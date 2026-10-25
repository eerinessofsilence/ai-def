import copy
import io
import json
import warnings
import hashlib
from functools import wraps
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit

from PIL import Image, ImageOps, UnidentifiedImageError
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone, translation
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.cache import never_cache

from main.arms_models import ArmsProduct

from . import arms
from .errors import CMSProblem
from .models import Document, MediaAsset, Revision, SITES, WorkspaceAccess


def endpoint(methods):
    def decorate(view):
        @wraps(view)
        @never_cache
        @translation.override("en")
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                response = JsonResponse({"error": "Method not allowed."}, status=405)
                response["Allow"] = ", ".join(methods)
                return response
            try:
                with transaction.atomic():
                    return view(request, *args, **kwargs)
            except CMSProblem as error:
                return JsonResponse({"error": error.message, "fields": error.fields}, status=error.status)
            except Http404:
                return JsonResponse({"error": "Content not found."}, status=404)
            except ValidationError as error:
                fields = {key: " ".join(value) for key, value in error.message_dict.items()} if hasattr(error, "message_dict") else {}
                return JsonResponse({"error": "Check the form fields." if fields else " ".join(error.messages), "fields": fields}, status=422)
            except IntegrityError:
                return JsonResponse({"error": "The content was changed concurrently or the URL is already in use. Refresh the data."}, status=409)
        return csrf_protect(wrapped)
    return decorate


def body(request):
    if request.content_type != "application/json":
        raise CMSProblem("Submit data as JSON.", status=415)
    if len(request.body) > 2 * 1024 * 1024:
        raise CMSProblem("The content is too large.", status=413)
    try:
        value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise CMSProblem("Unable to read the data.")
    if not isinstance(value, dict):
        raise CMSProblem("Expected an object containing content fields.")
    return value


def access(request, site, action="view"):
    if site not in dict(SITES):
        raise Http404
    user = request.user
    if not user.is_authenticated:
        raise CMSProblem("Sign in to CMS.", status=401)
    if not user.is_active or not user.is_staff:
        raise CMSProblem("You do not have access to CMS.", status=403)
    if user.is_superuser:
        return "manager"
    grant = WorkspaceAccess.objects.filter(user=user, site=site).first()
    if not grant or (action == "publish" and grant.role == "editor") or (action == "manage" and grant.role != "manager"):
        raise CMSProblem("You do not have permission for this action.", status=403)
    return grant.role


def adapter(site, kind):
    if kind == "pages":
        from .pages import PageAdapter
        return PageAdapter()
    if site == "arms" and kind == "products":
        return arms
    if site == "ai-def":
        from .content import ContentAdapter, NODES
        if kind in NODES:
            return ContentAdapter(kind)
    raise Http404


def locked_document(request, site, document_id, action="view", lock=False):
    access(request, site, action)
    queryset = Document.objects.select_for_update() if lock else Document.objects
    document = get_object_or_404(queryset, pk=document_id, site=site)
    if document.kind in {"portal", "modules"} and not (request.user.is_superuser or request.user.has_perm("portal.change_portalproduct")):
        raise CMSProblem("You do not have access to the client portal.", status=403)
    adapter(site, document.kind)
    return document


def assert_version(document, payload):
    if type(payload.get("version")) is not int or payload["version"] != document.version:
        raise CMSProblem("This content has already changed. Your text remains in the open form. Open the latest version or create a copy.", status=409)


def record(document, user, action):
    document.updated_by = user
    document.save()
    Revision.objects.create(document=document, version=document.version, data=document.data, action=action, created_by=user)


def representation(document, request, *, include_review=True):
    media = {}
    asset_ids = set()

    def visit(value):
        if isinstance(value, dict):
            if "asset_id" in value:
                asset_ids.add(value["asset_id"])
            elif set(value) == {"path", "storage"}:
                from django.core.files.storage import default_storage
                path = value["path"]
                media[("stored:" if value["storage"] else "legacy:") + path] = request.build_absolute_uri(default_storage.url(path)) if value["storage"] else path
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(document.data)
    for asset in MediaAsset.objects.filter(site=document.site, pk__in=asset_ids):
        media[str(asset.pk)] = request.build_absolute_uri(asset.file.url)
    from .translation_review import status as translation_status
    return {"id": str(document.pk), "site": document.site, "kind": document.kind, "target_id": document.target_id,
            "data": document.data, "version": document.version, "media": media,
            "status": "changes" if document.published_data is not None and document.dirty else ("published" if document.published_data is not None else "draft"),
            "updated_at": document.updated_at.isoformat(), "published_at": document.published_at.isoformat() if document.published_at else None,
            **({"translation_review": translation_status(document)} if include_review else {})}


