"""Resolve file placements without serializing every product and its nested records."""
from collections import defaultdict

from django.db import models

from .content import LABELS, NODES, editable_fields
from .models import Document, Page, Revision


def media_refs(value):
    if isinstance(value, dict):
        if "asset_id" in value:
            yield "asset:" + str(value["asset_id"])
        elif set(value) == {"path", "storage"}:
            yield ("stored:" if value["storage"] else "legacy:") + value["path"]
        else:
            for child in value.values():
                yield from media_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from media_refs(child)


def content_name(data):
    value = data.get("fields", {}).get("title") or data.get("fields", {}).get("name") or data.get("name")
    return (value.get("en") if isinstance(value, dict) else value) or "Untitled draft"


def usages(request, site, assets, *, history=False):
    if not assets:
        return {}
    can_portal = request.user.is_superuser or request.user.has_perm("portal.change_portalproduct")
    kinds = (["products", "pages"] if site == "arms" else ["products", "civil-products", "articles", "pages"] + (["portal", "modules"] if can_portal else []))
    aliases = defaultdict(set)
    for asset in assets:
        identifier = str(asset.pk)
        aliases["asset:" + identifier].add(identifier)
        aliases["stored:" + asset.file.name].add(identifier)
        if asset.source_url:
            aliases["legacy:" + asset.source_url].add(identifier)
    result = defaultdict(dict)
    documents = list(Document.objects.filter(site=site, kind__in=kinds).only("id", "kind", "target_id", "data", "dirty", "published_data"))
    opened = {(doc.kind, doc.target_id): str(doc.pk) for doc in documents if doc.target_id is not None}
    module_products = defaultdict(list)
    if site == "ai-def" and can_portal:
        from portal.models import ProductModulePlacement
        for placement in ProductModulePlacement.objects.values("module_id", "product_id", "product__name", "product__available"):
            module_products[placement["module_id"]].append(placement)

    def add(refs, kind, target, name, state, *, document_id=None, version=None, location=""):
        refs = set(refs)
        identifier = document_id or opened.get((kind, target)) or f"live-{target}"
        identity = f"{kind}:{target if target is not None else identifier}"
        for ref in refs:
            for asset_id in aliases.get(ref, ()):
                key = (identity, state, version)
                if key not in result[asset_id]:
                    result[asset_id][key] = {"kind": kind, "id": identifier, "identity": identity, "name": name, "state": state, "version": version, "locations": []}
                if location and location not in result[asset_id][key]["locations"]:
                    result[asset_id][key]["locations"].append(location)
        if kind == "modules" and state == "stored":
            for placement in module_products[target]:
                add(refs, "portal", placement["product_id"], placement["product__name"], "published" if placement["product__available"] else "unpublished", location=f"Shared module · {name}")

    if site == "ai-def":
        for kind, definition in NODES.items():
            if kind not in kinds:
                continue
            root = definition["model"]
            title_key = "title" if kind == "articles" else "name"
            visibility = "is_published" if kind == "articles" else "available" if hasattr(root, "available") else None

            def visit(definition, parent=None, lookup="", label=""):
                model = definition["model"]
                files = [field.name for field in editable_fields(model, parent) if isinstance(field, models.FileField)]
                if files:
                    columns = [lookup + "pk", lookup + title_key, *([lookup + visibility] if visibility else []), *files]
                    for row in model.objects.values(*columns).iterator():
                        state = "published" if visibility and row[lookup + visibility] else "unpublished" if visibility else "stored"
                        for field in files:
                            if row[field]:
                                add(["stored:" + row[field]], kind, row[lookup + "pk"], row[lookup + title_key], state, location=" · ".join(filter(None, [label, LABELS.get(field, field)])))
                for relation in definition["relations"].values():
                    child = relation["model"]
                    foreign = next(field for field in child._meta.fields if field.is_relation and field.remote_field.model == model)
                    visit(relation, model, foreign.name + "__" + lookup, relation.get("label", ""))
            visit(definition)
    else:
        from main.arms_models import ArmsImage, ArmsProduct
        for row in ArmsProduct.objects.values("pk", "name", "available", "image", "legacy_image"):
            add(["stored:" + row["image"], "legacy:" + row["legacy_image"]], "products", row["pk"], row["name"], "published" if row["available"] else "unpublished", location="Cover")
        for row in ArmsImage.objects.values("variant__product_id", "variant__product__name", "variant__product__available", "variant__content", "image", "legacy_path"):
            label = row["variant__content"].get("en", {}).get("label") or "Variant photos"
            add(["stored:" + row["image"], "legacy:" + row["legacy_path"]], "products", row["variant__product_id"], row["variant__product__name"], "published" if row["variant__product__available"] else "unpublished", location=label)
    for page in Page.objects.filter(site=site).values("pk", "name", "assets"):
        for key, ref in page["assets"].items():
            add(media_refs(ref), "pages", page["pk"], page["name"], "published", location=key)
    for document in documents:
        if document.dirty or document.published_data is None:
            add(media_refs(document.data), document.kind, document.target_id, content_name(document.data), "draft", document_id=str(document.pk))
    if history:
        # shortcut: scan history only for file details; index references if revision volume makes this slow.
        for revision in Revision.objects.filter(document__site=site, document__kind__in=kinds).select_related("document").only("version", "data", "document__id", "document__kind", "document__target_id").iterator(chunk_size=100):
            add(media_refs(revision.data), revision.document.kind, revision.document.target_id, content_name(revision.data), "history", document_id=str(revision.document_id), version=revision.version)
    return {identifier: list(entries.values()) for identifier, entries in result.items()}
