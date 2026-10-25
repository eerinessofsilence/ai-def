import copy

from django.test import TestCase

from main.arms_models import ArmsProduct
from main.models import Product, ProductFeature
from users.models import User
from .comparison import website_state
from .models import Document, Page, Revision, WorkspaceAccess
from .views import adapter


class WebsiteConflictTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="conflict-editor@example.invalid", is_staff=True)
        for site in ("ai-def", "arms"):
            WorkspaceAccess.objects.create(user=self.user, site=site, role="editor")
        self.client.force_login(self.user)
        self.product = Product.objects.create(name_en="Original", description_en="Website", available=True)
        response = self.post("/api/cms/ai-def/products/", {"target_id": self.product.pk})
        self.original = response.json()
        self.url = f"/api/cms/ai-def/documents/{self.original['id']}/"

    def post(self, url, value):
        return self.client.post(url, value, content_type="application/json")

    def draft(self):
        data = copy.deepcopy(self.original["data"])
        data["fields"]["description"]["en"] = "My saved draft"
        response = self.client.put(self.url, {"version": self.original["version"], "data": data}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_external_changes_can_be_loaded_without_losing_either_side_or_publishing(self):
        saved = self.draft()
        self.product.description_en = "Changed outside CMS"
        self.product.available = False
        self.product.save()
        feature = ProductFeature.objects.create(product=self.product, name_en="Range", value_en="20")
        before = list(Document.objects.values()), list(Revision.objects.values())
        response = self.post(self.url + "website/", {"version": saved["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        comparison = response.json()
        self.assertTrue(comparison["changed"])
        self.assertFalse(comparison["published"])
        self.assertEqual(comparison["before"]["fields"]["description"]["en"], "Changed outside CMS")
        self.assertEqual(comparison["after"]["fields"]["description"]["en"], "My saved draft")
        self.assertEqual((list(Document.objects.values()), list(Revision.objects.values())), before)
        refreshed = self.post(self.url + "refresh/", {"version": comparison["version"], "live_version": comparison["live_version"], "preserve_draft": True})
        self.assertEqual(refreshed.status_code, 200, refreshed.content)
        result = refreshed.json()
        self.assertEqual(result["data"], comparison["before"])
        self.assertEqual(result["version"], saved["version"] + 2)
        self.assertEqual(result["status"], "draft")
        document = Document.objects.get(pk=result["id"])
        self.assertFalse(document.dirty)
        self.assertIsNone(document.published_at)
        self.assertEqual(document.revisions.get(action="saved_copy").data, saved["data"])
        self.product.refresh_from_db()
        feature.refresh_from_db()
        self.assertEqual(self.product.description_en, "Changed outside CMS")
        self.assertFalse(self.product.available)
        self.assertEqual(feature.value_en, "20")
        # Restoring is a separate draft action and still leaves the website alone.
        restored = self.post(self.url + "restore/", {"version": result["version"], "restore_version": saved["version"] + 1})
        self.assertEqual(restored.status_code, 200, restored.content)
        self.assertEqual(restored.json()["data"]["fields"]["description"]["en"], "My saved draft")
        self.product.refresh_from_db()
        self.assertEqual(self.product.description_en, "Changed outside CMS")

    def test_stale_website_and_draft_versions_cannot_refresh_or_create_history_entries(self):
        saved = self.draft()
        comparison = self.post(self.url + "website/", {"version": saved["version"]}).json()
        ProductFeature.objects.create(product=self.product, name_en="Added externally", value_en="10")
        before = list(Document.objects.values()), list(Revision.objects.values())
        payload = {"version": saved["version"], "live_version": comparison["live_version"], "preserve_draft": True}
        self.assertEqual(self.post(self.url + "refresh/", payload).status_code, 409)
        self.assertEqual(self.post(self.url + "refresh/", {**payload, "live_version": None}).status_code, 409)
        self.assertEqual(self.post(self.url + "refresh/", {**payload, "version": 0}).status_code, 409)
        self.assertEqual(self.post(self.url + "refresh/", {"version": saved["version"]}).status_code, 409)
        self.assertEqual(self.post(self.url + "refresh/", {**payload, "preserve_draft": "yes"}).status_code, 422)
        self.assertEqual((list(Document.objects.values()), list(Revision.objects.values())), before)

    def test_snapshots_match_each_adapters_fingerprint_including_fixed_pages_and_arms(self):
        page = Page.objects.get(site="ai-def", slug="technology")
        arms = ArmsProduct.objects.create(name="QA", slug="qa-conflict", category="pistols", available=True)
        cases = [("ai-def", "products", self.product), ("ai-def", "pages", page), ("arms", "products", arms)]
        for site, kind, obj in cases:
            response = self.post(f"/api/cms/{site}/{kind}/", {"target_id": obj.pk})
            self.assertEqual(response.status_code, 200, response.content)
            document = Document.objects.get(pk=response.json()["id"])
            data, token, published = website_state(document)
            self.assertEqual(data, adapter(site, kind).snapshot(obj))
            self.assertEqual(token, adapter(site, kind).live_fingerprint(obj))
            self.assertTrue(published)
        doc = Document.objects.get(site="ai-def", kind="pages", target_id=page.pk)
        draft = copy.deepcopy(doc.data)
        draft["content"]["en"]["technology"]["hero"]["title"] = "Page draft"
        doc.data = draft
        doc.dirty = True
        doc.save()
        page.content["en"]["technology"]["hero"]["title"] = "External page"
        page.save()
        url = f"/api/cms/ai-def/documents/{doc.pk}/"
        comparison = self.post(url + "website/", {"version": doc.version}).json()
        refreshed = self.post(url + "refresh/", {"version": doc.version, "live_version": comparison["live_version"], "preserve_draft": True})
        self.assertEqual(refreshed.status_code, 200, refreshed.content)
        self.assertEqual(refreshed.json()["data"]["content"]["en"]["technology"]["hero"]["title"], "External page")
        self.assertEqual(doc.revisions.get(action="saved_copy").data, draft)

    def test_scope_version_permissions_and_new_draft_are_checked(self):
        self.assertEqual(self.post(self.url + "website/", {"version": 0}).status_code, 409)
        self.assertEqual(self.post(self.url.replace("ai-def", "arms") + "website/", {"version": 1}).status_code, 404)
        doc = Document.objects.get(pk=self.original["id"])
        doc.target_id = None
        doc.save()
        self.assertEqual(self.post(self.url + "website/", {"version": 1}).status_code, 422)
        self.assertEqual(self.post(self.url + "refresh/", {"version": 1}).status_code, 422)
        doc.kind = "portal"
        doc.save()
        self.assertEqual(self.post(self.url + "website/", {"version": 1}).status_code, 403)
        self.client.logout()
        self.assertEqual(self.post(self.url + "website/", {"version": 1}).status_code, 401)
