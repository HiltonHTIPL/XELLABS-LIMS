from django.contrib import admin
from .models import WorkflowState, WorkflowTransition, Task, TaskAssignment, Approval, ElectronicSignature


@admin.register(WorkflowState)
class WorkflowStateAdmin(admin.ModelAdmin):
    list_display = ("name", "code")
    search_fields = ("name", "code")


@admin.register(WorkflowTransition)
class WorkflowTransitionAdmin(admin.ModelAdmin):
    list_display = ("name", "from_state", "to_state", "required_role")
    list_filter = ("required_role",)


class TaskAssignmentInline(admin.TabularInline):
    model = TaskAssignment
    extra = 0
    readonly_fields = ("assigned_at",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "priority", "due_date", "created_by", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("title",)
    inlines = [TaskAssignmentInline]
    readonly_fields = ("created_at", "updated_at")


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ("pk", "content_type", "object_id", "status", "requested_by", "reviewed_by", "requested_at")
    list_filter = ("status", "content_type")
    readonly_fields = ("requested_at", "reviewed_at")


@admin.register(ElectronicSignature)
class ElectronicSignatureAdmin(admin.ModelAdmin):
    list_display = ("signed_at", "signed_by", "content_type", "object_id", "reason", "ip_address")
    list_filter = ("content_type",)
    search_fields = ("signed_by__username", "reason")
    readonly_fields = ("signed_by", "signed_at", "ip_address", "content_type", "object_id", "reason")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
