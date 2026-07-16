from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    SampleType, SampleTemplate, AnalysisProfile, Method, Test, Specification,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment,
    Result, QCSample, ChainOfCustody,
)

UNLOCK_ROLES = ("admin", "lab_manager")


class RecordLockMixin:
    """Blocks updates to locked records unless the user is admin or lab_manager."""
    def validate(self, attrs):
        if self.instance and getattr(self.instance, "is_locked", False):
            user = self.context["request"].user
            if getattr(user, "role", None) not in UNLOCK_ROLES:
                raise serializers.ValidationError(
                    "This record is locked. Contact a lab manager to make changes."
                )
        return super().validate(attrs)


class SampleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleType
        fields = "__all__"
        extra_kwargs = {
            'prefix': {'required': True, 'allow_blank': False},
        }


class SampleTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleTemplate
        fields = "__all__"


class AnalysisProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisProfile
        fields = "__all__"


class MethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Method
        fields = "__all__"


class TestSerializer(serializers.ModelSerializer):
    method_name = serializers.CharField(source="method.name", read_only=True)
    method_code = serializers.CharField(source="method.code", read_only=True)

    class Meta:
        model = Test
        fields = "__all__"


class SpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specification
        fields = "__all__"


class SampleSerializer(RecordLockMixin, serializers.ModelSerializer):
    sample_type_name = serializers.CharField(source="sample_type.name", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    received_by_name = serializers.SerializerMethodField(read_only=True)
    attachment_url = serializers.SerializerMethodField(read_only=True)
    reason_for_change = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def get_received_by_name(self, obj):
        if obj.received_by:
            full = f"{obj.received_by.first_name} {obj.received_by.last_name}".strip()
            return full or obj.received_by.username
        return ""

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    sample_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=Sample.objects.all())],
    )

    class Meta:
        model = Sample
        fields = "__all__"
        read_only_fields = ("created_by", "locked_by", "locked_at", "created_at", "updated_at")

    def create(self, validated_data):
        from .services import generate_sample_id
        from datetime import timedelta
        validated_data.pop("reason_for_change", None)
        validated_data["created_by"] = self.context["request"].user
        if not validated_data.get("sample_id"):
            validated_data["sample_id"] = generate_sample_id(validated_data["sample_type"])
        # Auto-compute due/retention date from sample type Retention Period
        if validated_data.get("collection_date") and not validated_data.get("expiry_date"):
            sample_type = validated_data.get("sample_type")
            days = getattr(sample_type, "retention_days", None) or 14
            validated_data["expiry_date"] = validated_data["collection_date"] + timedelta(days=days)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("reason_for_change", None)
        new_status = validated_data.get("status")
        if new_status and new_status != instance.status:
            if instance.status == "registered" and new_status == "received":
                raise serializers.ValidationError(
                    {"status": "Use the /receive action to move a sample to 'received' — "
                               "it also records chain of custody."}
                )
            # Auto-lock when published
            if new_status == "published" and not instance.is_locked:
                from django.utils import timezone
                validated_data["is_locked"] = True
                validated_data["locked_by"] = self.context["request"].user
                validated_data["locked_at"] = timezone.now()
                validated_data["locked_reason"] = "Auto-locked on publication"
            # Sample's post_save signal (audittrail/signals.py) already logs this
            # status change to AuditEvent + a field-level DataChangeLog — no manual
            # audit call needed here.
        return super().update(instance, validated_data)


class AnalysisRequestSerializer(serializers.ModelSerializer):
    ar_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=AnalysisRequest.objects.all())],
    )
    tests_detail = TestSerializer(source="tests", many=True, read_only=True)

    class Meta:
        model = AnalysisRequest
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        from .services import generate_ar_id
        if not validated_data.get("ar_id"):
            validated_data["ar_id"] = generate_ar_id()
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class WorksheetAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorksheetAssignment
        fields = "__all__"


class WorksheetSerializer(serializers.ModelSerializer):
    assignments = WorksheetAssignmentSerializer(many=True, read_only=True)
    ws_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=Worksheet.objects.all())],
    )

    class Meta:
        model = Worksheet
        fields = "__all__"
        read_only_fields = ("analyst", "created_at", "updated_at")

    def create(self, validated_data):
        from .services import generate_ws_id
        if not validated_data.get("ws_id"):
            validated_data["ws_id"] = generate_ws_id()
        validated_data["analyst"] = self.context["request"].user
        return super().create(validated_data)


class ResultSerializer(RecordLockMixin, serializers.ModelSerializer):
    reason_for_change = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Result
        fields = "__all__"
        read_only_fields = ("submitted_by", "verified_by", "submitted_at", "verified_at")

    def update(self, instance, validated_data):
        validated_data.pop("reason_for_change", None)
        new_status = validated_data.get("status")
        if new_status and new_status != instance.status:
            if new_status == "verified":
                raise serializers.ValidationError(
                    {"status": "Use the /verify action to verify a result — it also records "
                               "the verifier, timestamp, and audit trail."}
                )
            # Result's post_save signal (audittrail/signals.py) already logs this
            # status change to AuditEvent + a field-level DataChangeLog — no manual
            # audit call needed here.
        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data.pop("reason_for_change", None)
        return super().create(validated_data)


class QCSampleSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)
    run_by_name = serializers.CharField(source="run_by.username", read_only=True, default=None)

    class Meta:
        model = QCSample
        fields = "__all__"
        read_only_fields = ("run_by", "reviewed_by", "reviewed_at", "is_reviewed", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["run_by"] = self.context["request"].user
        return super().create(validated_data)


class ChainOfCustodySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChainOfCustody
        fields = "__all__"
        read_only_fields = ("timestamp",)
