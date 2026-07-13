from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import ReadOnlyOrLabManager, ReadOnlyOrAnalystOrAbove
from .models import Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun, InstrumentResultImport
from .serializers import (
    InstrumentSerializer, InstrumentMethodSerializer, CalibrationSerializer,
    MaintenanceSerializer, InstrumentRunSerializer, InstrumentResultImportSerializer,
)


class InstrumentViewSet(viewsets.ModelViewSet):
    queryset = Instrument.objects.all()
    serializer_class = InstrumentSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["name", "instrument_id", "serial_number"]
    ordering_fields = ["name", "next_calibration", "next_maintenance"]

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
        qs = self.get_queryset().filter(
            status="active", next_calibration__isnull=False, next_calibration__lte=cutoff
        ).order_by("next_calibration")
        # Deliberately unpaginated — this is a small, bounded alerts list (due
        # within N days), not a general browse listing, and callers (dashboard
        # widgets) expect a plain array, not the {count, next, results} envelope.
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
        qs = self.get_queryset().filter(
            status="active", next_maintenance__isnull=False, next_maintenance__lte=cutoff
        ).order_by("next_maintenance")
        # Deliberately unpaginated — see calibration_due for why.
        return Response(InstrumentSerializer(qs, many=True).data)


class InstrumentMethodViewSet(viewsets.ModelViewSet):
    queryset = InstrumentMethod.objects.select_related("instrument", "method").all()
    serializer_class = InstrumentMethodSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["instrument", "is_active"]


class CalibrationViewSet(viewsets.ModelViewSet):
    # Calibration already gets automatic AuditEvent + DataChangeLog logging via
    # the post_save signal wired in audittrail/apps.py — no manual audit needed.
    queryset = Calibration.objects.select_related("instrument", "performed_by").all()
    serializer_class = CalibrationSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "status"]
    ordering_fields = ["calibration_date", "next_due"]


class MaintenanceViewSet(viewsets.ModelViewSet):
    queryset = Maintenance.objects.select_related("instrument", "performed_by").all()
    serializer_class = MaintenanceSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "maintenance_type"]
    ordering_fields = ["maintenance_date", "next_due"]


class InstrumentRunViewSet(viewsets.ModelViewSet):
    queryset = InstrumentRun.objects.select_related("instrument", "method", "operator").all()
    serializer_class = InstrumentRunSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["instrument", "method"]
    ordering_fields = ["run_date"]


class InstrumentResultImportViewSet(viewsets.ModelViewSet):
    queryset = InstrumentResultImport.objects.select_related("instrument", "imported_by").all()
    serializer_class = InstrumentResultImportSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["instrument", "status", "file_format"]

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """Dispatch a Celery task to parse and import results from the uploaded file."""
        imp = self.get_object()
        if imp.status in ("processed", "processing"):
            return Response(
                {"detail": f"Import is already {imp.status}."}, status=status.HTTP_400_BAD_REQUEST
            )
        # Atomic conditional update: only the request that actually flips
        # pending/failed -> processing gets to dispatch the task. A second
        # click while the first is still in flight (still "pending" until the
        # task's own transaction starts) previously slipped through and queued
        # a duplicate concurrent import of the same file.
        updated = InstrumentResultImport.objects.filter(
            pk=imp.pk, status__in=["pending", "failed"]
        ).update(status="processing")
        if updated == 0:
            return Response(
                {"detail": "Import was just started by another request."}, status=status.HTTP_409_CONFLICT
            )
        from .tasks import process_instrument_import
        task = process_instrument_import.delay(imp.pk)
        return Response({"task_id": task.id, "import_id": imp.pk, "status": "processing"})

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
