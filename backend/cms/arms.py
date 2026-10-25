import copy
import hashlib
import json
from uuid import UUID, uuid4

from django.utils.text import slugify

from main.arms_models import ArmsImage, ArmsProduct, ArmsVariant, localized_content

from .errors import CMSProblem
from .models import MediaAsset


LANGUAGES = ("en", "de", "sk", "es", "fr", "it", "ru")


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def media_ref(image, legacy=""):
    return {"path": image.name, "storage": True} if image else ({"path": legacy, "storage": False} if legacy else None)


def snapshot(product):
    return {
        "name": product.name, "slug": product.slug, "brand": product.brand,
        "category": product.category, "cover": media_ref(product.image, product.legacy_image),
        "content": copy.deepcopy(product.content), "width": product.width, "height": product.height,
        "variants": [{
            "id": variant.pk, "code": variant.code, "model_name": variant.model_name,
            "content": copy.deepcopy(variant.content),
            "images": [{"id": photo.pk, "media": media_ref(photo.image, photo.legacy_path), **({"alt": copy.deepcopy(photo.alt)} if photo.alt else {})} for photo in variant.images.all()],
        } for variant in product.variants.all()],
    }


def live_fingerprint(product):
    return fingerprint({"data": snapshot(product), "available": product.available})


def empty():
    return {"name": "", "slug": "", "brand": "AI DEF", "category": "pistols", "cover": None,
            "content": {}, "width": 1500, "height": 1000, "variants": []}


def _existing_refs(data):
    result = set()
    if isinstance(data, dict):
        if set(data) == {"path", "storage"}:
            result.add((data["path"], data["storage"]))
        for value in data.values():
            result.update(_existing_refs(value))
    elif isinstance(data, list):
        for value in data:
            result.update(_existing_refs(value))
    return result


