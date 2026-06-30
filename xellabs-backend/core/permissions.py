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


class AuditReadOnly(BasePermission):
    """Audit trail is read-only for all users (admin can see all)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.method in SAFE_METHODS
