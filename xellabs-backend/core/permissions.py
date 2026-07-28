from rest_framework.permissions import BasePermission, SAFE_METHODS


# ── Roles ────────────────────────────────────────────────────────────────────
# The 9 lab roles. ROLE_HIERARCHY is used ONLY by the generic "…OrAbove" classes
# below, which gate broad/generic CRUD endpoints (setup data, inventory, etc.)
# that are NOT part of the explicit activity matrix. The 24 matrix activities are
# gated by `requires(...)` against ACTIVITY_ROLES — an explicit, NON-hierarchical
# allow-list (e.g. an Analyst may Enter Results while a Lab Manager may not), so
# never fold a matrix activity back into a rank check.
ROLE_HIERARCHY = {
    "admin": 6,
    "manager": 5,
    "lab_manager": 4,
    "verifier": 3,
    "publisher": 3,
    "analyst": 2,
    "sampler": 1,
    "lab_clerk": 1,
    "client": 0,
}


def _rank(user):
    return ROLE_HIERARCHY.get(getattr(user, "role", ""), -1)


# ── Explicit activity → allowed-roles matrix (single source of truth) ─────────
# Mirrors the lab role-privilege matrix exactly. `admin` is in every set.
# Non-hierarchical by design.
ACTIVITY_ROLES = {
    "create_client":         {"client", "lab_clerk", "lab_manager", "manager", "admin"},
    "register_sample":       {"lab_clerk", "lab_manager", "manager", "admin"},
    "create_accession":      {"lab_clerk", "lab_manager", "manager", "admin"},
    "collect_sample":        {"sampler", "lab_manager", "admin"},
    "receive_sample":        {"lab_clerk", "admin"},
    "assign_analyses":       {"analyst", "lab_manager", "admin"},
    "create_worksheet":      {"analyst", "lab_manager", "admin"},
    "assign_instrument":     {"analyst", "lab_manager", "admin"},
    "assign_method":         {"analyst", "lab_manager", "admin"},
    "add_qc_samples":        {"analyst", "lab_manager", "admin"},
    "perform_qc":            {"analyst", "admin"},
    "import_results":        {"analyst", "admin"},
    "enter_results":         {"analyst", "admin"},
    "edit_results":          {"analyst", "admin"},
    "verify_results":        {"verifier", "lab_manager", "admin"},
    "approve_results":       {"lab_manager", "manager", "admin"},
    "publish_results":       {"lab_manager", "publisher", "manager", "admin"},
    "generate_reports":      {"verifier", "lab_manager", "publisher", "manager", "admin"},
    "reject_results":        {"verifier", "lab_manager", "manager", "admin"},
    "dispose_sample":        {"lab_manager", "manager", "admin"},
    "view_audit_trail":      {"analyst", "verifier", "lab_manager", "publisher", "manager", "admin"},
    "configure_methods":     {"lab_manager", "manager", "admin"},
    "configure_instruments": {"lab_manager", "manager", "admin"},
    "user_management":       {"admin"},
}


def requires(activity, allow_read=True):
    """Permission-class factory: allow the request only if the user's role is in
    ACTIVITY_ROLES[activity]. By default safe (read) methods are open to any
    authenticated user — pass allow_read=False to gate reads by role too (e.g.
    the audit trail, where *viewing* is itself the restricted activity)."""
    allowed = ACTIVITY_ROLES[activity]

    class _ActivityPermission(BasePermission):
        message = f"Your role is not permitted for this action ({activity})."

        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if allow_read and request.method in SAFE_METHODS:
                return True
            return getattr(user, "role", None) in allowed

    _ActivityPermission.__name__ = f"Requires_{activity}"
    return _ActivityPermission


# ── Generic hierarchy classes (non-matrix endpoints only) ─────────────────────

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


CAN_RECEIVE_OR_STORE_ROLES = {"admin", "lab_manager", "analyst", "lab_clerk"}


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
    write_roles = {"admin", "manager", "lab_manager", "verifier", "analyst"}


class ReadOnlyOrSampleHandler(_ReadAllWriteRoles):
    """Reads for all authenticated users; create/update by roles that handle
    samples (incl. lab_clerk for registration); delete lab_manager+."""
    write_roles = set(CAN_RECEIVE_OR_STORE_ROLES)
