"""Read-only comparison metadata shared by publication and version history."""
import copy
from collections import defaultdict

from django.db import models
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from .content import NODES, editable_fields
from .errors import CMSProblem
from .models import Revision
from .views import assert_version, endpoint, locked_document, representation


def website_state(document, *, lock=False):
    from main.arms_models import ArmsProduct
    from .arms import fingerprint
    from .content import visibility
    from .views import adapter
    backend = adapter(document.site, document.kind)
    queryset = getattr(backend, "model", ArmsProduct).objects
    if lock:
        queryset = queryset.select_for_update()
    obj = get_object_or_404(queryset, pk=document.target_id)
    data = backend.snapshot(obj)
    published = visibility(obj)
    # Hash the exact snapshot shown; a later related-row edit must invalidate it.
    value = data if document.kind == "pages" else {"data": data, "available" if document.site == "arms" else "published": published}
    return data, fingerprint(value), published


@endpoint(["POST"])
def website_comparison(request, site, document_id):
    from .views import body
    document = locked_document(request, site, document_id, lock=True)
    assert_version(document, body(request))
    if document.target_id is None:
        raise CMSProblem("This draft has no website version yet.", status=422)
    before, version, published = website_state(document)
    return JsonResponse({"version": document.version, "live_version": version, "changed": version != document.live_fingerprint,
                         "published": published, "before": before, "after": document.data,
                         "media": media_for(document, request, before, document.data),
                         "reference_labels": reference_labels(document.kind, before, document.data)})


def reference_labels(kind, *snapshots):
    if kind not in NODES:
        return {}
    known, identifiers, fields = defaultdict(dict), defaultdict(set), {}

    def title(node):
        value = node.get("fields", {}).get("name") or node.get("fields", {}).get("title")
        return (value.get("en") if isinstance(value, dict) else value) or "Untitled entry"

    def visit(node, definition, parent=None, path=""):
        if not isinstance(node, dict):
            return
        model = definition["model"]
        if node.get("id") is not None:
            known[model][str(node["id"])] = title(node)
        for field in editable_fields(model, parent):
            if isinstance(field, models.ForeignKey):
                value = node.get("fields", {}).get(field.name)
                if value is not None:
                    target = field.remote_field.model
                    key = path + "fields." + field.name
                    fields.setdefault(key, (target, set()))[1].add(str(value))
                    if type(value) is int:
                        identifiers[target].add(value)
        for key, child in definition["relations"].items():
            for row in node.get("sections", {}).get(key, []):
                visit(row, child, model, path + "sections." + key + ".")

    for snapshot in snapshots:
        visit(snapshot, NODES[kind])
    for model, ids in identifiers.items():
        name = next((key for key in ("name", "title") if any(field.name == key for field in model._meta.fields)), None)
        if name:
            for identifier, label in model.objects.filter(pk__in=ids).values_list("pk", name):
                known[model].setdefault(str(identifier), label or "Untitled entry")
    return {path: {identifier: known[model].get(identifier, f"Unavailable entry · ID {identifier}") for identifier in ids} for path, (model, ids) in fields.items()}


def media_for(document, request, *snapshots):
    media = {}
    for data in snapshots:
        if data is not None:
            value = copy.copy(document)
            value.data = data
            media.update(representation(value, request, include_review=False)["media"])
    return media


@endpoint(["GET"])
def history_comparison(request, site, document_id, version):
    document = locked_document(request, site, document_id)
    try:
        current = int(request.GET.get("current", ""))
    except ValueError:
        raise CMSProblem("Save the current draft before comparing versions.", status=422)
    assert_version(document, {"version": current})
    revision = get_object_or_404(Revision, document=document, version=version)
    return JsonResponse({"version": document.version, "revision": revision.version, "before": revision.data, "after": document.data,
                         "media": media_for(document, request, revision.data, document.data),
                         "reference_labels": reference_labels(document.kind, revision.data, document.data)})
