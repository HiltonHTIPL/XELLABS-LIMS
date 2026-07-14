from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    SampleType, SampleTemplate, AnalysisProfile, Method, Calculation, Test, Specification,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment,
    Result, QCSample, ChainOfCustody,
)

UNLOCK_ROLES = ("admin", "lab_manager")


def _create_with_id_retry(validated_data, id_field, generate, create):
    """ID generators read MAX(<id>) then format the next number, so two
    concurrent creates can produce the same ID. Retry with a freshly generated
    ID instead of surfacing a 500 IntegrityError. Only applies when the ID was
    auto-generated — a caller-supplied duplicate should still fail loudly."""
    auto_generated = not validated_data.get(id_field)
    for attempt in range(5):
        if auto_generated:
            validated_data[id_field] = generate()
        try:
            with transaction.atomic():
                return create(validated_data)
        except IntegrityError:
            if not auto_generated or attempt == 4:
                raise
    raise RuntimeError("unreachable")


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


class CalculationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calculation
        fields = "__all__"


class MethodSerializer(serializers.ModelSerializer):
    instruments = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Method
        fields = "__all__"

    def get_fields(self):
        from instruments.models import Instrument
        fields = super().get_fields()
        fields["instrument_ids"] = serializers.PrimaryKeyRelatedField(
            source="instruments", many=True, write_only=True, required=False,
            queryset=Instrument.objects.all(),
        )
        return fields

    def get_instruments(self, obj):
        return list(obj.instrumentmethod_set.values_list("instrument_id", flat=True))

    def _sync_instruments(self, method, instrument_list):
        from instruments.models import InstrumentMethod
        if instrument_list is None:
            return
        existing_ids = set(method.instrumentmethod_set.values_list("instrument_id", flat=True))
        wanted_ids = {i.pk for i in instrument_list}
        InstrumentMethod.objects.filter(method=method, instrument_id__in=existing_ids - wanted_ids).delete()
        for instrument_id in wanted_ids - existing_ids:
            InstrumentMethod.objects.create(method=method, instrument_id=instrument_id)

    def create(self, validated_data):
        instrument_list = validated_data.pop("instruments", None)
        method = super().create(validated_data)
        self._sync_instruments(method, instrument_list)
        return method

    def update(self, instance, validated_data):
        instrument_list = validated_data.pop("instruments", None)
        method = super().update(instance, validated_data)
        self._sync_instruments(method, instrument_list)
        return method


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
    reason_for_change = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def get_received_by_name(self, obj):
        if obj.received_by:
            full = f"{obj.received_by.first_name} {obj.received_by.last_name}".strip()
            return full or obj.received_by.username
        return ""
    sample_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=Sample.objects.all())],
    )

    class Meta:
        model = Sample
        fields = "__all__"
        read_only_fields = ("created_by", "locked_by", "locked_at", "created_at", "updated_at")

    # Fields that describe the sample itself — editable only until the sample is
    # received (or by admin/lab_manager afterwards). Status/workflow fields are
    # governed separately in update().
    DETAIL_FIELDS = (
        "client", "sample_type", "collection_date", "description",
        "barcode", "storage_location", "expiry_date",
    )

    def validate_collection_date(self, value):
        from django.utils import timezone
        if value and value > timezone.now():
            raise serializers.ValidationError("Sample date cannot be in the future.")
        return value

    def create(self, validated_data):
        from .services import generate_sample_id
        from datetime import timedelta
        validated_data.pop("reason_for_change", None)
        validated_data["created_by"] = self.context["request"].user
        # Auto-compute due date: collection_date + 14 days if not explicitly provided
        if validated_data.get("collection_date") and not validated_data.get("expiry_date"):
            validated_data["expiry_date"] = validated_data["collection_date"] + timedelta(days=14)
        sample_type = validated_data["sample_type"]
        return _create_with_id_retry(
            validated_data, "sample_id",
            lambda: generate_sample_id(sample_type),
            super().create,
        )

    def update(self, instance, validated_data):
        validated_data.pop("reason_for_change", None)

        # Detail fields are editable only while the sample is still 'registered';
        # after receipt only admin/lab_manager may correct them. Without this the
        # periodic SENAITE pull-sync silently reasserts the mirrored state anyway,
        # so allowing the edit would just look like a bug to the user.
        if instance.status != "registered":
            user = self.context["request"].user
            if getattr(user, "role", None) not in UNLOCK_ROLES:
                changed = [
                    f for f in self.DETAIL_FIELDS
                    if f in validated_data and validated_data[f] != getattr(instance, f)
                ]
                if changed:
                    raise serializers.ValidationError(
                        "Sample details can no longer be edited after the sample has been "
                        "received. Contact a lab manager to make corrections."
                    )

        new_status = validated_data.get("status")
        if new_status and new_status != instance.status:
            if instance.status == "registered" and new_status == "received":
                raise serializers.ValidationError(
                    {"status": "Use the /receive action to move a sample to 'received' — "
                               "it also records chain of custody."}
                )
            if instance.status == "received" and new_status == "registered":
                raise serializers.ValidationError(
                    {"status": "A received sample cannot be moved back to 'registered' — "
                               "receipt has already been recorded in the chain of custody."}
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
        validated_data["created_by"] = self.context["request"].user
        return _create_with_id_retry(validated_data, "ar_id", generate_ar_id, super().create)

    def update(self, instance, validated_data):
        # Analyses are editable until the sample is received; afterwards only
        # admin/lab_manager may correct them (mirrors the Sample detail rule).
        if instance.sample and instance.sample.status != "registered":
            user = self.context["request"].user
            if getattr(user, "role", None) not in UNLOCK_ROLES:
                guarded = ("tests", "sample", "priority", "due_date", "notes")
                changed = []
                for f in guarded:
                    if f not in validated_data:
                        continue
                    if f == "tests":
                        new_ids = {t.pk for t in validated_data["tests"]}
                        if new_ids != set(instance.tests.values_list("pk", flat=True)):
                            changed.append(f)
                    elif validated_data[f] != getattr(instance, f):
                        changed.append(f)
                if changed:
                    raise serializers.ValidationError(
                        "Analyses can no longer be edited after the sample has been "
                        "received. Contact a lab manager to make corrections."
                    )
        return super().update(instance, validated_data)


class WorksheetAssignmentSerializer(serializers.ModelSerializer):
    instrument_name = serializers.SerializerMethodField(read_only=True)
    method_name = serializers.SerializerMethodField(read_only=True)

    def get_instrument_name(self, obj):
        return obj.instrument.name if obj.instrument else ""

    def get_method_name(self, obj):
        return obj.method.name if obj.method else ""

    class Meta:
        model = WorksheetAssignment
        fields = "__all__"

    def create(self, validated_data):
        # Default instrument/method from the parent worksheet at assignment time,
        # unless the caller explicitly set them — mirrors SENAITE's cascade-on-add.
        worksheet = validated_data.get("worksheet")
        if worksheet:
            validated_data.setdefault("instrument", worksheet.instrument)
            validated_data.setdefault("method", worksheet.method)
        instance = super().create(validated_data)
        # Assigning a test to a worksheet moves the sample into In Progress.
        from .services import refresh_sample_workflow_status
        if instance.analysis_request and instance.analysis_request.sample:
            refresh_sample_workflow_status(instance.analysis_request.sample)
        return instance


class WorksheetSerializer(serializers.ModelSerializer):
    assignments = WorksheetAssignmentSerializer(many=True, read_only=True)
    analyst_name = serializers.SerializerMethodField(read_only=True)
    instrument_name = serializers.SerializerMethodField(read_only=True)
    method_name = serializers.SerializerMethodField(read_only=True)
    ws_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=Worksheet.objects.all())],
    )

    def get_analyst_name(self, obj):
        if obj.analyst:
            full = f"{obj.analyst.first_name} {obj.analyst.last_name}".strip()
            return full or obj.analyst.username
        return ""

    def get_instrument_name(self, obj):
        return obj.instrument.name if obj.instrument else ""

    def get_method_name(self, obj):
        return obj.method.name if obj.method else ""

    class Meta:
        model = Worksheet
        fields = "__all__"
        # analyst is settable on update (Assign To); create always uses request.user
        read_only_fields = ("created_at", "updated_at")
        extra_kwargs = {"analyst": {"required": False}}

    def create(self, validated_data):
        from .services import generate_ws_id
        validated_data["analyst"] = self.context["request"].user
        return _create_with_id_retry(validated_data, "ws_id", generate_ws_id, super().create)

    def update(self, instance, validated_data):
        instrument_changed = "instrument" in validated_data and validated_data["instrument"] != instance.instrument
        method_changed = "method" in validated_data and validated_data["method"] != instance.method
        instance = super().update(instance, validated_data)
        # Cascade the worksheet's instrument/method to every assignment already on
        # it, matching SENAITE's setInstrument()/setMethod() cascade-to-analyses.
        if instrument_changed:
            instance.assignments.update(instrument=instance.instrument)
        if method_changed:
            instance.assignments.update(method=instance.method)
        return instance


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
