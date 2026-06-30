from rest_framework import serializers
from .models import AuditEvent, DataChangeLog, LoginEvent, SecurityEvent, RecordVersion


class DataChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataChangeLog
        fields = "__all__"


class AuditEventSerializer(serializers.ModelSerializer):
    changes = DataChangeLogSerializer(many=True, read_only=True)
    user_display = serializers.CharField(source="user.__str__", read_only=True)
    content_type_label = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = "__all__"

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
    changed_by_display = serializers.CharField(source="changed_by.__str__", read_only=True)

    class Meta:
        model = RecordVersion
        fields = "__all__"
