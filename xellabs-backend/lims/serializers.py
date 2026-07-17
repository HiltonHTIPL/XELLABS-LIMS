from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    SampleType, SampleTemplate, AnalysisProfile, Method, Calculation, Specification,
    DynamicAnalysisSpecification, AnalysisSpecification,
    Sample, AnalysisRequest, AnalysisRequestAnalysis, Worksheet, WorksheetAssignment,
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


class DynamicAnalysisSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicAnalysisSpecification
        fields = "__all__"
        read_only_fields = ("senaite_uid",)


class SpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specification
        fields = "__all__"
        extra_kwargs = {"specification": {"required": False}}  # set by the parent AnalysisSpecificationSerializer


class AnalysisSpecificationSerializer(serializers.ModelSerializer):
    """Header + nested writable rows — the whole grid saves in one request,
    matching SENAITE's own single-Save-button form (see the screenshot this
    was designed from). create()/update() replace the full row set rather
    than diffing, since the frontend always submits the complete grid."""
    rows = SpecificationSerializer(many=True)

    class Meta:
        model = AnalysisSpecification
        fields = "__all__"

    def create(self, validated_data):
        rows_data = validated_data.pop("rows")
        instance = AnalysisSpecification.objects.create(**validated_data)
        for row in rows_data:
            Specification.objects.create(specification=instance, **row)
        return instance

    def update(self, instance, validated_data):
        rows_data = validated_data.pop("rows", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if rows_data is not None:
            instance.rows.all().delete()
            for row in rows_data:
                Specification.objects.create(specification=instance, **row)
        return instance


class SampleSerializer(RecordLockMixin, serializers.ModelSerializer):
    sample_type_name = serializers.CharField(source="sample_type.name", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    client_senaite_uid = serializers.CharField(source="client.senaite_uid", read_only=True)
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
        sample_type = validated_data["sample_type"]
        if validated_data.get("collection_date") and not validated_data.get("expiry_date"):
            days = getattr(sample_type, "retention_days", None) or 14
            validated_data["expiry_date"] = validated_data["collection_date"] + timedelta(days=days)
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


class AnalysisRequestAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisRequestAnalysis
        fields = "__all__"
        extra_kwargs = {"analysis_request": {"required": False}}  # set by the parent AnalysisRequestSerializer


class AnalysisRequestSerializer(serializers.ModelSerializer):
    ar_id = serializers.CharField(
        required=False, allow_blank=True,
        validators=[UniqueValidator(queryset=AnalysisRequest.objects.all())],
    )
    analyses = AnalysisRequestAnalysisSerializer(many=True, required=False)
    sample_id = serializers.SerializerMethodField(read_only=True)

    def get_sample_id(self, obj):
        # Prefer SENAITE's own assigned sample/AR id once synced; falls back to
        # Django's locally-generated id until the SENAITE sync has run.
        return obj.sample.senaite_ar_id or obj.sample.sample_id

    class Meta:
        model = AnalysisRequest
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        from .services import generate_ar_id
        analyses_data = validated_data.pop("analyses", [])
        validated_data["created_by"] = self.context["request"].user
        instance = _create_with_id_retry(validated_data, "ar_id", generate_ar_id, super().create)
        for row in analyses_data:
            AnalysisRequestAnalysis.objects.create(analysis_request=instance, **row)
        return instance

    def update(self, instance, validated_data):
        # Analyses are editable until the sample is received; afterwards only
        # admin/lab_manager may correct them (mirrors the Sample detail rule).
        analyses_data = validated_data.pop("analyses", None)
        if instance.sample and instance.sample.status != "registered":
            user = self.context["request"].user
            if getattr(user, "role", None) not in UNLOCK_ROLES:
                guarded = ("sample", "priority", "due_date", "notes")
                changed = [f for f in guarded if f in validated_data and validated_data[f] != getattr(instance, f)]
                if analyses_data is not None:
                    new_uids = {row["senaite_service_uid"] for row in analyses_data}
                    if new_uids != set(instance.analyses.values_list("senaite_service_uid", flat=True)):
                        changed.append("analyses")
                if changed:
                    raise serializers.ValidationError(
                        "Analyses can no longer be edited after the sample has been "
                        "received. Contact a lab manager to make corrections."
                    )
        instance = super().update(instance, validated_data)
        if analyses_data is not None:
            instance.analyses.all().delete()
            for row in analyses_data:
                AnalysisRequestAnalysis.objects.create(analysis_request=instance, **row)
        return instance


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

    def validate(self, attrs):
        ar = attrs.get("analysis_request")
        service_uid = attrs.get("senaite_service_uid", "")
        if ar and WorksheetAssignment.objects.filter(
            analysis_request=ar, senaite_service_uid=service_uid
        ).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise serializers.ValidationError(
                f"Sample {ar.sample.sample_id} already has this test assigned — "
                "it cannot be assigned twice."
            )
        return attrs

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
