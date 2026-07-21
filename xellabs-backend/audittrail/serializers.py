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
