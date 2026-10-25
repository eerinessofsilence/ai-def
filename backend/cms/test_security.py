import io
from uuid import uuid4

from PIL import Image
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase

from users.models import User
from .models import Document, MediaAsset, WorkspaceAccess


class CMSSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email="security@example.invalid", password="Example-security-password-643!", is_staff=True)
        WorkspaceAccess.objects.create(user=self.user, site="ai-def", role="manager")
        self.client.force_login(self.user)

    def send(self, method, path, data):
        return getattr(self.client, method)(path, data, content_type="application/json")

    def test_every_mutation_requires_csrf_even_for_an_authenticated_manager(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        identifier = uuid4()
        routes = [
            ("post", "session/"), ("delete", "session/"),
            *[("post", f"ai-def/{kind}/") for kind in ("products", "civil-products", "articles", "pages", "portal", "modules")],
            ("post", "arms/products/"), ("post", "ai-def/uploads/"),
            ("post", "ai-def/references/categories/"), ("put", "ai-def/references/categories/"),
            ("post", "ai-def/members/"), ("put", "ai-def/members/"), ("delete", "ai-def/members/"),
            ("post", "ai-def/password/"), ("post", "ai-def/products/reorder/"),
            ("patch", f"ai-def/assets/{identifier}/"), ("put", "ai-def/inquiries/1/"),
            ("put", f"ai-def/documents/{identifier}/"),
            *[("post", f"ai-def/documents/{identifier}/{action}/") for action in ("publish", "unpublish", "restore", "duplicate", "refresh", "stash", "review", "website", "translations")],
        ]
        for method, path in routes:
            with self.subTest(method=method, path=path):
                self.assertEqual(getattr(client, method)("/api/cms/" + path, {}, content_type="application/json").status_code, 403)
        token = client.get("/api/cms/session/").json()["csrf"]
        self.assertEqual(client.delete("/api/cms/session/", HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertFalse(client.get("/api/cms/session/").json()["authenticated"])

    def test_anonymous_cannot_read_private_cms_collections(self):
        self.client.logout()
        for path in ("products/", "articles/", "pages/", "assets/", "inquiries/", "members/", "schema/products/", "products/reorder/"):
            with self.subTest(path=path):
                response = self.client.get("/api/cms/ai-def/" + path)
                self.assertEqual(response.status_code, 401)
                self.assertIn("no-store", response["Cache-Control"])

    def test_site_grant_and_portal_permission_are_checked_on_each_request(self):
        self.assertEqual(self.client.get("/api/cms/arms/products/").status_code, 403)
        self.assertEqual(self.client.get("/api/cms/ai-def/portal/").status_code, 403)
        self.user.user_permissions.add(Permission.objects.get(codename="change_portalproduct", content_type__app_label="portal"))
        self.assertEqual(self.client.get("/api/cms/ai-def/portal/").status_code, 200)
        self.user.cms_access.all().delete()
        self.assertEqual(self.client.get("/api/cms/ai-def/products/").status_code, 403)
        self.assertEqual(self.client.get("/api/cms/session/").json()["sites"], [])

    def test_inactive_nonstaff_and_unassigned_accounts_cannot_sign_in(self):
        self.client.logout()
        for active, staff, assigned, expected in ((False, True, True, 401), (True, False, True, 401), (True, True, False, 403)):
            with self.subTest(active=active, staff=staff, assigned=assigned):
                self.user.is_active, self.user.is_staff = active, staff
                self.user.save()
                if not assigned:
                    self.user.cms_access.all().delete()
                response = self.send("post", "/api/cms/session/", {"email": self.user.email, "password": "Example-security-password-643!"})
                self.assertEqual(response.status_code, expected)
                self.assertFalse(self.client.get("/api/cms/session/").json()["authenticated"])

    def test_json_boundary_rejects_malformed_and_oversized_input_without_creating_a_draft(self):
        url = "/api/cms/ai-def/products/"
        before = Document.objects.count()
        for raw, content_type, expected in (("{", "application/json", 400), ("[]", "application/json", 400), ('"text"', "application/json", 400), ("{}", "text/plain", 415), ('{"name":"' + "x" * (2 * 1024 * 1024) + '"}', "application/json", 413)):
            with self.subTest(content_type=content_type, expected=expected):
                response = self.client.post(url, raw, content_type=content_type)
                self.assertEqual(response.status_code, expected, response.content)
        self.assertEqual(Document.objects.count(), before)

    def test_wrong_method_has_explicit_allow_header_and_unknown_site_is_not_found(self):
        response = self.client.delete("/api/cms/ai-def/products/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response["Allow"], "GET, POST")
        self.assertEqual(self.client.get("/api/cms/unknown/products/").status_code, 404)

    def test_bad_member_details_do_not_create_users_or_grants(self):
        before = (User.objects.count(), WorkspaceAccess.objects.count())
        for values in ({"email": "invalid", "password": "Example-secure-member-password-729!"}, {"email": "new@example.invalid", "password": "123"}, {"email": "new@example.invalid", "password": "Example-secure-member-password-729!", "role": "superuser"}, {"email": [], "password": "Example-secure-member-password-729!"}):
            with self.subTest(values=values):
                self.assertEqual(self.send("post", "/api/cms/ai-def/members/", values).status_code, 422)
                self.assertEqual((User.objects.count(), WorkspaceAccess.objects.count()), before)

    def test_adding_existing_member_never_resets_password_or_escalates_existing_role(self):
        member = User.objects.create_user(email="existing@example.invalid", password="Existing-password-143!", is_staff=True)
        grant = WorkspaceAccess.objects.create(user=member, site="ai-def", role="editor")
        WorkspaceAccess.objects.create(user=member, site="arms", role="publisher")
        response = self.send("post", "/api/cms/ai-def/members/", {"email": "EXISTING@EXAMPLE.INVALID", "role": "manager", "password": "Replacement-password-635!"})
        self.assertEqual(response.status_code, 200)
        member.refresh_from_db()
        grant.refresh_from_db()
        self.assertTrue(member.check_password("Existing-password-143!"))
        self.assertFalse(member.is_superuser)
        self.assertEqual(grant.role, "editor")
        self.assertEqual(member.cms_access.get(site="arms").role, "publisher")

    def test_manager_cannot_remove_or_change_own_access(self):
        for method in ("put", "delete"):
            self.assertEqual(self.send(method, "/api/cms/ai-def/members/", {"user_id": self.user.pk, "role": "editor"}).status_code, 422)
        self.assertEqual(self.user.cms_access.get().role, "manager")

    def test_removing_member_access_preserves_account_and_other_site(self):
        member = User.objects.create_user(email="shared@example.invalid", is_staff=True)
        for site in ("ai-def", "arms"):
            WorkspaceAccess.objects.create(user=member, site=site)
        self.assertEqual(self.send("delete", "/api/cms/ai-def/members/", {"user_id": member.pk}).status_code, 200)
        self.assertTrue(User.objects.filter(pk=member.pk).exists())
        self.assertEqual(list(member.cms_access.values_list("site", flat=True)), ["arms"])

    def test_weak_password_change_preserves_original_password_and_session(self):
        response = self.send("post", "/api/cms/ai-def/password/", {"current_password": "Example-security-password-643!", "new_password": "123"})
        self.assertEqual(response.status_code, 422)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Example-security-password-643!"))
        self.assertTrue(self.client.get("/api/cms/session/").json()["authenticated"])

    def test_public_auth_token_is_revoked_on_logout_and_does_not_replace_cms_session(self):
        client = Client()
        response = client.post("/api/auth/login/", {"email": self.user.email, "password": "Example-security-password-643!"}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        token = response.json()["token"]
        self.assertNotIn("password", response.json()["user"])
        headers = {"HTTP_AUTHORIZATION": "Token " + token}
        self.assertEqual(client.get("/api/auth/me/", **headers).json()["email"], self.user.email)
        self.assertFalse(client.get("/api/cms/session/", **headers).json()["authenticated"])
        self.assertEqual(client.post("/api/auth/logout/", **headers).status_code, 204)
        self.assertEqual(client.get("/api/auth/me/", **headers).status_code, 401)

    def test_supported_image_uploads_preserve_dimensions_alpha_and_site_ownership(self):
        for format, extension in (("JPEG", "jpg"), ("PNG", "png"), ("WEBP", "webp")):
            with self.subTest(format=format):
                buffer = io.BytesIO()
                source = Image.new("RGB" if format == "JPEG" else "RGBA", (24, 16), "navy" if format == "JPEG" else (0, 0, 128, 0))
                source.save(buffer, format=format)
                response = self.client.post("/api/cms/ai-def/uploads/", {"file": SimpleUploadedFile("photo." + extension, buffer.getvalue()), "kind": "image"})
                self.assertEqual(response.status_code, 201, response.content)
                asset = MediaAsset.objects.get(pk=response.json()["ref"]["asset_id"])
                self.assertEqual((asset.site, asset.width, asset.height, asset.uploaded_by_id), ("ai-def", 24, 16, self.user.pk))
                with asset.file.open("rb") as file, Image.open(file) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(image.size, (24, 16))
                    if format != "JPEG":
                        self.assertEqual(image.getpixel((0, 0))[3], 0)

    def test_jpeg_upload_applies_exif_orientation_before_recording_dimensions(self):
        buffer = io.BytesIO()
        source = Image.new("RGB", (24, 16), "navy")
        exif = source.getexif()
        exif[274] = 6
        source.save(buffer, format="JPEG", exif=exif)
        response = self.client.post("/api/cms/ai-def/uploads/", {"file": SimpleUploadedFile("rotated.jpg", buffer.getvalue()), "kind": "image"})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual((response.json()["width"], response.json()["height"]), (16, 24))
        asset = MediaAsset.objects.get(pk=response.json()["ref"]["asset_id"])
        with asset.file.open("rb") as file, Image.open(file) as image:
            self.assertEqual(image.size, (16, 24))
            self.assertIsNone(image.getexif().get(274))

    def test_truncated_image_with_valid_header_cannot_create_an_asset(self):
        buffer = io.BytesIO()
        Image.new("RGB", (24, 16), "navy").save(buffer, format="PNG")
        response = self.client.post("/api/cms/ai-def/uploads/", {"file": SimpleUploadedFile("truncated.png", buffer.getvalue()[:40]), "kind": "image"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_document_and_video_uploads_reject_spoofed_signatures_without_rows(self):
        for kind, name, payload in (("document", "guide.pdf", b"<script>bad</script>"), ("video", "clip.mp4", b"not a video"), ("image", "image.svg", b"<svg></svg>"), ("unsupported", "file.bin", b"file")):
            with self.subTest(kind=kind):
                self.assertEqual(self.client.post("/api/cms/ai-def/uploads/", {"kind": kind, "file": SimpleUploadedFile(name, payload)}).status_code, 422)
        self.assertEqual(MediaAsset.objects.count(), 0)
