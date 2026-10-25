from django.db import connection
from django.http import Http404, JsonResponse

from main.arms_models import ArmsProduct
from .arms import fingerprint
from .errors import CMSProblem
from .views import access, adapter, body, endpoint


def snapshot(rows, kind):
    name = "title" if kind == "articles" else "name"
    visibility = "is_published" if kind == "articles" else "available"
    return {
        "version": fingerprint([[row.pk, row.order, getattr(row, name), getattr(row, visibility)] for row in rows]),
        "items": [{"id": row.pk, "name": getattr(row, name), "status": "published" if getattr(row, visibility) else "draft"} for row in rows],
    }


@endpoint(["GET", "POST"])
def reorder(request, site, kind):
    access(request, site, "publish")
    if kind not in {"products", "civil-products", "articles", "portal"}:
        raise Http404
    if kind == "portal" and not (request.user.is_superuser or request.user.has_perm("portal.change_portalproduct")):
        raise CMSProblem("You do not have access to the client portal.", status=403)
    model = getattr(adapter(site, kind), "model", ArmsProduct)
    if request.method == "POST":
        payload = body(request)
        wanted = payload.get("ids")
        version = payload.get("version")
        if set(payload) != {"ids", "version"} or not isinstance(wanted, list) or any(type(identifier) is not int for identifier in wanted) or len(set(wanted)) != len(wanted):
            raise CMSProblem("Submit each catalogue item exactly once.", status=422)
        if not isinstance(version, str) or len(version) != 64 or any(character not in "0123456789abcdef" for character in version):
            raise CMSProblem("Reload the catalogue order before applying changes.", status=422)
        # Lock inserts/deletes and row-locking writers too, so the checked catalogue cannot change mid-apply.
        with connection.cursor() as cursor:
            cursor.execute(f"LOCK TABLE {connection.ops.quote_name(model._meta.db_table)} IN EXCLUSIVE MODE")
    ordering = ["order", "pk"] if site == "arms" else ["order", "-published_at", "-created_at", "pk"] if kind == "articles" else ["order", "-created_at", "name", "pk"] if kind == "portal" else ["order", "name", "pk"]
    rows = list(model.objects.order_by(*ordering))
    current = snapshot(rows, kind)
    if request.method == "GET":
        return JsonResponse(current)
    identifiers = [row.pk for row in rows]
    if version != current["version"] and identifiers != wanted:
        raise CMSProblem("The catalogue changed while you arranged it. Your proposed order has been kept. Load the latest order before applying again.", status=409)
    if set(wanted) != set(identifiers):
        raise CMSProblem("The catalogue now contains different items. Load the latest order before applying again.", status=409)
    maximum = connection.ops.integer_field_range(model._meta.get_field("order").get_internal_type())[1]
    if len(rows) > maximum + 1:
        raise CMSProblem("This catalogue exceeds the supported order range. No positions were changed.", status=422)
    if identifiers != wanted:
        indexed = {row.pk: row for row in rows}
        rows = [indexed[identifier] for identifier in wanted]
        for position, row in enumerate(rows):
            row.order = position
        model.objects.bulk_update(rows, ["order"])
    return JsonResponse(snapshot(rows, kind))
