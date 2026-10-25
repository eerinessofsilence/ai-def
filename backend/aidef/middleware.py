from __future__ import annotations

from typing import Iterable

from django.conf import settings
from django.utils import translation


class QueryLanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.supported = {code.lower() for code, _ in settings.LANGUAGES}
        self.admin_path_prefix = "/admin/"

    def __call__(self, request):
        language = self._get_query_language(request)
        if language:
            translation.activate(language)
            request.LANGUAGE_CODE = language

        return self.get_response(request)

    def _get_query_language(self, request) -> str | None:
        if request.path_info == "/internal-admin" or request.path_info.startswith("/internal-admin/"):
            return None
        if request.path_info == self.admin_path_prefix.rstrip("/") or request.path_info.startswith(
            self.admin_path_prefix
        ):
            return None
        raw = request.GET.get("lang")
        if not raw:
            return None
        normalized = raw.lower().strip()
        base = normalized.split("-")[0]
        if base in self.supported:
            return base
        return None
