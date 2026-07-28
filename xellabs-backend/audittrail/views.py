from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as df_filters
from django.contrib.contenttypes.models import ContentType
from core.permissions import requires
from .models import AuditEvent, LoginEvent, SecurityEvent, RecordVersion, ImportLog
from .serializers import (
    AuditEventSerializer, LoginEventSerializer,
    SecurityEventSerializer, RecordVersionSerializer,
    ImportLogSerializer, LogExternalEventSerializer,
)

# Only these two record kinds are ever bridged from SENAITE-native actions
# today (sample lifecycle transitions, and worksheet transitions) — deliberately
# a closed lookup table, not a way to pass an arbitrary app_label/model string
# in from an API client.
RECORD_TYPE_CONTENT_TYPES = {
    "sample": ("lims", "sample"),
    "worksheet": ("lims", "worksheet"),
    "analysisrequest": ("lims", "analysisrequest"),
    "result": ("lims", "result"),
    "method": ("lims", "method"),
    "sampletype": ("lims", "sampletype"),
    "sampletemplate": ("lims", "sampletemplate"),
    "analysisspecification": ("lims", "analysisspecification"),
}


class AuditEventFilter(df_filters.FilterSet):
    date_from = df_filters.DateFilter(field_name="timestamp", lookup_expr="gte")
    date_to = df_filters.DateFilter(field_name="timestamp", lookup_expr="lte")
    object_repr = df_filters.CharFilter(field_name="object_repr", lookup_expr="exact")
    # log_external's object_repr is a free-text label (e.g. "Sample HP-0011 —
    # Soil pH assigned to Worksheet WS-011"), not a value a caller can match
    # exactly — a per-sample lookup (e.g. the Sample Detail Audit Trail drawer)
    # needs a substring match instead.
    object_repr_contains = df_filters.CharFilter(field_name="object_repr", lookup_expr="icontains")
    object_id = df_filters.NumberFilter(field_name="object_id", lookup_expr="exact")
    record_type = df_filters.CharFilter(method="filter_record_type")

    def filter_record_type(self, queryset, name, value):
        if value in RECORD_TYPE_CONTENT_TYPES:
            app, model = RECORD_TYPE_CONTENT_TYPES[value]
            try:
                ct = ContentType.objects.get(app_label=app, model=model)
                return queryset.filter(content_type=ct)
            except ContentType.DoesNotExist:
                return queryset.none()
        return queryset

    class Meta:
        model = AuditEvent
        fields = ["action", "content_type", "user", "date_from", "date_to", "object_repr", "object_id", "record_type"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("user", "content_type").prefetch_related("changes").all()
    serializer_class = AuditEventSerializer
    permission_classes = [requires("view_audit_trail", allow_read=False)]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditEventFilter
    ordering_fields = ["timestamp"]

    def get_permissions(self):
        # The trail itself stays read-only (AuditReadOnly) for every list/retrieve
        # call — but log_external is the one write path this viewset exposes,
        # for actions that happen entirely against SENAITE's own REST API (no
        # Django model instance ever gets saved, so no signal fires) — any
        # authenticated user may log an action they themselves just performed.
        if self.action == "log_external":
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=["post"])
    def log_external(self, request):
        # Bridge for SENAITE-native workflow actions (sample receive/verify/
        # publish/cancel on /dashboard/samples & /batches, worksheet transition/
        # submit/verify on /dashboard/worksheets) — these call SENAITE's REST API
        # directly from the Next.js server and never touch a Django model, so
        # the normal TRACKED_MODELS save-signal (audittrail/signals.py) never
        # fires for them. Without this, those actions left zero audit trail.
        serializer = LogExternalEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content_type = None
        record_type = serializer.validated_data.get("record_type")
        if record_type:
            app_label, model = RECORD_TYPE_CONTENT_TYPES[record_type]
            content_type = ContentType.objects.get(app_label=app_label, model=model)
        event = AuditEvent.objects.create(
            user=request.user,
            action=serializer.validated_data["action"],
            # Never "senaite" — CLAUDE.md §11a (white-label rule): the lab
            # system this bridges to must never be named anywhere user-visible,
            # and `source` renders directly in the Audit Trail table's own
            # Source column.
            source="workflow",
            content_type=content_type,
            object_repr=serializer.validated_data.get("object_repr", ""),
            extra_data=serializer.validated_data.get("extra_data"),
        )
        return Response(AuditEventSerializer(event).data, status=status.HTTP_201_CREATED)


class LoginEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginEvent.objects.select_related("user").all()
    serializer_class = LoginEventSerializer
    permission_classes = [requires("view_audit_trail", allow_read=False)]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["success", "user"]
    ordering_fields = ["timestamp"]


class SecurityEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityEvent.objects.select_related("user").all()
    serializer_class = SecurityEventSerializer
    permission_classes = [requires("view_audit_trail", allow_read=False)]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["severity", "event_type"]


class RecordVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RecordVersion.objects.select_related("content_type", "changed_by").all()
    serializer_class = RecordVersionSerializer
    permission_classes = [requires("view_audit_trail", allow_read=False)]
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
