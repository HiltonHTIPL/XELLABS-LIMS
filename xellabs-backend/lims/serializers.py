from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    SampleType, Method, Test, Specification,
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


class MethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Method
        fields = "__all__"


class TestSerializer(serializers.ModelSerializer):
    method_name = serializers.CharField(source="method.name", read_only=True)

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
    reason_for_change = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
        validated_data.pop("reason_for_change", None)
        validated_data["created_by"] = self.context["request"].user
        if not validated_data.get("sample_id"):
            validated_data["sample_id"] = generate_sample_id(validated_data["sample_type"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("reason_for_change", None)
        # Auto-lock when published
        if validated_data.get("status") == "published" and not instance.is_locked:
            from django.utils import timezone
            validated_data["is_locked"] = True
            validated_data["locked_by"] = self.context["request"].user
            validated_data["locked_at"] = timezone.now()
            validated_data["locked_reason"] = "Auto-locked on publication"
        return super().update(instance, validated_data)


class AnalysisRequestSerializer(serializers.ModelSerializer):
    ar_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=AnalysisRequest.objects.all())],
    )

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
        # Auto-lock when verified
        if validated_data.get("status") == "verified":
            validated_data["is_locked"] = True
        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data.pop("reason_for_change", None)
        return super().create(validated_data)


class QCSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = QCSample
        fields = "__all__"
        read_only_fields = ("run_by", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["run_by"] = self.context["request"].user
        return super().create(validated_data)


class ChainOfCustodySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChainOfCustody
        fields = "__all__"
        read_only_fields = ("timestamp",)
