import logging
from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.db.utils import DataError, IntegrityError, ProgrammingError
from django.template import TemplateDoesNotExist, TemplateSyntaxError
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

logger = logging.getLogger(__name__)

# Fonts don't change between reports — build the font configuration once per worker
# process instead of re-parsing font files on every single PDF render. Built lazily on
# first use (NOT at module import time) because Celery's prefork pool imports this module
# in the main process before forking workers — a FontConfiguration created pre-fork holds
# native (non-fork-safe) state that hangs the forked child on its first render.
_FONT_CONFIG = None


def _get_font_config():
    global _FONT_CONFIG
    if _FONT_CONFIG is None:
        _FONT_CONFIG = FontConfiguration()
    return _FONT_CONFIG

# These fail the exact same way on every retry (bad schema, broken template, bad data) —
# retrying just delays the "failed" status by ~90s for no benefit. Only genuinely transient
# errors (DB connection blips, etc.) are worth Celery's retry/backoff.
NON_RETRYABLE_EXCEPTIONS = (ProgrammingError, DataError, IntegrityError, TemplateSyntaxError, TemplateDoesNotExist)


@shared_task(bind=True, max_retries=3, queue="reports")
def generate_coa_pdf(self, report_id, schema_name="public"):
    from django_tenants.utils import schema_context
    from .models import Report
    from lims.models import Sample, QCSample, WorksheetAssignment, Specification
    from workflow.models import ElectronicSignature

    try:
        with schema_context(schema_name):
            report = Report.objects.select_related("sample", "generated_by").get(pk=report_id)
            sample = report.sample

            # Load active template — per-client override first, then global default
            from .models import ReportTemplate, DEFAULT_COA_FIELDS
            client_id = sample.client_id if sample else None
            tmpl = None
            if client_id:
                tmpl = ReportTemplate.objects.filter(
                    report_type=report.report_type, is_active=True, client_id=client_id
                ).order_by("-updated_at").first()
            if not tmpl:
                tmpl = ReportTemplate.objects.filter(
                    report_type=report.report_type, is_active=True, client__isnull=True
                ).order_by("-updated_at").first()
            template_fields = {f["key"]: f for f in (tmpl.fields if tmpl else DEFAULT_COA_FIELDS)}
            header_color = (tmpl.header_color if tmpl else None) or "#003366"
            logo_url = tmpl.get_logo_url() if tmpl else ""

            results = []
            qc_samples = []
            analyst_sig = None
            reviewer_sig = None

            if sample:
                assignments = WorksheetAssignment.objects.filter(
                    analysis_request__sample=sample
                ).select_related(
                    "test__method",
                    "analysis_request",
                    "worksheet__analyst",
                    "result__submitted_by",
                    "result__verified_by",
                )

                # Fetch every relevant spec in one query instead of one query per row (N+1).
                test_ids = assignments.values_list("test_id", flat=True)
                specs_by_test = {}
                for spec in Specification.objects.filter(
                    test_id__in=test_ids, sample_type=sample.sample_type, is_active=True
                ):
                    specs_by_test.setdefault(spec.test_id, spec)

                for wa in assignments:
                    result = getattr(wa, "result", None)
                    spec = specs_by_test.get(wa.test_id)

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

                worksheet_ids = assignments.values_list("worksheet_id", flat=True).distinct()
                qc_samples = list(
                    QCSample.objects.filter(worksheet_id__in=worksheet_ids)
                    .select_related("test")
                    .order_by("created_at")
                )

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

            def tf(key, fallback=""):
                f = template_fields.get(key, {})
                if not f.get("visible", True):
                    return None
                return f.get("value") or fallback

            # Django's template engine can't call tf("key", "fallback") with arguments inside
            # {{ }} — only Jinja2 supports that syntax. Precompute every field the template
            # needs into a plain dict so coa.html can use simple attribute lookup ({{ tf.key }}).
            tf_values = {f["key"]: tf(f["key"]) for f in DEFAULT_COA_FIELDS}

            html_content = render_to_string("reporting/coa.html", {
                "report": report,
                "sample": sample,
                "results": results,
                "qc_samples": qc_samples,
                "analyst_sig": analyst_sig,
                "reviewer_sig": reviewer_sig,
                "tf": tf_values,
                "header_color": header_color,
                "logo_url": logo_url,
            })

            pdf_bytes = HTML(string=html_content).write_pdf(font_config=_get_font_config())
            filename = f"COA_{report.report_id}.pdf"
            report.file.save(filename, ContentFile(pdf_bytes), save=False)
            report.status = "final"
            report.published_at = timezone.now()
            report.save(update_fields=["file", "status", "published_at"])

            logger.info("COA PDF generated for report %s", report.report_id)
            return {"status": "ok", "report_id": report.report_id, "file": report.file.name}

    except Exception as exc:
        logger.exception("COA generation failed for report_id=%s schema=%s", report_id, schema_name)
        non_retryable = isinstance(exc, NON_RETRYABLE_EXCEPTIONS)
        if non_retryable or self.request.retries >= self.max_retries:
            with schema_context(schema_name):
                Report.objects.filter(pk=report_id).exclude(status="final").update(status="failed")
            logger.error(
                "COA generation permanently failed for report_id=%s schema=%s (retryable=%s)",
                report_id, schema_name, not non_retryable,
            )
            return {"status": "failed", "report_id": report_id, "error": str(exc)}
        raise self.retry(exc=exc, countdown=30)
