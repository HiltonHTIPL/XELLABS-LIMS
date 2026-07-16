"""
Instrument file import processing.

`apply_import` runs the full parse -> map -> create -> audit pipeline
synchronously and returns a summary. Both the Celery task (background path)
and the "commit" API action (interactive path used by the import UX) call it,
so the two paths never drift.
"""
import json
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


def apply_import(imp) -> dict:
    """
    Parse the uploaded file, map rows to existing samples/tests, create or refresh
    Result records, and write an audit event. Returns a summary dict:
    {created, updated, skipped, errors, sample_ids, status}.
    """
    from django.db import transaction
    from django.contrib.contenttypes.models import ContentType
    from audittrail.models import AuditEvent
    from lims.models import Result, WorksheetAssignment
    from .models import InstrumentResultImport
    from .importers import parse_csv, parse_xml, map_results

    imp.status = "pending"
    imp.save(update_fields=["status"])

    try:
        file_content = imp.file.read()
    except Exception as e:
        _fail(imp, f"Could not read file: {e}")
        return {"created": 0, "updated": 0, "skipped": 0, "errors": 1, "sample_ids": [], "status": "failed"}

    if imp.file_format == "xml":
        rows, parse_errors = parse_xml(file_content)
    else:
        rows, parse_errors = parse_csv(file_content)

    if not rows and parse_errors:
        _fail(imp, "File could not be parsed. Errors: " + json.dumps(parse_errors))
        return {"created": 0, "updated": 0, "skipped": 0, "errors": len(parse_errors),
                "sample_ids": [], "status": "failed"}

    mapped, map_errors = map_results(rows)
    all_errors = parse_errors + map_errors
    created_count = 0
    updated_count = 0
    skipped_count = 0
    affected: set[str] = set()

    try:
        for row in mapped:
            with transaction.atomic():
                wa = WorksheetAssignment.objects.select_for_update().filter(
                    analysis_request__sample__pk=row["sample_pk"],
                    senaite_service_uid=row["senaite_service_uid"],
                ).first()

                if not wa:
                    all_errors.append({
                        "row": row.get("sample_id"),
                        "detail": f"No open worksheet assignment for sample={row['sample_id']} test={row['test_code']}.",
                    })
                    skipped_count += 1
                    continue

                result, created = Result.objects.get_or_create(
                    worksheet_assignment=wa,
                    defaults={"value": row["value"], "unit": row["unit"], "remarks": row["flags"]},
                )
                if created:
                    created_count += 1
                    affected.add(row["sample_id"])
                elif result.status == "pending":
                    result.value = row["value"]
                    result.unit = row["unit"]
                    result.remarks = row["flags"]
                    result.save(update_fields=["value", "unit", "remarks"])
                    updated_count += 1
                    affected.add(row["sample_id"])
                else:
                    all_errors.append({
                        "row": row["sample_id"],
                        "detail": f"Result for {row['sample_id']}/{row['test_code']} already {result.status}, skipped.",
                    })
                    skipped_count += 1
    except Exception as e:
        logger.exception("Import #%d crashed during create.", imp.pk)
        _fail(imp, f"Import failed unexpectedly: {e}")
        return {"created": created_count, "updated": updated_count, "skipped": skipped_count,
                "errors": len(all_errors) + 1, "sample_ids": sorted(affected), "status": "failed"}

    ct = ContentType.objects.get_for_model(InstrumentResultImport)
    AuditEvent.objects.create(
        user=imp.imported_by,
        action="instrument_import",
        content_type=ct,
        object_id=imp.pk,
        object_repr=f"Import #{imp.pk} - {imp.instrument.name}",
        extra_data={
            "file_format": imp.file_format,
            "total_rows": len(rows),
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": all_errors,
        },
    )

    applied = created_count + updated_count
    # "failed" only when nothing at all was applied; partial success still counts
    # as "processed" so the error log (recorded either way) can be reviewed.
    imp.status = "failed" if (mapped and applied == 0) else "processed"
    imp.error_log = json.dumps(all_errors) if all_errors else ""
    imp.save(update_fields=["status", "error_log"])

    logger.info("Import #%d complete: created=%d updated=%d skipped=%d errors=%d",
                imp.pk, created_count, updated_count, skipped_count, len(all_errors))
    return {
        "created": created_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "errors": len(all_errors),
        "sample_ids": sorted(affected),
        "status": imp.status,
    }


@shared_task(bind=True, max_retries=0)
def process_instrument_import(self, import_id: int):
    """Celery entrypoint: resolve the import row and delegate to apply_import."""
    from .models import InstrumentResultImport
    try:
        imp = InstrumentResultImport.objects.select_related("instrument", "imported_by").get(pk=import_id)
    except InstrumentResultImport.DoesNotExist:
        logger.error("InstrumentResultImport %d not found.", import_id)
        return
    return apply_import(imp)


def _fail(imp, message):
    imp.status = "failed"
    imp.error_log = message
    imp.save(update_fields=["status", "error_log"])
    logger.error("Import #%d failed: %s", imp.pk, message)
