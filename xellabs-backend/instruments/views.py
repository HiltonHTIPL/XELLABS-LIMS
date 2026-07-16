from django.http import FileResponse
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import (
    ReadOnlyOrLabManager, ReadOnlyOrAnalystOrAbove, IsAdminRole, IsAnalystOrAbove,
    IsLabManagerOrAbove,
)
from .models import (
    Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun,
    InstrumentResultImport, InstrumentType, InstrumentLocation, Certification,
    ScheduledTask, Validation, InstrumentManufacturer, InstrumentSupplier,
)
from .importers import build_provenance_map
from .serializers import (
    InstrumentSerializer, InstrumentMethodSerializer, CalibrationSerializer,
    MaintenanceSerializer, InstrumentRunSerializer, InstrumentResultImportSerializer,
    InstrumentTypeSerializer, InstrumentLocationSerializer, CertificationSerializer,
    ScheduledTaskSerializer, ValidationSerializer,
    InstrumentManufacturerSerializer, InstrumentSupplierSerializer,
)
from . import services as instrument_services


class InstrumentViewSet(viewsets.ModelViewSet):
    queryset = Instrument.objects.select_related(
        "instrument_type", "instrument_location", "manufacturer_org", "supplier_org"
    ).all()
    serializer_class = InstrumentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "usability"]
    search_fields = ["name", "instrument_id", "serial_number", "manufacturer", "supplier"]
    ordering_fields = ["name", "next_calibration", "next_maintenance", "status", "usability"]

    def get_permissions(self):
        # Registration writes = admin only; analysts can still list for maintenance/import UX.
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()]
        return [IsAnalystOrAbove()]

    def _transition(self, request, service_fn):
        instrument = self.get_object()
        try:
            service_fn(instrument)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InstrumentSerializer(instrument, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])
    def activate(self, request, pk=None):
        return self._transition(request, instrument_services.activate)

    @action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])
    def deactivate(self, request, pk=None):
        return self._transition(request, instrument_services.deactivate)

    @action(detail=True, methods=["post"], url_path="set-under-maintenance",
            permission_classes=[IsLabManagerOrAbove])
    def set_under_maintenance(self, request, pk=None):
        return self._transition(request, instrument_services.set_under_maintenance)

    @action(detail=True, methods=["post"], url_path="set-out-of-service",
            permission_classes=[IsLabManagerOrAbove])
    def set_out_of_service(self, request, pk=None):
        return self._transition(request, instrument_services.set_out_of_service)

    @action(detail=True, methods=["post"], url_path="return-to-service",
            permission_classes=[IsLabManagerOrAbove])
    def return_to_service(self, request, pk=None):
        return self._transition(request, instrument_services.return_to_service)

    @action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])
    def retire(self, request, pk=None):
        return self._transition(request, instrument_services.retire)

    @action(detail=True, methods=["post"], url_path="refresh-usability",
            permission_classes=[IsLabManagerOrAbove])
    def refresh_usability(self, request, pk=None):
        instrument = self.get_object()
        instrument_services.refresh_usability(instrument)
        return Response(InstrumentSerializer(instrument, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="calibration-due")
    def calibration_due(self, request):
        """Instruments with calibration due within the next 30 days."""
        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            return Response({"error": "days must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        if days < 1 or days > 365:
            return Response({"error": "days must be between 1 and 365"}, status=status.HTTP_400_BAD_REQUEST)
        cutoff = timezone.now().date() + timezone.timedelta(days=days)
        # Deliberately unpaginated — this is a small, bounded alerts list (due
        # within N days), not a general browse listing, and callers (dashboard
        # widgets) expect a plain array, not the {count, next, results} envelope.
        qs = self.get_queryset().filter(
            status="active", next_calibration__isnull=False, next_calibration__lte=cutoff
        ).order_by("next_calibration")
        return Response(InstrumentSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="maintenance-due")
    def maintenance_due(self, request):
        """Instruments with maintenance due within the next 30 days."""
        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            return Response({"error": "days must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        if days < 1 or days > 365:
            return Response({"error": "days must be between 1 and 365"}, status=status.HTTP_400_BAD_REQUEST)
        cutoff = timezone.now().date() + timezone.timedelta(days=days)
        # Deliberately unpaginated — see calibration_due for why.
        qs = self.get_queryset().filter(
            status="active", next_maintenance__isnull=False, next_maintenance__lte=cutoff
        ).order_by("next_maintenance")
        return Response(InstrumentSerializer(qs, many=True).data)


class InstrumentMethodViewSet(viewsets.ModelViewSet):
    queryset = InstrumentMethod.objects.select_related("instrument", "method").all()
    serializer_class = InstrumentMethodSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["instrument", "is_active"]


class CalibrationViewSet(viewsets.ModelViewSet):
    # Calibration already gets automatic AuditEvent + DataChangeLog logging via
    # the post_save signal wired in audittrail/apps.py — no manual audit needed.
    queryset = Calibration.objects.select_related("instrument", "performed_by").all()
    serializer_class = CalibrationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "status"]
    ordering_fields = ["calibration_date", "next_due"]


class MaintenanceViewSet(viewsets.ModelViewSet):
    queryset = Maintenance.objects.select_related("instrument", "performed_by").all()
    serializer_class = MaintenanceSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "maintenance_type"]
    ordering_fields = ["maintenance_date", "next_due"]


class InstrumentRunViewSet(viewsets.ModelViewSet):
    queryset = InstrumentRun.objects.select_related("instrument", "method", "operator").all()
    serializer_class = InstrumentRunSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "method"]
    ordering_fields = ["run_date"]


class InstrumentResultImportViewSet(viewsets.ModelViewSet):
    queryset = InstrumentResultImport.objects.select_related("instrument", "imported_by").all()
    serializer_class = InstrumentResultImportSerializer
    permission_classes = [IsAnalystOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["instrument", "status", "file_format"]

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        """
        Parse an uploaded file and validate every row against the database without
        writing anything. Returns per-row valid/error/skip status so the analyst can
        review the mapping before committing.
        """
        from .importers import parse_instrument_file, build_preview

        upload = request.FILES.get("file")
        file_format = request.data.get("file_format", "csv")
        if not upload:
            return Response({"detail": "A file is required."}, status=status.HTTP_400_BAD_REQUEST)

        interface = ""
        instrument_id = request.data.get("instrument")
        if instrument_id:
            try:
                instrument = Instrument.objects.get(pk=instrument_id)
                interface = instrument.import_data_interface or ""
            except (Instrument.DoesNotExist, ValueError, TypeError):
                pass

        content = upload.read()
        try:
            rows, parse_errors = parse_instrument_file(
                content, file_format=file_format, interface_code=interface,
            )
        except Exception as e:
            return Response(
                {"detail": f"File could not be parsed — check the File Format matches the actual file: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not rows and any(e.get("row") == 0 for e in parse_errors):
            return Response(
                {
                    "detail": parse_errors[0]["detail"],
                    "summary": {"total": 0, "valid": 0, "invalid": 0, "skipped": 0},
                    "rows": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        preview_rows, summary = build_preview(rows, parse_errors)
        return Response({"summary": summary, "rows": preview_rows})

    @action(detail=False, methods=["post"], url_path="commit")
    def commit(self, request):
        """
        Create the import record (the backed-up original file) and synchronously
        apply it, creating/refreshing Result rows linked to the source instrument.
        """
        upload = request.FILES.get("file")
        instrument_id = request.data.get("instrument")
        file_format = request.data.get("file_format", "csv")
        if not upload:
            return Response({"detail": "A file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not instrument_id:
            return Response({"detail": "An instrument is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            instrument = Instrument.objects.get(pk=instrument_id)
        except (Instrument.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Instrument not found."}, status=status.HTTP_400_BAD_REQUEST)

        imp = InstrumentResultImport.objects.create(
            instrument=instrument, file=upload, file_format=file_format,
            imported_by=request.user, status="pending",
        )
        from .tasks import apply_import
        summary = apply_import(imp)
        return Response({"import_id": imp.pk, **summary})

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Stream the original uploaded file back as an attachment (the backup copy)."""
        imp = self.get_object()
        if not imp.file:
            return Response({"detail": "No file on this import."}, status=status.HTTP_404_NOT_FOUND)
        filename = imp.file.name.split("/")[-1]
        return FileResponse(imp.file.open("rb"), as_attachment=True, filename=filename)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """Dispatch a Celery task to parse and import results from the uploaded file."""
        imp = self.get_object()
        if imp.status == "processed":
            return Response({"detail": "Already processed."}, status=status.HTTP_400_BAD_REQUEST)
        from django.db import connection
        from .tasks import process_instrument_import
        # Capture the tenant schema now (request context has it) — the worker doesn't.
        task = process_instrument_import.delay(imp.pk, connection.schema_name)
        return Response({"task_id": task.id, "import_id": imp.pk, "status": "queued"})

    @action(detail=True, methods=["get"])
    def errors(self, request, pk=None):
        """Return the error log for an import as structured JSON."""
        import json
        imp = self.get_object()
        try:
            errors = json.loads(imp.error_log) if imp.error_log else []
        except (json.JSONDecodeError, ValueError):
            errors = [{"detail": imp.error_log}]
        return Response({"import_id": imp.pk, "status": imp.status, "errors": errors})


class SampleInstrumentReportView(APIView):
    """
    Aggregated instrument report for a single sample: every result across every
    instrument in one view. Instrument provenance (name, method, import date) is
    reconstructed from the backed-up original import files, so no result field has
    to be duplicated on the Result model.
    """

    permission_classes = [IsAnalystOrAbove]

    def get(self, request):
        from lims.models import Sample, Result

        sample_id = (request.query_params.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"detail": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sample = Sample.objects.select_related("client", "sample_type").get(sample_id=sample_id)
        except Sample.DoesNotExist:
            return Response({"detail": f"Sample '{sample_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        provenance = build_provenance_map(sample_id)

        results = (
            Result.objects
            .select_related(
                "worksheet_assignment__method",
                "worksheet_assignment__analysis_request__sample",
            )
            .filter(worksheet_assignment__analysis_request__sample__sample_id=sample_id)
            .order_by("worksheet_assignment__senaite_service_name")
        )

        result_rows = []
        instruments_seen: dict[str, dict] = {}
        for r in results:
            wa = r.worksheet_assignment
            prov = provenance.get(wa.senaite_service_uid)
            result_rows.append({
                "test_code": wa.senaite_service_uid,
                "test_name": wa.senaite_service_name,
                "method": wa.method.name if wa.method else "",
                "value": r.value,
                "unit": r.unit,
                "result_status": r.status,
                "is_out_of_range": r.is_out_of_range,
                "instrument_name": prov["instrument_name"] if prov else None,
                "instrument_code": prov["instrument_code"] if prov else None,
                "import_date": prov["import_date"] if prov else None,
                "file_format": prov["file_format"] if prov else None,
                "source": "instrument" if prov else "manual",
            })
            if prov and prov["instrument_code"] not in instruments_seen:
                instruments_seen[prov["instrument_code"]] = {
                    "name": prov["instrument_name"],
                    "code": prov["instrument_code"],
                    "method": wa.method.name if wa.method else "",
                    "import_date": prov["import_date"],
                }

        return Response({
            "sample": {
                "sample_id": sample.sample_id,
                "client_name": sample.client.name if sample.client_id else "",
                "sample_type": sample.sample_type.name if sample.sample_type_id else "",
                "status": sample.status,
                "collection_date": sample.collection_date.isoformat() if sample.collection_date else None,
                "received_date": sample.received_date.isoformat() if sample.received_date else None,
                "description": sample.description,
            },
            "results": result_rows,
            "instruments": list(instruments_seen.values()),
            "generated_at": timezone.now().isoformat(),
        })


class InstrumentTypeViewSet(viewsets.ModelViewSet):
    queryset = InstrumentType.objects.all()
    serializer_class = InstrumentTypeSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]


class InstrumentLocationViewSet(viewsets.ModelViewSet):
    queryset = InstrumentLocation.objects.all()
    serializer_class = InstrumentLocationSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]


class CertificationViewSet(viewsets.ModelViewSet):
    queryset = Certification.objects.select_related("instrument", "preparator", "validator").all()
    serializer_class = CertificationSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "internal"]
    ordering_fields = ["valid_from", "valid_to", "date"]


class ScheduledTaskViewSet(viewsets.ModelViewSet):
    queryset = ScheduledTask.objects.select_related("instrument").all()
    serializer_class = ScheduledTaskSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "task_type"]
    ordering_fields = ["next_due"]


class ValidationViewSet(viewsets.ModelViewSet):
    queryset = Validation.objects.select_related("instrument", "worker").all()
    serializer_class = ValidationSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument"]
    ordering_fields = ["date_issued"]


class InstrumentManufacturerViewSet(viewsets.ModelViewSet):
    queryset = InstrumentManufacturer.objects.all()
    serializer_class = InstrumentManufacturerSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]


class InstrumentSupplierViewSet(viewsets.ModelViewSet):
    queryset = InstrumentSupplier.objects.all()
    serializer_class = InstrumentSupplierSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]