@ensure_csrf_cookie
@endpoint(["GET", "POST", "DELETE"])
def session(request):
    if request.method == "POST":
        payload = body(request)
        email, password = payload.get("email"), payload.get("password")
        if not isinstance(email, str) or not isinstance(password, str) or len(email) > 254 or len(password) > 1024:
            raise CMSProblem("Enter your email and password.")
        key = "cms-login:" + hashlib.sha256((request.META.get("REMOTE_ADDR", "") + ":" + email.strip().lower()).encode()).hexdigest()
        # shortcut: uses the configured Django cache; use a shared cache when running multiple workers.
        if cache.get(key, 0) >= 10:
            raise CMSProblem("Too many sign-in attempts. Try again in 10 minutes.", status=429)
        canonical_email = get_user_model().objects.filter(email__iexact=email.strip()).values_list("email", flat=True).first()
        user = authenticate(request, username=canonical_email or email.strip(), password=password)
        if user is None or not user.is_active or not user.is_staff:
            if not cache.add(key, 1, timeout=600):
                try:
                    cache.incr(key)
                except ValueError:
                    cache.set(key, 1, timeout=600)
            raise CMSProblem("Incorrect email or password, or no access to CMS.", status=401)
        if not user.is_superuser and not WorkspaceAccess.objects.filter(user=user).exists():
            raise CMSProblem("Ask an administrator for site access.", status=403)
        login(request, user)
        cache.delete(key)
    elif request.method == "DELETE":
        logout(request)
    user = request.user
    authenticated = user.is_authenticated and user.is_staff and user.is_active
    grants = dict(WorkspaceAccess.objects.filter(user=user).values_list("site", "role")) if authenticated and not user.is_superuser else {}
    local = urlsplit("//" + request.get_host()).hostname in {"localhost", "127.0.0.1", "::1"}
    return JsonResponse({"authenticated": authenticated, "csrf": get_token(request), "environment": "local" if local else "live",
                         "user": {"name": user.get_full_name() or user.email, "is_superuser": user.is_superuser} if authenticated else None,
                         "sites": [{"id": site, "name": name, "role": "manager" if user.is_superuser else grants[site], "can_portal": site == "ai-def" and (user.is_superuser or user.has_perm("portal.change_portalproduct"))}
                                   for site, name in SITES if authenticated and (user.is_superuser or site in grants)]})


