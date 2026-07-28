import os

from django.http import JsonResponse
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_tenant_model


class XelLabsTenantMiddleware(TenantMainMiddleware):
    """
    Extends TenantMainMiddleware to accept an X-Tenant-Schema header.

    When Next.js makes server-side API calls its Host header is always
    localhost:8001, not the tenant subdomain.  By sending
      X-Tenant-Schema: greenvalley
    Next.js tells Django which schema to activate.

    Fall-through: if the header is absent, the parent class resolves the
    tenant from the Host header as normal (covers direct browser→Django calls
    and the public schema on localhost).
    """

    def process_request(self, request):
        # A tenant schema that no longer exists (deleted tenant, or a session
        # cookie issued before a DB reset) must never surface as an unhandled
        # 500 — the frontend needs a clean, machine-readable signal so it can
        # clear the stale session and bounce the user back to /login instead
        # of showing a raw stack trace on every page.
        try:
            return super().process_request(request)
        except get_tenant_model().DoesNotExist:
            return JsonResponse(
                {"detail": "Tenant session is no longer valid.", "code": "invalid_tenant"},
                status=401,
            )

    def hostname_from_request(self, request):
        schema = request.META.get('HTTP_X_TENANT_SCHEMA', '').strip().lower()
        if schema:
            # Map schema_name → primary domain so the parent logic works as-is.
            # If the schema is explicitly specified but doesn't exist, raise so
            # django-tenants returns 404 instead of silently falling back to localhost.
            from core.models import Domain
            domain = (
                Domain.objects
                .filter(tenant__schema_name=schema, is_primary=True)
                .values_list('domain', flat=True)
                .first()
            )
            if domain:
                return domain
            # Schema was explicitly requested but not found — raise to produce 404
            from django_tenants.utils import get_tenant_model
            raise get_tenant_model().DoesNotExist(
                f"No tenant found for schema '{schema}'"
            )

        return super().hostname_from_request(request)

    def get_tenant(self, model, hostname):
        try:
            return super().get_tenant(model, hostname)
        except Exception:
            # Only remap to the known internal Docker hostname (e.g. 'django'),
            # never a client-controlled Host header, to avoid tenant confusion.
            if hostname != os.getenv("INTERNAL_SERVICE_HOSTNAME", "django"):
                raise
            return super().get_tenant(model, "localhost")
