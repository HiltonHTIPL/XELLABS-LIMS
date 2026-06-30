"""Tenant schema URL conf — serves all tenant subdomains."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken.views import obtain_auth_token
from core.views import UserMeView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", obtain_auth_token),
    path("api/auth/me/", UserMeView.as_view()),
    path("api/", include("core.urls")),
    path("api/lims/", include("lims.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/instruments/", include("instruments.urls")),
    path("api/reports/", include("reporting.urls")),
    path("api/compliance/audit/", include("audittrail.urls")),
    path("api/compliance/workflow/", include("workflow.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
