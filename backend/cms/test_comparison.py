import copy

from django.test import TestCase

from main.models import Category, Product, ProductImage
from users.models import User
from .comparison import reference_labels
from .content import ContentAdapter
from .models import Document, MediaAsset, Revision, WorkspaceAccess


class HistoryComparisonTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="history-editor@example.invalid", is_staff=True)
        for site in ("ai-def", "arms"):
            WorkspaceAccess.objects.create(user=self.user, site=site, role="editor")
        self.client.force_login(self.user)
        self.category = Category.objects.create(name_en="Aircraft")
        self.other = Category.objects.create(name_en="Ground systems")
        self.product = Product.objects.create(name_en="Original", description_en="Website description", category=self.category)
        ProductImage.objects.create(product=self.product, image="products/original.webp")
        opened = self.client.post("/api/cms/ai-def/products/", {"target_id": self.product.pk}, content_type="application/json")
        self.assertEqual(opened.status_code, 200)
        self.original = opened.json()
        self.url = f"/api/cms/ai-def/documents/{self.original['id']}/"

    def test_compare_returns_both_snapshots_media_and_names_without_writing(self):
        asset = MediaAsset.objects.create(site="ai-def", file="cms/replacement.webp", original_name="Replacement")
        data = copy.deepcopy(self.original["data"])
        data["fields"]["description"]["en"] = "Saved draft description"
        data["fields"]["category"] = self.other.pk
        data["sections"]["images"][0]["fields"]["image"] = {"asset_id": str(asset.pk)}
        saved = self.client.put(self.url, {"version": self.original["version"], "data": data}, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        before = list(Document.objects.values()), list(Revision.objects.values()), list(Product.objects.values())
        response = self.client.get(self.url + f"history/1/?current={saved.json()['version']}")
        self.assertEqual(response.status_code, 200, response.content)
        value = response.json()
        self.assertEqual(value["before"], self.original["data"])
        self.assertEqual(value["after"], saved.json()["data"])
        self.assertEqual(value["reference_labels"]["fields.category"], {str(self.category.pk): "Aircraft", str(self.other.pk): "Ground systems"})
        self.assertIn("stored:products/original.webp", value["media"])
        self.assertIn(str(asset.pk), value["media"])
        self.assertEqual((list(Document.objects.values()), list(Revision.objects.values()), list(Product.objects.values())), before)
        self.assertIn("no-store", response["Cache-Control"])

    def test_comparison_requires_current_version_and_scopes_the_revision_to_the_document(self):
        self.assertEqual(self.client.get(self.url + "history/1/").status_code, 422)
        self.assertEqual(self.client.get(self.url + "history/1/?current=0").status_code, 409)
        self.assertEqual(self.client.get(self.url + "history/999/?current=1").status_code, 404)
        identifier = self.original["id"]
        self.assertEqual(self.client.get(f"/api/cms/arms/documents/{identifier}/history/1/?current=1").status_code, 404)
        document = Document.objects.get(pk=identifier)
        document.kind = "portal"
        document.save(update_fields=["kind"])
        self.assertEqual(self.client.get(self.url + "history/1/?current=1").status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url + "history/1/?current=1").status_code, 401)

    def test_reference_names_include_unsaved_groups_and_explicitly_identify_missing_entries(self):
        backend = ContentAdapter("portal")
        data = backend.empty()
        group = backend.empty(backend.definition["relations"]["characteristics_blocks"], backend.model)
        group["fields"]["title"]["en"] = "Dimensions"
        item = backend.empty(backend.definition["relations"]["characteristic"], backend.model)
        item["fields"]["block"] = group["id"]
        data["sections"]["characteristics_blocks"] = [group]
        data["sections"]["characteristic"] = [item]
        labels = reference_labels("portal", data)
        self.assertEqual(labels["sections.characteristic.fields.block"][str(group["id"])], "Dimensions")
        data = copy.deepcopy(self.original["data"])
        data["fields"]["category"] = 987654
        self.assertEqual(reference_labels("products", data)["fields.category"]["987654"], "Unavailable entry · ID 987654")
