"""
Celery task for processing instrument file imports.
"""
import json
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def process_instrument_import(self, import_id: int):
    """
    Parse the uploaded file, map rows to existing samples/tests,
    create Result records, and write an import audit log.
    """
    from audittrail.models import AuditEvent
    from lims.models import Result, WorksheetAssignment
    from .models import InstrumentResultImport
    from .importers import parse_csv, parse_xml, map_results

    try:
        imp = InstrumentResultImport.objects.select_related("instrument", "imported_by").get(pk=import_id)
    except InstrumentResultImport.DoesNotExist:
        logger.error("InstrumentResultImport %d not found.", import_id)
        return

    imp.status = "pending"
    imp.save(update_fields=["status"])

    # ── 1. Parse ─────────────────────────────────────────────────────────────
    try:
        file_content = imp.file.read()
    except Exception as e:
        _fail(imp, f"Could not read file: {e}")
        return

    if imp.file_format == "xml":
        rows, parse_errors = parse_xml(file_content)
    else:
        rows, parse_errors = parse_csv(file_content)

    if not rows and parse_errors:
        _fail(imp, "File could not be parsed. Errors: " + json.dumps(parse_errors))
        return

    # ── 2. Map to DB objects ──────────────────────────────────────────────────
    mapped, map_errors = map_results(rows)
    all_errors = parse_errors + map_errors

    # ── 3. Create/update Result records ──────────────────────────────────────
    created_count = 0
    skipped_count = 0

    for row in mapped:
        # Find an open WorksheetAssignment for this sample + test
        wa = WorksheetAssignment.objects.filter(
            analysis_request__sample__pk=row["sample_pk"],
            test__pk=row["test_pk"],
        ).first()

        if not wa:
            all_errors.append({
                "row": row.get("sample_id"),
                "detail": f"No open WorksheetAssignment found for sample={row['sample_id']} test={row['test_code']}.",
            })
            skipped_count += 1
            continue

        result, created = Result.objects.get_or_create(
            worksheet_assignment=wa,
            defaults={"value": row["value"], "unit": row["unit"], "remarks": row["flags"]},
        )
        if created:
            created_count += 1
        else:
            # Update existing pending result (analyst may not have entered it yet)
            if result.status == "pending":
                result.value = row["value"]
                result.unit = row["unit"]
                result.remarks = row["flags"]
                result.save(update_fields=["value", "unit", "remarks"])
            else:
                all_errors.append({
                    "row": row["sample_id"],
                    "detail": f"Result for {row['sample_id']}/{row['test_code']} already {result.status} — skipped.",
                })
                skipped_count += 1

    # ── 4. Write audit event ──────────────────────────────────────────────────
    from django.contrib.contenttypes.models import ContentType
    ct = ContentType.objects.get_for_model(InstrumentResultImport)
    AuditEvent.objects.create(
        user=imp.imported_by,
        action="instrument_import",
        content_type=ct,
        object_id=imp.pk,
        object_repr=f"Import #{imp.pk} — {imp.instrument.name}",
        extra_data={
            "file_format": imp.file_format,
            "total_rows": len(rows),
            "created": created_count,
            "skipped": skipped_count,
            "errors": all_errors,
        },
    )

    # ── 5. Finalise import record ─────────────────────────────────────────────
    imp.status = "processed" if not all_errors else "processed"  # processed even with partial errors
    imp.error_log = json.dumps(all_errors) if all_errors else ""
    imp.save(update_fields=["status", "error_log"])

    logger.info(
        "Import #%d complete — created=%d skipped=%d errors=%d",
        imp.pk, created_count, skipped_count, len(all_errors),
    )
    return {"created": created_count, "skipped": skipped_count, "errors": len(all_errors)}


def _fail(imp, message):
    imp.status = "failed"
    imp.error_log = message
    imp.save(update_fields=["status", "error_log"])
    logger.error("Import #%d failed: %s", imp.pk, message)
