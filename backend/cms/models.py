import uuid

from django.conf import settings
from django.db import models


SITES = (("ai-def", "AI DEF"), ("arms", "ARMS"))


class WorkspaceAccess(models.Model):
    class Role(models.TextChoices):
        EDITOR = "editor", "Редактор"
        PUBLISHER = "publisher", "Редактор с публикацией"
        MANAGER = "manager", "Управление сайтом"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cms_access")
    site = models.CharField(max_length=12, choices=SITES)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.EDITOR)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "site"), name="cms_user_site_unique")]


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.CharField(max_length=12, choices=SITES)
    kind = models.CharField(max_length=24)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    data = models.JSONField(default=dict)
    published_data = models.JSONField(null=True, blank=True)
    translation_reviews = models.JSONField(default=dict, blank=True)
    live_fingerprint = models.CharField(max_length=64, blank=True)
    dirty = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("site", "kind", "target_id"), name="cms_document_target_unique")]
        indexes = [models.Index(fields=("site", "kind", "updated_at"), name="cms_document_site_kind")]


class Revision(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="revisions")
    version = models.PositiveIntegerField()
    data = models.JSONField()
    action = models.CharField(max_length=16)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-version",)
        constraints = [models.UniqueConstraint(fields=("document", "version"), name="cms_revision_version_unique")]


class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.CharField(max_length=12, choices=SITES)
    file = models.FileField(upload_to="cms/%Y/%m/")
    original_name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, blank=True)
    source_url = models.CharField(max_length=500, blank=True)
    width = models.PositiveIntegerField(null=True)
    height = models.PositiveIntegerField(null=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Page(models.Model):
    site = models.CharField(max_length=12, choices=SITES)
    slug = models.SlugField()
    name = models.CharField(max_length=120)
    content = models.JSONField(default=dict)
    assets = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("site", "slug"), name="cms_page_site_slug_unique")]
