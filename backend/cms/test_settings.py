"""Isolated PostgreSQL, media and email settings for CMS regression tests."""
import atexit
import copy
import os
import re
from tempfile import TemporaryDirectory

from aidef.settings import *  # noqa: F403

DATABASES = copy.deepcopy(DATABASES)  # noqa: F405
test_database = os.environ.get("CMS_TEST_DB_NAME", "test_aidef_cms")
if not re.fullmatch(r"test_[A-Za-z0-9_]{1,58}", test_database) or test_database == DATABASES["default"]["NAME"]:
    raise ValueError("CMS_TEST_DB_NAME must name a separate database starting with test_.")
DATABASES["default"].setdefault("TEST", {})["NAME"] = test_database
SECRET_KEY = "cms-tests-only-never-use-for-a-server"
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
_media = TemporaryDirectory(prefix="aidef-cms-tests-")
atexit.register(_media.cleanup)
MEDIA_ROOT = _media.name