@endpoint(["GET", "POST"])
def products(request, site):
    if site == "ai-def":
        from .collections import collection
        return collection(request, site, "products")
    access(request, site, "edit" if request.method == "POST" else "view")
    backend = adapter(site, "products")
    if request.method == "POST":
        payload = body(request)
        target = payload.get("target_id")
        if target is None:
            from .drafts import initialise
            document = initialise(Document(site=site, kind="products"), backend, payload)
            record(document, request.user, "created")
        elif type(target) is int:
            product = get_object_or_404(ArmsProduct.objects.select_for_update().prefetch_related("variants__images"), pk=target)
            data = backend.snapshot(product)
            document = Document.objects.filter(site=site, kind="products", target_id=target).first()
            if document is None:
                document = Document(site=site, kind="products", target_id=target, data=data,
                                    published_data=copy.deepcopy(data) if product.available else None,
                                    live_fingerprint=backend.live_fingerprint(product), dirty=False,
                                    published_at=product.updated_at if product.available else None)
                record(document, request.user, "opened")
            elif not document.dirty and backend.live_fingerprint(product) != document.live_fingerprint:
                document.data = data
                document.published_data = copy.deepcopy(data) if product.available else None
                document.live_fingerprint = backend.live_fingerprint(product)
                document.version += 1
                record(document, request.user, "refreshed")
        else:
            raise CMSProblem("Invalid product ID.")
        return JsonResponse(representation(document, request), status=201 if target is None else 200)
    query = request.GET.get("q", "").strip()[:255]
    state = request.GET.get("state", "")
    category = request.GET.get("category", "")
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    documents = Document.objects.filter(site=site, kind="products")
    new = documents.filter(target_id__isnull=True)
    live = ArmsProduct.objects.all()
    if query:
        matching = documents.filter(data__name__icontains=query).values_list("target_id", flat=True)
        live = live.filter(Q(name__icontains=query) | Q(brand__icontains=query) | Q(slug__icontains=query) | Q(pk__in=matching))
        new = new.filter(data__name__icontains=query)
    if category:
        live = live.filter(category=category)
        new = new.filter(data__category=category)
    changed = documents.filter(dirty=True, published_data__isnull=False).values_list("target_id", flat=True)
    if state == "draft":
        live = live.filter(available=False)
    elif state == "changes":
        live = live.filter(available=True, pk__in=changed)
        new = new.none()
    elif state == "published":
        live = live.filter(available=True).exclude(pk__in=changed)
        new = new.none()
    total_new, total_live = new.count(), live.count()
    total = total_new + total_live
    pages = max(1, (total + 24) // 25)
    page = min(page, pages)
    start = (page - 1) * 25
    new_rows = list(new.order_by("-updated_at")[start:start + 25]) if start < total_new else []
    live_start = max(0, start - total_new)
    live_rows = list(live.order_by("order", "pk")[live_start:live_start + 25 - len(new_rows)])
    doc_map = {doc.target_id: doc for doc in documents.filter(target_id__in=[product.pk for product in live_rows])}
    rows = []
    for doc in new_rows:
        rep = representation(doc, request, include_review=False)
        rows.append({"document_id": str(doc.pk), "target_id": None, "name": doc.data.get("name") or "New product",
                     "category": doc.data.get("category"), "status": "draft", "updated_at": doc.updated_at.isoformat(),
                     "cover": doc.data.get("cover"), "media": rep["media"]})
    for product in live_rows:
        doc = doc_map.get(product.pk)
        data = doc.data if doc else {"name": product.name, "category": product.category, "cover": arms.media_ref(product.image, product.legacy_image)}
        temp = doc or Document(site=site, data=data, updated_at=product.updated_at)
        rows.append({"document_id": str(doc.pk) if doc else None, "target_id": product.pk, "name": data["name"] or "New product",
                     "category": data["category"], "status": "changes" if product.available and doc and doc.dirty else ("published" if product.available else "draft"),
                     "updated_at": (doc.updated_at if doc else product.updated_at).isoformat(), "cover": data.get("cover"),
                     "media": representation(temp, request, include_review=False)["media"]})
    return JsonResponse({"items": rows, "total": total, "page": page, "pages": pages})


@endpoint(["GET", "PUT"])
def document_detail(request, site, document_id):
    document = locked_document(request, site, document_id, "edit" if request.method == "PUT" else "view", request.method == "PUT")
    if request.method == "PUT":
        payload = body(request)
        assert_version(document, payload)
        data = adapter(site, document.kind).clean(payload.get("data"), document)
        if data != document.data:
            document.data = data
            document.dirty = document.published_data != data
            document.version += 1
            record(document, request.user, "saved")
    return JsonResponse(representation(document, request))


@endpoint(["POST"])
def document_action(request, site, document_id, action):
    if action not in {"publish", "unpublish", "restore", "duplicate", "refresh", "stash"}:
        raise Http404
    document = locked_document(request, site, document_id, "publish" if action in {"publish", "unpublish"} else "edit", True)
    payload = body(request)
    if action not in {"duplicate", "stash"}:
        assert_version(document, payload)
    backend = adapter(site, document.kind)
    if action == "stash":
        if document.kind != "pages" or type(payload.get("version")) is not int:
            raise CMSProblem("Saving a separate version is available for pages.", status=422)
        source = get_object_or_404(Revision, document=document, version=payload["version"])
        validation_document = copy.copy(document)
        validation_document.data = source.data
        saved_data = backend.clean(payload.get("data"), validation_document)
        document.version += 1
        document.updated_by = request.user
        document.save()
        Revision.objects.create(document=document, version=document.version, data=saved_data, action="saved_copy", created_by=request.user)
        return JsonResponse(representation(document, request))
    if action == "publish":
        before = copy.deepcopy(document.data)
        product = backend.publish(document)
        from .translation_review import rebase
        rebase(document, before)
        document.published_data = copy.deepcopy(document.data)
        document.live_fingerprint = backend.live_fingerprint(product)
        document.dirty = False
        document.published_at = timezone.now()
    elif action == "unpublish":
        if document.target_id:
            product = get_object_or_404(getattr(backend, "model", ArmsProduct).objects.select_for_update(), pk=document.target_id)
            if backend.live_fingerprint(product) != document.live_fingerprint:
                raise CMSProblem("The product was changed outside CMS. Open the latest version.", status=409)
            field = "is_published" if hasattr(product, "is_published") else "available"
            if not hasattr(product, field):
                raise CMSProblem("This item is used by other products. Remove its placement from the product instead of unpublishing it.", status=422)
            setattr(product, field, False)
            product.save()
            document.live_fingerprint = backend.live_fingerprint(product)
        document.published_data = None
        document.published_at = None
        document.dirty = True
    elif action == "restore":
        version = payload.get("restore_version")
        if type(version) is not int:
            raise CMSProblem("Select a version to restore.")
        revision = get_object_or_404(Revision, document=document, version=version)
        document.data = backend.clean(revision.data, document, restoring=True)
        document.dirty = document.data != document.published_data
    elif action == "refresh":
        preserve = payload.get("preserve_draft", False)
        if type(preserve) is not bool:
            raise CMSProblem("Choose whether to preserve the draft.", status=422)
        if document.dirty and not preserve:
            raise CMSProblem("Save your changes as a copy first. Refreshing must not discard the draft.", status=409)
        if document.target_id is None:
            raise CMSProblem("This draft has no website version yet.", status=422)
        from .comparison import website_state
        data, live_version, published = website_state(document, lock=True)
        if preserve:
            if payload.get("live_version") != live_version:
                raise CMSProblem("The website changed again. Compare the latest version before loading it. Your draft is unchanged.", status=409)
            document.version += 1
            record(document, request.user, "saved_copy")
        document.data = data
        document.published_data = copy.deepcopy(data) if published else None
        document.live_fingerprint = live_version
        document.dirty = False
        document.published_at = (document.published_at or timezone.now()) if published else None
    elif action == "duplicate":
        data = copy.deepcopy(payload.get("data", document.data))
        if document.kind == "pages":
            raise CMSProblem("This page has a fixed layout. Previous versions can be restored from history.", status=422)
        if site == "ai-def":
            data = backend.clean(data, document)
            def reset_ids(row):
                row["id"] = str(uuid4())
                for children in row["sections"].values():
                    for child in children:
                        reset_ids(child)
            group_ids = {key: {row["id"]: str(uuid4()) for row in data["sections"].get(key, [])} for key in ("characteristics_blocks", "modules_blocks")}
            old_sections = copy.deepcopy(data["sections"])
            reset_ids(data)
            for key in ("characteristics_blocks", "modules_blocks"):
                for index, row in enumerate(data["sections"].get(key, [])):
                    row["id"] = group_ids[key][old_sections[key][index]["id"]]
            for key, group in (("characteristic", "characteristics_blocks"), ("module_placements", "modules_blocks")):
                for row in data["sections"].get(key, []):
                    if row["fields"].get("block") in group_ids[group]:
                        row["fields"]["block"] = group_ids[group][row["fields"]["block"]]
            if "slug" in data["fields"]:
                data["fields"]["slug"] = ""
            name_key = "title" if "title" in data["fields"] else "name"
            name = data["fields"].get(name_key)
            if isinstance(name, dict):
                data["fields"][name_key] = {language: ((value or "") + " — copy")[:255] if value else value for language, value in name.items()}
            document = Document(site=site, kind=document.kind, data=data)
            record(document, request.user, "created")
            return JsonResponse(representation(document, request), status=201)
        if not isinstance(data, dict) or not isinstance(data.get("variants"), list):
            raise CMSProblem("Unable to read the product for duplication.")
        for variant in data["variants"]:
            if not isinstance(variant, dict) or not isinstance(variant.get("images"), list):
                raise CMSProblem("Unable to read the variant for duplication.")
            variant["id"] = str(uuid4())
            for photo in variant["images"]:
                if not isinstance(photo, dict):
                    raise CMSProblem("Unable to read the photo.")
                photo["id"] = str(uuid4())
        data = backend.clean(data, document)
        data["slug"] = ""
        data["name"] = (data["name"] + " — copy")[:255]
        document = Document(site=site, kind=document.kind, data=data)
        record(document, request.user, "created")
        return JsonResponse(representation(document, request), status=201)
    document.version += 1
    record(document, request.user, action)
    return JsonResponse(representation(document, request))


@endpoint(["GET"])
def history(request, site, document_id):
    document = locked_document(request, site, document_id)
    try:
        before = int(request.GET.get("before", document.version + 1))
    except ValueError:
        raise CMSProblem("Invalid version.")
    revisions = document.revisions.filter(version__lt=before).select_related("created_by")[:30]
    return JsonResponse({"items": [{"version": revision.version, "action": revision.action, "created_at": revision.created_at.isoformat(),
                                   "author": revision.created_by.get_full_name() or "Team member" if revision.created_by else "Deleted team member"}
                                  for revision in revisions]})


@endpoint(["GET"])
def preview(request, site, document_id):
    document = locked_document(request, site, document_id)
    backend = adapter(site, document.kind)
    revision = request.GET.get("revision")
    if request.GET.get("published") == "1":
        if document.published_data is None or not document.target_id:
            raise CMSProblem("This material has not been published.", status=422)
        obj = get_object_or_404(getattr(backend, "model", ArmsProduct), pk=document.target_id)
        from .content import visibility
        if not visibility(obj):
            raise CMSProblem("This material is not currently published.", status=422)
        data = backend.snapshot(obj)
    elif revision:
        try:
            version = int(revision)
        except ValueError:
            raise CMSProblem("Invalid version.")
        saved = get_object_or_404(Revision, document=document, version=version)
        data = adapter(site, document.kind).clean(saved.data, document, restoring=True)
    else:
        data = adapter(site, document.kind).clean(document.data, document)
    if site == "arms" and document.kind == "products" and not data.get("variants"):
        raise CMSProblem("Add a product variant to open preview.", status=422, fields={"variants": "Add at least one variant."})
    language = request.GET.get("lang", "en")
    result = backend.preview(data, request, language, site)
    if request.GET.get("inspect") == "1":
        from .preview_fields import preview_fields
        preview_document = copy.copy(document)
        preview_document.data = data
        result["_cms_fields"] = preview_fields(data, language, representation(preview_document, request, include_review=False)["media"])
        result["_cms_version"] = document.version
    return JsonResponse(result)


@endpoint(["POST"])
def upload(request, site):
    access(request, site, "edit")
    file = request.FILES.get("file")
    kind = request.POST.get("kind", "image")
    if kind in {"document", "video"}:
        limit = 20 if kind == "document" else 45
        if not file or file.size > limit * 1024 * 1024:
            raise CMSProblem(f"Select a file up to {limit} MB.", status=422)
        prefix = file.read(32)
        file.seek(0)
        extension = Path(file.name).suffix.lower()
        valid = (kind == "document" and extension == ".pdf" and prefix.startswith(b"%PDF-")) or (kind == "video" and ((extension == ".mp4" and prefix[4:8] == b"ftyp") or (extension == ".webm" and prefix.startswith(b"\x1a\x45\xdf\xa3"))))
        if not valid:
            raise CMSProblem("The file format does not match its content. Documents: PDF; videos: MP4 or WebM.", status=422)
        asset = MediaAsset(site=site, original_name=Path(file.name).name[:255], uploaded_by=request.user)
        asset.file.save(uuid4().hex + extension, file, save=False)
        try:
            asset.save()
        except Exception:
            asset.file.delete(save=False)
            raise
        return JsonResponse({"ref": {"asset_id": str(asset.pk)}, "url": request.build_absolute_uri(asset.file.url), "width": None, "height": None}, status=201)
    if kind != "image":
        raise CMSProblem("Unsupported file type.", status=422)
    if not file or file.size > 20 * 1024 * 1024:
        raise CMSProblem("Select an image up to 20 MB.", status=422)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(file) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError
                source.load()
                image = ImageOps.exif_transpose(source)
                if image.width * image.height > 40_000_000:
                    raise ValueError
                image.thumbnail((6000, 6000))
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                output = io.BytesIO()
                image.save(output, "WEBP", quality=90)
                width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise CMSProblem("Unable to open the image. Use JPEG, PNG or WebP up to 40 megapixels.", status=422)
    asset = MediaAsset(site=site, original_name=Path(file.name).name[:255], uploaded_by=request.user, width=width, height=height)
    asset.file.save(uuid4().hex + ".webp", ContentFile(output.getvalue()), save=False)
    try:
        asset.save()
    except Exception:
        asset.file.delete(save=False)
        raise
    return JsonResponse({"ref": {"asset_id": str(asset.pk)}, "url": request.build_absolute_uri(asset.file.url), "width": width, "height": height}, status=201)
