from rest_framework.permissions import BasePermission, SAFE_METHODS


ROLE_HIERARCHY = {
    "admin": 5,
    "lab_manager": 4,
    "reviewer": 3,
    "analyst": 2,
    "receptionist": 1,
    "client": 0,
}


def _rank(user):
    return ROLE_HIERARCHY.get(getattr(user, "role", ""), -1)


class IsSuperAdmin(BasePermission):
    """Platform-level superadmin only (Django is_superuser) — tenant admins
    (role='admin' but not superuser) are excluded. Guards tenant management."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "admin"


class IsLabManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and _rank(request.user) >= ROLE_HIERARCHY["lab_manager"]


class IsReviewerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and _rank(request.user) >= ROLE_HIERARCHY["reviewer"]


class IsAnalystOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and _rank(request.user) >= ROLE_HIERARCHY["analyst"]


class ReadOnlyOrLabManager(BasePermission):
    """Safe methods for all authenticated users; writes require lab_manager+."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return _rank(request.user) >= ROLE_HIERARCHY["lab_manager"]


class ReadOnlyOrAnalystOrAbove(BasePermission):
    """Safe methods for all authenticated users; writes require analyst+."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return _rank(request.user) >= ROLE_HIERARCHY["analyst"]


class AuditReadOnly(BasePermission):
    """Audit trail is read-only for all users (admin can see all)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.method in SAFE_METHODS


CAN_RECEIVE_OR_STORE_ROLES = {"admin", "lab_manager", "analyst", "receptionist"}


class CanReceiveOrStoreSamples(BasePermission):
    """Receive a sample and assign/unassign it to storage — not reviewer or client."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, "role", None) in CAN_RECEIVE_OR_STORE_ROLES
        )


class _ReadAllWriteRoles(BasePermission):
    """Base: safe methods for any authenticated user; writes restricted to
    `write_roles`; DELETE further restricted to lab_manager+ (destructive)."""
    write_roles: set = set()

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.method == "DELETE":
            return _rank(user) >= ROLE_HIERARCHY["lab_manager"]
        return getattr(user, "role", None) in self.write_roles


class ReadOnlyOrAnalystOrAbove(_ReadAllWriteRoles):
    """Reads for all authenticated users; create/update analyst+; delete lab_manager+."""
    write_roles = {"admin", "lab_manager", "reviewer", "analyst"}


class ReadOnlyOrSampleHandler(_ReadAllWriteRoles):
    """Reads for all authenticated users; create/update by roles that handle
    samples (incl. receptionist for registration); delete lab_manager+."""
    write_roles = set(CAN_RECEIVE_OR_STORE_ROLES)
