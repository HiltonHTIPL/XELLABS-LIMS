from rest_framework import serializers
from .models import Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun, InstrumentResultImport


class InstrumentSerializer(serializers.ModelSerializer):
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
