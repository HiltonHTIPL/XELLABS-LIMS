from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import AuditReadOnly
from .models import AuditEvent, LoginEvent, SecurityEvent, RecordVersion, ImportLog
from .serializers import (
    AuditEventSerializer, LoginEventSerializer,
    SecurityEventSerializer, RecordVersionSerializer,
    ImportLogSerializer
)


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("user", "content_type").prefetch_related("changes").all()
    serializer_class = AuditEventSerializer
    permission_classes = [AuditReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "content_type", "user"]
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
    
    def get_permissions(self):
        # Create is allowed for any authenticated user (who can import).
        # List/Retrieve could be AuditReadOnly or just IsAuthenticated.
        # But to allow users to see their own history or any history in the drawer,
        # we'll use default IsAuthenticated which is already set globally in REST_FRAMEWORK.
        # If we wanted only Audit readers to see it, we'd add AuditReadOnly for list actions.
        # Given it's in the import drawer for the person importing, IsAuthenticated is fine.
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
