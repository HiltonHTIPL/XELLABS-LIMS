"""
Tenant-aware DRF authentication classes.

XelLabsTenantMiddleware (config/tenant_middleware.py) activates whatever
PostgreSQL schema the `X-Tenant-Schema` header names, with no check that the
authenticated user actually belongs to that tenant — so a valid token for
tenant A plus `X-Tenant-Schema: tenant-b` reached tenant B's data.

Enforced at the AUTHENTICATION layer (not as a permission_classes check)
because most viewsets across the app override permission_classes with an
explicit list, which replaces rather than extends DRF's defaults — a
permission-based check would be silently skipped everywhere that happened.
Authentication classes are not overridden anywhere in this codebase except a
handful of public/superadmin views in core/views.py and core/health.py,
which either have no user to check (login, health) or already require
superuser (tenant management — exempted below), so wrapping authentication
here reliably covers every other endpoint without touching each viewset.
"""
from django.db import connection
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed


def _check_tenant(user):
    if user.is_superuser or not getattr(user, "tenant_id", None):
        return  # platform superadmins and tenant-less accounts are exempt
    if user.tenant.schema_name != connection.schema_name:
        raise AuthenticationFailed(
            "This account does not belong to the requested tenant."
        )


class TenantAwareTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            _check_tenant(result[0])
        return result


class TenantAwareSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            _check_tenant(result[0])
        return result
