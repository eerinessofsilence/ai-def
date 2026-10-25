import json

from . import arms_admin

from django import forms
from django.contrib import admin
from django.db.models import Q
from django.urls import reverse
from django.utils.html import format_html, format_html_join
from django.utils import timezone
from modeltranslation.admin import TabbedTranslationAdmin, TranslationStackedInline
from tinymce.widgets import TinyMCE

from aidef.admin_mixins import (
    HiddenModelTranslationTabsAdmin,
    ProductImageLanguageTabsMixin,
)
from .models import (
    BlogAuthor,
    BlogCategory,
    BlogPost,
    BlogPostBlock,
    BlogPostHeroImage,
    BlogPostSection,
    Category,
    CivilCategory,
    CivilProduct,
    CivilProductCTABlock,
    CivilProductDroneSliderMedia,
    CivilProductFeature,
    CivilProductFeatureBlock,
    CivilProductGallery,
    CivilProductImage,
    CivilProductInfoBlock,
    CivilProductSubFeature,
    CivilProductTechnology,
    ContactRequest,
    Product,
    ProductCTABlock,
    ProductDroneSliderMedia,
    ProductFinalCTABlock,
    ProductFeature,
    ProductFeatureBlock,
    ProductGallery,
    ProductImage,
    ProductImageTranslation,
    ProductInfoBlock,
    ProductSubFeature,
    ProductTechnology,
)

LANGUAGE_CHOICES = (
    ("en", "English"),
    ("de", "Deutsch"),
    ("sk", "Slovak"),
    ("es", "Spanish"),
    ("fr", "French"),
    ("it", "Italian"),
)
LANGUAGE_CODES = {code for code, _ in LANGUAGE_CHOICES}
DEFAULT_LANGUAGE = "en"
ADMIN_LIST_PER_PAGE = 50
LANGUAGE_LABELS = dict(LANGUAGE_CHOICES)
LANGUAGE_TOTAL = len(LANGUAGE_CHOICES)


def _get_language_from_request(request):
    raw = request.GET.get("lang", "")
    if raw:
        base = raw.split("-")[0].strip().lower()
        if base in LANGUAGE_CODES:
            return base
    fallback = getattr(request, "LANGUAGE_CODE", "")
    if fallback:
        base = fallback.split("-")[0].strip().lower()
        if base in LANGUAGE_CODES:
            return base
    return DEFAULT_LANGUAGE


def _strip_translation_label_suffix(label):
    if label in (None, ""):
        return label
    label = str(label)
    for code in LANGUAGE_CODES:
        suffix = f" [{code}]"
        if label.endswith(suffix):
            return label[: -len(suffix)]
    return label


def _format_json_for_textarea(value):
    if value in (None, "", {}, []):
        return ""
    if isinstance(value, dict):
        if all(
            isinstance(key, str)
            and isinstance(item, (str, int, float, bool, type(None)))
            for key, item in value.items()
        ):
            return "\n".join(f"{key}: {item}" for key, item in value.items())
        return json.dumps(value, ensure_ascii=False, indent=2)
    if isinstance(value, list):
        if all(isinstance(item, (str, int, float, bool, type(None))) for item in value):
            return "\n".join(str(item) for item in value)
        return json.dumps(value, ensure_ascii=False, indent=2)
    return json.dumps(value, ensure_ascii=False, indent=2)


def _parse_json_or_lines(value, *, split_commas=False, field_label="Field", max_items=None):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        raw_items = list(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise forms.ValidationError(
                    f"{field_label}: invalid JSON array."
                ) from exc
            if not isinstance(parsed, list):
                raise forms.ValidationError(
                    f"{field_label}: use a JSON array or line-based input."
                )
            raw_items = parsed
        else:
            raw_items = []
            for line in text.splitlines():
                chunk = line.strip()
                if not chunk:
                    continue
                if split_commas:
                    raw_items.extend(
                        item.strip() for item in chunk.split(",") if item.strip()
                    )
                else:
                    raw_items.append(chunk)
    else:
        raise forms.ValidationError(
            f"{field_label}: unsupported value type."
        )

    cleaned = [str(item).strip() for item in raw_items if str(item).strip()]
    if max_items is not None and len(cleaned) > max_items:
        raise forms.ValidationError(
            f"{field_label}: no more than {max_items} items are allowed."
        )
    return cleaned


def _parse_specs_value(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str):
        raise forms.ValidationError("Specs: unsupported value type.")

    text = value.strip()
    if not text:
        return None

    if text.startswith("{") or text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise forms.ValidationError(
                "Specs: invalid JSON payload."
            ) from exc
        if not isinstance(parsed, (dict, list)):
            raise forms.ValidationError(
                "Specs: root value must be JSON object or array."
            )
        return parsed

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None

    if all(":" in line for line in lines):
        result = {}
        for line in lines:
            key, raw_val = line.split(":", 1)
            key = key.strip()
            raw_val = raw_val.strip()
            if not key:
                raise forms.ValidationError(
                    "Specs: key is required for each 'key: value' row."
                )
            result[key] = raw_val
        return result

    return lines


def _safe_image_url(obj):
    if not obj or not getattr(obj, "image", None):
        return None
    try:
        return obj.image.url
    except (ValueError, AttributeError):
        return None


def _get_alt_map(obj):
    cached = getattr(obj, "_admin_alt_map_cache", None)
    if cached is not None:
        return cached

    alt_map = {code: "" for code, _ in LANGUAGE_CHOICES}
    if obj and getattr(obj, "pk", None):
        for translation in obj.translations.all():
            alt_map[translation.lang] = (translation.alt or "").strip()

    english_alt = (getattr(obj, "alt", "") or "").strip()
    if english_alt and not alt_map[DEFAULT_LANGUAGE]:
        alt_map[DEFAULT_LANGUAGE] = english_alt

    if obj is not None:
        setattr(obj, "_admin_alt_map_cache", alt_map)
    return alt_map


def _get_alt_coverage(obj):
    alt_map = _get_alt_map(obj)
    filled = [code for code, value in alt_map.items() if value]
    missing = [code for code, value in alt_map.items() if not value]
    return alt_map, filled, missing


def _render_alt_coverage_badge(obj):
    _, filled, missing = _get_alt_coverage(obj)
    summary = f"{len(filled)}/{LANGUAGE_TOTAL}"
    if missing:
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;'
            'border-radius:999px;background:#fff4f4;color:#ba2121;'
            'border:1px solid #ba2121;font-weight:600;">Missing {}</span>',
            summary,
        )
    return format_html(
        '<span style="display:inline-block;padding:2px 8px;'
        'border-radius:999px;background:#edf9ed;color:#106010;'
        'border:1px solid #2f9e44;font-weight:600;">Complete {}</span>',
        summary,
    )


