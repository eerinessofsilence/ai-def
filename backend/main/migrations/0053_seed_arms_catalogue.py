import json
from pathlib import Path

from django.db import migrations


def seed_catalogue(apps, schema_editor):
    payload = json.loads(Path(__file__).with_name("arms_catalogue.json").read_text())
    Product = apps.get_model("main", "ArmsProduct")
    Variant = apps.get_model("main", "ArmsVariant")
    Image = apps.get_model("main", "ArmsImage")
    database = schema_editor.connection.alias

    def translated(key, language):
        def lookup(code):
            value = payload["translations"][code]
            for part in key.split("."):
                if not isinstance(value, dict) or part not in value:
                    return None
                value = value[part]
            return value
        return lookup(language) or lookup("en") or key

    def specifications(items, language):
        return [{
            "label": translated(item["labelKey"], language),
            "value": translated(item["valueKey"], language) if item.get("valueKey") else item["value"],
        } for item in items]

    for order, source in enumerate(payload["products"]):
        content = {
            language: {
                "description": translated("store.descriptions." + source["id"], language),
                "specifications": specifications(source["specifications"], language),
            }
            for language in payload["translations"]
        }
        product, created = Product.objects.using(database).get_or_create(
            slug=source["id"],
            defaults={
                "name": source["name"], "brand": source["brand"], "category": source["category"],
                "legacy_image": source["image"], "width": source["width"], "height": source["height"],
                "content": content, "available": True, "order": order * 10,
            },
        )
        if not created:
            continue
        for variant_order, source_variant in enumerate(source["variants"]):
            variant = Variant.objects.using(database).create(
                product=product, code=source_variant["id"], model_name=source_variant.get("modelName", ""),
                order=variant_order * 10,
                content={
                    language: {
                        "label": translated(source_variant["labelKey"], language),
                        "specifications": specifications(source_variant["specifications"], language),
                    }
                    for language in payload["translations"]
                },
            )
            Image.objects.using(database).bulk_create([
                Image(variant=variant, legacy_path=image, order=image_order * 10)
                for image_order, image in enumerate(source_variant["images"])
            ])


class Migration(migrations.Migration):
    dependencies = [("main", "0052_arms_catalogue")]
    operations = [migrations.RunPython(seed_catalogue, migrations.RunPython.noop)]
