import json
from pathlib import Path

from django.db import migrations, models


def seed(apps, schema_editor):
    Page = apps.get_model("cms", "Page")
    for row in json.loads(Path(__file__).with_name("page_content.json").read_text()):
        Page.objects.get_or_create(site=row["site"], slug=row["slug"], defaults={key: value for key, value in row.items() if key not in {"site", "slug"}})


class Migration(migrations.Migration):
    dependencies = [("cms", "0001_initial")]
    operations = [
        migrations.CreateModel(name="Page", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("site", models.CharField(choices=[("ai-def", "AI DEF"), ("arms", "ARMS")], max_length=12)),
            ("slug", models.SlugField()), ("name", models.CharField(max_length=120)),
            ("content", models.JSONField(default=dict)), ("assets", models.JSONField(default=dict)),
            ("updated_at", models.DateTimeField(auto_now=True)),
        ], options={"constraints": [models.UniqueConstraint(fields=("site", "slug"), name="cms_page_site_slug_unique")]}),
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
