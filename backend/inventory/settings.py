"""
Django settings for inventory project.
"""
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-@change-this-in-production")

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() == "true"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://stockscan.app")


def _split_csv(value: str):
    return [p.strip() for p in (value or "").replace("\n", ",").split(",") if p.strip()]


def _sanitize_host(entry: str):
    s = (entry or "").strip()
    if not s:
        return None
    if "://" in s:
        parsed = urlparse(s)
        return parsed.hostname
    s = s.split("/")[0]
    return s.split(":")[0] or None


_default_hosts = "localhost,127.0.0.1,0.0.0.0,testserver,inventory-tool-plage.onrender.com"
_raw_hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", _default_hosts)
_base_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "testserver"}
_env_hosts = {h for h in (_sanitize_host(x) for x in _split_csv(_raw_hosts)) if h}
ALLOWED_HOSTS = sorted(_base_hosts | _env_hosts)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "rest_framework",
    "corsheaders",
    "products.apps.ProductsConfig",
    "ai_assistant",
    "pos",
    "kds",
    "admin_dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "inventory.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "inventory.wsgi.application"


# DATABASE
DATABASE_URL = os.environ.get("DATABASE_URL")


def _sqlite_name_from_url(parsed):
    """
    Support:
      - sqlite:///db.sqlite3 (relative)
      - sqlite:////absolute/path/db.sqlite3 (absolute)
      - sqlite://:memory:
    """
    # memory
    if parsed.netloc == ":memory:" or parsed.path == ":memory:":
        return ":memory:"

    path = parsed.path or ""
    if not path:
        return str(BASE_DIR / "db.sqlite3")

    # sqlite:////abs/path => parsed.path == "/abs/path"
    # sqlite:///rel/path  => parsed.path == "/rel/path" (we treat as relative -> strip leading /)
    # Heuristic: if URL starts with sqlite://// it's absolute
    raw = (DATABASE_URL or "").strip().lower()
    if raw.startswith("sqlite:////"):
        return path  # already absolute with leading "/"
    return str(BASE_DIR / path.lstrip("/"))


if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    scheme = (parsed.scheme or "").lower()

    # Handle sqlite in CI / local
    if scheme in ("sqlite", "sqlite3"):
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": _sqlite_name_from_url(parsed),
            }
        }

    # Handle postgres in prod
    elif scheme in ("postgres", "postgresql"):
        query = parse_qs(parsed.query)
        options = {}

        sslmode = (query.get("sslmode") or [None])[0]
        if sslmode:
            options["sslmode"] = sslmode
        elif not DEBUG:
            options["sslmode"] = os.environ.get("DB_SSLMODE", "require")

        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": (parsed.path or "").lstrip("/") or os.environ.get("DB_NAME", "postgres"),
                "USER": parsed.username or os.environ.get("DB_USER", ""),
                "PASSWORD": parsed.password or os.environ.get("DB_PASSWORD", ""),
                "HOST": parsed.hostname or os.environ.get("DB_HOST", ""),
                "PORT": parsed.port or os.environ.get("DB_PORT", ""),
                "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
                **({"OPTIONS": options} if options else {}),
            }
        }

    else:
        # Unknown scheme => fallback sqlite (safe default for tests/CI)
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": str(os.environ.get("INVENTORY_DB_PATH", BASE_DIR / "db.sqlite3")),
            }
        }

else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("INVENTORY_DB_PATH", BASE_DIR / "db.sqlite3"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOW_ALL_ORIGINS = os.environ.get(
    "CORS_ALLOW_ALL_ORIGINS",
    "True" if DEBUG else "False",
).lower() == "true"


def _origin_variants(origin: str):
    try:
        parsed = urlparse(origin)
    except Exception:
        return []
    if not parsed.scheme or not parsed.netloc:
        return []
    host = parsed.hostname or ""
    if not host:
        return []
    port = f":{parsed.port}" if parsed.port else ""
    base = f"{parsed.scheme}://{host}{port}"
    alt_host = host[4:] if host.startswith("www.") else f"www.{host}"
    alt = f"{parsed.scheme}://{alt_host}{port}"
    return [base, alt] if alt != base else [base]


_cors_origins = set()
for origin in _split_csv(os.environ.get("CORS_ALLOWED_ORIGINS", "")):
    _cors_origins.update(_origin_variants(origin) or [origin])

# Dev-friendly defaults
if DEBUG and not os.environ.get("CORS_ALLOWED_ORIGINS"):
    _cors_origins.update(
        {
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        }
    )

_cors_origins.update(_origin_variants(FRONTEND_URL))

vercel_preview = os.environ.get("VERCEL_PREVIEW_ORIGIN")
if vercel_preview:
    _cors_origins.update(_origin_variants(vercel_preview) or [vercel_preview])

CORS_ALLOWED_ORIGINS = sorted(_cors_origins)

from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-service-id",
    "x-service-mode",
]


# DRF JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "ai_assistant": os.environ.get("AI_THROTTLE_RATE", "10/min"),
    },
    "EXCEPTION_HANDLER": "utils.drf_exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("ACCESS_TOKEN_LIFETIME_MIN", 30))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", 7))),
}

# AI Assistant
AI_ENABLED = os.environ.get("AI_ENABLED", "False").lower() == "true"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
AI_MODEL_LIGHT = os.environ.get("AI_MODEL_LIGHT", AI_MODEL)
AI_MODEL_FULL = os.environ.get("AI_MODEL_FULL", "gpt-4o")

# Billing Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
STRIPE_SUCCESS_URL = os.environ.get("STRIPE_SUCCESS_URL", f"{FRONTEND_URL}/billing/success")
STRIPE_CANCEL_URL = os.environ.get("STRIPE_CANCEL_URL", f"{FRONTEND_URL}/billing/cancel")
STRIPE_PRICE_BOUTIQUE_MONTHLY = os.environ.get("STRIPE_PRICE_BOUTIQUE_MONTHLY")
STRIPE_PRICE_BOUTIQUE_YEARLY = os.environ.get("STRIPE_PRICE_BOUTIQUE_YEARLY")
STRIPE_PRICE_PRO_MONTHLY = os.environ.get("STRIPE_PRICE_PRO_MONTHLY")
STRIPE_PRICE_PRO_YEARLY = os.environ.get("STRIPE_PRICE_PRO_YEARLY")

# SendGrid Emails 
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "no-reply@stockscan.app")
INVITATIONS_SEND_EMAILS = os.environ.get("INVITATIONS_SEND_EMAILS", "true").lower() == "true"
EMAIL_VERIFICATION_REQUIRED = os.environ.get("EMAIL_VERIFICATION_REQUIRED", "true").lower() == "true"
