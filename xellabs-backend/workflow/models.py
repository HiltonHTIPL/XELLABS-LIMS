from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class WorkflowState(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "workflow_states"

    def __str__(self):
        return self.name


class WorkflowTransition(models.Model):
    from_state = models.ForeignKey(WorkflowState, on_delete=models.CASCADE, related_name="transitions_from")
    to_state = models.ForeignKey(WorkflowState, on_delete=models.CASCADE, related_name="transitions_to")
    name = models.CharField(max_length=100)
    required_role = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "workflow_transitions"

    def __str__(self):
        return f"{self.from_state} -> {self.to_state}"


class Task(models.Model):
    PRIORITY = [("low", "Low"), ("normal", "Normal"), ("high", "High"), ("urgent", "Urgent")]
    STATUS = [("open", "Open"), ("in_progress", "In Progress"), ("done", "Done"), ("cancelled", "Cancelled")]

    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY, default="normal")
    status = models.CharField(max_length=20, choices=STATUS, default="open")
    due_date = models.DateTimeField(null=True, blank=True)
    content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL)
    object_id = models.PositiveBigIntegerField(null=True, blank=True)
    related_object = GenericForeignKey("content_type", "object_id")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="tasks_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasks"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class TaskAssignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="assignments")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name="tasks_assigned_by")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_assignments"


class Approval(models.Model):
    STATUS = [("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")]
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    subject = GenericForeignKey("content_type", "object_id")
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name="approvals_requested")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="approvals_reviewed")
    comments = models.TextField(blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "approvals"


class ElectronicSignature(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    signed_object = GenericForeignKey("content_type", "object_id")
    signed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    reason = models.CharField(max_length=300)
    signed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "electronic_signatures"
