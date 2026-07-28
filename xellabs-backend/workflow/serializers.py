from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import serializers
from .models import WorkflowState, WorkflowTransition, Task, TaskAssignment, Approval, ElectronicSignature


class WorkflowStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowState
        fields = "__all__"


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowTransition
        fields = "__all__"


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class TaskAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAssignment
        fields = "__all__"
        read_only_fields = ("assigned_by", "assigned_at")

    def create(self, validated_data):
        validated_data["assigned_by"] = self.context["request"].user
        return super().create(validated_data)


class ApprovalSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Approval
        fields = "__all__"
        read_only_fields = ("requested_by", "reviewed_by", "requested_at", "reviewed_at")

    def get_requested_by_name(self, obj):
        return self._display_name(obj.requested_by)

    def get_reviewed_by_name(self, obj):
        return self._display_name(obj.reviewed_by)

    @staticmethod
    def _display_name(user):
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    def validate(self, attrs):
        # Only validate the Django-object subject when one is actually supplied.
        # SENAITE-sample approvals leave the GenericFK null (see model comment).
        content_type = attrs.get("content_type") or getattr(self.instance, "content_type", None)
        object_id = attrs.get("object_id") or getattr(self.instance, "object_id", None)
        if content_type and object_id is not None:
            try:
                content_type.get_object_for_this_type(pk=object_id)
            except content_type.model_class().DoesNotExist:
                raise serializers.ValidationError("The object this approval refers to does not exist.")
        return attrs

    def create(self, validated_data):
        validated_data["requested_by"] = self.context["request"].user
        return super().create(validated_data)


class ApprovalActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    comments = serializers.CharField(required=False, allow_blank=True)
    # The deciding user re-enters their password — this IS the electronic
    # signature (21 CFR Part 11: re-authentication at the point of signing).
    # Verified server-side in ApprovalViewSet.decide.
    password = serializers.CharField(write_only=True)


class SampleApprovalRequestSerializer(serializers.Serializer):
    """Create a pending approval for a SENAITE sample (by UID) once it has
    been verified — no Django content type involved."""
    senaite_uid = serializers.CharField(max_length=64)
    sample_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    client_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    priority = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")


class ElectronicSignatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElectronicSignature
        fields = "__all__"
        read_only_fields = ("signed_by", "signed_at", "ip_address")


class SignRequestSerializer(serializers.Serializer):
    """Input for creating an electronic signature — password verified server-side."""
    app_label = serializers.CharField()
    model = serializers.CharField()
    object_id = serializers.IntegerField()
    reason = serializers.CharField(max_length=300)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            ct = ContentType.objects.get(app_label=attrs["app_label"], model=attrs["model"])
        except ContentType.DoesNotExist:
            raise serializers.ValidationError("Unknown content type.")
        try:
            ct.get_object_for_this_type(pk=attrs["object_id"])
        except ct.model_class().DoesNotExist:
            raise serializers.ValidationError("Object not found.")
        attrs["content_type"] = ct

        user = self.context["request"].user
        if not user.check_password(attrs["password"]):
            raise serializers.ValidationError({"password": "Incorrect password. Signature not applied."})

        return attrs
