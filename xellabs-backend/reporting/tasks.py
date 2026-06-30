import io
import logging
from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def generate_coa_pdf(self, report_id):
    from .models import Report
    from lims.models import Sample, Result, QCSample, WorksheetAssignment
    from workflow.models import ElectronicSignature

    try:
        report = Report.objects.select_related("sample", "generated_by").get(pk=report_id)
        sample = report.sample

        results = []
        qc_samples = []
        analyst_sig = None
        reviewer_sig = None

        if sample:
            # Gather results for every analysis request on this sample
            assignments = WorksheetAssignment.objects.filter(
                analysis_request__sample=sample
            ).select_related(
                "test__method",
                "analysis_request",
                "worksheet__analyst",
                "result__submitted_by",
                "result__verified_by",
            )

            for wa in assignments:
                result = getattr(wa, "result", None)
                spec = wa.test.specifications.filter(
                    sample_type=sample.sample_type, is_active=True
                ).first()

                spec_str = ""
                if spec:
                    parts = []
                    if spec.min_value is not None:
                        parts.append(f"{spec.min_operator} {spec.min_value}")
                    if spec.max_value is not None:
                        parts.append(f"{spec.max_operator} {spec.max_value}")
                    spec_str = "  ".join(parts)

                results.append({
                    "test_name": wa.test.name,
                    "method_name": wa.test.method.name if wa.test.method else "",
                    "value": result.value if result else "",
                    "unit": result.unit if result else wa.test.unit,
                    "spec": spec_str,
                    "status": result.status if result else "pending",
                    "is_out_of_range": result.is_out_of_range if result else False,
                    "analyst": (
                        wa.worksheet.analyst.get_full_name() or wa.worksheet.analyst.username
                        if wa.worksheet else ""
                    ),
                    "verified_by": (
                        result.verified_by.get_full_name() or result.verified_by.username
                        if result and result.verified_by else ""
                    ),
                })

            # QC samples linked to any worksheet that touches this sample's ARs
            worksheet_ids = assignments.values_list("worksheet_id", flat=True).distinct()
            qc_samples = list(
                QCSample.objects.filter(worksheet_id__in=worksheet_ids)
                .select_related("test")
                .order_by("created_at")
            )

            # Electronic signatures
            sample_ct = ContentType.objects.get_for_model(sample)
            sigs = ElectronicSignature.objects.filter(
                content_type=sample_ct, object_id=sample.pk
            ).select_related("signed_by").order_by("signed_at")

            analyst_roles = ("analyst",)
            reviewer_roles = ("reviewer", "lab_manager", "admin")
            for sig in sigs:
                role = getattr(sig.signed_by, "role", "")
                if role in analyst_roles and analyst_sig is None:
                    analyst_sig = sig
                elif role in reviewer_roles and reviewer_sig is None:
                    reviewer_sig = sig

        html_content = render_to_string("reporting/coa.html", {
            "report": report,
            "sample": sample,
            "results": results,
            "qc_samples": qc_samples,
            "analyst_sig": analyst_sig,
            "reviewer_sig": reviewer_sig,
        })

        pdf_bytes = HTML(string=html_content).write_pdf()
        filename = f"COA_{report.report_id}.pdf"
        report.file.save(filename, ContentFile(pdf_bytes), save=False)
        report.status = "final"
        report.published_at = timezone.now()
        report.save(update_fields=["file", "status", "published_at"])

        logger.info("COA PDF generated for report %s", report.report_id)
        return {"status": "ok", "report_id": report.report_id, "file": report.file.name}

    except Exception as exc:
        logger.exception("COA generation failed for report_id=%s", report_id)
        raise self.retry(exc=exc, countdown=30)
