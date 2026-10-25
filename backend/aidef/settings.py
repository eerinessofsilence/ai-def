from os import getenv
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def getenv_first(*names, default=None):
    for name in names:
        value = getenv(name)
        if value is not None:
            return value
    return default


def getenv_bool(*names, default=False):
    value = getenv_first(*names)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def getenv_list(*names, default=""):
    value = getenv_first(*names, default=default)
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = getenv("DJANGO_SECRET")
DEBUG = getenv_bool("DJANGO_DEBUG", "DEBUG", default=True)
CMS_FRONTEND_URL = getenv("CMS_FRONTEND_URL", "http://127.0.0.1:5174/cms/" if DEBUG else "/cms/")
ALLOWED_HOSTS = getenv_list("DJANGO_ALLOWED_HOSTS", "ALLOWED_HOST")

INSTALLED_APPS = [
    'modeltranslation',
    'aidef.apps.AIDefAdminConfig',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.sitemaps',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'tinymce',
    'users.apps.UsersConfig',
    'main.apps.MainConfig',
    'portal.apps.PortalConfig',
    'cms.apps.CMSConfig',
]
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'aidef.middleware.QueryLanguageMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'aidef.urls'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'aidef.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': getenv_first('POSTGRES_HOST', 'DB_HOST', default="localhost"),
        'PORT': getenv_first('POSTGRES_PORT', 'DB_PORT', default="5432"),
        'USER': getenv_first('POSTGRES_USER', 'DB_USER', default="aidef"),
        'PASSWORD': getenv_first('POSTGRES_PASSWORD', 'DB_PASS', default="aidef"),
        'NAME': getenv_first('POSTGRES_DB_NAME', 'POSTGRES_DB', 'DB_NAME', default="aidef"),
        'ATOMIC_REQUESTS': True,
    }
}

AUTH_USER_MODEL = 'users.User'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


LANGUAGE_CODE = 'en'
LANGUAGES = [
    ('en', 'English'),
    ('de', 'German'),
    ('sk', 'Slovak'),
    ('es', 'Spanish'),
    ('fr', 'French'),
    ('it', 'Italian'),
]
MODELTRANSLATION_DEFAULT_LANGUAGE = 'en'
MODELTRANSLATION_LANGUAGES = ('en', 'de', 'sk', 'es', 'fr', 'it')
MODELTRANSLATION_FALLBACK_LANGUAGES = ('en',)
TIME_ZONE = getenv('DJANGO_TIME_ZONE', 'Europe/Kyiv')
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = getenv_list("DJANGO_CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = getenv_list("DJANGO_CSRF_TRUSTED_ORIGINS")

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

TINYMCE_DEFAULT_CONFIG = {
    "height": 360,
    "menubar": False,
    "statusbar": False,
    "plugins": "lists link image table code help wordcount",
    "toolbar": (
        "undo redo | blocks | bold italic underline | "
        "bullist numlist blockquote | link image table | removeformat code"
    ),
    "block_formats": (
        "Paragraph=p; "
        "Heading 1=h1; Heading 2=h2; Heading 3=h3; "
        "Heading 4=h4; Heading 5=h5; Heading 6=h6"
    ),
    "content_style": (
        "body { font-family: Inter, Arial, sans-serif; font-size: 16px; line-height: 1.5; } "
        "p { font-size: 16px; line-height: 1.5; margin: 0; } "
        "h1 { font-size: 48px; line-height: 1; font-weight: 600; margin: 0; } "
        "h2 { font-size: 36px; line-height: 1.1; font-weight: 600; margin: 0; } "
        "h3 { font-size: 30px; line-height: 1.2; font-weight: 600; margin: 0; } "
        "h4 { font-size: 24px; line-height: 1.25; font-weight: 600; margin: 0; } "
        "h5 { font-size: 20px; line-height: 1.3; font-weight: 600; margin: 0; } "
        "h6 { font-size: 18px; line-height: 1.35; font-weight: 600; margin: 0; }"
    ),
}

EMAIL_BACKEND = getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST = getenv('EMAIL_HOST', '')
EMAIL_PORT = int(getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = getenv_bool('EMAIL_USE_TLS', default=True)
EMAIL_USE_SSL = getenv_bool('EMAIL_USE_SSL', default=False)
DEFAULT_FROM_EMAIL = getenv('DEFAULT_FROM_EMAIL', 'no-reply@ai-def.com')
SERVER_EMAIL = DEFAULT_FROM_EMAIL
CONTACT_REQUEST_NOTIFICATION_EMAILS = getenv_list('CONTACT_REQUEST_NOTIFICATION_EMAILS')
STRATEGIC_PARTNERSHIP_EMAIL = getenv('STRATEGIC_PARTNERSHIP_EMAIL', '')
