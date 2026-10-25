import copy

from django.test import SimpleTestCase, TestCase

from main.models import Product, ProductFeature
from portal.models import PortalProduct, ProductModule, ProductModulePlacement
from users.models import User

from .models import Document, Revision, WorkspaceAccess
from .preview_fields import preview_fields


class PreviewFieldTests(SimpleTestCase):
    def test_inspection_uses_selected_language_and_omits_ambiguous_values(self):
        fields = preview_fields({"fields": {"name": {"en": "Unique title", "de": ""}, "first": {"en": "Repeated"}, "second": {"en": "Repeated"}, "html": {"en": "<p>First paragraph</p><p>Second paragraph</p>"}}}, "de", {})
        by_text = {item["value"]: item["path"] for item in fields}
        self.assertEqual(by_text["Unique title"], "fields.name.de")
        self.assertEqual(by_text["Second paragraph"], "fields.html.de")
        self.assertNotIn("Repeated", by_text)

    def test_image_mapping_resolves_real_urls_without_exposing_asset_ids_as_copy(self):
        result = preview_fields({"cover": {"asset_id": "file-id"}, "slug": "unique-product"}, "en", {"file-id": "https://example.invalid/photo.jpg"})
        self.assertIn({"path": "cover", "value": "https://example.invalid/photo.jpg", "kind": "image"}, result)
        self.assertFalse(any(item["value"] == "file-id" for item in result))


class PublicationReviewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="review@example.invalid", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)

    def post(self, url, payload):
        return self.client.post(url, payload, content_type="application/json")

    def open(self, kind, obj):
        response = self.post(f"/api/cms/ai-def/{kind}/", {"target_id": obj.pk})
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        return data, f"/api/cms/ai-def/documents/{data['id']}/"

    def test_review_compares_live_content_and_rolls_back_all_related_writes(self):
        product = Product.objects.create(name_en="Live", description_en="Before", available=True)
        feature = ProductFeature.objects.create(product=product, name_en="Range", value_en="10")
        document, url = self.open("products", product)
        document["data"]["fields"]["description"]["en"] = "After"
        document["data"]["sections"]["features"][0]["fields"]["value"]["en"] = "20"
        saved = self.client.put(url, {"version": document["version"], "data": document["data"]}, content_type="application/json").json()
        before = copy.deepcopy(Document.objects.get(pk=document["id"]).__dict__)
        revisions = Revision.objects.count()
        response = self.post(url + "review/", {"version": saved["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        result = response.json()
        self.assertTrue(result["ready"], result)
        self.assertEqual(result["before"]["fields"]["description"]["en"], "Before")
        self.assertEqual(result["after"]["fields"]["description"]["en"], "After")
        product.refresh_from_db()
        feature.refresh_from_db()
        self.assertEqual(product.description_en, "Before")
        self.assertEqual(feature.value_en, "10")
        self.assertEqual(Revision.objects.count(), revisions)
        after = Document.objects.get(pk=document["id"]).__dict__
        for key in ("data", "published_data", "version", "target_id", "dirty", "updated_at", "published_at", "live_fingerprint"):
            self.assertEqual(before[key], after[key], key)

    def test_incomplete_draft_reports_real_publication_errors_without_creating_product(self):
        document = self.post("/api/cms/ai-def/products/", {}).json()
        count = Product.objects.count()
        response = self.post(f"/api/cms/ai-def/documents/{document['id']}/review/", {"version": document["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(response.json()["ready"])
        self.assertTrue(response.json()["fields"])
        self.assertIsNone(response.json()["before"])
        self.assertEqual(Product.objects.count(), count)
        self.assertIsNone(Document.objects.get(pk=document["id"]).target_id)

    def test_review_and_publication_reject_stale_versions(self):
        product = Product.objects.create(name_en="Live", available=True)
        document, url = self.open("products", product)
        document["data"]["fields"]["description"]["en"] = "Newer draft"
        saved = self.client.put(url, {"version": document["version"], "data": document["data"]}, content_type="application/json").json()
        for action in ("review", "publish"):
            self.assertEqual(self.post(url + action + "/", {"version": document["version"]}).status_code, 409)
        self.assertEqual(self.post(url + "review/", {"version": saved["version"]}).status_code, 200)

    def test_review_rejects_changes_made_outside_cms(self):
        product = Product.objects.create(name_en="Live", available=True)
        document, url = self.open("products", product)
        Product.objects.filter(pk=product.pk).update(description_en="External change")
        self.assertEqual(self.post(url + "review/", {"version": document["version"]}).status_code, 409)

    def test_published_preview_ignores_unpublished_draft_and_inspection_is_opt_in(self):
        product = Product.objects.create(name_en="Live title", available=True)
        document, url = self.open("products", product)
        document["data"]["fields"]["name"]["en"] = "Draft title"
        self.client.put(url, {"version": document["version"], "data": document["data"]}, content_type="application/json")
        public = self.client.get(url + "preview/?published=1&lang=en").json()
        self.assertEqual(public["name"], "Live title")
        self.assertNotIn("_cms_fields", public)
        draft = self.client.get(url + "preview/?inspect=1&lang=en").json()
        self.assertEqual(draft["name"], "Draft title")
        self.assertEqual(draft["_cms_version"], Document.objects.get(pk=document["id"]).version)
        self.assertTrue(any(item["path"] == "fields.name.en" for item in draft["_cms_fields"]))

    def test_published_preview_cannot_mislabel_an_externally_unpublished_product(self):
        product = Product.objects.create(name_en="Live title", available=True)
        _, url = self.open("products", product)
        Product.objects.filter(pk=product.pk).update(available=False)
        self.assertEqual(self.client.get(url + "preview/?published=1").status_code, 422)

    def test_shared_module_review_lists_affected_products_and_obeys_portal_access(self):
        module = ProductModule.objects.create(name_en="Shared", tag_en="Module")
        product = PortalProduct.objects.create(name_en="Affected", available=True)
        ProductModulePlacement.objects.create(product=product, module=module)
        document, url = self.open("modules", module)
        response = self.post(url + "review/", {"version": document["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["affected"], [{"id": product.pk, "name": "Affected", "available": True}])
        editor = User.objects.create_user(email="editor@example.invalid", is_staff=True)
        WorkspaceAccess.objects.create(user=editor, site="ai-def")
        self.client.force_login(editor)
        self.assertEqual(self.post(url + "review/", {"version": document["version"]}).status_code, 403)

    def test_session_identifies_loopback_as_local(self):
        self.assertEqual(self.client.get("/api/cms/session/", HTTP_HOST="127.0.0.1").json()["environment"], "local")
