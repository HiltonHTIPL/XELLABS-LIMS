import os
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Report
from .serializers import ReportSerializer
from .tasks import generate_coa_pdf


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.select_related("sample", "generated_by").all()
    serializer_class = ReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["report_type", "status", "sample"]
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

        task = generate_coa_pdf.delay(report.pk)
        return Response(
            {
                "detail": "COA generation started.",
                "task_id": task.id,
                "report_id": report.report_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Stream the generated COA PDF file to the client."""
        report = self.get_object()

        if not report.file:
            return Response(
                {"detail": "No PDF file available. Run /generate first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        file_path = report.file.path
        if not os.path.exists(file_path):
            raise Http404("PDF file not found on disk.")

        response = FileResponse(
            open(file_path, "rb"),
            content_type="application/pdf",
        )
        filename = os.path.basename(file_path)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
