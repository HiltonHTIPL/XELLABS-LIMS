import os

GUEST_ROLE_NAME = "Gamma"
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': ['*'],
    'resources': ['*'],
    # Must include the deployed frontend origin, not just localhost
    'origins': os.getenv('SUPERSET_CORS_ORIGINS', 'http://localhost:3000').split(','),
}
from superset.config import TALISMAN_CONFIG

TALISMAN_ENABLED = False
TALISMAN_CONFIG = {
    "content_security_policy": None,
    "force_https": False,
    "frame_options": None
}
HTTP_HEADERS = {}
SESSION_COOKIE_NAME = "superset_session"
SESSION_COOKIE_SAMESITE = None

APP_NAME = "XELPulse"
LOGO_TARGET_PATH = "http://localhost:3000/dashboard/analytics"

THEME_DEFAULT = {
    "token": {
        "brandLogoUrl": "/static/assets/images/xelpulse-logo-light.jpg",
        "brandLogoAlt": "XELPulse",
        "brandLogoHref": "http://localhost:3000/dashboard/analytics",
        "brandLogoHeight": "48px",
        "colorPrimary": "#2563EB",
        "colorLink": "#2563EB",
        "colorSuccess": "#0154FC",
        "colorWarning": "#EA580C",
        "colorError": "#DC2626",
        "colorBgBase": "#FFFFFF",
        "colorBgLayout": "#F7F8FC",
        "colorTextBase": "#3B4256",
        "borderRadius": 14,
    }
}

THEME_DARK = {
    "algorithm": "dark",
    "token": {
        "brandLogoUrl": "/static/assets/images/xelpulse-logo-dark.jpg",
        "brandLogoAlt": "XELPulse",
        "brandLogoHref": "http://localhost:3000/dashboard/analytics",
        "brandLogoHeight": "48px",
        "colorPrimary": "#2563EB",
        "colorLink": "#2563EB",
        "colorSuccess": "#0154FC",
        "colorWarning": "#EA580C",
        "colorError": "#DC2626",
        "borderRadius": 14,
    }
}

WTF_CSRF_ENABLED = False
WTF_CSRF_EXEMPT_LIST = [
    "superset.views.core",
    "SecurityRestApi"
]
JWT_COOKIE_CSRF_PROTECT = False
