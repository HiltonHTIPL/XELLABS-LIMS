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
    class Meta:
        model = Approval
        fields = "__all__"
        read_only_fields = ("requested_by", "reviewed_by", "requested_at", "reviewed_at")

    def validate(self, attrs):
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
