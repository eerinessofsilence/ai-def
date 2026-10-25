from django.test import TestCase

from main.models import Category, Product
from users.models import User

from .content import safe_href, sanitize
from .models import Document


class DraftCreationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="draft-editor@example.invalid", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)

    def create(self, site, kind, payload):
        return self.client.post(f"/api/cms/{site}/{kind}/", payload, content_type="application/json")

    def test_named_creation_is_atomic_and_unpublished(self):
        category = Category.objects.create(name_en="UAV")
        response = self.create("ai-def", "products", {"name": "  Real product name  ", "category": category.pk})
        self.assertEqual(response.status_code, 201, response.content)
        result = response.json()
        self.assertEqual(result["data"]["fields"]["name"]["en"], "Real product name")
        self.assertEqual(result["data"]["fields"]["category"], category.pk)
        self.assertIsNone(result["target_id"])
        self.assertEqual(result["status"], "draft")
        self.assertEqual(Product.objects.count(), 0)
        count = Document.objects.count()
        for payload in ({"name": " "}, {"name": "x" * 256}, {"name": "Name", "category": -99}, {"name": "Name", "template": "unknown"}):
            self.assertEqual(self.create("ai-def", "products", payload).status_code, 422)
            self.assertEqual(Document.objects.count(), count)

    def test_article_template_contains_an_empty_editable_text_block(self):
        response = self.create("ai-def", "articles", {"name": "Article title", "template": "article"})
        self.assertEqual(response.status_code, 201, response.content)
        blocks = response.json()["data"]["sections"]["blocks"]
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["fields"]["kind"], "text")
        self.assertFalse(blocks[0]["fields"]["html"]["en"])
        self.assertEqual(self.create("ai-def", "articles", {"name": "Blank", "template": "blank"}).json()["data"]["sections"]["blocks"], [])

    def test_arms_creation_uses_the_same_name_and_category_workflow(self):
        response = self.create("arms", "products", {"name": "Product name", "category": "automatic"})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["name"], "Product name")
        self.assertEqual(response.json()["data"]["category"], "automatic")
        count = Document.objects.count()
        self.assertEqual(self.create("arms", "products", {"name": "Name", "category": "invalid"}).status_code, 422)
        self.assertEqual(Document.objects.count(), count)

    def test_saved_rich_text_preserves_supported_formatting_and_rejects_unsafe_links(self):
        for href in ("javascript:alert(1)", "data:text/html,test", "//outside.invalid", "/\\outside.invalid", "https://example.invalid/\npath"):
            self.assertIsNone(safe_href(href), href)
        for href in ("https://example.invalid/page", "HTTPS://example.invalid", "mailto:team@example.invalid", "tel:+421123456", "/products/item", "#section"):
            self.assertEqual(safe_href(href), href)
        cleaned = sanitize('<h2>Heading</h2><ol><li><strong>Bold</strong> and <em>italic</em></li></ol><a href="java&#x73;cript:alert(1)">Text</a>')
        self.assertIn('<ol><li><strong>Bold</strong> and <em>italic</em></li></ol>', cleaned)
        self.assertNotIn('href=', cleaned)
