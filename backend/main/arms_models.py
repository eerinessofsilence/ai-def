from django.db import models


def localized_content(translations, language):
    return {**translations.get("en", {}), **{key: value for key, value in translations.get(language, {}).items() if value}}


class ArmsProduct(models.Model):
    name = models.CharField("Название", max_length=255)
    slug = models.SlugField("Адрес страницы", unique=True)
    brand = models.CharField("Производитель", max_length=120, default="AI DEF")
    category = models.CharField("Категория", max_length=20, choices=(("pistols", "Пистолеты"), ("automatic", "Автоматическое оружие")))
    image = models.ImageField("Обложка", upload_to="arms/covers/", blank=True)
    legacy_image = models.CharField(max_length=500, blank=True)
    width = models.PositiveIntegerField(default=1500)
    height = models.PositiveIntegerField(default=1000)
    content = models.JSONField(default=dict, blank=True)
    available = models.BooleanField("Показывать на сайте", default=False)
    order = models.PositiveIntegerField("Порядок", default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "pk")
        verbose_name = "Продукт ARMS"
        verbose_name_plural = "Продукты ARMS"

    def __str__(self):
        return self.name


class ArmsVariant(models.Model):
    product = models.ForeignKey(ArmsProduct, on_delete=models.CASCADE, related_name="variants", verbose_name="Продукт")
    code = models.SlugField("Код варианта")
    model_name = models.CharField("Модель", max_length=255, blank=True)
    content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        ordering = ("order", "pk")
        constraints = [models.UniqueConstraint(fields=("product", "code"), name="arms_variant_product_code")]
        verbose_name = "Вариант"
        verbose_name_plural = "Варианты исполнения"

    def __str__(self):
        return self.content.get("en", {}).get("label") or self.code


class ArmsImage(models.Model):
    alt = models.JSONField(default=dict, blank=True)
    variant = models.ForeignKey(ArmsVariant, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField("Фотография", upload_to="arms/gallery/", blank=True)
    legacy_path = models.CharField(max_length=500, blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        ordering = ("order", "pk")
        verbose_name = "Фотография"
        verbose_name_plural = "Фотографии"

    def __str__(self):
        return f"Фото {self.order + 1}"
