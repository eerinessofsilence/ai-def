"""Explicit content aggregates; the client never imports Django admin forms or widgets."""
import copy
from datetime import date
from html import escape
from html.parser import HTMLParser
from uuid import UUID, uuid4
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import models, transaction
from django.db.models import Max
from django.utils import translation
from django.utils.text import slugify
from modeltranslation.translator import translator

from main import models as main
from portal import models as portal

from .arms import _existing_refs, fingerprint, media_ref, resolve_media
from .errors import CMSProblem
from .models import MediaAsset


LANGUAGES = tuple(code for code, _ in settings.LANGUAGES)
LABELS = {
    "name": "Name", "title": "Title", "description": "Description", "slug": "Page URL",
    "category": "Category", "author": "Author", "subtitle": "Summary", "hero_image": "Cover",
    "image": "Image", "alt": "Image description", "image_alt": "Image description",
    "icon": "Icon", "dropdown_image": "Menu image", "specs": "Additional specifications",
    "value": "Value", "tags": "Tags", "icon_lucide": "Icon", "icon_file": "Icon file",
    "background_image": "Background image", "with_logo": "Show logo", "has_button": "Show button",
    "title_1": "First heading", "title_2": "Second heading", "description_1": "First text",
    "description_2": "Second text", "image_1": "First image", "image_2": "Second image",
    "paragraph": "Text", "video": "Video", "kind": "Block type", "html": "Text", "paragraphs": "Paragraphs",
    "items": "List items", "bullets": "List items", "anchor_id": "Section anchor",
    "published_at": "Publication date", "read_minutes": "Reading time, min", "role": "Job title",
    "serial_number": "Serial number", "is_preview": "Cover", "icon_type": "Icon source",
    "block": "Group", "module": "Module", "tag": "Tag", "button_text": "Button label", "text": "Text",
}


def safe_href(value):
    href = (value or "").strip()
    if not href or "\\" in href or any(ord(char) < 32 or ord(char) == 127 for char in href):
        return None
    if href.startswith(("/", "#")):
        return href if not href.startswith("//") else None
    try:
        parsed = urlsplit(href)
        if parsed.scheme.lower() in {"http", "https"} and parsed.hostname and not any(char.isspace() for char in parsed.netloc):
            parsed.port
            return href
        if parsed.scheme.lower() in {"mailto", "tel"} and href.split(":", 1)[1]:
            return href
    except ValueError:
        pass
    return None


class RichText(HTMLParser):
    tags = {"p", "br", "strong", "b", "em", "i", "u", "s", "a", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.result = []
        self.suppressed = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "iframe", "object"}:
            self.suppressed += 1
        if self.suppressed or tag not in self.tags:
            return
        attributes = ""
        if tag == "a":
            href = safe_href(dict(attrs).get("href", ""))
            if href:
                attributes = f' href="{escape(href, quote=True)}" rel="noopener noreferrer"'
        self.result.append(f"<{tag}{attributes}>")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "iframe", "object"}:
            self.suppressed = max(0, self.suppressed - 1)
            return
        if not self.suppressed and tag in self.tags and tag not in {"br", "hr"}:
            self.result.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.suppressed:
            self.result.append(escape(data))


def sanitize(value):
    parser = RichText()
    parser.feed(value)
    parser.close()
    return "".join(parser.result)


def node(model, relations=None):
    return {"model": model, "relations": relations or {}}


def product_node(civil=False):
    prefix = "CivilProduct" if civil else "Product"
    relations = {}
    for key, suffix, label, group, single in (
        ("images", "Image", "Photos", "photos", False),
        ("gallery", "Gallery", "Page gallery", "photos", False),
        ("features", "Feature", "Key specifications", "specs", False),
        ("sub_features", "SubFeature", "Additional specifications", "specs", False),
        ("technologies", "Technology", "Technology", "blocks", False),
        ("feature_blocks", "FeatureBlock", "Benefits", "blocks", False),
        ("info_blocks", "InfoBlock", "Text and images", "blocks", False),
        ("cta_blocks", "CTABlock", "Call to action", "blocks", False),
        ("drone_slider_media", "DroneSliderMedia", "Homepage card", "photos", True),
    ):
        relations[key] = {**node(getattr(main, prefix + suffix)), "label": label, "group": group, "single": single}
    if not civil:
        relations["final_cta_block"] = {**node(main.ProductFinalCTABlock), "label": "Final call to action", "group": "blocks", "single": True}
    return node(main.CivilProduct if civil else main.Product, relations)


