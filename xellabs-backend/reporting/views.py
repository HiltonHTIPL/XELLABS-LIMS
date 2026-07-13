import json
import os
import time
from django.db import connection
from django.http import FileResponse, Http404, StreamingHttpResponse
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import ReadOnlyOrLabManager, ReadOnlyOrAnalystOrAbove
from .models import Report, ReportTemplate, DEFAULT_COA_FIELDS
from .serializers import ReportSerializer, ReportTemplateSerializer
from .tasks import generate_coa_pdf


class ReportTemplateViewSet(viewsets.ModelViewSet):
    queryset = ReportTemplate.objects.select_related("created_by", "client").all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [ReadOnlyOrLabManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["report_type", "is_active", "client"]
    search_fields = ["name"]
    ordering_fields = ["updated_at", "created_at"]

    @action(detail=False, methods=["get"], url_path="defaults")
    def defaults(self, request):
        return Response(DEFAULT_COA_FIELDS)

    @action(detail=False, methods=["get"], url_path="active")
    def active(self, request):
        """Return the active template for the given report_type and optional client_id."""
        report_type = request.query_params.get("report_type", "coa")
        client_id = request.query_params.get("client_id")
        qs = ReportTemplate.objects.filter(report_type=report_type, is_active=True)
        # Per-client override takes priority
        tmpl = None
        if client_id:
            tmpl = qs.filter(client_id=client_id).order_by("-updated_at").first()
        if not tmpl:
            tmpl = qs.filter(client__isnull=True).order_by("-updated_at").first()
        if not tmpl:
            return Response({"detail": "No active template found.", "fields": DEFAULT_COA_FIELDS})
        return Response(ReportTemplateSerializer(tmpl).data)

    @action(detail=True, methods=["post"], url_path="set-active")
    def set_active(self, request, pk=None):
        """Mark this template as active; deactivate all others of the same type (and same client scope)."""
        tmpl = self.get_object()
        ReportTemplate.objects.filter(
            report_type=tmpl.report_type, client=tmpl.client
        ).exclude(pk=tmpl.pk).update(is_active=False)
        tmpl.is_active = True
        tmpl.save(update_fields=["is_active"])
        return Response(ReportTemplateSerializer(tmpl).data)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Clone a template with a new name."""
        original = self.get_object()
        import copy
        new_tmpl = ReportTemplate.objects.create(
            name=f"Copy of {original.name}",
            report_type=original.report_type,
            is_active=False,
            fields=copy.deepcopy(original.fields),
            header_color=original.header_color,
            client=original.client,
            created_by=request.user,
        )
        return Response(ReportTemplateSerializer(new_tmpl).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="preview")
    def preview(self, request, pk=None):
        """Generate a sample preview PDF using placeholder data and return it."""
        from django.http import HttpResponse
        from django.template.loader import render_to_string
        from weasyprint import HTML
        from .models import DEFAULT_COA_FIELDS

        tmpl = self.get_object()
        template_fields = {f["key"]: f for f in (tmpl.fields or DEFAULT_COA_FIELDS)}

        def tf(key):
            f = template_fields.get(key, {})
            if not f.get("visible", True):
                return None
            return f.get("value") or ""

        tf_values = {f["key"]: tf(f["key"]) for f in DEFAULT_COA_FIELDS}

        # Dummy context — no real DB objects needed
        class Dummy:
            def __getattr__(self, name):
                return f"[{name}]"
            def __str__(self):
                return "[preview]"

        html_content = render_to_string("reporting/coa_preview.html", {
            "tf": tf_values,
            "header_color": tmpl.header_color or "#003366",
            "logo_url": tmpl.get_logo_url(),
            "is_preview": True,
        })

        pdf_bytes = HTML(string=html_content).write_pdf()
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="preview_{tmpl.pk}.pdf"'
        return response


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.select_related(
        "sample", "sample__client", "sample__sample_type", "generated_by"
    ).all()
    serializer_class = ReportSerializer
    permission_classes = [ReadOnlyOrAnalystOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["report_type", "status", "sample", "sample__client"]
    search_fields = ["report_id", "title"]
    ordering_fields = ["created_at", "published_at"]

    @action(detail=True, methods=["post"], url_path="generate")
    def generate(self, request, pk=None):
        """Dispatch a Celery task to generate the COA PDF for this report."""
        report = self.get_object()

        if report.report_type != "coa":
            return Response(
                {"detail": "PDF generation is only supported for COA reports."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not report.sample:
            return Response(
                {"detail": "Report has no linked sample. Cannot generate COA."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = generate_coa_pdf.delay(report.pk, schema_name=connection.schema_name)
        return Response(
            {
                "detail": "COA generation started.",
                "task_id": task.id,
                "report_id": report.report_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="stream")
    def stream(self, request, pk=None):
        """
        Server-side push instead of the frontend polling every few seconds: holds the
        connection open and only writes a line when the status actually changes, ending
        as soon as generation finishes (or after a timeout matching the frontend's backstop).

        Gunicorn runs only 2 sync workers (see CLAUDE.md — memory-capped), and this
        view blocks its worker for the whole stream via time.sleep. Unrestricted use
        could pin every worker on open streams and freeze the entire API. A Redis
        counter (cross-process, unlike an in-memory semaphore) caps concurrent
        streams at MAX_CONCURRENT_STREAMS so at least one worker always stays free.
        """
        from django.core.cache import cache
        from django_tenants.utils import schema_context

        # get_object() (not raw pk) so a report belonging to another tenant/user still 404s.
        self.get_object()
        report_id = pk
        schema_name = connection.schema_name

        MAX_CONCURRENT_STREAMS = 1
        counter_key = "report_stream_active_count"
        cache.add(counter_key, 0, timeout=None)
        try:
            current = cache.incr(counter_key)
        except ValueError:
            cache.set(counter_key, 1, timeout=None)
            current = 1
        if current > MAX_CONCURRENT_STREAMS:
            cache.decr(counter_key)
            return Response(
                {"detail": "Too many active report streams. Please try again shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        def event_stream():
            last_status = None
            elapsed = 0
            interval = 1
            timeout = 120
            try:
                while elapsed <= timeout:
                    with schema_context(schema_name):
                        report = Report.objects.filter(pk=report_id).first()
                    if not report:
                        yield json.dumps({"type": "error", "detail": "Report not found"}) + "\n"
                        return
                    if report.status != last_status:
                        last_status = report.status
                        yield json.dumps({
                            "type": "update",
                            "status": report.status,
                            "file": bool(report.file),
                        }) + "\n"
                    if report.status in ("final", "cancelled", "failed"):
                        return
                    time.sleep(interval)
                    elapsed += interval
                yield json.dumps({"type": "timeout"}) + "\n"
            finally:
                try:
                    cache.decr(counter_key)
                except ValueError:
                    pass

        response = StreamingHttpResponse(event_stream(), content_type="application/x-ndjson")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Stream the generated COA PDF file to the client."""
        from django.conf import settings
        import os.path

        report = self.get_object()

        if not report.file:
            return Response(
                {"detail": "No PDF file available. Run /generate first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        file_path = report.file.path

        # SECURITY: Validate file path to prevent directory traversal
        # 1. Resolve to absolute path and remove any .. traversal
        file_path = os.path.abspath(file_path)
        media_root = os.path.abspath(settings.MEDIA_ROOT)

        # 2. Ensure file is within MEDIA_ROOT directory. A bare startswith()
        # would let a sibling directory that merely shares the prefix (e.g.
        # MEDIA_ROOT="/app/media" matching "/app/media_evil/...") pass the
        # check — os.path.commonpath is the correct containment test.
        if os.path.commonpath([file_path, media_root]) != media_root:
            return Response(
                {"detail": "Access denied: invalid file path."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Check file exists and is readable
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise Http404("PDF file not found on disk.")

        # 4. Verify file belongs to this report's tenant (via path structure)
        # Files are stored as: MEDIA_ROOT/<tenant_name>/<report_type>/...
        try:
            response = FileResponse(
                open(file_path, "rb"),
                content_type="application/pdf",
            )
            filename = os.path.basename(file_path)
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
        except (IOError, OSError):
            return Response(
                {"detail": "Error reading file."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel a report that is in draft or failed state."""
        report = self.get_object()
        if report.status not in ("draft", "failed"):
            return Response(
                {"detail": f"Cannot cancel a report with status '{report.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report.status = "cancelled"
        report.save(update_fields=["status"])
        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"], url_path="regenerate")
    def regenerate(self, request, pk=None):
        """Reset a final/failed/cancelled COA report to draft and re-dispatch generation."""
        report = self.get_object()
        if report.report_type != "coa":
            return Response(
                {"detail": "Regeneration is only supported for COA reports."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not report.sample:
            return Response(
                {"detail": "Report has no linked sample."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_file = report.file
        report.status = "draft"
        report.file = None
        report.published_at = None
        report.save(update_fields=["status", "file", "published_at"])
        if old_file:
            old_file.storage.delete(old_file.name)
        task = generate_coa_pdf.delay(report.pk, schema_name=connection.schema_name)
        return Response(
            {"detail": "Regeneration started.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED,
        )