def clean(data, document, *, publishing=False, restoring=False):
    errors = {}
    if not isinstance(data, dict) or set(data) - set(empty()):
        raise CMSProblem("Unable to read product details.")

    def text(value, path, limit, required=False):
        if not isinstance(value, str) or len(value) > limit:
            errors[path] = f"Enter text of up to {limit} characters."
            return ""
        if publishing:
            value = value.strip()
        if required and not value.strip():
            errors[path] = "Complete this field before publishing."
        return value

    def items(value, path, limit):
        if not isinstance(value, list) or len(value) > limit:
            errors[path] = f"Maximum allowed: {limit} items."
            return []
        return value

    allowed_refs = _existing_refs(document.data) | _existing_refs(document.published_data)
    if restoring:
        # Revision data is read from this document's immutable server-side history.
        allowed_refs |= _existing_refs(data)
    asset_ids = set()

    def image(value, path):
        if value is None:
            return None
        if isinstance(value, dict) and set(value) == {"asset_id"}:
            try:
                asset_ids.add(UUID(str(value["asset_id"])))
                return {"asset_id": str(UUID(str(value["asset_id"])))}
            except (ValueError, TypeError, AttributeError):
                pass
        elif isinstance(value, dict) and set(value) == {"path", "storage"}:
            if isinstance(value["path"], str) and type(value["storage"]) is bool and (value["path"], value["storage"]) in allowed_refs:
                return value.copy()
        errors[path] = "Select a photo uploaded for this site."
        return None

    def translations(value, path, variant=False):
        if not isinstance(value, dict) or set(value) - set(LANGUAGES):
            errors[path] = "Unsupported language."
            return {}
        result = {}
        for language, content in value.items():
            prefix = f"{path}.{language}"
            allowed = {"label", "specifications"} if variant else {"description", "specifications", "cover_alt"}
            if not isinstance(content, dict) or set(content) - allowed:
                errors[prefix] = "Unknown translation fields."
                continue
            row = {}
            for key in ("label",) if variant else ("description", "cover_alt"):
                if key in content:
                    row[key] = text(content[key], f"{prefix}.{key}", 255 if key != "description" else 30000)
            specs = []
            for index, spec in enumerate(items(content.get("specifications", []), prefix + ".specifications", 100)):
                spec_path = f"{prefix}.specifications.{index}"
                if not isinstance(spec, dict) or set(spec) != {"label", "value"}:
                    errors[spec_path] = "Enter a specification name and value."
                    continue
                specs.append({key: text(spec[key], f"{spec_path}.{key}", 1000, publishing) for key in ("label", "value")})
            row["specifications"] = specs
            result[language] = row
        return result

    result = empty()
    for key, limit in (("name", 255), ("slug", 50), ("brand", 120), ("category", 20)):
        result[key] = text(data.get(key, result[key]), key, limit, publishing and key in {"name", "brand"})
    if result["category"] not in dict(ArmsProduct._meta.get_field("category").choices):
        errors["category"] = "Select a product category."
    if result["slug"] and (slugify(result["slug"]) != result["slug"]):
        errors["slug"] = "Use lowercase Latin letters, digits and hyphens in the URL."
    result["cover"] = image(data.get("cover"), "cover")
    if publishing and not result["cover"]:
        errors["cover"] = "Add a cover before publishing."
    for key in ("width", "height"):
        value = data.get(key, result[key])
        if type(value) is not int or not 1 <= value <= 30000:
            errors[key] = "Invalid image dimensions."
        else:
            result[key] = value
    result["content"] = translations(data.get("content", {}), "content")
    if publishing and not result["content"].get("en", {}).get("description"):
        errors["content.en.description"] = "Add an English description. It is used when a translation is missing."
    seen_codes, seen_ids, seen_image_ids = set(), set(), set()
    live = ArmsProduct.objects.filter(pk=document.target_id).prefetch_related("variants__images").first() if document.target_id else None
    existing = {variant.pk: variant for variant in live.variants.all()} if live else {}
    for index, variant in enumerate(items(data.get("variants", []), "variants", 100)):
        path = f"variants.{index}"
        if not isinstance(variant, dict) or set(variant) - {"id", "code", "model_name", "content", "images"}:
            errors[path] = "Unable to read the variant."
            continue
        identifier = variant.get("id")
        if restoring and type(identifier) is int and identifier not in existing:
            identifier = str(uuid4())
        if type(identifier) is int:
            if identifier not in existing or identifier in seen_ids:
                errors[path] = "This variant does not belong to the product or is listed more than once."
            seen_ids.add(identifier)
        elif not isinstance(identifier, str) or len(identifier) > 64:
            errors[path] = "Variant ID is missing."
            identifier = "invalid"
        elif identifier in seen_ids:
            errors[path] = "A variant is listed more than once."
        else:
            seen_ids.add(identifier)
        code = text(variant.get("code", ""), path + ".code", 50, publishing)
        if code and (slugify(code) != code or code in seen_codes):
            errors[path + ".code"] = "The code must be unique and contain Latin letters, digits and hyphens."
        seen_codes.add(code)
        row = {"id": identifier, "code": code, "model_name": text(variant.get("model_name", ""), path + ".model_name", 255),
               "content": translations(variant.get("content", {}), path + ".content", True), "images": []}
        if publishing and not row["content"].get("en", {}).get("label"):
            errors[path + ".content.en.label"] = "Enter an English variant name."
        photos = {photo.pk for photo in existing[identifier].images.all()} if identifier in existing else set()
        for photo_index, photo in enumerate(items(variant.get("images", []), path + ".images", 50)):
            photo_path = f"{path}.images.{photo_index}"
            if not isinstance(photo, dict) or set(photo) - {"id", "media", "alt"} or not {"id", "media"}.issubset(photo):
                errors[photo_path] = "Unable to read the photo."
                continue
            photo_id = photo["id"]
            if restoring and type(photo_id) is int and photo_id not in photos:
                photo_id = str(uuid4())
            if type(photo_id) is int:
                if photo_id not in photos or photo_id in seen_image_ids:
                    errors[photo_path] = "This photo does not belong to the variant or is listed more than once."
                seen_image_ids.add(photo_id)
            elif not isinstance(photo_id, str) or len(photo_id) > 64:
                errors[photo_path] = "Photo ID is missing."
            elif photo_id in seen_image_ids:
                errors[photo_path] = "A photo is listed more than once."
            else:
                seen_image_ids.add(photo_id)
            ref = image(photo["media"], photo_path + ".media")
            alt = photo.get("alt", {})
            if not isinstance(alt, dict) or set(alt) - set(LANGUAGES):
                errors[photo_path + ".alt"] = "Invalid photo description languages."
                alt = {}
            alt = {language: text(value, photo_path + ".alt." + language, 255) for language, value in alt.items()}
            if ref:
                row["images"].append({"id": photo_id, "media": ref, **({"alt": alt} if alt else {})})
        if publishing and not row["images"]:
            errors[path + ".images"] = "Add at least one photo to the variant."
        result["variants"].append(row)
    if publishing and not result["variants"]:
        errors["variants"] = "Add at least one product variant."
    found = set(MediaAsset.objects.filter(site=document.site, pk__in=asset_ids).values_list("pk", flat=True))
    if found != asset_ids:
        errors["images"] = "One of the photos is unavailable in this workspace."
    if errors:
        raise CMSProblem("Check the highlighted fields.", status=422, fields=errors)
    return result


