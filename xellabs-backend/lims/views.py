import logging

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType
from core.permissions import (
    IsLabManagerOrAbove, requires,
    ReadOnlyOrLabManager, ReadOnlyOrAnalystOrAbove, ReadOnlyOrSampleHandler,
)
from audittrail.models import AuditEvent
from .models import (
    SampleType, SampleTemplate, Method, Specification,
    DynamicAnalysisSpecification, AnalysisSpecification,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment,
    Result, QCSample, ChainOfCustody,
)
from .serializers import (
    SampleTypeSerializer, SampleTemplateSerializer, MethodSerializer, SpecificationSerializer,
    DynamicAnalysisSpecificationSerializer, AnalysisSpecificationSerializer,
    SampleSerializer, AnalysisRequestSerializer, WorksheetSerializer,
    WorksheetAssignmentSerializer, ResultSerializer, QCSampleSerializer,
    ChainOfCustodySerializer,
)

logger = logging.getLogger(__name__)


class SampleTypeViewSet(viewsets.ModelViewSet):
    queryset = SampleType.objects.all()
    serializer_class = SampleTypeSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    @action(detail=False, methods=["post"], url_path="sync-from-senaite")
    def sync_from_senaite(self, request):
        """Create any SENAITE sample types missing from Django. Called by the frontend on New Sample page load."""
        # Only lab managers and admins can trigger a full sync
        if request.user.role not in ('admin', 'lab_manager'):
            return Response(
                {'detail': 'Only lab managers can sync sample types from SENAITE.'},
                status=status.HTTP_403_FORBIDDEN
            )
        import base64, requests as http_requests
        from django.conf import settings
        # Use the same settings the rest of the backend authenticates to SENAITE
        # with (core/senaite_service.py's _session()) — NOT the frontend's env var
        # names (SENAITE_ADMIN_USER/SENAITE_ADMIN_PASS), which don't exist in this
        # container. Reading those here silently fell back to "admin"/"admin",
        # authenticating as Anonymous and returning zero SampleTypes from SENAITE's
        # Setup area — the sync endpoint ran, reported success, and fixed nothing.
        senaite_url = settings.SENAITE_URL
        user = settings.SENAITE_USER
        pw = settings.SENAITE_PASSWORD
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
            from core.senaite_service import _sanitize_error
            logger.error("Sample type sync failed: %s", e)
            return Response(
                {"detail": f"The lab system is unreachable: {_sanitize_error(str(e))}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        created_names = []
        skipped = []
        # Bulk-load existing rows once instead of a filter() + get_or_create()
        # (2 queries) per SENAITE item — most items on a repeat sync are
        # already-synced and need no DB write at all, so skip those entirely
        # via a plain dict lookup before touching the database.
        existing_by_uid = {st.senaite_uid: st for st in SampleType.objects.exclude(senaite_uid="").exclude(senaite_uid__isnull=True)}
        existing_by_name = {st.name: st for st in SampleType.objects.all()}
        for st in senaite_types:
            uid = st.get("uid", "")
            name = (st.get("title") or st.get("Title") or "").strip()
            prefix = (st.get("Prefix") or name[:4].upper() or "XX").strip()
            if not name:
                continue
            if uid and uid in existing_by_uid:
                continue  # already synced by uid — nothing to do
            if not uid and name in existing_by_name:
                continue  # already synced by name (no-uid fallback path) — nothing to do
            # One bad row must never abort the whole sync: SampleType.name is
            # unique, so a SENAITE type re-created under a new UID with the same
            # title used to raise IntegrityError here and silently drop every
            # remaining type — the "dropdown shows 2 of 3 types" bug.
            try:
                if uid:
                    name_match = existing_by_name.get(name)
                    if name_match and name_match.senaite_uid != uid:
                        # Same title, different (or blank) UID — adopt the new UID
                        # instead of colliding on the unique name.
                        name_match.senaite_uid = uid
                        name_match.save(update_fields=["senaite_uid"])
                        continue
                    obj, created = SampleType.objects.get_or_create(
                        senaite_uid=uid,
                        defaults={"name": name, "prefix": prefix, "is_active": True}
                    )
                else:
                    # No uid from SENAITE — use name as fallback (less reliable but still atomic)
                    obj, created = SampleType.objects.get_or_create(
                        name=name,
                        defaults={"prefix": prefix, "is_active": True}
                    )
                if created:
                    created_names.append(name)
            except Exception as e:
                logger.warning("Sample type sync skipped %r: %s", name, e)
                skipped.append(name)

        return Response({"synced": len(created_names), "created": created_names, "skipped": skipped})


class SampleTemplateViewSet(viewsets.ModelViewSet):
    queryset = SampleTemplate.objects.all()
    serializer_class = SampleTemplateSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]


class MethodViewSet(viewsets.ModelViewSet):
    queryset = Method.objects.all()
    serializer_class = MethodSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]
    parser_classes = [MultiPartParser, FormParser]


