from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import IsReviewerOrAbove, IsLabManagerOrAbove, CanReceiveOrStoreSamples
from .models import (
    SampleType, Method, Test, Specification,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment,
    Result, QCSample, ChainOfCustody,
)
from .serializers import (
    SampleTypeSerializer, MethodSerializer, TestSerializer, SpecificationSerializer,
    SampleSerializer, AnalysisRequestSerializer, WorksheetSerializer,
    WorksheetAssignmentSerializer, ResultSerializer, QCSampleSerializer,
    ChainOfCustodySerializer,
)


class SampleTypeViewSet(viewsets.ModelViewSet):
    queryset = SampleType.objects.all()
    serializer_class = SampleTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    @action(detail=False, methods=["post"], url_path="sync-from-senaite")
    def sync_from_senaite(self, request):
        """Create any SENAITE sample types missing from Django. Called by the frontend on New Sample page load."""
        import os, base64, requests as http_requests
        senaite_url = os.environ.get("SENAITE_URL", "http://senaite:8080/senaite")
        user = os.environ.get("SENAITE_ADMIN_USER", "admin")
        pw = os.environ.get("SENAITE_ADMIN_PASS", "admin")
        token = base64.b64encode(f"{user}:{pw}".encode()).decode()
        try:
            resp = http_requests.get(
                f"{senaite_url}/@@API/senaite/v1/SampleType",
                headers={"Authorization": f"Basic {token}"},
                params={"complete": "yes", "b_size": 200},
                timeout=8,
            )
            resp.raise_for_status()
            senaite_types = resp.json().get("items", [])
        except Exception as e:
            return Response({"detail": f"SENAITE unreachable: {e}"}, status=status.HTTP_502_BAD_GATEWAY)

        created_names = []
        for st in senaite_types:
            uid = st.get("uid", "")
            name = (st.get("title") or st.get("Title") or "").strip()
            prefix = (st.get("Prefix") or name[:4].upper() or "XX").strip()
            if not name:
                continue
            # Skip if already exists by uid or name
            if SampleType.objects.filter(senaite_uid=uid).exists():
                continue
            if SampleType.objects.filter(name=name).exists():
                # Update missing uid if name matches
                SampleType.objects.filter(name=name, senaite_uid="").update(senaite_uid=uid)
                continue
            SampleType.objects.create(name=name, prefix=prefix, senaite_uid=uid, is_active=True)
            created_names.append(name)

        return Response({"synced": len(created_names), "created": created_names})


class MethodViewSet(viewsets.ModelViewSet):
    queryset = Method.objects.all()
    serializer_class = MethodSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]


class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.select_related("method").all()
    serializer_class = TestSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active", "method"]
    search_fields = ["name", "code"]


class SpecificationViewSet(viewsets.ModelViewSet):
    queryset = Specification.objects.select_related("test", "sample_type").all()
    serializer_class = SpecificationSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["test", "sample_type", "is_active"]


