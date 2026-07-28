from rest_framework import serializers
from .models import AuditEvent, DataChangeLog, LoginEvent, SecurityEvent, RecordVersion, ImportLog


class DataChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataChangeLog
        fields = "__all__"


class AuditEventSerializer(serializers.ModelSerializer):
    changes = DataChangeLogSerializer(many=True, read_only=True)
    user_display = serializers.SerializerMethodField()
    content_type_label = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = "__all__"

    def get_user_display(self, obj):
        return str(obj.user) if obj.user else "System"

    def get_content_type_label(self, obj):
        if obj.content_type:
            return f"{obj.content_type.app_label}.{obj.content_type.model}"
        return None


class LoginEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginEvent
        fields = "__all__"


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvent
        fields = "__all__"


class RecordVersionSerializer(serializers.ModelSerializer):
    changed_by_display = serializers.SerializerMethodField()

    class Meta:
        model = RecordVersion
        fields = "__all__"

    def get_changed_by_display(self, obj):
        return str(obj.changed_by) if obj.changed_by else "System"


class ImportLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = ImportLog
        fields = "__all__"
        read_only_fields = ["user", "timestamp"]

    def get_user_display(self, obj):
        return str(obj.user) if obj.user else "System"


class LogExternalEventSerializer(serializers.Serializer):
    """Input shape for AuditEventViewSet.log_external — plain CharField (not a
    ChoiceField against AuditEvent.ACTION) since this bridges arbitrary SENAITE
    workflow transition names (e.g. 'retract') that don't all have a matching
    internal action choice.

    `record_type` is optional and only ever a key into RECORD_TYPE_CONTENT_TYPES
    (never an arbitrary app_label/model string from the client) — it lets the
    Audit Trail table's "Record Type" column show "Sample"/"Worksheet" for
    these bridged rows the same way it already does for normal TRACKED_MODELS
    rows, without requiring (or trusting) a real Django object_id to exist."""
    action = serializers.CharField(max_length=30)
    object_repr = serializers.CharField(max_length=300, required=False, allow_blank=True)
    record_type = serializers.ChoiceField(choices=["sample", "worksheet"], required=False)
    extra_data = serializers.JSONField(required=False)