class DynamicAnalysisSpecificationViewSet(viewsets.ModelViewSet):
    queryset = DynamicAnalysisSpecification.objects.all()
    serializer_class = DynamicAnalysisSpecificationSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        # SENAITE first (source of truth for the file itself — see
        # core/senaite_service.py push_dynamic_analysis_spec docstring for why
        # this specific object type has to go through Plone's REST API). No
        # Django row is created if SENAITE rejects it — same "no orphan
        # Django-only records" discipline used for Sample registration.
        from core.senaite_service import push_dynamic_analysis_spec

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data["file"]
        uploaded_file.seek(0)
        result = push_dynamic_analysis_spec(
            name=serializer.validated_data["name"],
            summary=serializer.validated_data.get("summary", ""),
            file_bytes=uploaded_file.read(),
            filename=uploaded_file.name,
        )
        if not result.get("ok"):
            return Response(
                {"detail": f"The lab system rejected the file: {result.get('error')}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        uploaded_file.seek(0)
        # DRF's auto-generated BooleanField doesn't reliably inherit the model's
        # default=True when the client omits is_active entirely (confirmed live:
        # came back False without this) — force the intended default explicitly
        # unless the client actually sent a value for it.
        is_active = True if "is_active" not in request.data else serializer.validated_data.get("is_active", True)
        instance = serializer.save(senaite_uid=result["uid"], is_active=is_active)
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)


class AnalysisSpecificationViewSet(viewsets.ModelViewSet):
    queryset = AnalysisSpecification.objects.select_related("sample_type", "dynamic_spec").prefetch_related("rows").all()
    serializer_class = AnalysisSpecificationSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["sample_type", "is_active"]
    search_fields = ["title"]


class SpecificationViewSet(viewsets.ModelViewSet):
    queryset = Specification.objects.select_related("specification__sample_type").all()
    serializer_class = SpecificationSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["senaite_service_uid", "specification", "is_active"]


class SampleViewSet(viewsets.ModelViewSet):
    queryset = Sample.objects.all()  # select_related fields are not used in stats/tat_trend endpoints
    serializer_class = SampleSerializer
    permission_classes = [ReadOnlyOrSampleHandler]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "sample_type", "client", "priority", "hold_for_qa", "senaite_uid", "sample_id"]
    search_fields = ["sample_id", "barcode", "description"]
    ordering_fields = ["created_at", "collection_date", "received_date", "expiry_date"]

    def get_queryset(self):
        # Client users only ever see their own client's samples. Client login
        # accounts use the Client.client_id as their username.
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) == "client":
            qs = qs.filter(client__client_id__iexact=user.username)
        if (
            self.action == "list"
            and self.request.query_params.get("status") != "disposed"
            and self.request.query_params.get("include_disposed") != "1"
        ):
            qs = qs.exclude(status="disposed")
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.utils import timezone
        from django.db.models import Count, Q
        qs = self.get_queryset()
        now = timezone.now()

        agg = qs.aggregate(
            logged=Count("pk", filter=Q(status="registered")),
            received=Count("pk", filter=Q(status="received")),
            in_process=Count("pk", filter=Q(status="in_progress")),
            to_be_verified=Count("pk", filter=Q(status="results_pending")),
            on_hold_for_qa=Count("pk", filter=Q(hold_for_qa=True)),
            completed=Count("pk", filter=Q(status="published")),
            overdue=Count("pk", filter=Q(expiry_date__lt=now) & ~Q(status__in=["registered", "disposed", "rejected"])),
        )
        return Response(agg)

    @action(detail=False, methods=["post"], url_path="refresh-status",
            permission_classes=[IsAuthenticated])
    def refresh_status(self, request):
        """Sync ONE sample's status from live SENAITE state into Django, on
        demand. Called by the frontend right after any workflow transition
        (receive / results submit / verify / publish) so the Django mirror the
        dashboard + overview read is always current — the synchronous
        counterpart of the 5-min pull task, keyed off senaite_uid (reliable).
        Body: {senaite_uid} (AnalysisRequest uid) or {analysis_uid}."""
        from lims.senaite_sync import refresh_one_sample_status
        senaite_uid = request.data.get("senaite_uid") or ""
        analysis_uid = request.data.get("analysis_uid") or ""
        if not senaite_uid and not analysis_uid:
            return Response({"detail": "senaite_uid or analysis_uid is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        result = refresh_one_sample_status(ar_uid=senaite_uid, analysis_uid=analysis_uid)
        return Response(result)

    @action(detail=False, methods=["get"])
    def tat_trend(self, request):
        from django.utils import timezone
        import datetime
        qs = Sample.objects.filter(status="published", received_date__isnull=False)
        now = timezone.now()
        weeks = []
        for i in range(4, -1, -1):
            week_start = now - datetime.timedelta(weeks=i + 1)
            week_end = now - datetime.timedelta(weeks=i)
            # Only fetch the two fields we need (received_date, updated_at) to avoid N+1 query
            # locked_at is stamped at publication (auto-lock) — a stable
            # completion timestamp. updated_at is only a fallback for legacy
            # rows and drifts every time the row is touched (e.g. SENAITE sync).
            week_qs = qs.filter(
                received_date__gte=week_start, received_date__lt=week_end
            ).values('received_date', 'updated_at', 'locked_at')
            durations = [
                ((s['locked_at'] or s['updated_at']) - s['received_date']).total_seconds() / 86400
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
        import os
        ALLOWED_EXTENSIONS = {
            ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv",
            ".xls", ".xlsx", ".doc", ".docx",
        }
        MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 MB

        sample = self.get_object()
        file = request.FILES.get("attachment")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"detail": f"File type '{ext or 'unknown'}' is not allowed. "
                           f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > MAX_ATTACHMENT_BYTES:
            return Response(
                {"detail": "File is too large. Maximum size is 10 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Save the new file first; only delete the old one once the new save
        # succeeded, so a failed upload never destroys the existing attachment.
        old_attachment = sample.attachment if sample.attachment else None
        old_name = old_attachment.name if old_attachment else None
        sample.attachment = file
        sample.senaite_attachment_uid = ""
        sample.save(update_fields=["attachment", "senaite_attachment_uid"])
        if old_name and old_name != sample.attachment.name:
            sample.attachment.storage.delete(old_name)
        url = request.build_absolute_uri(sample.attachment.url) if sample.attachment else None

        from django.db import connection
        from core.tasks import sync_sample_attachment_to_senaite
        sync_sample_attachment_to_senaite.delay(sample.pk, connection.schema_name)

        return Response({"attachment_url": url})

    @action(
        detail=True,
        methods=["post"],
        url_path="dispose",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsLabManagerOrAbove],
    )
    def dispose(self, request, pk=None):
        """Dispose a past-retention sample in XELLABS (TC-9)."""
        from .services import dispose_sample
        sample = self.get_object()
        basis = request.data.get("regulatory_basis") or ""
        notes = request.data.get("notes") or ""
        certificate = request.FILES.get("attachment") or request.FILES.get("certificate")
        try:
            dispose_sample(sample, request.user, basis=basis, notes=notes, certificate=certificate)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        attachment_url = (
            request.build_absolute_uri(sample.attachment.url) if sample.attachment else None
        )
        data = SampleSerializer(sample, context={"request": request}).data
        data["attachment_url"] = attachment_url
        return Response(data)

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-dispose",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
        permission_classes=[IsLabManagerOrAbove],
    )
    def bulk_dispose(self, request):
        """Bulk dispose past-retention samples in XELLABS (TC-9).
        Invokes dispose_sample() in a loop per sample so signals & audit events fire."""
        from .services import dispose_sample

        raw_ids = request.data.get("sample_ids") or request.data.get("ids") or []
        if isinstance(raw_ids, str):
            import json
            try:
                raw_ids = json.loads(raw_ids)
            except Exception:
                raw_ids = [s.strip() for s in raw_ids.split(",") if s.strip()]

        if not isinstance(raw_ids, (list, tuple, set)):
            raw_ids = [raw_ids]

        if not raw_ids:
            return Response({"detail": "No sample IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        basis = request.data.get("regulatory_basis") or ""
        notes = request.data.get("notes") or ""
        certificate = request.FILES.get("attachment") or request.FILES.get("certificate")

        samples = Sample.objects.filter(id__in=raw_ids)
        sample_map = {s.id: s for s in samples}

        disposed_ids = []
        skipped = []

        for sid in raw_ids:
            try:
                sid_int = int(sid)
            except (ValueError, TypeError):
                skipped.append({"id": sid, "reason": "Invalid sample ID format."})
                continue

            sample = sample_map.get(sid_int)
            if not sample:
                skipped.append({"id": sid_int, "reason": "Sample not found."})
                continue

            try:
                dispose_sample(sample, request.user, basis=basis, notes=notes, certificate=certificate)
                disposed_ids.append(sample.id)
            except ValueError as e:
                skipped.append({"id": sample.id, "reason": str(e)})
            except Exception as e:
                skipped.append({"id": sample.id, "reason": f"Unexpected error: {str(e)}"})

        return Response({
            "ok": True,
            "disposed_count": len(disposed_ids),
            "disposed_ids": disposed_ids,
            "skipped_count": len(skipped),
            "skipped": skipped,
            "message": f"Successfully disposed {len(disposed_ids)} sample(s)." + (f" Skipped {len(skipped)} sample(s)." if skipped else "")
        })

    @action(detail=True, methods=["post"], permission_classes=[requires("receive_sample", allow_read=False)])
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
    queryset = AnalysisRequest.objects.select_related("sample", "created_by").prefetch_related("analyses").all()
    serializer_class = AnalysisRequestSerializer
    permission_classes = [ReadOnlyOrSampleHandler]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "sample"]
    search_fields = ["ar_id"]
    ordering_fields = ["created_at", "due_date"]

    def get_queryset(self):
        # Disposed samples leave active analysis work lists.
        qs = super().get_queryset()
        if self.request.query_params.get("include_disposed") == "1":
            return qs
        return qs.exclude(sample__status="disposed")


class WorksheetViewSet(viewsets.ModelViewSet):
    queryset = Worksheet.objects.select_related("analyst").prefetch_related("assignments").all()
    serializer_class = WorksheetSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "analyst"]
    search_fields = ["ws_id"]
    ordering_fields = ["created_at"]

    @action(detail=True, methods=["post"], permission_classes=[ReadOnlyOrAnalystOrAbove])
    def submit_for_review(self, request, pk=None):
        from .services import submit_worksheet_for_review
        ws = self.get_object()
        # Only the worksheet's own analyst (or lab_manager+) may submit it.
        if ws.analyst_id != request.user.id and request.user.role not in ("admin", "lab_manager"):
            return Response(
                {"detail": "Only the assigned analyst or a lab manager can submit this worksheet."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            submit_worksheet_for_review(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorksheetSerializer(ws).data)

    @action(detail=True, methods=["post"], permission_classes=[requires("verify_results", allow_read=False)])
    def verify(self, request, pk=None):
        from .services import verify_worksheet
        ws = self.get_object()
        try:
            verify_worksheet(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WorksheetSerializer(ws).data)

    @action(detail=True, methods=["post"], permission_classes=[requires("reject_results", allow_read=False)])
    def reject(self, request, pk=None):
        from .services import reject_worksheet
        ws = self.get_object()
        try:
            ws, new_ws = reject_worksheet(ws, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        data = WorksheetSerializer(ws).data
        data["new_worksheet"] = WorksheetSerializer(new_ws).data if new_ws else None
        return Response(data)


class WorksheetAssignmentViewSet(viewsets.ModelViewSet):
    queryset = WorksheetAssignment.objects.select_related("worksheet", "analysis_request").all()
    serializer_class = WorksheetAssignmentSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["worksheet", "senaite_service_uid"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("include_disposed") == "1":
            return qs
        return qs.exclude(analysis_request__sample__status="disposed")


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.select_related(
        "worksheet_assignment",
        "worksheet_assignment__analysis_request",
        "worksheet_assignment__analysis_request__sample",
        "submitted_by",
        "verified_by",
    ).all()
    serializer_class = ResultSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "is_out_of_range", "worksheet_assignment"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("include_disposed") == "1":
            return qs
        return qs.exclude(
            worksheet_assignment__analysis_request__sample__status="disposed"
        )

    def get_permissions(self):
        # Entering / editing a result is restricted to the roles in the matrix
        # (analyst, admin) — narrower than the class default. Reads stay open;
        # @action endpoints (submit/verify/reject) keep their own gates.
        if self.action in ("create", "update", "partial_update"):
            return [requires("edit_results")()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], permission_classes=[requires("enter_results", allow_read=False)])
    def submit(self, request, pk=None):
        from .services import submit_result
        result = self.get_object()
        try:
            submit_result(result, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResultSerializer(result).data)

    @action(detail=True, methods=["post"], permission_classes=[requires("verify_results", allow_read=False)])
    def verify(self, request, pk=None):
        from .services import verify_result
        result = self.get_object()
        try:
            verify_result(result, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResultSerializer(result).data)

    @action(detail=True, methods=["post"], permission_classes=[requires("reject_results", allow_read=False)])
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
    queryset = QCSample.objects.select_related("worksheet", "run_by").all()
    serializer_class = QCSampleSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["qc_type", "status", "senaite_service_uid", "worksheet"]
    search_fields = ["qc_id"]

    @action(detail=True, methods=["post"], permission_classes=[requires("verify_results", allow_read=False)])
    def review(self, request, pk=None):
        from django.db import transaction
        from django.utils import timezone
        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent

        review_notes = request.data.get("review_notes", "").strip()
        if not review_notes:
            return Response({"detail": "Review notes are required for signing off a failed QC sample."}, status=status.HTTP_400_BAD_REQUEST)

        action_type = request.data.get("action_type", "accept")

        # Row lock so two concurrent reviewers can't both pass the is_reviewed
        # check and double-sign (or schedule duplicate re-runs).
        with transaction.atomic():
            qc_sample = QCSample.objects.select_for_update().get(pk=self.get_object().pk)

            if qc_sample.status not in ["failed", "warning"]:
                return Response({"detail": "Only failed or warning QC samples require review."}, status=status.HTTP_400_BAD_REQUEST)
            if qc_sample.is_reviewed:
                return Response({"detail": "This QC sample has already been reviewed."}, status=status.HTTP_400_BAD_REQUEST)

            qc_sample.is_reviewed = True
            qc_sample.reviewed_by = request.user
            qc_sample.reviewed_at = timezone.now()
            qc_sample.review_notes = review_notes
            qc_sample.save(update_fields=["is_reviewed", "reviewed_by", "reviewed_at", "review_notes"])

            # QCSample is not in the auto-tracked signal list — QC sign-off is
            # compliance-sensitive, so log it manually.
            AuditEvent.objects.create(
                user=request.user,
                action="qc_review",
                content_type=ContentType.objects.get_for_model(qc_sample),
                object_id=qc_sample.pk,
                object_repr=f"QC {qc_sample.qc_id} ({qc_sample.status}) signed off",
                extra_data={"action_type": action_type, "review_notes": review_notes, "qc_status": qc_sample.status},
            )

        if action_type == "reanalyze":
            from .models import QCSample
            new_qc = QCSample.objects.create(
                qc_type=qc_sample.qc_type,
                senaite_service_uid=qc_sample.senaite_service_uid,
                senaite_service_name=qc_sample.senaite_service_name,
                worksheet=qc_sample.worksheet,
                lot_number=qc_sample.lot_number,
                expiry_date=qc_sample.expiry_date,
                target_value=qc_sample.target_value,
                tolerance_percent=qc_sample.tolerance_percent,
                notes=f"Re-analysis of failed QC run {qc_sample.qc_id}. Reason: {review_notes}",
                run_by=request.user
            )
            return Response({
                "detail": f"QC sample signed off. New QC run {new_qc.qc_id} scheduled.",
                "qc_sample": QCSampleSerializer(qc_sample, context={"request": request}).data,
                "new_qc_sample": QCSampleSerializer(new_qc, context={"request": request}).data
            })
            
        return Response(QCSampleSerializer(qc_sample, context={"request": request}).data)


class ChainOfCustodyViewSet(viewsets.ModelViewSet):
    queryset = ChainOfCustody.objects.select_related("sample", "transferred_by", "received_by").all()
    serializer_class = ChainOfCustodySerializer
    permission_classes = [ReadOnlyOrSampleHandler]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sample", "action"]

    def perform_create(self, serializer):
        # The person releasing custody is whoever is logged in and performing
        # this handoff — never a value the client should be trusted to set.
        instance = serializer.save(transferred_by=self.request.user)
        AuditEvent.objects.create(
            user=self.request.user,
            action="custody_transfer",
            content_type=ContentType.objects.get_for_model(Sample),
            object_id=instance.sample_id,
            object_repr=instance.sample.sample_id,
            extra_data={
                "action": instance.action, "from_location": instance.from_location,
                "to_location": instance.to_location, "purpose": instance.purpose,
                "condition": instance.condition, "seal_status": instance.seal_status,
                "received_by": instance.received_by_id,
            },
        )
