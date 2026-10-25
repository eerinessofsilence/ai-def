import copy
from uuid import uuid4

from django.test import TestCase

from users.models import User
from .content import ContentAdapter
from .models import Document, MediaAsset, Page, Revision, WorkspaceAccess


class TranslationReviewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="translation-editor@example.invalid", is_staff=True)
        for site in ("ai-def", "arms"):
            WorkspaceAccess.objects.create(user=self.user, site=site, role="editor")
        self.client.force_login(self.user)

    def post(self, url, data):
        return self.client.post(url, data, content_type="application/json")

    def save(self, document, data):
        response = self.client.put(f"/api/cms/{document['site']}/documents/{document['id']}/", {"version": document["version"], "data": data}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def article(self, blocks=1):
        created = self.post("/api/cms/ai-def/articles/", {"name": "Review source", "template": "article"}).json()
        data = copy.deepcopy(created["data"])
        data["fields"]["title"]["de"] = "Quelle"
        data["sections"]["blocks"][0]["fields"]["html"].update(en="<p>Original body</p>", de="<p>Übersetzung</p>")
        if blocks == 2:
            backend = ContentAdapter("articles")
            child = backend.empty(backend.definition["relations"]["blocks"], backend.model)
            child["fields"]["kind"] = "quote"
            child["fields"]["html"].update(en="<blockquote>Quote</blockquote>", de="<blockquote>Zitat</blockquote>")
            data["sections"]["blocks"].append(child)
        return self.save(created, data)

    def mark(self, document, language="de"):
        response = self.post(f"/api/cms/{document['site']}/documents/{document['id']}/translations/", {"version": document["version"], "language": language})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_filled_values_are_unreviewed_until_explicit_check_and_source_changes_are_specific(self):
        document = self.article()
        self.assertEqual(document["translation_review"]["de"]["unreviewed"], 2)
        checked = self.mark(document)
        self.assertEqual(checked["data"], document["data"])
        self.assertEqual(checked["status"], document["status"])
        self.assertEqual(checked["translation_review"]["de"]["reviewed"], 2)
        self.assertEqual(Revision.objects.get(document_id=document["id"], version=checked["version"]).action, "review_de")
        data = copy.deepcopy(checked["data"])
        data["fields"]["title"]["en"] = "Changed source"
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["source_changed"], 1)
        self.assertEqual(saved["translation_review"]["de"]["issues"], [{"path": "fields.title.de", "state": "source_changed"}])
        self.assertEqual(saved["translation_review"]["de"]["reviewed"], 1)
        reopened = self.client.get(f"/api/cms/ai-def/documents/{document['id']}/").json()
        self.assertEqual(reopened["translation_review"], saved["translation_review"])

    def test_translated_edits_and_missing_values_invalidate_the_check_without_blocking_fallback_publication(self):
        checked = self.mark(self.article())
        data = copy.deepcopy(checked["data"])
        data["sections"]["blocks"][0]["fields"]["html"]["de"] = "<p>Changed translation</p>"
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["translation_changed"], 1)
        data = copy.deepcopy(saved["data"])
        data["fields"]["title"]["de"] = ""
        saved = self.save(saved, data)
        url = f"/api/cms/ai-def/documents/{saved['id']}/"
        denied = self.post(url + "translations/", {"version": saved["version"], "language": "de"})
        self.assertEqual(denied.status_code, 422)
        self.assertIn("fields.title.de", denied.json()["fields"])
        WorkspaceAccess.objects.filter(user=self.user, site="ai-def").update(role="publisher")
        self.assertEqual(self.post(url + "review/", {"version": saved["version"]}).status_code, 200)
        self.assertTrue(self.post(url + "review/", {"version": saved["version"]}).json()["ready"])

    def test_reordering_keeps_checkpoints_attached_to_stable_block_ids(self):
        checked = self.mark(self.article(blocks=2))
        data = copy.deepcopy(checked["data"])
        data["sections"]["blocks"].reverse()
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["reviewed"], 3)
        self.assertEqual(saved["translation_review"]["de"]["issues"], [])

    def test_publication_rebases_temporary_ids_and_media_refs_and_image_replacement_invalidates_alt(self):
        document = self.article()
        asset = MediaAsset.objects.create(site="ai-def", file="cms/photo.webp", original_name="Photo")
        backend = ContentAdapter("articles")
        child = backend.empty(backend.definition["relations"]["blocks"], backend.model)
        child["fields"]["kind"] = "image"
        child["fields"]["image"] = {"asset_id": str(asset.pk)}
        child["fields"]["image_alt"].update(en="Aircraft", de="Fluggerät")
        data = copy.deepcopy(document["data"])
        data["sections"]["blocks"].append(child)
        checked = self.mark(self.save(document, data))
        WorkspaceAccess.objects.filter(user=self.user, site="ai-def").update(role="publisher")
        url = f"/api/cms/ai-def/documents/{checked['id']}/"
        response = self.post(url + "publish/", {"version": checked["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        published = response.json()
        self.assertIsInstance(published["data"]["sections"]["blocks"][1]["id"], int)
        self.assertEqual(published["translation_review"]["de"]["reviewed"], 3)
        self.assertEqual(published["translation_review"]["de"]["checked_at"], checked["translation_review"]["de"]["checked_at"])
        replacement = MediaAsset.objects.create(site="ai-def", file="cms/new-photo.webp", original_name="New photo")
        data = copy.deepcopy(published["data"])
        data["sections"]["blocks"][1]["fields"]["image"] = {"asset_id": str(replacement.pk)}
        saved = self.save(published, data)
        self.assertEqual(saved["translation_review"]["de"]["source_changed"], 1)
        self.assertEqual(saved["translation_review"]["de"]["issues"][0]["path"], "sections.blocks.1.fields.image_alt.de")

    def test_fixed_page_structure_tracks_the_specific_changed_leaf(self):
        page = Page.objects.create(site="ai-def", slug="review-test", name="Review page", content={"en": {"main": {"title": "Hello", "cards": [{"title": "Card"}]}}, "de": {"main": {"title": "Hallo", "cards": [{"title": "Karte"}]}}})
        opened = self.post("/api/cms/ai-def/pages/", {"target_id": page.pk})
        self.assertEqual(opened.status_code, 200, opened.content)
        checked = self.mark(opened.json())
        data = copy.deepcopy(checked["data"])
        data["content"]["en"]["main"]["cards"][0]["title"] = "Updated card"
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["issues"], [{"path": "content.de.main.cards.0.title", "state": "source_changed"}])

    def test_arms_variant_and_alt_checks_survive_publication(self):
        created = self.post("/api/cms/arms/products/", {"name": "Review ARMS"}).json()
        asset = MediaAsset.objects.create(site="arms", file="cms/arms.webp", original_name="Photo")
        ref = {"asset_id": str(asset.pk)}
        data = copy.deepcopy(created["data"])
        data.update(cover=ref, content={"en": {"description": "Description", "cover_alt": "Front", "specifications": []}, "de": {"description": "Beschreibung", "cover_alt": "Vorn", "specifications": []}}, variants=[{"id": str(uuid4()), "code": "standard", "model_name": "", "content": {"en": {"label": "Standard", "specifications": []}, "de": {"label": "Standard", "specifications": []}}, "images": [{"id": str(uuid4()), "media": ref, "alt": {"en": "Side", "de": "Seite"}}]}])
        checked = self.mark(self.save(created, data))
        self.assertEqual(checked["translation_review"]["de"]["reviewed"], 4)
        WorkspaceAccess.objects.filter(user=self.user, site="arms").update(role="publisher")
        response = self.post(f"/api/cms/arms/documents/{checked['id']}/publish/", {"version": checked["version"]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["translation_review"]["de"]["reviewed"], 4)

    def test_review_endpoint_checks_version_language_scope_and_server_owned_metadata(self):
        document = self.article()
        url = f"/api/cms/ai-def/documents/{document['id']}/translations/"
        self.assertEqual(self.post(url, {"version": 0, "language": "de"}).status_code, 409)
        for language in ("en", "ru", "unknown"):
            self.assertEqual(self.post(url, {"version": document["version"], "language": language}).status_code, 422)
        self.assertEqual(self.post(url, {"version": document["version"], "language": "de", "fields": {}}).status_code, 422)
        self.assertEqual(self.client.get(url).status_code, 405)
        self.assertEqual(self.post(f"/api/cms/arms/documents/{document['id']}/translations/", {"version": document["version"], "language": "de"}).status_code, 404)
        self.assertEqual(Document.objects.get(pk=document["id"]).translation_reviews, {})
        self.client.logout()
        self.assertEqual(self.post(url, {"version": document["version"], "language": "de"}).status_code, 401)

    def test_custom_product_image_alt_is_tracked_and_english_removal_does_not_hide_stale_text(self):
        from main.models import Product, ProductImage, ProductImageTranslation
        product = Product.objects.create(name_en="Aircraft", name_de="Fluggerät")
        image = ProductImage.objects.create(product=product, image="products/original.webp")
        ProductImageTranslation.objects.filter(image=image, lang="en").update(alt="In flight")
        ProductImageTranslation.objects.filter(image=image, lang="de").update(alt="Im Flug")
        document = self.post("/api/cms/ai-def/products/", {"target_id": product.pk}).json()
        checked = self.mark(document)
        self.assertEqual(checked["translation_review"]["de"]["reviewed"], 2)
        replacement = MediaAsset.objects.create(site="ai-def", file="cms/other.webp", original_name="Other")
        data = copy.deepcopy(checked["data"])
        data["sections"]["images"][0]["fields"]["image"] = {"asset_id": str(replacement.pk)}
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["issues"], [{"path": "sections.images.0.fields.alt.de", "state": "source_changed"}])
        checked = self.mark(self.article())
        data = copy.deepcopy(checked["data"])
        data["sections"]["blocks"][0]["fields"]["html"]["en"] = ""
        saved = self.save(checked, data)
        self.assertEqual(saved["translation_review"]["de"]["source_changed"], 1)

    def test_inactive_legacy_content_is_not_reported_as_a_missing_translation(self):
        document = self.article()
        data = copy.deepcopy(document["data"])
        data["sections"]["blocks"][0]["fields"]["paragraphs"].update(en=["Unused legacy text"], de=[])
        backend = ContentAdapter("articles")
        legacy = backend.empty(backend.definition["relations"]["sections"], backend.model)
        legacy["fields"]["title"]["en"] = "Inactive legacy section"
        data["sections"]["sections"].append(legacy)
        saved = self.save(document, data)
        self.assertEqual(saved["translation_review"]["de"]["total"], 2)
        self.assertEqual(saved["translation_review"]["de"]["missing"], 0)
