import copy
import re
from pathlib import Path
from uuid import UUID

from django.core.files.storage import default_storage
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404

from .arms import _existing_refs, fingerprint, resolve_media
from .errors import CMSProblem
from .models import Document, MediaAsset, Page
from .views import access, body, endpoint, record, representation


def merge(english, translated):
    if isinstance(english, dict) and isinstance(translated, dict):
        return {key: merge(value, translated.get(key)) for key, value in english.items()} | {key: value for key, value in translated.items() if key not in english}
    if isinstance(english, list) and isinstance(translated, list) and translated:
        return [merge(english[min(index, len(english) - 1)] if english else None, value)
                for index, value in enumerate(translated)]
    return translated if translated not in (None, "", [], {}) else english


def public_payload(page, request, language):
    assets = {}
    for key, ref in page.assets.items():
        path, stored = resolve_media(ref, page.site)
        assets[key] = request.build_absolute_uri(default_storage.url(path)) if stored and path else path
    return {"name": page.name, "slug": page.slug, "site": page.site,
            "content": merge(page.content.get("en", {}), page.content.get(language, {})), "assets": assets}


SHORT_COPY_FIELDS = {"title", "kicker", "cta", "pill", "badge", "name", "category", "slideAlt", "slideAria", "hqTitle", "addressesLabel", "view", "download", "viewDocument", "downloadDocument", "success", "industrialSecurity", "ministryPermit", "categoryAExemption", "categoryAExemptionAmended", "weaponsLicense", "phases"}


class PageAdapter:
    model = Page

    def snapshot(self, page):
        return {"name": page.name, "slug": page.slug, "content": copy.deepcopy(page.content), "assets": copy.deepcopy(page.assets)}

    def live_fingerprint(self, page):
        return fingerprint(self.snapshot(page))

    def clean(self, data, document, *, publishing=False, restoring=False):
        if not isinstance(data, dict) or set(data) != {"name", "slug", "content", "assets"}:
            raise CMSProblem("Unable to read page content.", status=422)
        original = document.data
        if data["name"] != original["name"] or data["slug"] != original["slug"]:
            raise CMSProblem("A developer manages the page URL and layout.", status=422)
        languages = {"en", "de", "sk", "es", "fr", "it"} | ({"ru"} if document.site == "arms" else set())
        if not isinstance(data["content"], dict) or set(data["content"]) - languages or "en" not in data["content"]:
            raise CMSProblem("Invalid page languages.", status=422)
        errors = {}
        def check(value, pattern, path):
            if isinstance(pattern, str):
                key = next((part for part in reversed(path.split(".")) if not part.isdecimal()), "")
                limit = max(255 if key in SHORT_COPY_FIELDS else 30000, len(pattern))
                if not isinstance(value, str) or len(value) > limit:
                    errors[path] = f"Enter up to {limit:,} characters."
                elif value and set(re.findall(r"\{\{\s*(\w+)\s*\}\}", value)) != set(re.findall(r"\{\{\s*(\w+)\s*\}\}", pattern)):
                    tokens = re.findall(r"\{\{\s*\w+\s*\}\}", pattern)
                    errors[path] = "Keep the template variables unchanged: " + ", ".join(tokens) + "." if tokens else "Remove unknown template variables. This field does not use them."
            elif isinstance(pattern, list):
                if not isinstance(value, list) or len(value) > 100:
                    errors[path] = "Invalid list."
                elif pattern:
                    for index, child in enumerate(value):
                        check(child, pattern[min(index, len(pattern) - 1)], f"{path}.{index}")
            elif isinstance(pattern, dict):
                if not isinstance(value, dict) or set(value) != set(pattern):
                    errors[path] = "The block structure does not match the page layout."
                else:
                    for key, child in value.items():
                        check(child, pattern[key], f"{path}.{key}")
            elif type(value) is not type(pattern):
                errors[path] = "Invalid value."
        for language, content in data["content"].items():
            if content == {} and language != "en":
                continue
            check(content, original["content"].get(language) or original["content"]["en"], "content." + language)
        if not isinstance(data["assets"], dict) or set(data["assets"]) != set(original["assets"]):
            errors["assets"] = "The image and document structure does not match the page."
        else:
            allowed = _existing_refs(original) | _existing_refs(document.published_data)
            if restoring:
                allowed |= _existing_refs(data)
            for key, ref in data["assets"].items():
                if not isinstance(ref, dict):
                    errors["assets." + key] = "Select a file."
                elif set(ref) == {"asset_id"}:
                    try:
                        asset = MediaAsset.objects.filter(site=document.site, pk=UUID(str(ref["asset_id"]))).first()
                        allowed_extensions = {".pdf"} if data["slug"] == "permits-certificates" else ({".mp4", ".webm"} if key == "video" or key == "hero0" else {".webp", ".jpg", ".jpeg", ".png"})
                        valid = asset is not None and Path(asset.file.name).suffix.lower() in allowed_extensions
                    except (ValueError, TypeError, AttributeError):
                        valid = False
                    if not valid:
                        errors["assets." + key] = "The file is unavailable in this workspace."
                elif set(ref) != {"path", "storage"} or not isinstance(ref["path"], str) or type(ref["storage"]) is not bool or (ref["path"], ref["storage"]) not in allowed:
                    errors["assets." + key] = "Select an uploaded file."
        if errors:
            raise CMSProblem("Check the highlighted fields.", status=422, fields=errors)
        return copy.deepcopy(data)

    def publish(self, document):
        data = self.clean(document.data, document, publishing=True)
        page = get_object_or_404(Page.objects.select_for_update(), pk=document.target_id, site=document.site)
        if self.live_fingerprint(page) != document.live_fingerprint:
            raise CMSProblem("The page has already changed. Save your work as a copy before refreshing.", status=409)
        page.content, page.assets = data["content"], data["assets"]
        page.save()
        return page

    def preview(self, data, request, language, site):
        return public_payload(Page(site=site, **data), request, language)


@endpoint(["GET", "POST"])
def pages(request, site):
    access(request, site, "edit" if request.method == "POST" else "view")
    backend = PageAdapter()
    if request.method == "POST":
        identifier = body(request).get("target_id")
        if type(identifier) is not int:
            raise CMSProblem("Select an existing website page.", status=422)
        page = get_object_or_404(Page.objects.select_for_update(), pk=identifier, site=site)
        document = Document.objects.filter(site=site, kind="pages", target_id=identifier).first()
        if document is None:
            data = backend.snapshot(page)
            document = Document(site=site, kind="pages", target_id=identifier, data=data, published_data=copy.deepcopy(data),
                                live_fingerprint=backend.live_fingerprint(page), dirty=False, published_at=page.updated_at)
            record(document, request.user, "opened")
        return JsonResponse(representation(document, request))
    documents = {document.target_id: document for document in Document.objects.filter(site=site, kind="pages", target_id__isnull=False)}
    return JsonResponse({"items": [{"target_id": page.pk, "document_id": str(documents[page.pk].pk) if page.pk in documents else None,
                                   "name": page.name, "slug": page.slug, "updated_at": documents[page.pk].updated_at.isoformat() if page.pk in documents else page.updated_at.isoformat(),
                                   "status": "changes" if page.pk in documents and documents[page.pk].dirty else "published"}
                                  for page in Page.objects.filter(site=site).order_by("pk")]})


def public_page(request, site, slug):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    page = get_object_or_404(Page, site=site, slug=slug)
    language = request.GET.get("lang", "en")
    return JsonResponse(public_payload(page, request, language))
