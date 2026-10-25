from django import forms
from django.contrib import admin
from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.html import format_html

from aidef.admin_mixins import AdminLanguageSwitcherMixin
from .arms_models import ArmsImage, ArmsProduct, ArmsVariant

ARMS_LANGUAGES = (("en", "English"), ("de", "Deutsch"), ("sk", "Slovak"), ("es", "Español"), ("fr", "Français"), ("it", "Italiano"), ("ru", "Русский"))


class ArmsContentForm(forms.ModelForm):
    language = "en"
    specifications = forms.JSONField(label="Характеристики", required=False, widget=forms.Textarea(attrs={"rows": 8}), help_text="Укажите название и значение каждой характеристики.")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        content = self.instance.content.get(self.language, {})
        for name in ("label", "description"):
            if name in self.fields:
                self.fields[name].initial = content.get(name, "")
        if "specifications" in self.fields:
            self.fields["specifications"].initial = content.get("specifications", [])

    def clean_specifications(self):
        items = self.cleaned_data["specifications"]
        if items is None:
            return []
        if not isinstance(items, list):
            raise ValidationError("Характеристики должны быть списком.")
        result = []
        for index, item in enumerate(items, 1):
            if not isinstance(item, dict) or set(item) != {"label", "value"}:
                raise ValidationError(f"Строка {index}: укажите название и значение.")
            if not all(isinstance(item[key], str) and item[key].strip() for key in ("label", "value")):
                raise ValidationError(f"Строка {index}: название и значение не должны быть пустыми.")
            result.append({key: value.strip() for key, value in item.items()})
        return result

    def save(self, commit=True):
        instance = super().save(commit=False)
        content = {key: self.cleaned_data[key] for key in ("label", "description", "specifications") if key in self.cleaned_data}
        instance.content = {**instance.content, self.language: {**instance.content.get(self.language, {}), **content}}
        if commit:
            instance.save()
            self.save_m2m()
        return instance


class ArmsProductForm(ArmsContentForm):
    description = forms.CharField(label="Описание", required=False, widget=forms.Textarea(attrs={"rows": 4}))

    class Meta:
        model = ArmsProduct
        exclude = ("content", "legacy_image", "width", "height", "updated_at")

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("available") and not self.instance.pk:
            self.add_error("available", "Сначала сохраните продукт и добавьте хотя бы один вариант исполнения.")
        elif cleaned.get("available") and not self.instance.variants.exists():
            self.add_error("available", "Добавьте хотя бы один вариант исполнения перед публикацией.")
        if cleaned.get("available") and not cleaned.get("image") and not self.instance.legacy_image:
            self.add_error("image", "Добавьте обложку перед публикацией.")
        return cleaned


class ArmsVariantForm(ArmsContentForm):
    label = forms.CharField(label="Название варианта", max_length=255)

    class Meta:
        model = ArmsVariant
        exclude = ("content",)


class ArmsLanguageAdmin(AdminLanguageSwitcherMixin, admin.ModelAdmin):
    language_choices = ARMS_LANGUAGES
    language_codes = {code for code, _ in ARMS_LANGUAGES}

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        return type("LanguageBoundForm", (form,), {"language": self._get_language_from_request(request)})


class ArmsVariantSummaryForm(ArmsVariantForm):
    specifications = None


class ArmsVariantInline(admin.StackedInline):
    model = ArmsVariant
    form = ArmsVariantSummaryForm
    fields = ("label", "code", "model_name", "order")
    extra = 0
    show_change_link = True
    verbose_name_plural = "Варианты — после сохранения откройте вариант, чтобы добавить фотографии и переводы"

    def get_formset(self, request, obj=None, **kwargs):
        language = request.GET.get("lang", "en")
        if language not in {code for code, _ in ARMS_LANGUAGES}:
            language = "en"
        kwargs["form"] = type("LanguageBoundVariantForm", (ArmsVariantSummaryForm,), {"language": language})
        return super().get_formset(request, obj, **kwargs)


class ArmsImageInline(admin.StackedInline):
    model = ArmsImage
    fields = ("preview", "image", "order")
    readonly_fields = ("preview",)
    extra = 0

    @admin.display(description="Текущая фотография")
    def preview(self, obj):
        if obj.image:
            url = obj.image.url
        elif obj.legacy_path:
            url = ("http://127.0.0.1:5173" if settings.DEBUG else "https://arms.ai-def.com") + obj.legacy_path
        else:
            return "Загрузите фотографию"
        return format_html('<img src="{}" alt="" style="max-width:240px;max-height:150px;object-fit:contain">', url)


@admin.register(ArmsProduct)
class ArmsProductAdmin(ArmsLanguageAdmin):
    form = ArmsProductForm
    fieldsets = (
        ("Основное", {"fields": ("name", "slug", "brand", "category")}),
        ("Описание", {"fields": ("description",)}),
        ("Обложка", {"fields": ("cover_preview", "image")}),
        ("Характеристики", {"fields": ("specifications",)}),
        ("Публикация", {"fields": ("available", "order")}),
    )
    readonly_fields = ("cover_preview",)
    list_display = ("name", "category", "available", "order")
    search_fields = ("name", "slug", "brand")
    list_filter = ("category", "available")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (ArmsVariantInline,)

    @admin.display(description="Текущая обложка")
    def cover_preview(self, obj):
        if obj.image:
            url = obj.image.url
        elif obj.legacy_image:
            url = ("http://127.0.0.1:5173" if settings.DEBUG else "https://arms.ai-def.com") + obj.legacy_image
        else:
            return "Обложка ещё не загружена"
        return format_html('<img src="{}" alt="" style="max-width:280px;max-height:180px;object-fit:contain">', url)


@admin.register(ArmsVariant)
class ArmsVariantAdmin(ArmsLanguageAdmin):
    form = ArmsVariantForm
    fieldsets = (
        ("Вариант", {"fields": ("product", "code", "label", "model_name")}),
        ("Характеристики", {"fields": ("specifications",)}),
        ("Порядок", {"fields": ("order",)}),
    )
    inlines = (ArmsImageInline,)
    list_display = ("__str__", "product", "code")

    def response_change(self, request, obj):
        response = super().response_change(request, obj)
        if not any(key in request.POST for key in ("_continue", "_addanother", "_popup")):
            url = reverse("admin:main_armsproduct_change", args=[obj.product_id])
            return HttpResponseRedirect(f"{url}?lang={self._get_language_from_request(request)}#cms-section-5")
        return response


admin.site.register(ArmsImage)
