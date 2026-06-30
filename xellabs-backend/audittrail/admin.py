from django.contrib import admin
from .models import AuditEvent, DataChangeLog, LoginEvent, SecurityEvent, RecordVersion


class DataChangeLogInline(admin.TabularInline):
    model = DataChangeLog
    extra = 0
    readonly_fields = ("field_name", "old_value", "new_value", "reason")
    can_delete = False


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "action", "content_type", "object_repr", "ip_address")
    list_filter = ("action", "content_type")
    search_fields = ("user__username", "object_repr", "ip_address")
    readonly_fields = ("user", "action", "content_type", "object_id", "object_repr", "ip_address", "timestamp")
    inlines = [DataChangeLogInline]
    ordering = ("-timestamp",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LoginEvent)
class LoginEventAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "username_attempted", "success", "ip_address")
    list_filter = ("success",)
    search_fields = ("username_attempted", "ip_address")
    readonly_fields = ("user", "username_attempted", "success", "ip_address", "user_agent", "timestamp")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "severity", "event_type", "user", "ip_address")
    list_filter = ("severity",)
    search_fields = ("description", "ip_address")
    readonly_fields = ("user", "event_type", "severity", "description", "ip_address", "timestamp")

    def has_add_permission(self, request):
        return False


@admin.register(RecordVersion)
class RecordVersionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "content_type", "object_id", "version_number", "changed_by", "reason")
    list_filter = ("content_type",)
    search_fields = ("object_id", "reason", "changed_by__username")
    readonly_fields = ("content_type", "object_id", "version_number", "data", "changed_by", "reason", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