def _render_alt_links(obj):
    if not obj or not getattr(obj, "pk", None):
        return "Save image first to edit alt translations."

    alt_map, _, _ = _get_alt_coverage(obj)
    change_url = reverse(
        f"admin:{obj._meta.app_label}_{obj._meta.model_name}_change",
        args=[obj.pk],
    )
    links = []
    for code, _ in LANGUAGE_CHOICES:
        missing_style = "border-color:#ba2121;color:#ba2121;" if not alt_map.get(code) else ""
        links.append((missing_style, change_url, code, code.upper()))

    return format_html(
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">{}</div>',
        format_html_join(
            "",
            '<a class="button" style="margin:0;{}" href="{}?lang={}">{}</a>',
            links,
        ),
    )


class SingleLanguageTranslatedInlineMixin:
    translated_base_fields = ()

    def _resolve_translated_field_for_language(self, field_name, language):
        if not isinstance(field_name, str):
            return field_name

        if field_name in self.translated_base_fields:
            return f"{field_name}_{language}"

        for base_name in self.translated_base_fields:
            prefix = f"{base_name}_"
            if field_name.startswith(prefix):
                return f"{base_name}_{language}"

        return field_name

    def get_formset(self, request, obj=None, **kwargs):
        base_formset = super().get_formset(request, obj, **kwargs)
        language = _get_language_from_request(request)
        base_form = base_formset.form

        class LanguageBoundForm(base_form):
            pass

        LanguageBoundForm.language = language
        LanguageBoundForm.base_fields = base_form.base_fields.copy()

        for base_name in self.translated_base_fields:
            current_field_name = f"{base_name}_{language}"
            if current_field_name in LanguageBoundForm.base_fields:
                LanguageBoundForm.base_fields.pop(base_name, None)

            for code in LANGUAGE_CODES:
                if code == language:
                    continue
                LanguageBoundForm.base_fields.pop(f"{base_name}_{code}", None)

        for field_name, field in LanguageBoundForm.base_fields.items():
            if field_name.endswith(f"_{language}"):
                field.label = _strip_translation_label_suffix(field.label)

        base_formset.form = LanguageBoundForm
        return base_formset

    def _filter_translated_fields_for_language(self, fields, language):
        filtered_fields = []
        for field in fields:
            if isinstance(field, (tuple, list)):
                nested = self._filter_translated_fields_for_language(field, language)
                if nested:
                    filtered_fields.append(tuple(nested))
                continue

            if field in self.translated_base_fields:
                filtered_fields.append(f"{field}_{language}")
                continue

            matched_base = None
            for base_name in self.translated_base_fields:
                prefix = f"{base_name}_"
                if isinstance(field, str) and field.startswith(prefix):
                    matched_base = base_name
                    break

            if matched_base is None:
                filtered_fields.append(field)
                continue

            if field == f"{matched_base}_{language}":
                filtered_fields.append(field)

        return filtered_fields

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        language = _get_language_from_request(request)
        filtered_fieldsets = []

        for name, options in fieldsets:
            next_options = options.copy()
            fields = next_options.get("fields")
            if fields:
                next_options["fields"] = self._filter_translated_fields_for_language(
                    fields,
                    language,
                )
            filtered_fieldsets.append((name, next_options))

        return filtered_fieldsets

    def get_prepopulated_fields(self, request, obj=None):
        base_fields = dict(super().get_prepopulated_fields(request, obj))
        if not base_fields:
            return base_fields

        language = _get_language_from_request(request)
        resolved = {}
        for target, sources in base_fields.items():
            resolved_target = self._resolve_translated_field_for_language(
                target,
                language,
            )
            resolved[resolved_target] = tuple(
                self._resolve_translated_field_for_language(source, language)
                for source in sources
            )
        return resolved


