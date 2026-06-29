from rest_framework import serializers
from .models import (
    SampleType, Method, Test, Specification,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment,
    Result, QCSample, ChainOfCustody,
)


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


class SampleSerializer(serializers.ModelSerializer):
    sample_type_name = serializers.CharField(source="sample_type.name", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Sample
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class AnalysisRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisRequest
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class WorksheetAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorksheetAssignment
        fields = "__all__"


class WorksheetSerializer(serializers.ModelSerializer):
    assignments = WorksheetAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = Worksheet
        fields = "__all__"
        read_only_fields = ("analyst", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["analyst"] = self.context["request"].user
        return super().create(validated_data)


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = "__all__"
        read_only_fields = ("submitted_by", "verified_by", "submitted_at", "verified_at")


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
