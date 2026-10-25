import copy

from django.db.models import Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone, translation

from .content import ContentAdapter, LANGUAGES, NODES, REFERENCES, visibility
from .arms import fingerprint, media_ref
from .errors import CMSProblem
from .models import Document
from .views import access, body, endpoint, record, representation


def title(data):
    values = data.get("fields", {})
    value = values.get("title") or values.get("name") or ""
    return (value.get("en") or "New content") if isinstance(value, dict) else (value or "New content")


def cover(data):
    fields = data.get("fields", {})
    if fields.get("hero_image"):
        return fields["hero_image"]
    images = data.get("sections", {}).get("images", []) or data.get("sections", {}).get("hero_images", [])
    return images[0]["fields"].get("image") if images else fields.get("dropdown_image")


def permitted(request, site, kind, action="view"):
    access(request, site, action)
    if site != "ai-def" or kind not in NODES:
        raise Http404
    if kind in {"portal", "modules"} and not (request.user.is_superuser or request.user.has_perm("portal.change_portalproduct")):
        raise CMSProblem("You do not have access to the client portal.", status=403)


@endpoint(["GET", "POST"])
def collection(request, site, kind):
    permitted(request, site, kind, "edit" if request.method == "POST" else "view")
    backend = ContentAdapter(kind)
    if request.method == "POST":
        payload = body(request)
        target = payload.get("target_id")
        if target is None:
            from .drafts import initialise
            document = initialise(Document(site=site, kind=kind), backend, payload)
            record(document, request.user, "created")
        elif type(target) is int:
            obj = get_object_or_404(backend.model.objects.select_for_update(), pk=target)
            data = backend.snapshot(obj)
            document = Document.objects.filter(site=site, kind=kind, target_id=target).first()
            if document is None:
                document = Document(site=site, kind=kind, target_id=target, data=data,
                                    published_data=copy.deepcopy(data) if visibility(obj) else None,
                                    live_fingerprint=backend.live_fingerprint(obj), dirty=False,
                                    published_at=getattr(obj, "updated_at", timezone.now()) if visibility(obj) else None)
                record(document, request.user, "opened")
            elif not document.dirty and backend.live_fingerprint(obj) != document.live_fingerprint:
                document.data = data
                document.published_data = copy.deepcopy(data) if visibility(obj) else None
                document.live_fingerprint = backend.live_fingerprint(obj)
                document.version += 1
                record(document, request.user, "refreshed")
        else:
            raise CMSProblem("Invalid content ID.")
        return JsonResponse(representation(document, request), status=201 if target is None else 200)
    query = request.GET.get("q", "").strip()[:255]
    state, category = request.GET.get("state", ""), request.GET.get("category", "")
    documents = Document.objects.filter(site=site, kind=kind)
    new, live = documents.filter(target_id__isnull=True), backend.model.objects.all()
    name = "title" if kind == "articles" else "name"
    if query:
        matches = documents.filter(**{f"data__fields__{name}__en__icontains": query}).values_list("target_id", flat=True)
        live = live.filter(Q(**{name + "__icontains": query}) | Q(pk__in=matches))
        new = new.filter(**{f"data__fields__{name}__en__icontains": query})
    if category and category.isdecimal() and any(field.name == "category" for field in backend.model._meta.fields):
        live = live.filter(category_id=int(category))
        new = new.filter(data__fields__category=int(category))
    field = "is_published" if kind == "articles" else "available"
    has_visibility = any(item.name == field for item in backend.model._meta.fields)
    changed = documents.filter(dirty=True, published_data__isnull=False).values_list("target_id", flat=True)
    if state == "draft":
        live = live.filter(**{field: False}) if has_visibility else live.none()
    elif state == "changes":
        live, new = live.filter(pk__in=changed), new.none()
    elif state == "published":
        if has_visibility:
            live = live.filter(**{field: True})
        live, new = live.exclude(pk__in=changed), new.none()
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except ValueError:
        page = 1
    new_count = new.count()
    total = new_count + live.count()
    pages = max(1, (total + 24) // 25)
    page, start = min(page, pages), (min(page, pages) - 1) * 25
    new_rows = list(new.order_by("-updated_at")[start:start + 25]) if start < new_count else []
    ordering = ["order", "pk"] if any(item.name == "order" for item in backend.model._meta.fields) else ["pk"]
    live_start = max(0, start - new_count)
    if any(field.name == "category" for field in backend.model._meta.fields):
        live = live.select_related("category")
    if kind in {"products", "civil-products", "portal"}:
        live = live.prefetch_related("images")
    live_rows = list(live.order_by(*ordering)[live_start:live_start + 25 - len(new_rows)])
    doc_map = {doc.target_id: doc for doc in documents.filter(target_id__in=[obj.pk for obj in live_rows])}
    rows = []
    for obj in [*new_rows, *live_rows]:
        is_document = isinstance(obj, Document)
        document = obj if is_document else doc_map.get(obj.pk)
        if document:
            data = document.data
        else:
            fields = {name: {"en": getattr(obj, name + "_en", None) or getattr(obj, name)}, "category": getattr(obj, "category_id", None)}
            if kind == "articles":
                fields["hero_image"] = media_ref(obj.hero_image)
            photos = list(obj.images.all()) if kind in {"products", "civil-products", "portal"} else []
            data = {"fields": fields, "sections": {"images": [{"fields": {"image": media_ref(photos[0].image)}}] if photos else []}}
        updated_at = document.updated_at if document else getattr(obj, "updated_at", None)
        temp = document or Document(site=site, kind=kind, data=data, updated_at=updated_at or timezone.now())
        category_id, category_label = data["fields"].get("category"), ""
        if category_id:
            with translation.override("en"):
                model = backend.model._meta.get_field("category").remote_field.model
                category_label = obj.category.name if not is_document and not document and obj.category_id == category_id else (model.objects.filter(pk=category_id).values_list("name", flat=True).first() or "")
        rows.append({"document_id": str(document.pk) if document else None, "target_id": document.target_id if document else obj.pk,
                     "name": title(data), "category": category_label, "category_id": category_id,
                     "cover": cover(data), "media": representation(temp, request, include_review=False)["media"], "updated_at": updated_at.isoformat() if updated_at else None,
                     "status": "draft" if (is_document and document.published_data is None) or (not is_document and not visibility(obj)) else ("changes" if document and document.dirty else "published")})
    return JsonResponse({"items": rows, "page": page, "pages": pages, "total": total})


@endpoint(["GET"])
def schema(request, site, kind):
    permitted(request, site, kind)
    return JsonResponse(ContentAdapter(kind).schema())


def reference_payload(obj):
    content = {key: {language: getattr(obj, key + "_" + language) for language in LANGUAGES} for key in ("name", "role") if hasattr(obj, key)}
    return {"id": obj.pk, "label": content["name"].get("en") or obj.name, "content": content, "version": fingerprint(content)}


@endpoint(["GET", "POST", "PUT"])
def references(request, site, kind):
    access(request, site, "publish" if request.method == "PUT" else ("edit" if request.method == "POST" else "view"))
    if site != "ai-def" or kind not in REFERENCES:
        raise Http404
    model = REFERENCES[kind]
    if request.method == "POST":
        payload = body(request)
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 120:
            raise CMSProblem("Enter a name of up to 120 characters.", status=422)
        with translation.override("en"):
            obj = model(name=name.strip())
            obj.full_clean(exclude=["slug"])
            obj.save()
        return JsonResponse(reference_payload(obj), status=201)
    if request.method == "PUT":
        payload = body(request)
        if type(payload.get("id")) is not int:
            raise CMSProblem("Select an entry.", status=422)
        obj = get_object_or_404(model.objects.select_for_update(), pk=payload["id"])
        if payload.get("version") != reference_payload(obj)["version"]:
            raise CMSProblem("This entry has already changed. Close and reopen the editor.", status=409)
        language, name = payload.get("language", "en"), payload.get("name")
        if language not in LANGUAGES or not isinstance(name, str) or len(name) > 120 or (language == "en" and not name.strip()):
            raise CMSProblem("Check the name. An English name is required.", status=422)
        with translation.override("en"):
            setattr(obj, "name_" + language, name.strip())
            if hasattr(obj, "role") and "role" in payload:
                role = payload["role"]
                if not isinstance(role, str) or len(role) > obj._meta.get_field("role").max_length:
                    raise CMSProblem("Check the author’s job title.", status=422)
                setattr(obj, "role_" + language, role)
            obj.full_clean()
            obj.save()
        return JsonResponse(reference_payload(obj))
    return JsonResponse({"items": [reference_payload(obj) for obj in model.objects.order_by("pk")]})
