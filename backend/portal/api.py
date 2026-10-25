from __future__ import annotations

from typing import Any, Dict, Iterable, List

from django.http import Http404, JsonResponse
from django.views.decorators.http import require_GET

from .models import (
    PortalProduct,
    ProductCharacteristic,
    ProductCharacteristicsBlock,
    ProductGallery,
    ProductImage,
    ProductModule,
    ProductModuleCharacteristic,
    ProductModuleImage,
    ProductModulePlacement,
    ProductModulesBlock,
    ProductPresentationInfo,
    ProductTextBlock,
)


def _absolute_media_url(request, image_field) -> str | None:
    if not image_field:
        return None
    try:
        url = image_field.url
    except (ValueError, AttributeError):
        return None
    return request.build_absolute_uri(url)


def _serialize_image_urls(
    request, images: Iterable[ProductImage]
) -> List[str]:
    urls: List[str] = []
    for image in images:
        url = _absolute_media_url(request, image.image)
        if url:
            urls.append(url)
    return urls


def _serialize_module_images(
    request, images: Iterable[ProductModuleImage]
) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for image in sorted(images, key=lambda item: item.id or 0):
        url = _absolute_media_url(request, image.image)
        if url:
            payload.append(
                {
                    "id": image.id,
                    "url": url,
                    "alt": image.alt,
                }
            )
    return payload


def _serialize_text_blocks(
    blocks: Iterable[ProductTextBlock],
) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for block in sorted(
        blocks,
        key=lambda item: (item.order, item.id or 0),
    ):
        payload.append(
            {
                "id": block.id,
                "title": block.title,
                "text": block.text,
                "order": block.order,
            }
        )
    return payload


def _serialize_module_characteristics(
    characteristics: Iterable[ProductModuleCharacteristic],
) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for item in sorted(
        characteristics,
        key=lambda characteristic: (
            characteristic.order,
            characteristic.id or 0,
        ),
    ):
        payload.append(
            {
                "id": item.id,
                "name": item.name,
                "label": item.name,
                "description": item.description,
                "value": item.description,
                "order": item.order,
            }
        )
    return payload


def _serialize_characteristic(
    characteristic: ProductCharacteristic,
) -> Dict[str, Any]:
    return {
        "id": characteristic.id,
        "name": characteristic.name,
        "label": characteristic.name,
        "description": characteristic.description,
        "value": characteristic.description,
        "order": characteristic.order,
        "block_id": characteristic.block_id,
    }


def _serialize_module(
    request,
    module: ProductModule,
    *,
    order: int,
    block_id: int | None,
) -> Dict[str, Any]:
    module_images = _serialize_module_images(
        request, module.module_images.all()
    )
    module_characteristics = _serialize_module_characteristics(
        module.module_characteristics.all()
    )
    image_url = module_images[0]["url"] if module_images else None
    return {
        "id": module.id,
        "name": module.name,
        "title": module.name,
        "tag": module.tag,
        "description": module.description,
        "action": module.button_text,
        "button_text": module.button_text,
        "order": order,
        "block_id": block_id,
        "image": image_url,
        "images": [item["url"] for item in module_images],
        "module_images": module_images,
        "module_characteristics": module_characteristics,
    }


def _serialize_product_base(
    request, product: PortalProduct
) -> Dict[str, Any]:
    tags = product.tags or []
    highlight = tags[0] if isinstance(tags, list) and tags else ""
    images = sorted(
        product.images.all(),
        key=lambda item: (item.order, item.id),
    )
    preview = next((image for image in images if image.is_preview), None)
    if not preview and images:
        preview = images[0]
    preview_image = preview.image if preview else None
    return {
        "id": product.id,
        "slug": product.slug,
        "name": product.name,
        "category": product.category_label,
        "category_slug": product.category_slug,
        "serial": product.serial_number,
        "order": product.order,
        "summary": product.description,
        "highlight": highlight,
        "preview_image": _absolute_media_url(request, preview_image),
        "images": _serialize_image_urls(request, images),
    }
    
