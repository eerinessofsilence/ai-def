import copy

from django.test import TestCase

from main.models import ContactRequest
from users.models import User

from .models import Page, WorkspaceAccess


class PagesAndInquiriesTests(TestCase):
    def test_page_fallback_keeps_translated_list_length_and_falls_back_inside_rows(self):
        from .pages import merge
        original = {"cards": [{"title": "First", "text": "Original body"}, {"title": "Second", "text": "Second body"}]}
        translated = {"cards": [{"title": "Erste", "text": ""}]}
        before = copy.deepcopy(translated)
        self.assertEqual(merge(original, translated), {"cards": [{"title": "Erste", "text": "Original body"}]})
        self.assertEqual(merge(original, {"cards": []}), original)
        self.assertEqual(translated, before)

    def setUp(self):
        self.user = User.objects.create_user(email="workflow@example.invalid", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)

    def post(self, url, value):
        return self.client.post(url, value, content_type="application/json")

    def test_stale_page_work_can_be_saved_in_history_without_overwriting_latest_draft(self):
        page = Page.objects.get(site="ai-def", slug="technology")
        doc = self.post("/api/cms/ai-def/pages/", {"target_id": page.pk}).json()
        url = f"/api/cms/ai-def/documents/{doc['id']}/"
        first = copy.deepcopy(doc["data"])
        first["content"]["en"]["technology"]["hero"]["title"] = "First editor"
        saved = self.client.put(url, {"version": doc["version"], "data": first}, content_type="application/json")
        self.assertEqual(saved.status_code, 200)
        second = copy.deepcopy(doc["data"])
        second["content"]["en"]["technology"]["hero"]["title"] = "Second editor"
        stashed = self.post(url + "stash/", {"version": doc["version"], "data": second})
        self.assertEqual(stashed.status_code, 200, stashed.content)
        self.assertEqual(stashed.json()["data"]["content"]["en"]["technology"]["hero"]["title"], "First editor")
        from .models import Revision
        self.assertEqual(Revision.objects.get(document_id=doc["id"], version=stashed.json()["version"]).data["content"]["en"]["technology"]["hero"]["title"], "Second editor")

    def test_page_draft_preview_publish_and_restore_preserve_live_content(self):
        page = Page.objects.get(site="ai-def", slug="technology")
        old = copy.deepcopy(page.content)
        doc = self.post("/api/cms/ai-def/pages/", {"target_id": page.pk}).json()
        url = f"/api/cms/ai-def/documents/{doc['id']}/"
        doc["data"]["content"]["en"]["technology"]["hero"]["title"] = "Draft technology heading"
        saved = self.client.put(url, {"version": doc["version"], "data": doc["data"]}, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        live = self.client.get("/api/pages/ai-def/technology/?lang=en").json()
        self.assertEqual(live["content"]["technology"]["hero"]["title"], old["en"]["technology"]["hero"]["title"])
        preview = self.client.get(url + "preview/?lang=en")
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.json()["content"]["technology"]["hero"]["title"], "Draft technology heading")
        published = self.post(url + "publish/", {"version": saved.json()["version"]})
        self.assertEqual(published.status_code, 200, published.content)
        page.refresh_from_db()
        self.assertEqual(page.content["en"]["technology"]["hero"]["title"], "Draft technology heading")
        restored = self.post(url + "restore/", {"version": published.json()["version"], "restore_version": doc["version"]})
        self.assertEqual(restored.status_code, 200, restored.content)
        page.refresh_from_db()
        self.assertEqual(page.content["en"]["technology"]["hero"]["title"], "Draft technology heading")

    def test_arms_page_preview_does_not_require_product_variants(self):
        page = Page.objects.get(site="arms", slug="permits-certificates")
        doc = self.post("/api/cms/arms/pages/", {"target_id": page.pk}).json()
        url = f"/api/cms/arms/documents/{doc['id']}/preview/"
        for query in ("?lang=de", f"?lang=de&revision={doc['version']}"):
            response = self.client.get(url + query)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()["slug"], page.slug)
            self.assertIn("permitsCertificates", response.json()["content"])
            self.assertIn("ministryPermit", response.json()["assets"])

    def test_page_rejects_broken_layout_structure_and_arbitrary_media_paths(self):
        page = Page.objects.get(site="ai-def", slug="home")
        doc = self.post("/api/cms/ai-def/pages/", {"target_id": page.pk}).json()
        url = f"/api/cms/ai-def/documents/{doc['id']}/"
        doc["data"]["assets"]["hero1"] = {"path": "/private-file.jpg", "storage": True}
        response = self.client.put(url, {"version": doc["version"], "data": doc["data"]}, content_type="application/json")
        self.assertEqual(response.status_code, 422)
        doc["data"]["assets"] = page.assets
        doc["data"]["content"]["en"]["main"]["hero"] = "invalid structure"
        self.assertEqual(self.client.put(url, {"version": doc["version"], "data": doc["data"]}, content_type="application/json").status_code, 422)

    def test_inquiry_scope_conflict_and_submission_fields_are_protected(self):
        arms = ContactRequest.objects.create(first_name="Test", last_name="Visitor", email="visitor@example.invalid", message="Synthetic request", source="arms:/store")
        main = ContactRequest.objects.create(first_name="Test", last_name="Visitor", email="visitor2@example.invalid", message="Synthetic request", source="ai-def:/support")
        editor = User.objects.create_user(email="inbox-editor@example.invalid", is_staff=True)
        WorkspaceAccess.objects.create(user=editor, site="arms", role="editor")
        self.client.force_login(editor)
        listing = self.client.get("/api/cms/arms/inquiries/").json()
        self.assertEqual([row["id"] for row in listing["items"]], [arms.pk])
        self.assertEqual(self.client.get(f"/api/cms/arms/inquiries/{main.pk}/").status_code, 404)
        url = f"/api/cms/arms/inquiries/{arms.pk}/"
        data = {"updated_at": arms.updated_at.isoformat(), "status": "in_progress", "assigned_to": editor.pk, "internal_note": "Internal only"}
        saved = self.client.put(url, data, content_type="application/json")
        self.assertEqual(saved.status_code, 200, saved.content)
        self.assertEqual(self.client.put(url, data, content_type="application/json").status_code, 409)
        arms.refresh_from_db()
        self.assertEqual(arms.message, "Synthetic request")
        self.assertEqual(arms.status, "in_progress")
        self.assertEqual(self.client.get("/api/cms/arms/inquiries/?source=unknown").status_code, 403)
