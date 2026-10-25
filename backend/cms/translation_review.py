"""Manual translation checkpoints; filled values alone never imply a reviewed translation."""
from html import unescape

from django.http import JsonResponse
from django.utils import timezone
from django.utils.html import strip_tags

from .arms import LANGUAGES as ARMS_LANGUAGES, fingerprint
from .content import LANGUAGES, NODES, editable_fields, translated_fields
from .errors import CMSProblem
from .media_usage import media_refs
from .models import MediaAsset
from .views import endpoint


def has_text(value):
    if isinstance(value, str):
        return bool(unescape(strip_tags(value)).replace("\xa0", " ").strip())
    if isinstance(value, dict):
        return any(has_text(child) for child in value.values())
    return isinstance(value, list) and any(has_text(child) for child in value)


def missing(original, translated):
    if isinstance(original, str):
        return int(has_text(original) and not has_text(translated))
    if isinstance(original, dict):
        return sum(missing(value, translated.get(key) if isinstance(translated, dict) else None) for key, value in original.items())
    if isinstance(original, list):
        return sum(missing(value, translated[index] if isinstance(translated, list) and index < len(translated) else None) for index, value in enumerate(original))
    return 0


def normalise(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return {key: normalise(child) for key, child in value.items()}
    if isinstance(value, list):
        return [normalise(child) for child in value]
    return value


def asset_paths(site, *snapshots):
    identifiers = {ref.removeprefix("asset:") for data in snapshots for ref in media_refs(data) if ref.startswith("asset:")}
    return {str(identifier): path for identifier, path in MediaAsset.objects.filter(site=site, pk__in=identifiers).values_list("pk", "file")} if identifiers else {}


def entries(data, site, kind, language, assets):
    result = {}

    def add(key, path, original, translated, image=None):
        if not has_text(original) and not has_text(translated):
            return
        context = None
        if image:
            context = {"path": assets.get(str(image["asset_id"]), "unavailable"), "storage": True} if "asset_id" in image else image
        result[key] = {"path": path, "source": fingerprint([normalise(original), context]), "translation": fingerprint(normalise(translated)), "missing": missing(original, translated)}

    if kind == "pages":
        def visit(original, translated, key="content", path=f"content.{language}"):
            if isinstance(original, str) or isinstance(translated, str):
                add(key, path, original, translated)
            elif isinstance(original, dict) or isinstance(translated, dict):
                old = original if isinstance(original, dict) else {}
                new = translated if isinstance(translated, dict) else {}
                for field in dict.fromkeys([*old, *new]):
                    visit(old.get(field), new.get(field), key + "." + field, path + "." + field)
            elif isinstance(original, list) or isinstance(translated, list):
                old = original if isinstance(original, list) else []
                new = translated if isinstance(translated, list) else []
                for index in range(max(len(old), len(new))):
                    visit(old[index] if index < len(old) else None, new[index] if index < len(new) else None, f"{key}.{index}", f"{path}.{index}")
        visit(data.get("content", {}).get("en", {}), data.get("content", {}).get(language, {}))
    elif site == "arms":
        def content(values, key, path, cover=None):
            original, translated = values.get("en", {}), values.get(language, {})
            for field in dict.fromkeys([*original, *translated]):
                add(key + "." + field, path + "." + language + "." + field, original.get(field), translated.get(field), cover if field == "cover_alt" else None)
        content(data.get("content", {}), "content", "content", data.get("cover"))
        for index, variant in enumerate(data.get("variants", [])):
            stable = f"variants.{variant['id']}"
            path = f"variants.{index}"
            content(variant.get("content", {}), stable + ".content", path + ".content")
            for photo_index, photo in enumerate(variant.get("images", [])):
                alt = photo.get("alt", {})
                add(f"{stable}.images.{photo['id']}.alt", f"{path}.images.{photo_index}.alt.{language}", alt.get("en"), alt.get(language), photo.get("media"))
    elif kind in NODES:
        def visit(row, definition, parent=None, key="", path=""):
            model = definition["model"]
            translated = translated_fields(model)
            block = row.get("fields", {}).get("kind", "text")
            html = row.get("fields", {}).get("html", {})
            for field in editable_fields(model, parent):
                if field.name not in translated and not (field.name == "alt" and hasattr(model, "translations")):
                    continue
                if isinstance(html, dict) and "html" in row.get("fields", {}):
                    if field.name == "image_alt" and block != "image":
                        continue
                    if field.name in {"html", "paragraphs", "items"} and block in {"image", "divider"}:
                        continue
                    if field.name in {"paragraphs", "items"} and has_text(html.get("en")):
                        continue
                values = row.get("fields", {}).get(field.name, {})
                if isinstance(values, dict):
                    image = row["fields"].get("image") if field.name in {"alt", "image_alt"} else None
                    add(key + "fields." + field.name, path + "fields." + field.name + "." + language, values.get("en"), values.get(language), image)
            for field, relation in definition["relations"].items():
                if relation.get("group") == "legacy" and row.get("sections", {}).get("blocks"):
                    continue
                for index, child in enumerate(row.get("sections", {}).get(field, [])):
                    visit(child, relation, model, f"{key}sections.{field}.{child['id']}.", f"{path}sections.{field}.{index}.")
        visit(data, NODES[kind])
    return result


def status(document):
    assets = asset_paths(document.site, document.data)
    result = {}
    for language in (ARMS_LANGUAGES if document.site == "arms" else LANGUAGES):
        if language == "en":
            continue
        current = entries(document.data, document.site, document.kind, language, assets)
        checkpoint = document.translation_reviews.get(language, {})
        checked = checkpoint.get("fields", {})
        counts = dict.fromkeys(("missing", "source_changed", "translation_changed", "unreviewed", "reviewed"), 0)
        issues = []
        for key, value in current.items():
            previous = checked.get(key)
            state = "missing" if value["missing"] else "unreviewed" if previous is None else "source_changed" if value["source"] != previous["source"] else "translation_changed" if value["translation"] != previous["translation"] else "reviewed"
            counts[state] += 1
            if state != "reviewed":
                issues.append({"path": value["path"], "state": state})
        result[language] = {**counts, "total": len(current), "issues": issues, "checked_at": checkpoint.get("checked_at")}
    return result


def rebase(document, before):
    """Publication replaces temporary row IDs; keep checkpoints attached to the same written rows."""
    assets = asset_paths(document.site, before, document.data)
    for language, checkpoint in document.translation_reviews.items():
        old = entries(before, document.site, document.kind, language, assets)
        next_entries = entries(document.data, document.site, document.kind, language, assets)
        by_path = {value["path"]: key for key, value in old.items()}
        checked = checkpoint.get("fields", {})
        checkpoint["fields"] = {key: checked[by_path[value["path"]]] for key, value in next_entries.items() if value["path"] in by_path and by_path[value["path"]] in checked}


@endpoint(["POST"])
def review_translation(request, site, document_id):
    from .views import assert_version, body, locked_document, record, representation
    document = locked_document(request, site, document_id, "edit", True)
    payload = body(request)
    assert_version(document, payload)
    language = payload.get("language")
    allowed = ARMS_LANGUAGES if site == "arms" else LANGUAGES
    if set(payload) != {"version", "language"} or language not in allowed or language == "en":
        raise CMSProblem("Choose a translation language supported by this site.", status=422)
    current = entries(document.data, site, document.kind, language, asset_paths(site, document.data))
    if not current:
        raise CMSProblem("There are no translation fields to review.", status=422)
    errors = {value["path"]: "Complete this translation before marking the language reviewed." for value in current.values() if value["missing"]}
    if errors:
        raise CMSProblem("Complete the missing translations first. Publishing with English fallback remains available.", status=422, fields=errors)
    document.translation_reviews[language] = {"checked_at": timezone.now().isoformat(), "fields": {key: {"source": value["source"], "translation": value["translation"]} for key, value in current.items()}}
    document.version += 1
    record(document, request.user, "review_" + language)
    return JsonResponse(representation(document, request))
