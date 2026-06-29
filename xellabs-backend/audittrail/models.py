from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class AuditEvent(models.Model):
    ACTION = [
        ("create", "Created"),
        ("update", "Updated"),
        ("delete", "Deleted"),
        ("view", "Viewed"),
        ("approve", "Approved"),
        ("reject", "Rejected"),
        ("sign", "Signed"),
        ("print", "Printed"),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=20, choices=ACTION)
    content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL)
    object_id = models.PositiveBigIntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=300, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_events"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user} {self.action} {self.object_repr} at {self.timestamp}"


class DataChangeLog(models.Model):
    audit_event = models.ForeignKey(AuditEvent, on_delete=models.CASCADE, related_name="changes")
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    reason = models.TextField(blank=True)

    class Meta:
        db_table = "data_change_logs"


class LoginEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    username_attempted = models.CharField(max_length=150)
    success = models.BooleanField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "login_events"
        ordering = ["-timestamp"]


class SecurityEvent(models.Model):
    SEVERITY = [("low", "Low"), ("medium", "Medium"), ("high", "High"), ("critical", "Critical")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    event_type = models.CharField(max_length=100)
    severity = models.CharField(max_length=10, choices=SEVERITY, default="low")
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "security_events"
        ordering = ["-timestamp"]


class RecordVersion(models.Model):
    """Immutable snapshot of a record at each save — version control for compliance."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    version_number = models.PositiveIntegerField()
    data = models.JSONField()
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "record_versions"
        ordering = ["content_type", "object_id", "version_number"]
        unique_together = ("content_type", "object_id", "version_number")
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"{self.content_type} #{self.object_id} v{self.version_number}"