class ProductImageAdminForm(forms.ModelForm):
    # Keep ProductImage edits focused on a single alt text field.
    alt_text = forms.CharField(label="Alt text", max_length=255, required=False)

    class Meta:
        model = ProductImage
        fields = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        language = getattr(self, "language", DEFAULT_LANGUAGE)
        if not self.instance or not self.instance.pk:
            return
        translation = self.instance.translations.filter(lang=language).first()
        if translation is not None:
            self.initial["alt_text"] = translation.alt
            return
        fallback = self.instance.translations.filter(
            lang=DEFAULT_LANGUAGE
        ).first()
        if fallback and fallback.alt:
            self.initial["alt_text"] = fallback.alt
            return
        if self.instance.alt:
            self.initial["alt_text"] = self.instance.alt


class ProductAdminForm(forms.ModelForm):
    specs = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 6}),
        help_text=(
            "JSON object/array or line-based input. "
            "Example lines: range: 40km"
        ),
    )

    class Meta:
        model = Product
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.initial["specs"] = _format_json_for_textarea(self.instance.specs)

    def clean_specs(self):
        return _parse_specs_value(self.cleaned_data.get("specs"))


class CivilProductAdminForm(forms.ModelForm):
    specs = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 6}),
        help_text=(
            "JSON object/array or line-based input. "
            "Example lines: range: 40km"
        ),
    )

    class Meta:
        model = CivilProduct
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.initial["specs"] = _format_json_for_textarea(self.instance.specs)

    def clean_specs(self):
        return _parse_specs_value(self.cleaned_data.get("specs"))


class ProductTechnologyInlineForm(forms.ModelForm):
    tags = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="One tag per line or comma-separated values (max 3).",
    )

    class Meta:
        model = ProductTechnology
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial["tags"] = _format_json_for_textarea(self.instance.tags)

    def clean_tags(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("tags"),
            split_commas=True,
            field_label="Tags",
            max_items=3,
        )


class CivilProductTechnologyInlineForm(forms.ModelForm):
    tags = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="One tag per line or comma-separated values (max 3).",
    )

    class Meta:
        model = CivilProductTechnology
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial["tags"] = _format_json_for_textarea(self.instance.tags)

    def clean_tags(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("tags"),
            split_commas=True,
            field_label="Tags",
            max_items=3,
        )


class ProductInfoBlockInlineForm(forms.ModelForm):
    description_1 = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text="One bullet per line or JSON array.",
    )
    description_2 = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text="One bullet per line or JSON array.",
    )

    class Meta:
        model = ProductInfoBlock
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial["description_1"] = _format_json_for_textarea(
            self.instance.description_1
        )
        self.initial["description_2"] = _format_json_for_textarea(
            self.instance.description_2
        )

    def clean_description_1(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("description_1"),
            split_commas=False,
            field_label="Description 1",
        )

    def clean_description_2(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("description_2"),
            split_commas=False,
            field_label="Description 2",
        )


class CivilProductInfoBlockInlineForm(forms.ModelForm):
    description_1 = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text="One bullet per line or JSON array.",
    )
    description_2 = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text="One bullet per line or JSON array.",
    )

    class Meta:
        model = CivilProductInfoBlock
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial["description_1"] = _format_json_for_textarea(
            self.instance.description_1
        )
        self.initial["description_2"] = _format_json_for_textarea(
            self.instance.description_2
        )

    def clean_description_1(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("description_1"),
            split_commas=False,
            field_label="Description 1",
        )

    def clean_description_2(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("description_2"),
            split_commas=False,
            field_label="Description 2",
        )


class BlogPostSectionInlineForm(forms.ModelForm):
    PARAGRAPHS_HELP_TEXT = "One paragraph per line or JSON array."
    BULLETS_HELP_TEXT = "One bullet per line or JSON array."

    paragraphs = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 5}),
        help_text=PARAGRAPHS_HELP_TEXT,
    )
    bullets = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text=BULLETS_HELP_TEXT,
    )

    class Meta:
        model = BlogPostSection
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial["paragraphs"] = _format_json_for_textarea(
            self.instance.paragraphs
        )
        self.initial["bullets"] = _format_json_for_textarea(self.instance.bullets)
        self._configure_translated_list_field(
            "paragraphs",
            rows=5,
            help_text=self.PARAGRAPHS_HELP_TEXT,
        )
        self._configure_translated_list_field(
            "bullets",
            rows=4,
            help_text=self.BULLETS_HELP_TEXT,
        )

    def _configure_translated_list_field(self, field_name, *, rows, help_text):
        language_code = getattr(self, "language", DEFAULT_LANGUAGE)
        translated_field_name = f"{field_name}_{language_code}"
        existing = self.fields.get(translated_field_name)
        if existing is None:
            return

        self.fields[translated_field_name] = forms.CharField(
            required=False,
            label=existing.label,
            widget=forms.Textarea(attrs={"rows": rows}),
            help_text=help_text,
        )
        self.initial[translated_field_name] = _format_json_for_textarea(
            getattr(self.instance, translated_field_name, None)
        )

    def clean_paragraphs(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("paragraphs"),
            split_commas=False,
            field_label="Paragraphs",
        )

    def clean_bullets(self):
        return _parse_json_or_lines(
            self.cleaned_data.get("bullets"),
            split_commas=False,
            field_label="Bullets",
        )

    def clean(self):
        cleaned_data = super().clean()

        for language_code, _ in LANGUAGE_CHOICES:
            paragraphs_field = f"paragraphs_{language_code}"
            if paragraphs_field in self.fields:
                cleaned_data[paragraphs_field] = _parse_json_or_lines(
                    cleaned_data.get(paragraphs_field),
                    split_commas=False,
                    field_label=f"Paragraphs ({language_code.upper()})",
                )

            bullets_field = f"bullets_{language_code}"
            if bullets_field in self.fields:
                cleaned_data[bullets_field] = _parse_json_or_lines(
                    cleaned_data.get(bullets_field),
                    split_commas=False,
                    field_label=f"Bullets ({language_code.upper()})",
                )

        return cleaned_data


