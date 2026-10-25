from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from main.models import ContactRequest

from .errors import CMSProblem
from .views import access, body, endpoint


STATUSES = {"new": "New", "in_progress": "In progress", "done": "Done", "spam": "Spam"}


def scope(site):
    arms = Q(source__startswith="arms:") | Q(source__regex=r"^/([a-z]{2}/)?store(/|$)")
    main = Q(source__startswith="ai-def:")
    return arms if site == "arms" else main


def assignees(site):
    return get_user_model().objects.filter(is_staff=True, is_active=True).filter(Q(is_superuser=True) | Q(cms_access__site=site)).distinct().order_by("first_name", "pk")


def payload(item, *, full=False):
    result = {"id": item.pk, "name": f"{item.first_name} {item.last_name}".strip(), "message": item.message if full else item.message[:160],
              "product": item.product, "status": item.status, "created_at": item.created_at.isoformat(), "updated_at": item.updated_at.isoformat(),
              "assigned_to": item.assigned_to_id}
    if full:
        result.update({"email": item.email, "phone": item.phone, "country": item.country_name, "address": ", ".join(filter(None, [item.address_line1, item.address_line2])),
                       "website": item.website, "source": item.source, "language": item.language, "variant": item.variant, "internal_note": item.internal_note})
    return result


@endpoint(["GET"])
def inquiry_list(request, site):
    access(request, site)
    query = ContactRequest.objects.filter(scope(site))
    if request.GET.get("source") == "unknown":
        access(request, site, "manage")
        query = ContactRequest.objects.exclude(scope("arms") | scope("ai-def"))
    status = request.GET.get("state", "")
    if status in STATUSES:
        query = query.filter(status=status)
    text = request.GET.get("q", "").strip()[:255]
    if text:
        query = query.filter(Q(first_name__icontains=text) | Q(last_name__icontains=text) | Q(message__icontains=text) | Q(email__icontains=text) | Q(product__icontains=text))
    if request.GET.get("assigned") == "me":
        query = query.filter(assigned_to=request.user)
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except ValueError:
        page = 1
    total = query.count()
    pages = max(1, (total + 24) // 25)
    page = min(page, pages)
    return JsonResponse({"items": [payload(item) for item in query.order_by("-created_at", "-pk")[(page - 1) * 25:page * 25]], "total": total, "page": page, "pages": pages})


@endpoint(["GET", "PUT"])
def inquiry_detail(request, site, identifier):
    access(request, site, "edit" if request.method == "PUT" else "view")
    query = ContactRequest.objects.select_for_update() if request.method == "PUT" else ContactRequest.objects
    item = get_object_or_404(query, pk=identifier)
    if not ContactRequest.objects.filter(pk=identifier).filter(scope(site)).exists():
        if ContactRequest.objects.filter(pk=identifier).filter(scope("arms") | scope("ai-def")).exists():
            from django.http import Http404
            raise Http404
        access(request, site, "manage")
    if request.method == "PUT":
        values = body(request)
        if set(values) != {"updated_at", "status", "assigned_to", "internal_note"}:
            raise CMSProblem("You can update the status, assignee and internal note.")
        if values["updated_at"] != item.updated_at.isoformat():
            raise CMSProblem("Another team member changed this inquiry. Refresh before saving.", status=409)
        if values["status"] not in STATUSES or not isinstance(values["internal_note"], str) or len(values["internal_note"]) > 20000:
            raise CMSProblem("Check the status and internal note.", status=422)
        assigned = values["assigned_to"]
        if assigned is not None and (type(assigned) is not int or not assignees(site).filter(pk=assigned).exists()):
            raise CMSProblem("Select a team member with access to this site.", status=422)
        item.status, item.assigned_to_id, item.internal_note = values["status"], assigned, values["internal_note"]
        item.save(update_fields=["status", "assigned_to", "internal_note", "updated_at"])
    return JsonResponse({"item": payload(item, full=True), "assignees": [{"id": user.pk, "name": user.get_full_name() or user.email} for user in assignees(site)]})
