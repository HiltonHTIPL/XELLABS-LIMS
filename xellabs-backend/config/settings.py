import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.getenv("DEBUG", "False") == "True"

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-55t!40@#xrq!hijkz984yr!yumph2g2c(u%bop)$p5q+=-z+i+"
    else:
        raise RuntimeError("SECRET_KEY environment variable must be set when DEBUG=False")

_allowed_hosts_default = "localhost,127.0.0.1,django" if DEBUG else ""
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", _allowed_hosts_default).split(",") if h.strip()]

# ── Multi-tenant: shared apps live in the public schema ──────────────────────
SHARED_APPS = [
    "django_tenants",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.admin",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "django_filters",
    "core",          # Tenant, Domain, User, Client — shared
]

# ── Tenant apps are replicated per tenant schema ─────────────────────────────
TENANT_APPS = [
    "lims",
    "inventory",
    "instruments",
    "workflow",
    "audittrail",
    "reporting",
]

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

TENANT_MODEL = "core.Tenant"
TENANT_DOMAIN_MODEL = "core.Domain"

DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

MIDDLEWARE = [
    "config.tenant_middleware.XelLabsTenantMiddleware",   # must be first; reads X-Tenant-Schema header
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "audittrail.middleware.AuditMiddleware",   # after auth so request.user is populated
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG

# Public schema urlconf (tenant management, no tenant context)
PUBLIC_SCHEMA_URLCONF = "config.urls_public"

# Default urlconf for all tenant schemas
ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "reporting" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",   # replaces django.db.backends.postgresql
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "core.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/min",
        "user": "300/min",
    },
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_TIMEZONE = "UTC"

_redis_cache_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0").rsplit("/", 1)[0] + "/1"
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": _redis_cache_url,  # Redis DB 1 — separate from Celery's DB 0
        "KEY_PREFIX": "xellabs",
        "TIMEOUT": 300,
    }
}

SENAITE_URL      = os.getenv("SENAITE_URL",      "http://senaite:8080/senaite")
SENAITE_USER     = os.getenv("SENAITE_USER",     "admin")
SENAITE_PASSWORD = os.getenv("SENAITE_PASSWORD", "admin")

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    # Pull sample status + results from SENAITE every 5 minutes
    "sync-from-senaite-every-5-minutes": {
        "task": "lims.tasks.sync_from_senaite",
        "schedule": 300,
    },
    "check-inventory-expiry-daily": {
        "task": "inventory.tasks.check_inventory_expiry",
        "schedule": crontab(hour=6, minute=0),
        "kwargs": {"days_ahead": 30},
    },
    "check-sample-expiry-daily": {
        "task": "inventory.tasks.check_sample_expiry",
        "schedule": crontab(hour=6, minute=15),
        "kwargs": {"days_ahead": 7},
    },
}

