from django.test import TestCase

from main.models import BlogPost, BlogPostSection, Product, ProductFeature, ProductImage, ProductImageTranslation
from portal.models import PortalProduct, ProductCharacteristic, ProductCharacteristicsBlock
from users.models import User

from .content import sanitize
from .models import Document


class ContentWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="content@example.invalid", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)

    def post(self, path, data):
        return self.client.post(path, data, content_type="application/json")

    def open(self, kind, obj):
        response = self.post(f"/api/cms/ai-def/{kind}/", {"target_id": obj.pk})
        self.assertEqual(response.status_code, 200, response.content)
        doc = response.json()
        return doc, f"/api/cms/ai-def/documents/{doc['id']}/"

    def test_snapshot_round_trip_keeps_translations_and_nested_records(self):
        product = Product.objects.create(name_en="Original", name_de="Deutsch", available=True)
        feature = ProductFeature.objects.create(product=product, name_en="Range", value_en="10", description_de="Beschreibung")
        image = ProductImage.objects.create(product=product, image="existing.webp")
        ProductImageTranslation.objects.filter(image=image, lang="de").update(alt="Deutsches Bild")
        doc, url = self.open("products", product)
        doc["data"]["fields"]["description"]["en"] = "Draft description"
        saved = self.client.put(url, {"version": doc["version"], "data": doc["data"]}, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        product.refresh_from_db()
        self.assertNotEqual(product.description_en, "Draft description")
        published = self.post(url + "publish/", {"version": saved.json()["version"]})
        self.assertEqual(published.status_code, 200, published.content)
        product.refresh_from_db()
        feature.refresh_from_db()
        self.assertEqual(product.name_de, "Deutsch")
        self.assertEqual(feature.description_de, "Beschreibung")
        self.assertEqual(product.description_en, "Draft description")
        self.assertEqual(image.translations.get(lang="de").alt, "Deutsches Bild")

    def test_preview_uses_public_serializer_without_publishing_changes(self):
        product = Product.objects.create(name_en="Live", slug="preview-product", available=True)
        doc, url = self.open("products", product)
        data = doc["data"]
        data["fields"]["name"]["en"] = "Preview only"
        saved = self.client.put(url, {"version": doc["version"], "data": data}, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        response = self.client.get(url + "preview/?lang=en")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["name"], "Preview only")
        product.refresh_from_db()
        self.assertEqual(product.name_en, "Live")

    def test_legacy_article_sections_survive_editing(self):
        article = BlogPost.objects.create(title_en="Legacy", is_published=True)
        section = BlogPostSection.objects.create(post=article, title_en="Section", paragraphs_en=["Old text"])
        doc, url = self.open("articles", article)
        response = self.post(url + "publish/", {"version": doc["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        section.refresh_from_db()
        self.assertEqual(section.paragraphs_en, ["Old text"])
        preview = self.client.get(url + "preview/?lang=en")
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.json()["blocks"][0]["paragraphs"], ["Old text"])

    def test_portal_cannot_assign_characteristic_to_foreign_group(self):
        product = PortalProduct.objects.create(name_en="Portal")
        foreign = PortalProduct.objects.create(name_en="Other")
        group = ProductCharacteristicsBlock.objects.create(product=foreign, title_en="Other group", icon_lucide="Box")
        ProductCharacteristic.objects.create(product=product, name_en="Size", description_en="Large")
        doc, url = self.open("portal", product)
        doc["data"]["sections"]["characteristic"][0]["fields"]["block"] = group.pk
        response = self.client.put(url, {"version": doc["version"], "data": doc["data"]}, content_type="application/json")
        self.assertEqual(response.status_code, 422)

    def test_new_incomplete_product_draft_can_be_saved(self):
        created = self.post("/api/cms/ai-def/products/", {}).json()
        response = self.client.put(f"/api/cms/ai-def/documents/{created['id']}/", {"version": created["version"], "data": created["data"]}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(Document.objects.get(pk=created["id"]).target_id)

    def test_all_editor_schemas_can_be_loaded(self):
        for kind in ("products", "civil-products", "articles", "portal", "modules"):
            response = self.client.get(f"/api/cms/ai-def/schema/{kind}/")
            self.assertEqual(response.status_code, 200, response.content)
            self.assertTrue(response.json()["fields"])

    def test_portal_edit_keeps_shared_modules_and_group_membership(self):
        from portal.models import ProductModule, ProductModulePlacement
        first = PortalProduct.objects.create(name_en="First portal product")
        other = PortalProduct.objects.create(name_en="Other portal product")
        group = ProductCharacteristicsBlock.objects.create(product=first, title_en="Dimensions", icon_lucide="Box")
        ProductCharacteristic.objects.create(product=first, block=group, name_en="Width", description_en="10")
        ProductCharacteristic.objects.create(product=first, block=group, name_en="Height", description_en="20")
        shared = ProductModule.objects.create(name_en="Shared module", tag_en="Module")
        ProductModulePlacement.objects.create(product=first, module=shared)
        ProductModulePlacement.objects.create(product=other, module=shared)
        doc, url = self.open("portal", first)
        response = self.post(url + "publish/", {"version": doc["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(first.characteristic.filter(block=group).count(), 2)
        self.assertEqual(shared.placements.count(), 2)
        preview = self.client.get(url + "preview/?lang=en")
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.json()["modules"]["items"][0]["name"], "Shared module")
        self.assertEqual(shared.placements.count(), 2)

    def test_civil_page_blocks_keep_content_and_translations_after_publication(self):
        from main.models import CivilProduct, CivilProductFeatureBlock, CivilProductInfoBlock, CivilProductTechnology, CivilProductCTABlock, CivilProductDroneSliderMedia
        product = CivilProduct.objects.create(name_en="Civil product", name_fr="Produit civil")
        feature = CivilProductFeatureBlock.objects.create(product=product, name_en="Feature", title_en="Feature title", title_fr="Titre", with_logo=True)
        info = CivilProductInfoBlock.objects.create(product=product, title_1_en="First", title_2_en="Second", description_1=["One", "Two"], description_2=["Three"])
        technology = CivilProductTechnology.objects.create(product=product, name_en="Technology", tags=["AI"])
        cta = CivilProductCTABlock.objects.create(product=product, name_en="CTA", title_en="Contact", has_button=True)
        CivilProductDroneSliderMedia.objects.create(product=product, image="slider.webp", video="hover.mp4")
        doc, url = self.open("civil-products", product)
        response = self.post(url + "publish/", {"version": doc["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        feature.refresh_from_db()
        info.refresh_from_db()
        technology.refresh_from_db()
        cta.refresh_from_db()
        self.assertEqual(feature.title_fr, "Titre")
        self.assertEqual(info.description_1, ["One", "Two"])
        self.assertEqual(technology.tags, ["AI"])
        self.assertTrue(cta.has_button)
        self.assertEqual(product.drone_slider_media.video.name, "hover.mp4")

    def test_rich_text_removes_scripts_and_unsafe_links(self):
        html = sanitize('<p style="color:red">Text<script>alert(1)</script><a href="javascript:alert(1)">Link</a><strong>bold</strong></p>')
        self.assertEqual(html, '<p>Text<a>Link</a><strong>bold</strong></p>')

    def test_empty_image_translation_uses_english_alt_in_public_api(self):
        product = Product.objects.create(name_en="Alt fallback", available=True)
        image = ProductImage.objects.create(product=product, image="fallback.webp", alt="English image description")
        image.translations.filter(lang="de").update(alt="")
        response = self.client.get(f"/api/items/{product.slug}/?lang=de", HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["images"][0]["alt"], "English image description")

    def test_reference_translation_edit_is_versioned_and_keeps_other_languages(self):
        from main.models import Category
        category = Category.objects.create(name_en="Original category", name_de="Deutsche Kategorie")
        url = "/api/cms/ai-def/references/categories/"
        item = next(row for row in self.client.get(url).json()["items"] if row["id"] == category.pk)
        request = {"id": item["id"], "version": item["version"], "language": "fr", "name": "Catégorie française"}
        response = self.client.put(url, request, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        category.refresh_from_db()
        self.assertEqual(category.name_de, "Deutsche Kategorie")
        self.assertEqual(category.name_fr, "Catégorie française")
        self.assertEqual(self.client.put(url, request, content_type="application/json").status_code, 409)