class BlogPostBlockInlineForm(forms.ModelForm):
    HTML_HELP_TEXT = (
        "Rich text content for text, lists, quotes, and dividers."
    )

    class Meta:
        model = BlogPostBlock
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name in (
            "paragraphs",
            "items",
            *(f"paragraphs_{code}" for code, _ in LANGUAGE_CHOICES),
            *(f"items_{code}" for code, _ in LANGUAGE_CHOICES),
        ):
            self.fields.pop(field_name, None)
        self._configure_translated_html_field("html")

    def _configure_translated_html_field(self, field_name):
        language_code = getattr(self, "language", DEFAULT_LANGUAGE)
        translated_field_name = f"{field_name}_{language_code}"
        existing = self.fields.get(translated_field_name)
        if existing is None:
            return

        self.fields[translated_field_name] = forms.CharField(
            required=False,
            label="WYSIWYG",
            widget=TinyMCE(
                attrs={"cols": 100, "rows": 18},
                mce_attrs={
                    "toolbar_mode": "sliding",
                },
            ),
            help_text=self.HTML_HELP_TEXT,
        )
        self.initial[translated_field_name] = getattr(
            self.instance,
            translated_field_name,
            "",
        )


class ProductImageInline(admin.StackedInline):
    # Stacked inline avoids wide tables and keeps image ordering obvious.
    model = ProductImage
    extra = 0
    fields = (
        "image_preview_inline",
        "image",
        "order",
        "alt_coverage_inline",
        "alt_links_inline",
    )
    readonly_fields = (
        "image_preview_inline",
        "alt_coverage_inline",
        "alt_links_inline",
    )
    ordering = ("order",)
    show_change_link = True
    verbose_name_plural = "Product images"

    @admin.display(description="Preview")
    def image_preview_inline(self, obj):
        url = _safe_image_url(obj)
        if not url:
            return "-"
        return format_html(
            '<img src="{}" style="max-height:96px; max-width:160px; object-fit:contain;" />',
            url,
        )

    @admin.display(description="Alt coverage")
    def alt_coverage_inline(self, obj):
        return _render_alt_coverage_badge(obj)

    @admin.display(description="Alt links")
    def alt_links_inline(self, obj):
        return _render_alt_links(obj)


class BlogPostSectionInline(
    SingleLanguageTranslatedInlineMixin,
    TranslationStackedInline,
):
    model = BlogPostSection
    form = BlogPostSectionInlineForm
    extra = 0
    ordering = ("order",)
    fields = ("title", "anchor_id", "paragraphs", "bullets", "order")
    prepopulated_fields = {"anchor_id": ("title",)}
    verbose_name_plural = "Sections"
    translated_base_fields = ("title", "paragraphs", "bullets")


class BlogPostBlockInline(
    SingleLanguageTranslatedInlineMixin,
    TranslationStackedInline,
):
    model = BlogPostBlock
    form = BlogPostBlockInlineForm
    extra = 0
    ordering = ("order",)
    fields = (
        "title",
        "anchor_id",
        "html",
        "image",
        "image_alt",
        "order",
    )
    prepopulated_fields = {"anchor_id": ("title",)}
    verbose_name_plural = "Blocks"
    translated_base_fields = ("title", "html", "image_alt")


class BlogPostHeroImageInline(admin.StackedInline):
    model = BlogPostHeroImage
    extra = 0
    ordering = ("order", "pk")
    fields = ("image", "alt", "order")
    verbose_name_plural = "Hero slider images"


class ProductDroneSliderMediaInline(admin.StackedInline):
    model = ProductDroneSliderMedia
    extra = 0
    max_num = 1
    fields = ("image", "video")
    classes = ("collapse",)
    verbose_name_plural = "Drone slider media"


class CivilProductDroneSliderMediaInline(admin.StackedInline):
    model = CivilProductDroneSliderMedia
    extra = 0
    max_num = 1
    fields = ("image", "video")
    classes = ("collapse",)
    verbose_name_plural = "Drone slider media"


