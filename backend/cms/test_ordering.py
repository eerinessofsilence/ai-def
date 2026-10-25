from unittest.mock import patch

from django.db.models.query import QuerySet
from django.test import TestCase

from main.arms_models import ArmsProduct, ArmsVariant
from main.models import BlogPost, CivilProduct, Product
from portal.models import PortalProduct
from users.models import User
from .errors import CMSProblem
from .models import Document, WorkspaceAccess


class WebsiteOrderingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="order-publisher@example.invalid", is_staff=True)
        WorkspaceAccess.objects.create(user=self.user, site="arms", role="publisher")
        WorkspaceAccess.objects.create(user=self.user, site="ai-def", role="publisher")
        self.client.force_login(self.user)
        ArmsProduct.objects.all().delete()
        self.products = [ArmsProduct.objects.create(name=f"Product {index}", slug=f"order-{index}", category="pistols", available=True, order=index * 10) for index in range(3)]
        ArmsVariant.objects.bulk_create([ArmsVariant(product=product, code="standard") for product in self.products])
        self.url = "/api/cms/arms/products/reorder/"

    def current(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def apply(self, version, ids):
        return self.client.post(self.url, {"version": version, "ids": ids}, content_type="application/json")

    def positions(self):
        return list(ArmsProduct.objects.order_by("order", "pk").values_list("pk", "order"))

    def test_preparation_reads_the_full_unfiltered_catalogue_and_never_writes(self):
        ArmsProduct.objects.bulk_create([ArmsProduct(name=f"Extra {index}", slug=f"extra-{index}", category="pistols", order=50 + index) for index in range(30)])
        Document.objects.create(site="arms", kind="products", data={"name": "Not published yet"})
        before = self.positions()
        response = self.client.get(self.url + "?q=Product&state=published&page=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 33)
        self.assertEqual([item["id"] for item in response.json()["items"]], [row[0] for row in before])
        self.assertEqual(self.positions(), before)
        self.assertIn("no-store", response["Cache-Control"])

    def test_apply_changes_only_order_and_repeating_a_lost_response_is_safe(self):
        current = self.current()
        original = list(ArmsProduct.objects.order_by("pk").values("pk", "name", "slug", "content", "available", "updated_at"))
        wanted = [item["id"] for item in reversed(current["items"])]
        response = self.apply(current["version"], wanted)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual([item["id"] for item in response.json()["items"]], wanted)
        self.assertEqual(self.positions(), list(zip(wanted, range(len(wanted)))))
        self.assertEqual(list(ArmsProduct.objects.order_by("pk").values("pk", "name", "slug", "content", "available", "updated_at")), original)
        version = response.json()["version"]
        retry = self.apply(current["version"], wanted)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()["version"], version)
        self.assertEqual([row["id"] for row in self.client.get("/api/arms/products/").json()], [product.slug for product in reversed(self.products)])

    def test_invalid_and_incomplete_orders_never_change_any_positions(self):
        current = self.current()
        ids = [row["id"] for row in current["items"]]
        before = self.positions()
        for value in ([True, *ids[1:]], [ids[0], ids[0], ids[2]], [str(ids[0]), *ids[1:]], None):
            with self.subTest(value=value):
                self.assertEqual(self.apply(current["version"], value).status_code, 422)
                self.assertEqual(self.positions(), before)
        for value in (ids[:-1], [999999, *ids[1:]]):
            self.assertEqual(self.apply(current["version"], value).status_code, 409)
            self.assertEqual(self.positions(), before)
        self.assertEqual(self.apply("bad-version", ids).status_code, 422)
        self.assertEqual(self.client.post(self.url, {"target_id": ids[0], "direction": 1}, content_type="application/json").status_code, 422)

    def test_changes_to_order_catalogue_membership_and_names_are_detected(self):
        current = self.current()
        wanted = [row["id"] for row in reversed(current["items"])]
        ArmsProduct.objects.filter(pk=wanted[1]).update(order=99)
        before = self.positions()
        self.assertEqual(self.apply(current["version"], wanted).status_code, 409)
        self.assertEqual(self.positions(), before)
        current = self.current()
        added = ArmsProduct.objects.create(name="New arrival", slug="new-arrival", category="pistols")
        before = self.positions()
        self.assertEqual(self.apply(current["version"], wanted).status_code, 409)
        self.assertEqual(self.positions(), before)
        added.delete()
        current = self.current()
        ArmsProduct.objects.filter(pk=wanted[0]).update(name="Renamed elsewhere")
        self.assertEqual(self.apply(current["version"], wanted).status_code, 409)
        current = self.current()
        ArmsProduct.objects.filter(pk=wanted[0]).delete()
        before = self.positions()
        self.assertEqual(self.apply(current["version"], wanted).status_code, 409)
        self.assertEqual(self.positions(), before)

    def test_failure_during_apply_rolls_back_all_positions(self):
        current = self.current()
        before = self.positions()
        def interrupted(queryset, rows, fields, **kwargs):
            ArmsProduct.objects.filter(pk=rows[0].pk).update(order=997)
            raise CMSProblem("Simulated write failure.", status=422)
        with patch.object(QuerySet, "bulk_update", interrupted):
            response = self.apply(current["version"], [row["id"] for row in reversed(current["items"])])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.positions(), before)

    def test_initial_order_matches_public_catalogue_tie_breaks(self):
        Product.objects.create(name_en="Zed", order=0, available=True)
        Product.objects.create(name_en="Alpha", order=0, available=True)
        prepared = self.client.get("/api/cms/ai-def/products/reorder/").json()
        public = self.client.get("/api/items/").json()
        self.assertEqual([row["name"] for row in prepared["items"]], [row["name"] for row in public])
        self.assertEqual([row["name"] for row in prepared["items"]], ["Alpha", "Zed"])

    def test_publishing_and_portal_permissions_are_required_for_reading_and_applying(self):
        current = self.current()
        self.assertEqual(self.client.get("/api/cms/ai-def/portal/reorder/").status_code, 403)
        WorkspaceAccess.objects.filter(user=self.user, site="arms").update(role="editor")
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.apply(current["version"], [row["id"] for row in current["items"]]).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_all_supported_collections_use_the_same_atomic_contract(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        for kind, model, title in (("products", Product, "name_en"), ("civil-products", CivilProduct, "name_en"), ("articles", BlogPost, "title_en"), ("portal", PortalProduct, "name_en")):
            with self.subTest(kind=kind):
                model.objects.create(**{title: "First", "order": 0})
                model.objects.create(**{title: "Second", "order": 10})
                url = f"/api/cms/ai-def/{kind}/reorder/"
                snapshot = self.client.get(url).json()
                ids = [item["id"] for item in reversed(snapshot["items"])]
                response = self.client.post(url, {"version": snapshot["version"], "ids": ids}, content_type="application/json")
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(list(model.objects.order_by("order", "pk").values_list("pk", flat=True)), ids)
        self.assertEqual(self.client.get("/api/cms/arms/articles/reorder/").status_code, 404)
        self.assertEqual(self.client.get("/api/cms/ai-def/modules/reorder/").status_code, 404)