class SampleViewSet(viewsets.ModelViewSet):
    queryset = Sample.objects.select_related("client", "sample_type", "created_by", "received_by").all()
    serializer_class = SampleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "sample_type", "client", "priority", "hold_for_qa"]
    search_fields = ["sample_id", "barcode", "description"]
    ordering_fields = ["created_at", "collection_date", "received_date", "expiry_date"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.utils import timezone
        qs = self.get_queryset()
        now = timezone.now()
        return Response({
            "logged":         qs.filter(status="registered").count(),
            "received":       qs.filter(status="received").count(),
            "in_process":     qs.filter(status="in_progress").count(),
            "to_be_verified": qs.filter(status="results_pending").count(),
            "on_hold_for_qa": qs.filter(hold_for_qa=True).count(),
            "completed":      qs.filter(status="published").count(),
            "overdue":        qs.filter(
                expiry_date__lt=now
            ).exclude(status__in=["published", "disposed", "rejected"]).count(),
        })

    @action(detail=False, methods=["get"])
    def tat_trend(self, request):
        from django.utils import timezone
        import datetime
        qs = self.get_queryset().filter(status="published", received_date__isnull=False)
        now = timezone.now()
        weeks = []
        for i in range(4, -1, -1):
            week_start = now - datetime.timedelta(weeks=i + 1)
            week_end = now - datetime.timedelta(weeks=i)
            week_qs = qs.filter(received_date__gte=week_start, received_date__lt=week_end)
            durations = [
                (s.updated_at - s.received_date).total_seconds() / 86400
                for s in week_qs
            ]
            avg_tat = round(sum(durations) / len(durations), 1) if durations else None
            weeks.append({
                "week_start": week_start.date().isoformat(),
                "avg_tat_days": avg_tat,
                "sample_count": len(durations),
            })
        return Response(weeks)

    @action(detail=True, methods=["patch"], url_path="upload-attachment",
            parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        sample = self.get_object()
        file = request.FILES.get("attachment")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        if sample.attachment:
            sample.attachment.delete(save=False)
        sample.attachment = file
        sample.save(update_fields=["attachment"])
        url = request.build_absolute_uri(sample.attachment.url) if sample.attachment else None
        return Response({"attachment_url": url})

    @action(detail=True, methods=["post"], permission_classes=[CanReceiveOrStoreSamples])
    def receive(self, request, pk=None):
        from .services import receive_sample
        sample = self.get_object()
        intake = {
            "location":            request.data.get("location", ""),
            "notes":               request.data.get("notes", ""),
            "condition":           request.data.get("condition", ""),
            "seal_condition":      request.data.get("seal_condition", ""),
            "seal_number":         request.data.get("seal_number", ""),
            "quantity_received":   request.data.get("quantity_received"),
            "quantity_unit":       request.data.get("quantity_unit", ""),
            "sampling_deviation":  request.data.get("sampling_deviation", ""),
            "storage_requirement": request.data.get("storage_requirement", ""),
            "priority":            request.data.get("priority", ""),
            "hold_for_qa":         request.data.get("hold_for_qa", False),
            "collector":           request.data.get("collector", ""),
        }
        try:
            receive_sample(sample, request.user, **intake)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SampleSerializer(sample, context={"request": request}).data)


class AnalysisRequestViewSet(viewsets.ModelViewSet):
    queryset = AnalysisRequest.objects.select_related("sample", "created_by").prefetch_related("tests").all()
    serializer_class = AnalysisRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "sample"]
    search_fields = ["ar_id"]
    ordering_fields = ["created_at", "due_date"]


class WorksheetViewSet(viewsets.ModelViewSet):
    queryset = Worksheet.objects.select_related("analyst").prefetch_related("assignments").all()
    serializer_class = WorksheetSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "analyst"]
    search_fields = ["ws_id"]
    ordering_fields = ["created_at"]

    @action(detail=True, methods=["post"])
    def submit_for_review(self, request, pk=None):
        from .services import submit_worksheet_for_review
        ws = self.get_object()
        try:
            submit_worksheet_for_review(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorksheetSerializer(ws).data)

    @action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])
    def verify(self, request, pk=None):
        from .services import verify_worksheet
        ws = self.get_object()
        try:
            verify_worksheet(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorksheetSerializer(ws).data)

    @action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])
    def reject(self, request, pk=None):
        from .services import reject_worksheet
        ws = self.get_object()
        try:
            reject_worksheet(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorksheetSerializer(ws).data)


class WorksheetAssignmentViewSet(viewsets.ModelViewSet):
    queryset = WorksheetAssignment.objects.select_related("worksheet", "analysis_request", "test").all()
    serializer_class = WorksheetAssignmentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["worksheet", "test"]


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.select_related(
        "worksheet_assignment", "submitted_by", "verified_by"
    ).all()
    serializer_class = ResultSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "is_out_of_range", "worksheet_assignment"]

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        from .services import submit_result
        result = self.get_object()
        try:
            submit_result(result, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResultSerializer(result).data)

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAbove])
    def verify(self, request, pk=None):
        from .services import verify_result
        result = self.get_object()
        try:
            verify_result(result, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResultSerializer(result).data)

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAbove])
    def reject(self, request, pk=None):
        from .services import reject_result
        result = self.get_object()
        remarks = request.data.get("remarks", "")
        try:
            reject_result(result, request.user, remarks=remarks)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResultSerializer(result).data)


class QCSampleViewSet(viewsets.ModelViewSet):
    queryset = QCSample.objects.select_related("test", "worksheet", "run_by").all()
    serializer_class = QCSampleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["qc_type", "status", "test", "worksheet"]
    search_fields = ["qc_id"]


class ChainOfCustodyViewSet(viewsets.ModelViewSet):
    queryset = ChainOfCustody.objects.select_related("sample", "transferred_by", "received_by").all()
    serializer_class = ChainOfCustodySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sample", "action"]