ARTICLE = node(main.BlogPost, {
    "hero_images": {**node(main.BlogPostHeroImage), "label": "Cover images", "group": "photos"},
    "blocks": {**node(main.BlogPostBlock), "label": "Article content", "group": "blocks"},
    "sections": {**node(main.BlogPostSection), "label": "Legacy sections", "group": "legacy"},
})
PORTAL = node(portal.PortalProduct, {
    key: {**node(model), "label": label, "group": group}
    for key, model, label, group in (
        ("images", portal.ProductImage, "Photos", "photos"),
        ("gallery", portal.ProductGallery, "Gallery", "photos"),
        ("presentation_info", portal.ProductPresentationInfo, "Presentation", "blocks"),
        ("characteristics_blocks", portal.ProductCharacteristicsBlock, "Specification groups", "specs"),
        ("characteristic", portal.ProductCharacteristic, "Specifications", "specs"),
        ("modules_blocks", portal.ProductModulesBlock, "Module groups", "modules"),
        ("module_placements", portal.ProductModulePlacement, "Product modules", "modules"),
        ("text_blocks", portal.ProductTextBlock, "Text sections", "blocks"),
    )
})
MODULE = node(portal.ProductModule, {
    "module_images": {**node(portal.ProductModuleImage), "label": "Module photos", "group": "photos"},
    "module_characteristics": {**node(portal.ProductModuleCharacteristic), "label": "Module specifications", "group": "specs"},
})
NODES = {"products": product_node(), "civil-products": product_node(True), "articles": ARTICLE, "portal": PORTAL, "modules": MODULE}
REFERENCES = {"categories": main.Category, "civil-categories": main.CivilCategory, "authors": main.BlogAuthor, "rubrics": main.BlogCategory}
OMIT = {"id", "order", "created_at", "updated_at", "available", "is_published", "products"}


def translated_fields(model):
    return set(translator.get_options_for_model(model).fields) if model in translator.get_registered_models() else set()


def editable_fields(model, parent=None):
    translated = translated_fields(model)
    omitted = {name + "_" + language for name in translated for language in LANGUAGES}
    return [field for field in model._meta.fields if field.name not in OMIT | omitted
            and not (field.is_relation and field.remote_field.model == parent)]


def visibility(obj):
    return getattr(obj, "is_published", getattr(obj, "available", True))


