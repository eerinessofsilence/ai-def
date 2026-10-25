from django.core.cache import cache
from django.test import TestCase

from main.arms_models import ArmsProduct
from users.models import User

from .models import WorkspaceAccess


class AccountAndOrderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="cms-manager@example.invalid", password="Example-manager-password-927!", is_staff=True)
        WorkspaceAccess.objects.create(user=self.user, site="arms", role="manager")
        self.client.force_login(self.user)

    def post(self, url, values):
        return self.client.post(url, values, content_type="application/json")

    def test_site_manager_can_create_editor_without_granting_access_to_other_site(self):
        response = self.post("/api/cms/arms/members/", {"email": "new-editor@example.invalid", "name": "Editor", "password": "Example-new-editor-password-812!", "role": "editor"})
        self.assertEqual(response.status_code, 200, response.content)
        user = User.objects.get(email="new-editor@example.invalid")
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("Example-new-editor-password-812!"))
        self.assertEqual(list(user.cms_access.values_list("site", flat=True)), ["arms"])
        self.client.force_login(user)
        self.assertEqual(self.client.get("/api/cms/arms/members/").status_code, 403)

    def test_password_change_validates_current_password_and_keeps_session(self):
        url = "/api/cms/arms/password/"
        self.assertEqual(self.post(url, {"current_password": "wrong", "new_password": "Example-new-password-199!"}).status_code, 422)
        response = self.post(url, {"current_password": "Example-manager-password-927!", "new_password": "Example-new-password-199!"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(self.client.get("/api/cms/session/").json()["authenticated"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Example-new-password-199!"))

    def test_reordering_normalizes_equal_positions_and_requires_publishing_rights(self):
        first = ArmsProduct.objects.create(name="First", slug="order-first", order=1000)
        second = ArmsProduct.objects.create(name="Second", slug="order-second", order=1000)
        snapshot = self.client.get("/api/cms/arms/products/reorder/").json()
        identifiers = [item["id"] for item in snapshot["items"]]
        a, b = identifiers.index(first.pk), identifiers.index(second.pk)
        identifiers[a], identifiers[b] = identifiers[b], identifiers[a]
        response = self.post("/api/cms/arms/products/reorder/", {"version": snapshot["version"], "ids": identifiers})
        self.assertEqual(response.status_code, 200)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertLess(second.order, first.order)
        self.user.cms_access.update(role="editor")
        self.assertEqual(self.post("/api/cms/arms/products/reorder/", {"version": response.json()["version"], "ids": identifiers}).status_code, 403)

    def test_failed_login_is_throttled(self):
        self.client.logout()
        cache.clear()
        for _ in range(10):
            self.assertEqual(self.post("/api/cms/session/", {"email": "login-check@example.invalid", "password": "wrong"}).status_code, 401)
        self.assertEqual(self.post("/api/cms/session/", {"email": "login-check@example.invalid", "password": "wrong"}).status_code, 429)
        cache.clear()

    def test_login_accepts_email_with_different_letter_case(self):
        self.client.logout()
        response = self.post("/api/cms/session/", {"email": "CMS-MANAGER@EXAMPLE.INVALID", "password": "Example-manager-password-927!"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["authenticated"])
