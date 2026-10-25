import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="WorkspaceAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("site", models.CharField(choices=[("ai-def", "AI DEF"), ("arms", "ARMS")], max_length=12)),
                ("role", models.CharField(choices=[("editor", "Редактор"), ("publisher", "Редактор с публикацией"), ("manager", "Управление сайтом")], default="editor", max_length=12)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cms_access", to=settings.AUTH_USER_MODEL)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("user", "site"), name="cms_user_site_unique")]},
        ),
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("site", models.CharField(choices=[("ai-def", "AI DEF"), ("arms", "ARMS")], max_length=12)),
                ("kind", models.CharField(max_length=24)),
                ("target_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("data", models.JSONField(default=dict)),
                ("published_data", models.JSONField(blank=True, null=True)),
                ("live_fingerprint", models.CharField(blank=True, max_length=64)),
                ("dirty", models.BooleanField(default=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("site", "kind", "target_id"), name="cms_document_target_unique")],
                "indexes": [models.Index(fields=["site", "kind", "updated_at"], name="cms_document_site_kind")],
            },
        ),
        migrations.CreateModel(
            name="Revision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.PositiveIntegerField()),
                ("data", models.JSONField()),
                ("action", models.CharField(max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("document", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revisions", to="cms.document")),
            ],
            options={"ordering": ("-version",), "constraints": [models.UniqueConstraint(fields=("document", "version"), name="cms_revision_version_unique")]},
        ),
        migrations.CreateModel(
            name="MediaAsset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("site", models.CharField(choices=[("ai-def", "AI DEF"), ("arms", "ARMS")], max_length=12)),
                ("file", models.FileField(upload_to="cms/%Y/%m/")),
                ("original_name", models.CharField(max_length=255)),
                ("width", models.PositiveIntegerField(null=True)),
                ("height", models.PositiveIntegerField(null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
