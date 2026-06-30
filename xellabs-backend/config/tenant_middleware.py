from django_tenants.middleware.main import TenantMainMiddleware


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

    def hostname_from_request(self, request):
        schema = request.META.get('HTTP_X_TENANT_SCHEMA', '').strip().lower()
        if schema:
            # Map schema_name → primary domain so the parent logic works as-is
            try:
                from core.models import Domain
                domain = (
                    Domain.objects
                    .filter(tenant__schema_name=schema, is_primary=True)
                    .values_list('domain', flat=True)
                    .first()
                )
                if domain:
                    return domain
            except Exception:
                pass  # fall through to normal host resolution

        return super().hostname_from_request(request)

    def get_tenant(self, model, hostname):
        try:
            return super().get_tenant(model, hostname)
        except Exception:
            # Unknown host (e.g. internal Docker service name 'django') → public schema
            try:
                return super().get_tenant(model, 'localhost')
            except Exception:
                raise
