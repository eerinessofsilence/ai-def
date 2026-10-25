import copy
import io
import tempfile
from uuid import uuid4

from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from main.arms_models import ArmsImage, ArmsProduct, ArmsVariant
from users.models import User

from .arms import empty, live_fingerprint, snapshot
from .models import Document, MediaAsset, Revision, WorkspaceAccess


class CMSWorkflowTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media = tempfile.TemporaryDirectory()
        cls.settings_override = override_settings(MEDIA_ROOT=cls.media.name)
        cls.settings_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.settings_override.disable()
        cls.media.cleanup()
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user(email="cms-test@example.invalid", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)
        self.product = ArmsProduct.objects.create(name="Original", slug="cms-original", available=True,
                                                  category="pistols", legacy_image="/existing-cover.webp",
                                                  content={"en": {"description": "Published description", "specifications": []}})
        self.variant = ArmsVariant.objects.create(product=self.product, code="standard", content={"en": {"label": "Standard", "specifications": []}})
        ArmsImage.objects.create(variant=self.variant, legacy_path="/existing-image.webp")
        self.opened = self.post("/api/cms/arms/products/", {"target_id": self.product.pk}).json()
        self.url = f"/api/cms/arms/documents/{self.opened['id']}/"

    def post(self, url, data):
        return self.client.post(url, data, content_type="application/json")

    def save(self, data, version=None):
        return self.client.put(self.url, {"version": version or self.opened["version"], "data": data}, content_type="application/json")

    def test_draft_is_separate_from_public_content_and_explicit_publish_updates_it(self):
        data = copy.deepcopy(self.opened["data"])
        data["name"] = "Unpublished name"
        saved = self.save(data)
        self.assertEqual(saved.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, "Original")
        public = self.client.get("/api/arms/products/").json()
        self.assertEqual(next(row for row in public if row["id"] == self.product.slug)["name"], "Original")
        published = self.post(self.url + "publish/", {"version": saved.json()["version"]})
        self.assertEqual(published.status_code, 200, published.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, "Unpublished name")
        self.assertEqual(published.json()["status"], "published")

    def test_list_includes_existing_products_without_a_cms_document(self):
        Document.objects.filter(pk=self.opened["id"]).delete()
        response = self.client.get("/api/cms/arms/products/")
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.json()["items"] if item["target_id"] == self.product.pk)
        self.assertIsNone(row["document_id"])
        self.assertEqual(row["status"], "published")

    def test_cms_interface_uses_english_independently_of_content_language(self):
        from .content import ContentAdapter
        from django.utils import translation

        with translation.override("ru"):
            response = self.client.get("/api/cms/arms/documents/00000000-0000-0000-0000-000000000000/", HTTP_ACCEPT_LANGUAGE="ru")
            self.assertEqual(response.json()["error"], "Content not found.")
            for kind in ("products", "civil-products", "articles", "portal", "modules"):
                schema = ContentAdapter(kind).schema()
                self.assertNotRegex(str(schema), r"[А-Яа-яЁё]")
            title = next(field for field in ContentAdapter("articles").schema()["fields"] if field["key"] == "title")
            self.assertEqual(title["label"], "Title")

    def test_partial_arms_translation_falls_back_per_field_in_public_and_preview(self):
        self.product.content["de"] = {"description": "", "cover_alt": "Deutsches Titelbild"}
        self.product.save()
        self.variant.content["de"] = {"specifications": [{"label": "Länge", "value": "100 mm"}]}
        self.variant.save()
        opened = self.post("/api/cms/arms/products/", {"target_id": self.product.pk}).json()
        public = next(row for row in self.client.get("/api/arms/products/?lang=de").json() if row["id"] == self.product.slug)
        preview = self.client.get(f"/api/cms/arms/documents/{opened['id']}/preview/?lang=de").json()
        for row in (public, preview):
            self.assertEqual(row["description"], "Published description")
            self.assertEqual(row["coverAlt"], "Deutsches Titelbild")
            self.assertEqual(row["variants"][0]["label"], "Standard")
            self.assertEqual(row["variants"][0]["specifications"][0]["label"], "Länge")

    def test_product_search_pagination_and_publication_filter(self):
        ArmsProduct.objects.bulk_create([ArmsProduct(name=f"Pagination fixture {index:02d}", slug=f"pagination-{index}", available=index % 2 == 0, category="pistols", order=index) for index in range(30)])
        response = self.client.get("/api/cms/arms/products/?q=Pagination%20fixture&page=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 30)
        self.assertEqual(len(response.json()["items"]), 5)
        published = self.client.get("/api/cms/arms/products/?q=Pagination%20fixture&state=published")
        self.assertEqual(published.json()["total"], 15)
        self.assertTrue(all(row["status"] == "published" for row in published.json()["items"]))

    def test_stale_save_cannot_overwrite_someone_elses_draft(self):
        data = copy.deepcopy(self.opened["data"])
        data["name"] = "First editor"
        self.assertEqual(self.save(data).status_code, 200)
        data["name"] = "Second editor"
        self.assertEqual(self.save(data).status_code, 409)
        self.assertEqual(Document.objects.get(pk=self.opened["id"]).data["name"], "First editor")

    def test_external_change_blocks_publish_without_losing_draft(self):
        ArmsProduct.objects.filter(pk=self.product.pk).update(name="Changed outside CMS")
        response = self.post(self.url + "publish/", {"version": self.opened["version"]})
        self.assertEqual(response.status_code, 409)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, "Changed outside CMS")
        self.assertEqual(Document.objects.get(pk=self.opened["id"]).data["name"], "Original")

    def test_new_product_variants_and_images_publish_in_one_operation(self):
        image = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(image, "WEBP")
        asset = MediaAsset(site="arms", original_name="test.webp", uploaded_by=self.user, width=8, height=8)
        asset.file.save("test.webp", ContentFile(image.getvalue()))
        ref = {"asset_id": str(asset.pk)}
        created = self.post("/api/cms/arms/products/", {}).json()
        data = empty()
        data.update(name="New product", cover=ref, content={"en": {"description": "Description", "specifications": []}},
                    variants=[{"id": str(uuid4()), "code": "first", "model_name": "", "content": {"en": {"label": "First", "specifications": []}},
                               "images": [{"id": str(uuid4()), "media": ref}]}])
        url = f"/api/cms/arms/documents/{created['id']}/"
        saved = self.client.put(url, {"version": created["version"], "data": data}, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        published = self.post(url + "publish/", {"version": saved.json()["version"]})
        self.assertEqual(published.status_code, 200, published.content)
        product = ArmsProduct.objects.get(pk=published.json()["target_id"])
        self.assertTrue(product.available)
        self.assertEqual(product.variants.get().images.get().image.name, asset.file.name)

    def test_incomplete_draft_can_save_but_not_publish(self):
        created = self.post("/api/cms/arms/products/", {}).json()
        response = self.post(f"/api/cms/arms/documents/{created['id']}/publish/", {"version": created["version"]})
        self.assertEqual(response.status_code, 422)
        self.assertIn("cover", response.json()["fields"])
        self.assertIsNone(Document.objects.get(pk=created["id"]).target_id)

    def test_workspace_and_publishing_permissions_are_enforced_on_server(self):
        editor = User.objects.create_user(email="cms-editor@example.invalid", is_staff=True)
        WorkspaceAccess.objects.create(user=editor, site="arms", role="editor")
        self.client.force_login(editor)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.post(self.url + "publish/", {"version": self.opened["version"]}).status_code, 403)
        self.assertEqual(self.client.get(self.url.replace("/arms/", "/ai-def/")).status_code, 403)

    def test_cross_site_assets_and_foreign_nested_records_are_rejected(self):
        other = MediaAsset.objects.create(site="ai-def", file="cms/foreign.webp", original_name="foreign.webp")
        data = copy.deepcopy(self.opened["data"])
        data["cover"] = {"asset_id": str(other.pk)}
        self.assertEqual(self.save(data).status_code, 422)
        data = copy.deepcopy(self.opened["data"])
        data["variants"][0]["id"] = 999999
        self.assertEqual(self.save(data).status_code, 422)

    def test_malformed_identifiers_return_validation_errors(self):
        data = copy.deepcopy(self.opened["data"])
        data["variants"][0]["id"] = []
        self.assertEqual(self.save(data).status_code, 422)

    def test_restoring_removed_variant_keeps_history_and_recreates_nested_records(self):
        doc = Document.objects.get(pk=self.opened["id"])
        Revision.objects.create(document=doc, version=doc.version, data=doc.data, action="opened") if not doc.revisions.exists() else None
        old_version = doc.version
        self.variant.delete()
        self.product.refresh_from_db()
        doc.data = snapshot(self.product)
        doc.published_data = copy.deepcopy(doc.data)
        doc.live_fingerprint = live_fingerprint(self.product)
        doc.version += 1
        doc.save()
        restored = self.post(self.url + "restore/", {"version": doc.version, "restore_version": old_version})
        self.assertEqual(restored.status_code, 200, restored.content)
        published = self.post(self.url + "publish/", {"version": restored.json()["version"]})
        self.assertEqual(published.status_code, 200, published.content)
        self.assertEqual(self.product.variants.get().images.get().legacy_path, "/existing-image.webp")

    def test_csrf_required_and_private_preview_never_cached(self):
        protected = Client(enforce_csrf_checks=True)
        protected.force_login(self.user)
        denied = protected.post("/api/cms/arms/products/", {}, content_type="application/json")
        self.assertEqual(denied.status_code, 403)
        preview = self.client.get(self.url + "preview/?lang=en")
        self.assertEqual(preview.status_code, 200)
        self.assertIn("no-store", preview["Cache-Control"])
        self.client.logout()
        self.assertEqual(self.client.get(self.url + "preview/").status_code, 401)

    def test_upload_rejects_disguised_non_image_files(self):
        response = self.client.post("/api/cms/arms/uploads/", {"file": SimpleUploadedFile("image.jpg", b"not an image", content_type="image/jpeg")})
        self.assertEqual(response.status_code, 422)
