from rest_framework import serializers
from .models import (
    Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun,
    InstrumentResultImport, InstrumentType, InstrumentLocation, Certification,
    ScheduledTask, Validation, InstrumentManufacturer, InstrumentSupplier,
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


class InstrumentManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentManufacturer
        fields = "__all__"
        read_only_fields = ("created_at",)


class InstrumentSupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentSupplier
        fields = "__all__"
        read_only_fields = ("created_at",)


class InstrumentSerializer(serializers.ModelSerializer):
    # Read-friendly names alongside the FK ids (white-label: plain labels)
    instrument_type_name = serializers.CharField(source="instrument_type.name", read_only=True, default="")
    instrument_location_name = serializers.CharField(source="instrument_location.name", read_only=True, default="")
    manufacturer_org_name = serializers.CharField(source="manufacturer_org.name", read_only=True, default="")
    supplier_org_name = serializers.CharField(source="supplier_org.name", read_only=True, default="")
    is_usable = serializers.BooleanField(read_only=True)
    method_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )

    class Meta:
        model = Instrument
        fields = "__all__"
        read_only_fields = ("usability", "created_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["method_ids"] = list(
            instance.methods.filter(is_active=True).values_list("method_id", flat=True)
        )
        return data

    def _sync_methods(self, instrument, method_ids):
        if method_ids is None:
            return
        from .models import InstrumentMethod
        InstrumentMethod.objects.filter(instrument=instrument).exclude(method_id__in=method_ids).delete()
        for mid in method_ids:
            InstrumentMethod.objects.update_or_create(
                instrument=instrument, method_id=mid, defaults={"is_active": True}
            )

    def create(self, validated_data):
        method_ids = validated_data.pop("method_ids", None)
        instrument = super().create(validated_data)
        self._sync_methods(instrument, method_ids)
        return instrument

    def update(self, instance, validated_data):
        method_ids = validated_data.pop("method_ids", None)
        instrument = super().update(instance, validated_data)
        self._sync_methods(instrument, method_ids)
        return instrument


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