# Stacked translation inlines keep translated fields readable without horizontal scrolling.
class ProductFeatureInline(TranslationStackedInline):
    model = ProductFeature
    extra = 0
    ordering = ("order",)
    fields = ("name", "value", "description", "icon_lucide", "icon_file", "order")
    verbose_name_plural = "Key features"
    
class ProductSubFeatureInline(TranslationStackedInline):
    model = ProductSubFeature
    extra = 0
    ordering = ("order",)
    fields = ("name", "description", "icon_lucide", "icon_file", "order")
    classes = ("collapse",)
    verbose_name_plural = "Sub-features"
    
class ProductGalleryInline(TranslationStackedInline):
    model = ProductGallery
    extra = 0
    ordering = ("order",)
    fields = ("image", "alt", "order")
    classes = ("collapse",)
    verbose_name_plural = "Gallery"

class ProductTechnologyInline(TranslationStackedInline):
    model = ProductTechnology
    form = ProductTechnologyInlineForm
    extra = 0
    ordering = ("order",)
    fields = ("name", "description", "tags", "order")
    classes = ("collapse",)
    verbose_name_plural = "Technologies"
    
class ProductFeatureBlockInline(TranslationStackedInline):
    model = ProductFeatureBlock
    extra = 0
    ordering = ("order",)
    fields = ("name", "title", "description", "background_image", "with_logo", "order")
    classes = ("collapse",)
    verbose_name_plural = "Feature blocks"
    
class ProductInfoBlockInline(TranslationStackedInline):
    model = ProductInfoBlock
    form = ProductInfoBlockInlineForm
    extra = 0
    ordering = ("order",)
    fields = ("title_1", "description_1", "image_1", "title_2", "description_2", "image_2", "order")
    classes = ("collapse",)
    verbose_name_plural = "Info blocks"

class ProductCTABlockInline(TranslationStackedInline):
    model = ProductCTABlock
    extra = 0
    ordering = ("order",)
    fields = ("name", "title", "background_image", "has_button", "order")
    classes = ("collapse",)
    verbose_name_plural = "CTA blocks"


class ProductFinalCTABlockInline(TranslationStackedInline):
    model = ProductFinalCTABlock
    extra = 1
    max_num = 1
    fields = ("title", "paragraph", "has_button")
    classes = ("collapse",)
    verbose_name_plural = "Final CTA block"