def resolve_media(ref, site):
    if not ref:
        return "", False
    if "asset_id" in ref:
        asset = MediaAsset.objects.get(pk=ref["asset_id"], site=site)
        return asset.file.name, True
    return ref["path"], ref["storage"]


def publish(document):
    data = clean(document.data, document, publishing=True)
    product = ArmsProduct.objects.select_for_update().filter(pk=document.target_id).first() if document.target_id else ArmsProduct()
    if product is None:
        raise CMSProblem("The product was deleted. Create a copy of the draft.", status=409)
    if document.target_id and live_fingerprint(product) != document.live_fingerprint:
        raise CMSProblem("The product was changed outside CMS. Save your work as a copy and open the latest version.", status=409)
    slug = data["slug"] or slugify(data["name"])[:40] or "product"
    base, suffix = slug, 1
    while ArmsProduct.objects.filter(slug=slug).exclude(pk=product.pk).exists():
        if data["slug"]:
            raise CMSProblem("This URL is already in use.", status=422, fields={"slug": "Choose a different page URL."})
        suffix += 1
        slug = f"{base}-{suffix}"
    for key in ("name", "brand", "category", "content", "width", "height"):
        setattr(product, key, data[key])
    product.slug = slug
    path, stored = resolve_media(data["cover"], document.site)
    product.image, product.legacy_image = (path, "") if stored else ("", path)
    if not product.pk:
        from django.db.models import Max
        product.order = (ArmsProduct.objects.aggregate(value=Max("order"))["value"] or 0) + 10
    product.available = True
    product.full_clean()
    product.save()
    existing = {variant.pk: variant for variant in product.variants.all()}
    # Temporary codes allow an editor to swap two existing variant codes atomically.
    for variant in existing.values():
        variant.code = "cms-" + uuid4().hex
        variant.save(update_fields=["code"])
    keep = []
    for index, row in enumerate(data["variants"]):
        variant = existing.get(row["id"]) or ArmsVariant(product=product)
        for key in ("code", "model_name", "content"):
            setattr(variant, key, row[key])
        variant.order = index * 10
        variant.full_clean()
        variant.save()
        keep.append(variant.pk)
        photos = {photo.pk: photo for photo in variant.images.all()}
        photo_ids = []
        for photo_index, photo_row in enumerate(row["images"]):
            photo = photos.get(photo_row["id"]) or ArmsImage(variant=variant)
            path, stored = resolve_media(photo_row["media"], document.site)
            photo.image, photo.legacy_path = (path, "") if stored else ("", path)
            photo.alt = photo_row.get("alt", {})
            photo.order = photo_index * 10
            photo.full_clean()
            photo.save()
            photo_ids.append(photo.pk)
        variant.images.exclude(pk__in=photo_ids).delete()
    product.variants.exclude(pk__in=keep).delete()
    document.target_id = product.pk
    # Persist the actual IDs and paths assigned during publication for subsequent edits.
    document.data = snapshot(ArmsProduct.objects.prefetch_related("variants__images").get(pk=product.pk))
    return product


def preview(data, request, language, site):
    from django.core.files.storage import default_storage
    language = language if language in LANGUAGES else "en"

    def url(ref):
        path, stored = resolve_media(ref, site)
        return request.build_absolute_uri(default_storage.url(path)) if path and stored else path

    content = localized_content(data.get("content", {}), language)
    variants = []
    for row in data.get("variants", []):
        translated = localized_content(row.get("content", {}), language)
        variants.append({"id": row["code"] or str(row["id"]), "label": translated.get("label") or row["code"] or "Variant",
                         "modelName": row["model_name"] or data["name"], "images": [url(photo["media"]) for photo in row["images"]],
                         "imageAlts": {url(photo["media"]): photo.get("alt", {}).get(language) or photo.get("alt", {}).get("en", "") for photo in row["images"]},
                         "specifications": translated.get("specifications", [])})
    return {"id": data["slug"] or "preview", "name": data["name"], "brand": data["brand"], "category": data["category"],
            "description": content.get("description", ""), "image": url(data["cover"]), "coverAlt": content.get("cover_alt") or data.get("content", {}).get("en", {}).get("cover_alt", ""), "width": data["width"], "height": data["height"],
            "variants": variants, "specifications": content.get("specifications", [])}