class ContentAdapter:
    def __init__(self, kind):
        self.kind = kind
        self.definition = NODES[kind]
        self.model = self.definition["model"]

    def schema(self):
        def describe(definition, parent=None):
            model = definition["model"]
            translated = translated_fields(model)
            result = {"fields": [], "relations": {}, "label": definition.get("label", ""), "group": definition.get("group", ""), "single": definition.get("single", False)}
            for field in editable_fields(model, parent):
                reference = next((key for key, value in REFERENCES.items() if field.is_relation and field.remote_field.model == value), None)
                choices = []
                if field.is_relation and not reference:
                    if field.name == "module":
                        choices = [{"id": obj.pk, "label": obj.name} for obj in portal.ProductModule.objects.all().order_by("pk")]
                    # Block references are resolved against sibling groups in the current aggregate.
                field_type = "reference" if field.is_relation else ("file" if isinstance(field, models.FileField) else ("boolean" if isinstance(field, models.BooleanField) else ("json" if isinstance(field, models.JSONField) else ("date" if isinstance(field, models.DateField) else ("number" if isinstance(field, models.IntegerField) else ("richtext" if field.name == "html" else ("text" if isinstance(field, models.TextField) else "string")))))))
                result["fields"].append({"key": field.name, "label": LABELS.get(field.name, field.name.replace("_", " ").capitalize()), "type": field_type,
                                         "default": field.get_default() if field.has_default() else None,
                                         "translated": field.name in translated or (field.name == "alt" and hasattr(model, "translations")),
                                         "required": not field.blank and not field.null, "max_length": field.max_length,
                                         "choices": [{"id": key, "label": value} for key, value in field.choices] if field.choices else choices,
                                         "reference": reference, "related_group": "characteristics_blocks" if field.name == "block" and model == portal.ProductCharacteristic else ("modules_blocks" if field.name == "block" else None)})
            for key, relation in definition["relations"].items():
                result["relations"][key] = describe(relation, model)
            return result
        return describe(self.definition)

    def snapshot(self, obj):
        def read(instance, definition, parent=None):
            fields, relations = {}, {}
            model = definition["model"]
            translated = translated_fields(model)
            for field in editable_fields(model, parent):
                if field.name in translated:
                    fields[field.name] = {language: copy.deepcopy(getattr(instance, field.name + "_" + language)) for language in LANGUAGES}
                elif field.name == "alt" and hasattr(model, "translations"):
                    fields[field.name] = {language: instance.translations.filter(lang=language).values_list("alt", flat=True).first() or "" for language in LANGUAGES}
                elif isinstance(field, models.FileField):
                    fields[field.name] = media_ref(getattr(instance, field.name))
                elif field.is_relation:
                    fields[field.name] = getattr(instance, field.attname)
                else:
                    value = getattr(instance, field.name)
                    fields[field.name] = value.isoformat() if isinstance(value, date) else copy.deepcopy(value)
            for key, relation in definition["relations"].items():
                if relation.get("single"):
                    try:
                        child = getattr(instance, key)
                    except ObjectDoesNotExist:
                        child = None
                    rows = [child] if child else []
                else:
                    rows = getattr(instance, key).all()
                    rows = rows.order_by("order", "pk") if any(f.name == "order" for f in relation["model"]._meta.fields) else rows.order_by("pk")
                relations[key] = [read(child, relation, model) for child in rows]
            return {"id": instance.pk, "fields": fields, "sections": relations}
        return read(obj, self.definition)

    def empty(self, definition=None, parent=None):
        def create(definition, parent=None):
            model = definition["model"]
            obj = model()
            fields = {}
            for field in editable_fields(model, parent):
                value = field.get_default() if field.has_default() else (None if field.null or field.is_relation or isinstance(field, models.FileField) else ([] if isinstance(field, models.JSONField) else (False if isinstance(field, models.BooleanField) else (0 if isinstance(field, models.IntegerField) else ""))))
                fields[field.name] = {language: value for language in LANGUAGES} if field.name in translated_fields(model) or (field.name == "alt" and hasattr(model, "translations")) else value
            return {"id": str(uuid4()), "fields": fields, "sections": {key: [] for key in definition["relations"]}}
        return create(definition or self.definition, parent)

    def live_fingerprint(self, obj):
        return fingerprint({"data": self.snapshot(obj), "published": visibility(obj)})

    def clean(self, data, document, *, publishing=False, restoring=False):
        errors = {}
        allowed_refs = _existing_refs(document.data) | _existing_refs(document.published_data)
        if restoring:
            allowed_refs |= _existing_refs(data)
        allowed_ids = {}
        def remember(value, definition):
            if not isinstance(value, dict):
                return
            if type(value.get("id")) is int:
                allowed_ids.setdefault(definition["model"], set()).add(value["id"])
            for key, relation in definition["relations"].items():
                for child in value.get("sections", {}).get(key, []):
                    remember(child, relation)
        remember(document.data, self.definition)
        remember(document.published_data, self.definition)
        if restoring:
            remember(data, self.definition)
        assets = set()
        def parse(value, definition, path="", parent=None):
            model = definition["model"]
            if not isinstance(value, dict) or set(value) != {"id", "fields", "sections"} or not isinstance(value["fields"], dict) or not isinstance(value["sections"], dict):
                errors[path or "content"] = "Unable to read content."
                return self.empty() if not path else {"id": str(uuid4()), "fields": {}, "sections": {}}
            identifier = value["id"]
            if type(identifier) is int:
                if identifier not in allowed_ids.get(model, set()):
                    errors[path] = "This entry does not belong to this content."
            elif not isinstance(identifier, str) or not identifier or len(identifier) > 64:
                errors[path] = "Invalid block ID."
                identifier = str(uuid4())
            result = {"id": identifier, "fields": {}, "sections": {}}
            fields = {field.name: field for field in editable_fields(model, parent)}
            if set(value["fields"]) != set(fields):
                errors[path or "fields"] = "The field structure has changed. Reload the editor."
            def scalar(item, field, field_path):
                try:
                    if isinstance(field, models.FileField):
                        if item is None:
                            return None
                        if isinstance(item, dict) and set(item) == {"asset_id"}:
                            asset_id = UUID(str(item["asset_id"]))
                            assets.add(asset_id)
                            return {"asset_id": str(asset_id)}
                        if isinstance(item, dict) and set(item) == {"path", "storage"} and (item["path"], item["storage"]) in allowed_refs:
                            return copy.deepcopy(item)
                        raise ValueError
                    if field.is_relation:
                        if item is None:
                            return None
                        if type(item) is not int and not (field.name == "block" and isinstance(item, str)):
                            raise ValueError
                        if type(item) is int and not field.remote_field.model.objects.filter(pk=item).exists():
                            raise ValueError
                        return item
                    if isinstance(field, models.JSONField):
                        if item is not None and not isinstance(item, (list, dict)):
                            raise ValueError
                        if item is not None and field.name in {"description_1", "description_2", "paragraphs", "items", "bullets", "tags"}:
                            if not isinstance(item, list) or len(item) > 100 or any(not isinstance(text, str) or len(text) > 30000 for text in item):
                                raise ValueError
                        if publishing:
                            field.run_validators(item)
                        return copy.deepcopy(item)
                    if isinstance(field, models.BooleanField):
                        if type(item) is not bool:
                            raise ValueError
                        return item
                    if isinstance(field, models.IntegerField):
                        if type(item) is not int or not 0 <= item <= 2_147_483_647:
                            raise ValueError
                        return item
                    if isinstance(field, models.DateField):
                        return date.fromisoformat(item).isoformat() if item else None
                    if item is None and field.null:
                        return None
                    if not isinstance(item, str) or len(item) > (field.max_length or 150000):
                        raise ValueError
                    if field.name == "html":
                        item = sanitize(item)
                    if field.choices and item not in dict(field.choices):
                        raise ValueError
                    return item
                except (ValueError, TypeError, ValidationError) as error:
                    if isinstance(error, ValidationError):
                        message = " ".join(error.messages)
                    elif isinstance(field, models.DateField):
                        message = "Enter a valid date in YYYY-MM-DD format, or clear the date."
                    elif isinstance(field, models.BooleanField):
                        message = "Use the checkbox to enable or disable this option."
                    elif isinstance(field, models.IntegerField):
                        message = "Enter a whole number between 0 and 2,147,483,647."
                    elif isinstance(field, models.FileField):
                        message = "Choose a file from this site’s media library."
                    elif field.is_relation:
                        message = "Select an entry that is available in this workspace."
                    elif isinstance(field, models.JSONField):
                        message = "Enter a valid list or set of specifications. Text lists allow up to 100 rows of 30,000 characters each."
                    elif field.choices:
                        message = "Select one of the available options."
                    elif isinstance(item, str):
                        message = f"Enter up to {field.max_length or 150000:,} characters."
                    else:
                        message = "Enter text in this field."
                    errors[field_path] = message
                    return None
            for name, field in fields.items():
                item = value["fields"].get(name)
                field_path = f"{path + '.' if path else ''}fields.{name}"
                if name in translated_fields(model) or (name == "alt" and hasattr(model, "translations")):
                    if not isinstance(item, dict) or set(item) - set(LANGUAGES):
                        errors[field_path] = "Invalid translations."
                        item = {}
                    result["fields"][name] = {language: scalar(item.get(language), field, field_path + "." + language) if item.get(language) is not None else None for language in LANGUAGES}
                    required_value = result["fields"][name].get("en")
                else:
                    result["fields"][name] = scalar(item, field, field_path)
                    required_value = result["fields"][name]
                required_value = required_value.strip() if isinstance(required_value, str) else required_value
                if publishing and not field.blank and not field.null and not required_value and not isinstance(field, (models.BooleanField, models.IntegerField)):
                    if name != "slug":
                        errors[field_path] = "Fill in “" + LABELS.get(name, name) + "” before publishing."
            if set(value["sections"]) != set(definition["relations"]):
                errors[path or "sections"] = "The section structure has changed. Reload the editor."
            for key, relation in definition["relations"].items():
                rows = value["sections"].get(key)
                if not isinstance(rows, list) or len(rows) > (1 if relation.get("single") else 300):
                    errors[key] = "Too many blocks or an invalid section."
                    rows = []
                parsed = [parse(child, relation, f"{path + '.' if path else ''}sections.{key}.{index}", model) for index, child in enumerate(rows)]
                identifiers = [row["id"] for row in parsed]
                if len(set(identifiers)) != len(identifiers):
                    errors[key] = "A block is listed more than once."
                result["sections"][key] = parsed
            return result
        result = parse(data, self.definition)
        if set(MediaAsset.objects.filter(site=document.site, pk__in=assets).values_list("pk", flat=True)) != assets:
            errors["media"] = "The file is unavailable in this workspace."
        if self.kind == "portal":
            for relation, group in (("characteristic", "characteristics_blocks"), ("module_placements", "modules_blocks")):
                group_ids = {row["id"] for row in result["sections"].get(group, [])}
                for index, row in enumerate(result["sections"].get(relation, [])):
                    if row["fields"].get("block") is not None and row["fields"]["block"] not in group_ids:
                        errors[f"sections.{relation}.{index}.fields.block"] = "Select a group belonging to this product."
        if errors:
            raise CMSProblem("Check the highlighted fields.", status=422, fields=errors)
        return result

    def publish(self, document, *, preview=False):
        data = self.clean(document.data, document, publishing=not preview)
        obj = self.model.objects.select_for_update().filter(pk=document.target_id).first() if document.target_id else self.model()
        if obj is None:
            raise CMSProblem("The content was deleted. Create a copy of the draft.", status=409)
        if document.target_id and not preview and self.live_fingerprint(obj) != document.live_fingerprint:
            raise CMSProblem("The content was changed outside CMS. Save your work as a copy and open the latest version.", status=409)
        def write(row, definition, instance, parent=None, index=None, group_map=None, path=""):
            model = definition["model"]
            translated = translated_fields(model)
            field_defs = {field.name: field for field in editable_fields(model, type(parent) if parent else None)}
            image_alt = None
            for name, value in row["fields"].items():
                field = field_defs[name]
                if name in translated:
                    for language, text in value.items():
                        setattr(instance, name + "_" + language, text)
                    setattr(instance, name, value.get("en") if isinstance(field, models.JSONField) else (value.get("en") or ""))
                elif name == "alt" and hasattr(model, "translations"):
                    image_alt = value
                    instance.alt = value.get("en") or ""
                elif isinstance(field, models.FileField):
                    path, stored = resolve_media(value, document.site)
                    if path and not stored:
                        raise CMSProblem("This field requires an uploaded file.", status=422)
                    setattr(instance, name, path or None if field.null else path)
                elif field.is_relation:
                    if name == "block" and value is not None:
                        value = (group_map or {}).get(value)
                        if value is None:
                            raise CMSProblem("The group does not belong to this product.", status=422)
                    setattr(instance, field.attname, value)
                else:
                    setattr(instance, name, value)
            if parent:
                parent_field = next(field for field in model._meta.fields if field.is_relation and field.remote_field.model == type(parent))
                setattr(instance, parent_field.name, parent)
            if any(field.name == "order" for field in model._meta.fields):
                if index is not None:
                    instance.order = index * 10
                elif not instance.pk:
                    instance.order = (model.objects.aggregate(value=Max("order"))["value"] or 0) + 10
            if any(field.name == "slug" for field in model._meta.fields) and not instance.slug:
                base = slugify(getattr(instance, "name", "") or getattr(instance, "title", ""))[:210] or "content"
                slug, suffix = base, 1
                while model.objects.filter(slug=slug).exclude(pk=instance.pk).exists():
                    suffix += 1
                    slug = f"{base}-{suffix}"
                instance.slug = slug
            if hasattr(instance, "is_published"):
                instance.is_published = True
                if not instance.published_at:
                    instance.published_at = date.today()
            if hasattr(instance, "available"):
                instance.available = True
            if not preview:
                try:
                    instance.full_clean()
                except ValidationError as error:
                    fields = {}
                    for name, messages in getattr(error, "message_dict", {}).items():
                        parts = name.rsplit("_", 1)
                        key = ".".join(parts) if len(parts) == 2 and parts[1] in LANGUAGES else name
                        fields[f"{path + '.' if path else ''}fields.{key}"] = " ".join(messages)
                    raise CMSProblem("Check the highlighted fields before publishing.", status=422, fields=fields)
            instance.save()
            if image_alt is not None:
                for language, text in image_alt.items():
                    instance.translations.update_or_create(lang=language, defaults={"alt": text or ""})
            maps = {}
            for key, relation in definition["relations"].items():
                if relation.get("single"):
                    try:
                        child = getattr(instance, key)
                        existing = {child.pk: child}
                    except ObjectDoesNotExist:
                        existing = {}
                else:
                    existing = {child.pk: child for child in getattr(instance, key).all()}
                ids = []
                for position, child_row in enumerate(row["sections"][key]):
                    child = existing.get(child_row["id"]) or relation["model"]()
                    child = write(child_row, relation, child, instance, position, maps, f"{path + '.' if path else ''}sections.{key}.{position}")
                    ids.append(child.pk)
                    if key in {"characteristics_blocks", "modules_blocks"}:
                        maps[child_row["id"]] = child.pk
                for pk, child in existing.items():
                    if pk not in ids:
                        child.delete()
            return instance
        with translation.override("en"):
            obj = write(data, self.definition, obj)
        document.target_id = obj.pk
        document.data = self.snapshot(self.model.objects.get(pk=obj.pk))
        return obj

    def preview(self, data, request, language, site):
        from main.api import _serialize_blog_post_detail, _serialize_product_detail, _serialize_civil_product_detail
        from portal.api import _serialize_product_detail as serialize_portal
        from .models import Document
        document = Document(site=site, kind=self.kind, data=data, target_id=data["id"] if type(data["id"]) is int else None)
        # Build the exact public serializer response; rolled-back writes never become visible to visitors.
        with transaction.atomic():
            obj = self.publish(document, preview=True)
            request.META["HTTP_ACCEPT_LANGUAGE"] = language
            with translation.override(language if language in LANGUAGES else "en"):
                obj = self.model.objects.get(pk=obj.pk)
                serializer = {"products": _serialize_product_detail, "civil-products": _serialize_civil_product_detail,
                              "articles": _serialize_blog_post_detail, "portal": serialize_portal}.get(self.kind)
                result = serializer(request, obj) if serializer else {"name": obj.name, "description": obj.description}
            transaction.set_rollback(True)
        return result