@admin.register(Category)
class CategoryAdmin(HiddenModelTranslationTabsAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    list_per_page = ADMIN_LIST_PER_PAGE


@admin.register(BlogCategory)
class BlogCategoryAdmin(HiddenModelTranslationTabsAdmin):
    list_display = ("name", "slug", "is_active", "order")
    list_display_links = ("name", "slug")
    list_editable = ("is_active", "order")
    search_fields = ("name", "slug")
    ordering = ("order", "name")
    prepopulated_fields = {"slug": ("name",)}
    list_per_page = ADMIN_LIST_PER_PAGE


@admin.register(BlogAuthor)
class BlogAuthorAdmin(HiddenModelTranslationTabsAdmin):
    list_display = ("name", "role", "is_active", "order")
    list_display_links = ("name",)
    list_editable = ("role", "is_active", "order")
    search_fields = ("name", "role")
    ordering = ("order", "name")
    list_per_page = ADMIN_LIST_PER_PAGE


@admin.register(BlogPost)
class BlogPostAdmin(HiddenModelTranslationTabsAdmin):
    list_display = (
        "title",
        "slug",
        "category",
        "author",
        "is_published",
        "published_at",
        "order",
    )
    list_display_links = ("title", "slug")
    list_editable = ("is_published", "published_at", "order")
    list_filter = ("is_published", "category", "author", "published_at")
    search_fields = ("title", "slug", "subtitle", "author__name", "category__name")
    list_select_related = ("category", "author")
    ordering = ("order", "-published_at", "-created_at", "pk")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "published_at"
    list_per_page = ADMIN_LIST_PER_PAGE
    actions = ("mark_published", "mark_unpublished", "renumber_order")
    fieldsets = (
        (
            "Main",
            {
                "fields": (
                    "title",
                    "slug",
                    "category",
                    "author",
                    "is_published",
                    "published_at",
                    "read_minutes",
                    "order",
                ),
            },
        ),
        (
            "Content",
            {
                "fields": ("hero_image", "subtitle"),
            },
        ),
        (
            "Timestamps",
            {
                "classes": ("collapse",),
                "fields": ("created_at", "updated_at"),
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at")
    inlines = [BlogPostHeroImageInline, BlogPostBlockInline]

    @admin.action(description="Mark selected posts as published")
    def mark_published(self, request, queryset):
        today = timezone.localdate()
        updated = 0
        for post in queryset:
            changed_fields = []
            if not post.is_published:
                post.is_published = True
                changed_fields.append("is_published")
            if post.published_at is None:
                post.published_at = today
                changed_fields.append("published_at")
            if changed_fields:
                post.save(update_fields=changed_fields + ["updated_at"])
                updated += 1
        self.message_user(request, f"Published {updated} post(s).")

    @admin.action(description="Mark selected posts as unpublished")
    def mark_unpublished(self, request, queryset):
        updated = queryset.update(is_published=False, updated_at=timezone.now())
        self.message_user(request, f"Unpublished {updated} post(s).")

    @admin.action(description="Renumber order for selected blog posts (step 10)")
    def renumber_order(self, request, queryset):
        updated = 0
        for index, post in enumerate(
            queryset.order_by("order", "-published_at", "-created_at", "pk"),
            start=1,
        ):
            new_order = index * 10
            if post.order != new_order:
                post.order = new_order
                post.save(update_fields=["order", "updated_at"])
                updated += 1
        self.message_user(request, f"Updated order for {updated} post(s).")


@admin.register(Product)
class ProductAdmin(HiddenModelTranslationTabsAdmin):
    form = ProductAdminForm
    list_display = ('name', 'slug', 'category', 'available', 'order', 'created_at')
    list_display_links = ("name", "slug")
    list_editable = ("available", "order")
    list_filter = ('available', 'category', 'created_at')
    search_fields = ('name', 'slug', 'description', 'category__name')
    list_select_related = ("category",)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('order', '-created_at')
    date_hierarchy = "created_at"
    list_per_page = ADMIN_LIST_PER_PAGE
    actions = ("mark_available", "mark_unavailable", "renumber_order")
    save_on_top = False
    fieldsets = (
        (
            "Main",
            {
                "fields": ("name", "slug", "category", "available", "order"),
            },
        ),
        (
            "Content",
            {
                "fields": ("description", "icon", "dropdown_image"),
            },
        ),
        (
            "Advanced",
            {
                "classes": ("collapse",),
                "fields": ("specs",),
            },
        ),
    )
    inlines = [ProductImageInline, ProductDroneSliderMediaInline, ProductFeatureInline, ProductSubFeatureInline, ProductGalleryInline, ProductTechnologyInline, ProductFeatureBlockInline, ProductInfoBlockInline, ProductCTABlockInline, ProductFinalCTABlockInline]

    @admin.action(description="Mark selected products as available")
    def mark_available(self, request, queryset):
        updated = queryset.update(available=True)
        self.message_user(request, f"{updated} product(s) marked as available.")

    @admin.action(description="Mark selected products as unavailable")
    def mark_unavailable(self, request, queryset):
        updated = queryset.update(available=False)
        self.message_user(
            request, f"{updated} product(s) marked as unavailable."
        )

    @admin.action(description="Renumber order for selected products (step 10)")
    def renumber_order(self, request, queryset):
        updated = 0
        for index, product in enumerate(
            queryset.order_by("order", "created_at", "pk"), start=1
        ):
            new_order = index * 10
            if product.order != new_order:
                product.order = new_order
                product.save(update_fields=["order"])
                updated += 1
        self.message_user(request, f"Updated order for {updated} product(s).")


class CivilProductImageInline(admin.StackedInline):
    model = CivilProductImage
    extra = 0
    fields = (
        "image_preview_inline",
        "image",
        "alt",
        "order",
        "alt_coverage_inline",
    )
    readonly_fields = ("image_preview_inline", "alt_coverage_inline")
    ordering = ("order",)
    verbose_name_plural = "Product images"

    @admin.display(description="Preview")
    def image_preview_inline(self, obj):
        url = _safe_image_url(obj)
        if not url:
            return "-"
        return format_html(
            '<img src="{}" style="max-height:96px; max-width:160px; object-fit:contain;" />',
            url,
        )

    @admin.display(description="Alt coverage")
    def alt_coverage_inline(self, obj):
        return _render_alt_coverage_badge(obj)


class CivilProductFeatureInline(TranslationStackedInline):
    model = CivilProductFeature
    extra = 0
    ordering = ("order",)
    fields = ("name", "value", "description", "icon_lucide", "icon_file", "order")
    verbose_name_plural = "Key features"


class CivilProductSubFeatureInline(TranslationStackedInline):
    model = CivilProductSubFeature
    extra = 0
    ordering = ("order",)
    fields = ("name", "description", "icon_lucide", "icon_file", "order")
    classes = ("collapse",)
    verbose_name_plural = "Sub-features"


class CivilProductGalleryInline(TranslationStackedInline):
    model = CivilProductGallery
    extra = 0
    ordering = ("order",)
    fields = ("image", "alt", "order")
    classes = ("collapse",)
    verbose_name_plural = "Gallery"


class CivilProductTechnologyInline(TranslationStackedInline):
    model = CivilProductTechnology
    form = CivilProductTechnologyInlineForm
    extra = 0
    ordering = ("order",)
    fields = ("name", "description", "tags", "order")
    classes = ("collapse",)
    verbose_name_plural = "Technologies"


class CivilProductFeatureBlockInline(TranslationStackedInline):
    model = CivilProductFeatureBlock
    extra = 0
    ordering = ("order",)
    fields = (
        "name",
        "title",
        "description",
        "background_image",
        "with_logo",
        "order",
    )
    classes = ("collapse",)
    verbose_name_plural = "Feature blocks"


class CivilProductInfoBlockInline(TranslationStackedInline):
    model = CivilProductInfoBlock
    form = CivilProductInfoBlockInlineForm
    extra = 0
    ordering = ("order",)
    fields = (
        "title_1",
        "description_1",
        "image_1",
        "title_2",
        "description_2",
        "image_2",
        "order",
    )
    classes = ("collapse",)
    verbose_name_plural = "Info blocks"


class CivilProductCTABlockInline(TranslationStackedInline):
    model = CivilProductCTABlock
    extra = 0
    ordering = ("order",)
    fields = ("name", "title", "background_image", "has_button", "order")
    classes = ("collapse",)
    verbose_name_plural = "CTA blocks"


@admin.register(CivilCategory)
class CivilCategoryAdmin(HiddenModelTranslationTabsAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    list_per_page = ADMIN_LIST_PER_PAGE


@admin.register(CivilProduct)
class CivilProductAdmin(HiddenModelTranslationTabsAdmin):
    form = CivilProductAdminForm
    list_display = ("name", "slug", "category", "available", "order", "created_at")
    list_display_links = ("name", "slug")
    list_editable = ("available", "order")
    list_filter = ("available", "category", "created_at")
    search_fields = ("name", "slug", "description", "category__name")
    list_select_related = ("category",)
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("order", "-created_at")
    date_hierarchy = "created_at"
    list_per_page = ADMIN_LIST_PER_PAGE
    actions = ("mark_available", "mark_unavailable", "renumber_order")
    save_on_top = False
    fieldsets = (
        (
            "Main",
            {
                "fields": ("name", "slug", "category", "available", "order"),
            },
        ),
        (
            "Content",
            {
                "fields": ("description", "icon", "dropdown_image"),
            },
        ),
        (
            "Advanced",
            {
                "classes": ("collapse",),
                "fields": ("specs",),
            },
        ),
    )
    inlines = [
        CivilProductImageInline,
        CivilProductDroneSliderMediaInline,
        CivilProductFeatureInline,
        CivilProductSubFeatureInline,
        CivilProductGalleryInline,
        CivilProductTechnologyInline,
        CivilProductFeatureBlockInline,
        CivilProductInfoBlockInline,
        CivilProductCTABlockInline,
    ]

    @admin.action(description="Mark selected civil products as available")
    def mark_available(self, request, queryset):
        updated = queryset.update(available=True)
        self.message_user(
            request, f"{updated} civil product(s) marked as available."
        )

    @admin.action(description="Mark selected civil products as unavailable")
    def mark_unavailable(self, request, queryset):
        updated = queryset.update(available=False)
        self.message_user(
            request, f"{updated} civil product(s) marked as unavailable."
        )

    @admin.action(
        description="Renumber order for selected civil products (step 10)"
    )
    def renumber_order(self, request, queryset):
        updated = 0
        for index, product in enumerate(
            queryset.order_by("order", "created_at", "pk"), start=1
        ):
            new_order = index * 10
            if product.order != new_order:
                product.order = new_order
                product.save(update_fields=["order"])
                updated += 1
        self.message_user(
            request, f"Updated order for {updated} civil product(s)."
        )


class ContactSiteFilter(admin.SimpleListFilter):
    title = "Сайт (по источнику)"
    parameter_name = "site"

    def lookups(self, request, model_admin):
        return (
            ("ai-def", "AI DEF"),
            ("arms", "ARMS"),
            ("unknown", "Источник не определён"),
        )

    def queryset(self, request, queryset):
        arms = Q(source__startswith="arms:") | Q(
            source__regex=r"^/([a-z]{2}/)?store(/|$)"
        )
        main = Q(source__startswith="ai-def:")
        if self.value() == "arms":
            return queryset.filter(arms)
        if self.value() == "ai-def":
            return queryset.filter(main)
        if self.value() == "unknown":
            return queryset.exclude(arms | main)
        return queryset


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "status",
        "assigned_to",
        "variant",
        "full_name",
        "email",
        "product",
        "country_code",
        "message_preview",
    )
    list_display_links = ("created_at", "email")
    list_editable = ("status", "assigned_to")
    list_filter = (
        ContactSiteFilter,
        "status",
        "assigned_to",
        "variant",
        "created_at",
        "language",
        "country_code",
    )
    search_fields = (
        "first_name",
        "last_name",
        "email",
        "internal_note",
        "phone",
        "message",
        "product",
        "country_name",
        "country_code",
        "website",
        "source",
        "ip_address",
        "user_agent",
    )
    date_hierarchy = "created_at"
    list_per_page = ADMIN_LIST_PER_PAGE
    actions = (
        "assign_to_me",
        "clear_assignee",
        "mark_new",
        "mark_in_progress",
        "mark_done",
        "mark_spam",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "variant",
        "first_name",
        "last_name",
        "email",
        "phone",
        "product",
        "country_code",
        "country_name",
        "address_line1",
        "address_line2",
        "website",
        "message",
        "source",
        "language",
        "ip_address",
        "user_agent",
    )
    fieldsets = (
        (
            "Workflow",
            {
                "fields": (
                    "status",
                    "assigned_to",
                    "internal_note",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
        (
            "Contact Details",
            {
                "fields": (
                    "variant",
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                    "product",
                    "message",
                ),
            },
        ),
        (
            "Location",
            {
                "classes": ("collapse",),
                "fields": (
                    "country_code",
                    "country_name",
                    "address_line1",
                    "address_line2",
                    "website",
                ),
            },
        ),
        (
            "Technical Metadata",
            {
                "classes": ("collapse",),
                "fields": ("source", "language", "ip_address", "user_agent"),
            },
        ),
    )

    @admin.display(description="Name")
    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    @admin.display(description="Message")
    def message_preview(self, obj):
        text = (obj.message or "").strip()
        if not text:
            return "-"
        return text if len(text) <= 60 else f"{text[:57]}..."

    def _bulk_set_status(self, request, queryset, status):
        updated = queryset.update(status=status, updated_at=timezone.now())
        self.message_user(
            request,
            f"Updated status for {updated} request(s) to '{status}'.",
        )

    @admin.action(description="Assign selected requests to me")
    def assign_to_me(self, request, queryset):
        if not request.user.is_authenticated:
            self.message_user(request, "Unable to assign: current user is anonymous.")
            return
        updated = queryset.update(
            assigned_to=request.user,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"Assigned {updated} request(s) to you.")

    @admin.action(description="Clear assignee for selected requests")
    def clear_assignee(self, request, queryset):
        updated = queryset.update(assigned_to=None, updated_at=timezone.now())
        self.message_user(request, f"Cleared assignee for {updated} request(s).")

    @admin.action(description="Mark selected requests as New")
    def mark_new(self, request, queryset):
        self._bulk_set_status(request, queryset, ContactRequest.Status.NEW)

    @admin.action(description="Mark selected requests as In progress")
    def mark_in_progress(self, request, queryset):
        self._bulk_set_status(
            request, queryset, ContactRequest.Status.IN_PROGRESS
        )

    @admin.action(description="Mark selected requests as Done")
    def mark_done(self, request, queryset):
        self._bulk_set_status(request, queryset, ContactRequest.Status.DONE)

    @admin.action(description="Mark selected requests as Spam")
    def mark_spam(self, request, queryset):
        self._bulk_set_status(request, queryset, ContactRequest.Status.SPAM)


@admin.register(ProductImage)
class ProductImageAdmin(ProductImageLanguageTabsMixin, admin.ModelAdmin):
    language_choices = LANGUAGE_CHOICES
    language_codes = LANGUAGE_CODES
    language_labels = LANGUAGE_LABELS
    default_language = DEFAULT_LANGUAGE
    translation_model = ProductImageTranslation

    list_display = ("product", "alt_coverage_badge", "order")
    list_display_links = ("product",)
    list_editable = ("order",)
    list_select_related = ("product",)
    list_filter = ("product",)
    search_fields = ("product__name", "product__slug")
    ordering = ("product", "order")
    list_per_page = ADMIN_LIST_PER_PAGE
    actions = ("renumber_order",)
    form = ProductImageAdminForm
    # Custom template keeps coverage hints; language switcher comes from shared submit row.
    change_form_template = "admin/productimage_change_form.html"
    readonly_fields = ("image_preview", "translation_coverage")
    fields = ("image_preview", "translation_coverage", "alt_text")

    def has_add_permission(self, request):
        # Images are created in the Product inline to avoid technical fields here.
        return False

    @admin.action(
        description="Renumber image order for selected products (step 10)"
    )
    def renumber_order(self, request, queryset):
        updated = 0
        product_ids = queryset.values_list("product_id", flat=True).distinct()
        for product_id in product_ids:
            images = ProductImage.objects.filter(product_id=product_id).order_by(
                "order", "pk"
            )
            for index, image in enumerate(images, start=1):
                new_order = index * 10
                if image.order != new_order:
                    image.order = new_order
                    image.save(update_fields=["order"])
                    updated += 1
        self.message_user(request, f"Updated order for {updated} image(s).")

    def get_alt_map(self, obj):
        return _get_alt_map(obj)

    def get_alt_coverage(self, obj):
        return _get_alt_coverage(obj)

    def render_alt_links(self, obj):
        return _render_alt_links(obj)

    @admin.display(description="Image")
    def image_preview(self, obj):
        url = _safe_image_url(obj)
        if not url:
            return "-"
        return format_html(
            '<img src="{}" style="max-height: 180px; max-width: 100%; object-fit: contain;" />',
            url,
        )

    @admin.display(description="Alt coverage")
    def alt_coverage_badge(self, obj):
        return _render_alt_coverage_badge(obj)

    @admin.display(description="Translations")
    def translation_coverage(self, obj):
        _, filled, missing = _get_alt_coverage(obj)
        missing_labels = [LANGUAGE_LABELS[code] for code in missing]
        if missing_labels:
            return format_html(
                '<div>{}<br /><span style="color:#ba2121;">Missing: {}</span></div>',
                _render_alt_coverage_badge(obj),
                ", ".join(missing_labels),
            )
        return format_html(
            '<div>{}<br /><span style="color:#106010;">All language alt texts are filled.</span></div>',
            _render_alt_coverage_badge(obj),
        )

    @admin.display(description="Jump To Language")
    def alt_links(self, obj):
        return self.render_alt_links(obj)
