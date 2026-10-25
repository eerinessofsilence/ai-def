from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .arms_models import ArmsProduct, localized_content


@require_GET
def arms_product_list_api(request):
    language = request.GET.get("lang", "en").split("-")[0].lower()
    products = ArmsProduct.objects.filter(available=True).prefetch_related("variants__images")
    result = []
    for product in products:
        content = localized_content(product.content, language)
        variants = []
        for variant in product.variants.all():
            translated = localized_content(variant.content, language)
            images = [request.build_absolute_uri(photo.image.url) if photo.image else photo.legacy_path for photo in variant.images.all() if photo.image or photo.legacy_path]
            image_alts = {request.build_absolute_uri(photo.image.url) if photo.image else photo.legacy_path: photo.alt.get(language) or photo.alt.get("en", "") for photo in variant.images.all() if photo.image or photo.legacy_path}
            variants.append({
                "id": variant.code, "label": translated.get("label") or variant.code,
                "modelName": variant.model_name or product.name,
                "images": images,
                "imageAlts": image_alts,
                "specifications": translated.get("specifications", []),
            })
        if not variants:
            continue
        result.append({
            "id": product.slug, "name": product.name, "brand": product.brand,
            "category": product.category, "description": content.get("description", ""),
            "image": request.build_absolute_uri(product.image.url) if product.image else product.legacy_image,
            "coverAlt": content.get("cover_alt") or product.content.get("en", {}).get("cover_alt", ""),
            "width": product.width, "height": product.height, "variants": variants,
            "specifications": content.get("specifications", []),
        })
    return JsonResponse(result, safe=False)
