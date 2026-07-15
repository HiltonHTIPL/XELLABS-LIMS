from rest_framework import serializers
from .models import (
    Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun,
    InstrumentResultImport, InstrumentType, InstrumentLocation, Certification,
    ScheduledTask, Validation,
)


class InstrumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentType
        fields = "__all__"
        read_only_fields = ("created_at",)


class InstrumentLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentLocation
        fields = "__all__"
        read_only_fields = ("created_at",)


class InstrumentSerializer(serializers.ModelSerializer):
    # Read-friendly names alongside the FK ids (white-label: plain labels, no SENAITE refs)
    instrument_type_name = serializers.CharField(source="instrument_type.name", read_only=True, default="")
    instrument_location_name = serializers.CharField(source="instrument_location.name", read_only=True, default="")

    class Meta:
        model = Instrument
        fields = "__all__"


class InstrumentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentMethod
        fields = "__all__"


class CalibrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calibration
        fields = "__all__"
        read_only_fields = ("performed_by", "created_at")

    def create(self, validated_data):
        validated_data["performed_by"] = self.context["request"].user
        return super().create(validated_data)


class MaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maintenance
        fields = "__all__"
        read_only_fields = ("performed_by", "created_at")

    def create(self, validated_data):
        validated_data["performed_by"] = self.context["request"].user
        return super().create(validated_data)


class InstrumentRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentRun
        fields = "__all__"
        read_only_fields = ("operator", "created_at")

    def create(self, validated_data):
        validated_data["operator"] = self.context["request"].user
        return super().create(validated_data)


class InstrumentResultImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentResultImport
        fields = "__all__"
        read_only_fields = ("imported_by", "created_at")

    def create(self, validated_data):
        validated_data["imported_by"] = self.context["request"].user
        return super().create(validated_data)


class CertificationSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)
    preparator_name = serializers.CharField(source="preparator.get_full_name", read_only=True, default="")
    validator_name = serializers.CharField(source="validator.get_full_name", read_only=True, default="")

    class Meta:
        model = Certification
        fields = "__all__"
        read_only_fields = ("created_at",)


class ScheduledTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledTask
        fields = "__all__"
        read_only_fields = ("created_at",)


class ValidationSerializer(serializers.ModelSerializer):
    worker_name = serializers.CharField(source="worker.get_full_name", read_only=True, default="")

    class Meta:
        model = Validation
        fields = "__all__"
        read_only_fields = ("created_at",)
