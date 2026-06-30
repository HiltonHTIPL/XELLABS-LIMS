from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken.views import obtain_auth_token
from core.dashboard import DashboardView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", obtain_auth_token, name="api_token_auth"),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/", include("lims.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/instruments/", include("instruments.urls")),
    path("api/reports/", include("reporting.urls")),
    path("api/compliance/audit/", include("audittrail.urls")),
    path("api/compliance/workflow/", include("workflow.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
