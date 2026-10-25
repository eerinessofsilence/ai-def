from django.test import TestCase

from users.models import User
from .models import Document, MediaAsset, Page, Revision, WorkspaceAccess


class AssetLibraryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="asset-editor@example.invalid", is_staff=True)
        WorkspaceAccess.objects.create(user=self.user, site="arms", role="editor")
        self.client.force_login(self.user)
        MediaAsset.objects.create(site="ai-def", file="cms/private.webp", original_name="Other site")
        MediaAsset.objects.create(site="arms", file="cms/cover.webp", original_name="Cover.JPG", width=120, height=80)
        MediaAsset.objects.create(site="arms", file="cms/manual.pdf", original_name="Manual.pdf")
        MediaAsset.objects.create(site="arms", file="cms/movie.webm", original_name="Movie.webm")

    def test_scope_permissions_and_private_cache(self):
        response = self.client.get("/api/cms/arms/assets/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 3)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(self.client.get("/api/cms/ai-def/assets/").status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get("/api/cms/arms/assets/").status_code, 401)

    def test_search_type_and_missing_storage_metadata(self):
        response = self.client.get("/api/cms/arms/assets/?q=cover&kind=image").json()
        self.assertEqual(response["total"], 1)
        asset = response["items"][0]
        self.assertEqual(asset["name"], "Cover.JPG")
        self.assertEqual(asset["kind"], "image")
        self.assertEqual(asset["width"], 120)
        self.assertIsNone(asset["size_bytes"])
        self.assertIn("asset_id", asset["ref"])
        self.assertNotIn("uploaded_by", asset)
        for kind in ("video", "document"):
            self.assertEqual(self.client.get(f"/api/cms/arms/assets/?kind={kind}").json()["total"], 1)
        self.assertEqual(self.client.get("/api/cms/arms/assets/?kind=folder").status_code, 422)

    def test_stable_pagination_and_invalid_page(self):
        MediaAsset.objects.bulk_create([
            MediaAsset(site="arms", file=f"cms/{index}.webp", original_name=f"Page {index}")
            for index in range(30)
        ])
        first = self.client.get("/api/cms/arms/assets/?q=Page").json()
        second = self.client.get("/api/cms/arms/assets/?q=Page&page=2").json()
        self.assertEqual(len(first["items"]), 25)
        self.assertEqual(len(second["items"]), 5)
        identifiers = [row["ref"]["asset_id"] for row in first["items"] + second["items"]]
        self.assertEqual(len(set(identifiers)), 30)
        self.assertEqual(self.client.get("/api/cms/arms/assets/?page=invalid").json()["page"], 1)
        self.assertEqual(self.client.get("/api/cms/arms/assets/?page=999").json()["page"], 2)

    def test_name_edit_preserves_file_and_provenance_and_rejects_stale_writes(self):
        asset = MediaAsset.objects.get(original_name="Cover.JPG")
        url = f"/api/cms/arms/assets/{asset.pk}/"
        current = self.client.get(url).json()
        response = self.client.patch(url, {"version": current["version"], "display_name": "  Product front view  "}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["name"], "Product front view")
        asset.refresh_from_db()
        self.assertEqual(asset.original_name, "Cover.JPG")
        self.assertEqual(asset.file.name, "cms/cover.webp")
        self.assertEqual(self.client.get("/api/cms/arms/assets/?q=front").json()["total"], 1)
        self.assertEqual(self.client.get("/api/cms/arms/assets/?q=Cover.JPG").json()["total"], 1)
        self.assertEqual(self.client.patch(url, {"version": current["version"], "display_name": "Stale"}, content_type="application/json").status_code, 409)
        latest = response.json()["version"]
        self.assertEqual(self.client.patch(url, {"version": latest, "display_name": "Name", "source_url": "/forged.webp"}, content_type="application/json").status_code, 422)
        self.assertEqual(self.client.patch(url, {"version": latest, "display_name": "x" * 256}, content_type="application/json").status_code, 422)
        self.assertEqual(self.client.get(f"/api/cms/ai-def/assets/{asset.pk}/").status_code, 403)
        other = MediaAsset.objects.get(site="ai-def")
        self.assertEqual(self.client.get(f"/api/cms/arms/assets/{other.pk}/").status_code, 404)

    def test_usage_resolves_live_draft_history_and_legacy_without_double_counting(self):
        from main.arms_models import ArmsImage, ArmsProduct, ArmsVariant
        asset = MediaAsset.objects.get(original_name="Cover.JPG")
        asset.source_url = "/real-cover.webp"
        asset.save(update_fields=["source_url"])
        product = ArmsProduct.objects.create(name="Real catalogue product", slug="catalogue", category="pistols", legacy_image=asset.source_url, available=True)
        variant = ArmsVariant.objects.create(product=product, code="a", content={"en": {"label": "Standard"}})
        ArmsImage.objects.create(variant=variant, image=asset.file.name)
        document = Document.objects.create(site="arms", kind="products", target_id=product.pk, data={"name": product.name, "cover": {"asset_id": str(asset.pk)}}, published_data={})
        Revision.objects.create(document=document, version=1, data=document.data, action="saved")
        listed = self.client.get("/api/cms/arms/assets/?q=Real catalogue").json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["usage_count"], 1)
        detail = self.client.get(f"/api/cms/arms/assets/{asset.pk}/").json()
        self.assertEqual({item["state"] for item in detail["usages"]}, {"published", "draft", "history"})
        live = next(item for item in detail["usages"] if item["state"] == "published")
        self.assertEqual(live["id"], str(document.pk))
        self.assertEqual(set(live["locations"]), {"Cover", "Standard"})
        document.data = {"name": product.name}
        document.dirty = False
        document.save(update_fields=["data", "dirty"])
        product.legacy_image = ""
        product.save(update_fields=["legacy_image"])
        ArmsImage.objects.all().delete()
        detail = self.client.get(f"/api/cms/arms/assets/{asset.pk}/").json()
        self.assertEqual(detail["usage_count"], 0)
        self.assertEqual([item["state"] for item in detail["usages"]], ["history"])

    def test_content_placements_include_nested_images_pages_and_exclude_private_portal(self):
        from main.models import Product, ProductImage
        from portal.models import PortalProduct, ProductImage as PortalImage
        WorkspaceAccess.objects.create(user=self.user, site="ai-def", role="editor")
        asset = MediaAsset.objects.get(site="ai-def")
        product = Product.objects.create(name_en="AV catalogue", available=True)
        ProductImage.objects.create(product=product, image=asset.file.name)
        private = PortalProduct.objects.create(name_en="Private portal title")
        PortalImage.objects.create(product=private, image=asset.file.name)
        page = Page.objects.get(site="ai-def", slug="home")
        page.assets = {"hero": {"asset_id": str(asset.pk)}}
        page.save(update_fields=["assets"])
        private_doc = Document.objects.create(site="ai-def", kind="portal", data={"name": "Hidden draft", "image": {"asset_id": str(asset.pk)}})
        Revision.objects.create(document=private_doc, version=1, data=private_doc.data, action="saved")
        detail = self.client.get(f"/api/cms/ai-def/assets/{asset.pk}/").json()
        self.assertEqual(detail["usage_count"], 2)
        self.assertEqual({entry["kind"] for entry in detail["usages"]}, {"products", "pages"})
        self.assertEqual(self.client.get("/api/cms/ai-def/assets/?q=AV catalogue").json()["total"], 1)
        self.assertEqual(self.client.get("/api/cms/ai-def/assets/?q=Private portal title").json()["total"], 0)
        self.assertNotIn("Private portal title", str(detail))
        self.assertNotIn("Hidden draft", str(detail))

    def test_shared_module_images_are_discoverable_through_products_that_use_the_module(self):
        from portal.models import PortalProduct, ProductModule, ProductModuleImage, ProductModulePlacement
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        asset = MediaAsset.objects.get(site="ai-def")
        module = ProductModule.objects.create(name_en="Shared navigation module", tag_en="Navigation")
        ProductModuleImage.objects.create(module=module, image=asset.file.name)
        for name in ("Portal aircraft A", "Portal aircraft B"):
            product = PortalProduct.objects.create(name_en=name)
            ProductModulePlacement.objects.create(product=product, module=module)
        found = self.client.get("/api/cms/ai-def/assets/?q=Portal aircraft A").json()
        self.assertEqual(found["total"], 1)
        self.assertEqual(found["items"][0]["usage_count"], 3)
        detail = self.client.get(f"/api/cms/ai-def/assets/{asset.pk}/").json()
        self.assertEqual({item["name"] for item in detail["usages"]}, {"Shared navigation module", "Portal aircraft A", "Portal aircraft B"})