def _serialize_characteristics_blocks(product: "PortalProduct") -> Dict[str, Any]:
    blocks: List["ProductCharacteristicsBlock"] = list(
        product.characteristics_blocks.all().order_by("id")
    )

    characteristics: List["ProductCharacteristic"] = list(
        product.characteristic.all().order_by("order", "id")
    )

    grouped: Dict[int, List[Dict[str, Any]]] = {block.id: [] for block in blocks}
    unassigned: List[Dict[str, Any]] = []

    for item in characteristics:
        payload = _serialize_characteristic(item)

        if getattr(item, "block_id", None) and item.block_id in grouped:
            grouped[item.block_id].append(payload)
        else:
            unassigned.append(payload)

    return {
        "blocks": [
            {
                "id": block.id,
                "icon": block.icon,              
                "title": block.title,
                "items": grouped.get(block.id, []),
            }
            for block in blocks
        ],
        "items": unassigned,
    }

def _serialize_modules_blocks(
    request, product: PortalProduct
) -> Dict[str, Any]:
    blocks: List[ProductModulesBlock] = sorted(
        product.modules_blocks.all(),
        key=lambda item: item.id,
    )
    placements: List[ProductModulePlacement] = list(
        product.module_placements.all().order_by("order", "id")
    )
    grouped: Dict[int, List[Dict[str, Any]]] = {
        block.id: [] for block in blocks
    }
    unassigned: List[Dict[str, Any]] = []
    for placement in placements:
        payload = _serialize_module(
            request,
            placement.module,
            order=placement.order,
            block_id=placement.block_id,
        )
        if placement.block_id and placement.block_id in grouped:
            grouped[placement.block_id].append(payload)
        else:
            unassigned.append(payload)

    return {
        "blocks": [
            {
                "id": block.id,
                "subtitle": block.subtitle,
                "title": block.title,
                "items": grouped.get(block.id, []),
            }
            for block in blocks
        ],
        "items": unassigned,
    }


def _serialize_product_detail(
    request, product: PortalProduct
) -> Dict[str, Any]:
    data = _serialize_product_base(request, product)
    gallery: List[ProductGallery] = list(product.gallery.all())
    data["gallery"] = [
        {
            "id": item.id,
            "url": _absolute_media_url(request, item.image),
            "alt": item.alt,
            "order": item.order,
        }
        for item in gallery
        if item.image
    ]
    presentation_info: List[ProductPresentationInfo] = list(
        product.presentation_info.all().order_by("order", "id")
    )
    data["presentation_info"] = [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "order": item.order,
        }
        for item in presentation_info
    ]
    data.update(
        {
            "description": product.description,
            "tags": product.tags or [],
            "created_at": product.created_at.isoformat(),
            "updated_at": product.updated_at.isoformat(),
            "characteristics": _serialize_characteristics_blocks(product),
            "modules": _serialize_modules_blocks(request, product),
            "text_blocks": _serialize_text_blocks(product.text_blocks.all()),
        }
    )
    return data


@require_GET
def portal_product_list_api(request):
    products = (
        PortalProduct.objects.filter(available=True).select_related("category")
        .prefetch_related("images")
        .order_by("order", "-created_at", "name")
    )
    payload = [
        _serialize_product_base(request, product) for product in products
    ]
    return JsonResponse(payload, safe=False)


@require_GET
def portal_product_detail_api(request, slug: str):
    try:
        product = (
            PortalProduct.objects.select_related("category")
            .prefetch_related(
                "images",
                "gallery",
                "presentation_info",
                "characteristics_blocks",
                "characteristic",
                "modules_blocks",
                "module_placements",
                "module_placements__module",
                "module_placements__module__module_images",
                "module_placements__module__module_characteristics",
                "text_blocks",
            )
            .get(slug=slug, available=True)
        )
    except PortalProduct.DoesNotExist as exc:
        raise Http404("Product not found") from exc

    payload = _serialize_product_detail(request, product)
    return JsonResponse(payload)
