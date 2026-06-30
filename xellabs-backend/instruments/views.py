from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun, InstrumentResultImport
from .serializers import (
    InstrumentSerializer, InstrumentMethodSerializer, CalibrationSerializer,
    MaintenanceSerializer, InstrumentRunSerializer, InstrumentResultImportSerializer,
)


class InstrumentViewSet(viewsets.ModelViewSet):
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["name", "instrument_id", "serial_number"]
    ordering_fields = ["name", "next_calibration", "next_maintenance"]

    @action(detail=False, methods=["get"], url_path="calibration-due")
    def calibration_due(self, request):
        """Instruments with calibration due within the next 30 days."""
        days = int(request.query_params.get("days", 30))
        cutoff = timezone.now().date() + timezone.timedelta(days=days)
        qs = self.get_queryset().filter(
            status="active", next_calibration__isnull=False, next_calibration__lte=cutoff
        ).order_by("next_calibration")
        return Response(InstrumentSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="maintenance-due")
    def maintenance_due(self, request):
        """Instruments with maintenance due within the next 30 days."""
        days = int(request.query_params.get("days", 30))
        cutoff = timezone.now().date() + timezone.timedelta(days=days)
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
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["instrument", "status", "file_format"]

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """Dispatch a Celery task to parse and import results from the uploaded file."""
        imp = self.get_object()
        if imp.status == "processed":
            return Response({"detail": "Already processed."}, status=status.HTTP_400_BAD_REQUEST)
        from .tasks import process_instrument_import
        task = process_instrument_import.delay(imp.pk)
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
