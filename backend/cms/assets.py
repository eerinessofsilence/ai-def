from pathlib import Path

from django.core.files.storage import FileSystemStorage
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from .arms import fingerprint
from .errors import CMSProblem
from .media_usage import usages
from .models import MediaAsset
from .views import access, body, endpoint


EXTENSIONS = {
    "image": (".webp", ".png", ".jpg", ".jpeg"),
    "video": (".mp4", ".webm"),
    "document": (".pdf",),
}


def serialize(request, asset, placements):
    extension = Path(asset.file.name).suffix.lower()
    file_kind = next((name for name, values in EXTENSIONS.items() if extension in values), "unknown")
    size = None
    if isinstance(asset.file.storage, FileSystemStorage) and asset.file:
        try:
            size = asset.file.size
        except OSError:
            pass
    current = [entry for entry in placements if entry["state"] != "history"]
    return {
        "ref": {"asset_id": str(asset.pk)}, "name": asset.display_name or asset.original_name,
        "original_name": asset.original_name, "display_name": asset.display_name,
        "kind": file_kind, "url": request.build_absolute_uri(asset.file.url) if asset.file else "",
        "width": asset.width, "height": asset.height, "size_bytes": size,
        "created_at": asset.created_at.isoformat(),
        "version": fingerprint([asset.display_name, asset.original_name, asset.file.name]),
        "usage_count": len({entry["identity"] for entry in current}),
        "materials": list(dict.fromkeys(entry["name"] for entry in current)),
    }


@endpoint(["GET"])
def assets(request, site):
    access(request, site)
    kind = request.GET.get("kind", "")
    if kind and kind not in EXTENSIONS:
        raise CMSProblem("Select images, videos or documents.", status=422)
    query = MediaAsset.objects.filter(site=site)
    text = request.GET.get("q", "").strip()[:255]
    if kind:
        extensions = Q()
        for extension in EXTENSIONS[kind]:
            extensions |= Q(file__iendswith=extension)
        query = query.filter(extensions)
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except ValueError:
        page = 1
    # shortcut: resolve placements for this site's library; index them if catalogue volume makes scans slow.
    candidates = list(query.order_by("-created_at", "-pk"))
    placements = usages(request, site, candidates)
    if text:
        needle = text.casefold()
        candidates = [asset for asset in candidates if any(needle in name.casefold() for name in [asset.original_name, asset.display_name, *[entry["name"] for entry in placements.get(str(asset.pk), [])]])]
    total = len(candidates)
    pages = max(1, (total + 24) // 25)
    page = min(page, pages)
    items = [serialize(request, asset, placements.get(str(asset.pk), [])) for asset in candidates[(page - 1) * 25:page * 25]]
    return JsonResponse({"items": items, "page": page, "pages": pages, "total": total})


@endpoint(["GET", "PATCH"])
def asset_detail(request, site, asset_id):
    access(request, site)
    query = MediaAsset.objects.select_for_update() if request.method == "PATCH" else MediaAsset.objects
    asset = get_object_or_404(query, pk=asset_id, site=site)
    if request.method == "PATCH":
        payload = body(request)
        if set(payload) != {"version", "display_name"}:
            raise CMSProblem("Submit only the file name and its version.", status=422)
        current = fingerprint([asset.display_name, asset.original_name, asset.file.name])
        if payload["version"] != current:
            raise CMSProblem("This file was renamed in another window. Reopen its details before saving.", status=409)
        name = payload["display_name"]
        if not isinstance(name, str) or len(name.strip()) > 255 or any(ord(char) < 32 for char in name):
            raise CMSProblem("Use a name of up to 255 characters without line breaks.", status=422)
        asset.display_name = name.strip()
        asset.save(update_fields=["display_name"])
    placements = usages(request, site, [asset], history=True).get(str(asset.pk), [])
    return JsonResponse({**serialize(request, asset, placements), "usages": placements})
