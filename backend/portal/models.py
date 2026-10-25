from django.db import models
from django.utils.text import slugify
from main.models import Category
from django.core.exceptions import ValidationError

class IconType(models.TextChoices):
    LUCIDE = "lucide", "Lucide"
    UPLOAD = "upload", "Upload"

def default_tags():
    return [""]

class PortalProduct(models.Model):       
    available = models.BooleanField(default=True)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    tags = models.JSONField(
                            default=default_tags,
                            blank=True,
                            help_text="List of tags (strings). Example: ['uav', 'vtol']"
                            )
    serial_number = models.CharField(max_length=12, default="SN-XXXX-XXXX")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ('order', '-created_at')
        verbose_name = "Product"
        verbose_name_plural = "Products"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:230]
            slug = base
            counter = 1
            while PortalProduct.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    def _safe_image_url(self, image_field):
        if not image_field:
            return None
        try:
            return image_field.url
        except (ValueError, AttributeError):
            return None

    def get_preview_image(self):
        preview = self.images.filter(is_preview=True).order_by('order').first()
        if preview and preview.image:
            return preview.image
        fallback = self.images.order_by('order').first()
        if fallback and fallback.image:
            return fallback.image
        return None

    @property
    def preview_image_url(self):
        return self._safe_image_url(self.get_preview_image())

    @property
    def image_urls(self):
        urls = []
        for image in self.images.order_by('order'):
            url = self._safe_image_url(image.image)
            if url:
                urls.append(url)
        return urls

    @property
    def category_label(self):
        return self.category.name if self.category else None

    @property
    def category_slug(self):
        return self.category.slug if self.category else None

