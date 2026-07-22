from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as df_filters
from core.permissions import AuditReadOnly
from .models import AuditEvent, LoginEvent, SecurityEvent, RecordVersion, ImportLog
from .serializers import (
    AuditEventSerializer, LoginEventSerializer,
    SecurityEventSerializer, RecordVersionSerializer,
    ImportLogSerializer,
)


class AuditEventFilter(df_filters.FilterSet):
    date_from = df_filters.DateFilter(field_name="timestamp", lookup_expr="gte")
    date_to = df_filters.DateFilter(field_name="timestamp", lookup_expr="lte")

    class Meta:
        model = AuditEvent
        fields = ["action", "content_type", "user", "date_from", "date_to"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("user", "content_type").prefetch_related("changes").all()
    serializer_class = AuditEventSerializer
    permission_classes = [AuditReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditEventFilter
    ordering_fields = ["timestamp"]


class LoginEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginEvent.objects.select_related("user").all()
    serializer_class = LoginEventSerializer
    permission_classes = [AuditReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["success", "user"]
    ordering_fields = ["timestamp"]


class SecurityEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityEvent.objects.select_related("user").all()
    serializer_class = SecurityEventSerializer
    permission_classes = [AuditReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["severity", "event_type"]


class RecordVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RecordVersion.objects.select_related("content_type", "changed_by").all()
    serializer_class = RecordVersionSerializer
    permission_classes = [AuditReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["content_type", "object_id"]
    ordering_fields = ["version_number", "created_at"]


class ImportLogViewSet(viewsets.ModelViewSet):
    queryset = ImportLog.objects.select_related("user").all()
    serializer_class = ImportLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["entity_name", "user"]
    ordering_fields = ["timestamp"]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
