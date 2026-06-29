from rest_framework import viewsets, filters
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