class ProductImage(models.Model):
    product = models.ForeignKey(PortalProduct, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/%Y/%m/')
    alt = models.CharField(max_length=255, blank=True)
    is_preview = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('order',)
        verbose_name = "Product image"
        verbose_name_plural = "Product images"

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating:
            self.ensure_translations()

    def ensure_translations(self, english_alt=None):
        if english_alt is None:
            english_alt = (
                ProductImageTranslation.objects.filter(
                    image=self, lang="en"
                )
                .values_list("alt", flat=True)
                .first()
                or self.alt
                or ""
            )
        if isinstance(english_alt, str):
            english_alt = english_alt.strip()
        for lang, _ in ProductImageTranslation.Lang.choices:
            if lang == "en":
                alt = english_alt
            else:
                alt = english_alt if english_alt else ""
            ProductImageTranslation.objects.get_or_create(
                image=self,
                lang=lang,
                defaults={"alt": alt},
            )

    def __str__(self):
        return f"{self.product.name} — image {self.pk}"

class ProductImageTranslation(models.Model):
    class Lang(models.TextChoices):
        EN = "en", "English"
        DE = "de", "German"
        SK = "sk", "Slovak"
        ES = "es", "Spanish"
        FR = "fr", "French"
        IT = "it", "Italian"

    image = models.ForeignKey(
        ProductImage, on_delete=models.CASCADE, related_name="translations"
    )
    lang = models.CharField(max_length=2, choices=Lang.choices)
    alt = models.CharField(max_length=255)

    class Meta:
        unique_together = ("image", "lang")
        verbose_name = "Product image translation"
        verbose_name_plural = "Product image translations"

    def __str__(self):
        return f"{self.image_id} ({self.lang})"

class ProductGallery(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name='gallery',
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to='products/%Y/%m/')
    alt = models.CharField(max_length=255, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('order',)
        verbose_name = "Product gallery image"
        verbose_name_plural = "Product gallery images"

    def __str__(self):
        return f"{self.product.name} — gallery {self.pk}"

class ProductPresentationInfo(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name='presentation_info',
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=128)
    description = models.TextField(max_length=8192)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('order', 'id')
        verbose_name = "Product presentation info"
        verbose_name_plural = "Product presentation info"

    def __str__(self):
        return f"{self.product.name} — presentation {self.pk}"

class ProductCharacteristic(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name="characteristic",
        on_delete=models.CASCADE,
    )
    block = models.ForeignKey(
        "ProductCharacteristicsBlock",
        related_name="characteristics",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=128)
    description = models.TextField(max_length=512, blank=True)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ('order',)
        verbose_name = "Product characteristic"
        verbose_name_plural = "Product characteristics"
        
    def __str__(self):
        return f"{self.product.name} — characteristic {self.pk}"
    
class ProductCharacteristicsBlock(models.Model):
    product = models.ForeignKey(
        "PortalProduct",
        related_name="characteristics_blocks",
        on_delete=models.CASCADE,
    )

    icon_type = models.CharField(max_length=10, choices=IconType.choices, default=IconType.LUCIDE)
    icon_lucide = models.CharField(max_length=64, blank=True)
    icon_file = models.ImageField(upload_to="product_icons/", blank=True, null=True)

    title = models.CharField(max_length=128)

    def clean(self):
        super().clean()

        if self.icon_type == IconType.LUCIDE:
            self.icon_file = None
            if not self.icon_lucide:
                raise ValidationError({"icon_lucide": "Укажи имя Lucide-иконки."})

        elif self.icon_type == IconType.UPLOAD:
            self.icon_lucide = ""
            if not self.icon_file:
                raise ValidationError({"icon_file": "Загрузи файл иконки."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def icon(self):
        if self.icon_type == IconType.LUCIDE:
            return {"type": "lucide", "name": self.icon_lucide}
        if self.icon_file:
            return {"type": "upload", "url": self.icon_file.url}
        return None


class ProductModule(models.Model):
    products = models.ManyToManyField(
        PortalProduct,
        through="ProductModulePlacement",
        related_name="modules",
        blank=True,
    )
    name = models.CharField(max_length=128)
    tag = models.CharField(max_length=16)
    description = models.TextField(max_length=2048, blank=True)
    button_text = models.CharField(max_length=32, blank=False, null=False, default="Request")

    class Meta:
        verbose_name = "Product module"
        verbose_name_plural = "Product modules"
        
    def __str__(self):
        return self.name

class ProductModulePlacement(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name="module_placements",
        on_delete=models.CASCADE,
    )
    module = models.ForeignKey(
        ProductModule,
        related_name="placements",
        on_delete=models.CASCADE,
    )
    block = models.ForeignKey(
        "ProductModulesBlock",
        related_name="module_placements",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "Product module placement"
        verbose_name_plural = "Product module placements"

    def clean(self):
        super().clean()
        if self.block_id and self.product_id:
            if self.block.product_id != self.product_id:
                raise ValidationError(
                    {
                        "block": "Выбранный блок принадлежит другому продукту."
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} — {self.module.name}"
    
class ProductModuleCharacteristic(models.Model):
    module = models.ForeignKey(
        ProductModule,
        related_name="module_characteristics",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=256)
    description = models.TextField(max_length=1024, blank=True)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ('order',)
        verbose_name = "Product module characteristic"
        verbose_name_plural = "Product module characteristics"
        
    def __str__(self):
        return f"{self.module.name} — module characteristic {self.pk}" 
    
class ProductModuleImage(models.Model):
    module = models.ForeignKey(ProductModule, on_delete=models.CASCADE, related_name='module_images')
    image = models.ImageField(upload_to='products/%Y/%m/')
    alt = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Product module image"

    def __str__(self):
        return f"{self.module.name} — module image {self.pk}"   
    
class ProductModulesBlock(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name="modules_blocks",
        on_delete=models.CASCADE,
    )
    subtitle = models.CharField(max_length=128)
    title = models.CharField(max_length=128)
    
    class Meta:
        verbose_name = "Product modules block"
        verbose_name_plural = "Product modules blocks"
        
    def __str__(self):
        return f"{self.product.name} — modules block {self.pk}"

class ProductTextBlock(models.Model):
    product = models.ForeignKey(
        PortalProduct,
        related_name="text_blocks",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=128)
    text = models.TextField(max_length=2048)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)
        verbose_name = "Product text block"
        verbose_name_plural = "Product text blocks"

    def __str__(self):
        return f"{self.product.name} — text block {self.pk}"
    
