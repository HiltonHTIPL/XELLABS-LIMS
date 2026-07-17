"""
Instrument file import processing.

`apply_import` runs the full parse -> map -> create -> submit -> audit pipeline
synchronously and returns a summary. Both the Celery task (background path)
and the "commit" API action (interactive path used by the import UX) call it,
so the two paths never drift.

Imported Results land as `submitted` (reviewable) — same path as manual entry
after submit. Already verified/submitted/rejected Results are skipped, never overwritten.
"""
import json
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


def apply_import(imp) -> dict:
    """
    Parse the uploaded file (parser selected via instrument.import_data_interface),
    map rows to existing samples/tests, create/refresh pending Results, submit them
    into the review workflow, and write an audit event.

    Returns {created, updated, skipped, errors, sample_ids, status}.
    """
    from django.db import transaction
    from django.contrib.contenttypes.models import ContentType
    from audittrail.models import AuditEvent
    from lims.models import Result, WorksheetAssignment
    from lims.services import submit_result
    from .models import InstrumentResultImport
    from .importers import parse_instrument_file, map_results

    imp.status = "pending"
    imp.save(update_fields=["status"])

    try:
        file_content = imp.file.read()
    except Exception as e:
        _fail(imp, f"Could not read file: {e}")
        return {"created": 0, "updated": 0, "skipped": 0, "errors": 1, "sample_ids": [], "status": "failed"}

    interface = getattr(imp.instrument, "import_data_interface", "") or ""
    try:
        rows, parse_errors = parse_instrument_file(
            file_content,
            file_format=imp.file_format or "csv",
            interface_code=interface,
        )
    except Exception as e:
        # parse_csv/parse_xml raise on a genuinely malformed file (e.g. a
        # binary file uploaded under the wrong File Format, confirmed live —
        # csv.DictReader chokes on raw XLSX bytes decoded as text) — without
        # this, the exception was unhandled and left the import stuck at
        # "pending" forever with no error shown to the user.
        _fail(imp, f"File could not be parsed — check the File Format matches the actual file: {e}")
        return {"created": 0, "updated": 0, "skipped": 0, "errors": 1, "sample_ids": [], "status": "failed"}

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
                    continue

                # Enter the same review path as manual entry: pending → submitted.
                if result.status == "pending" and result.value:
                    try:
                        submit_result(result, imp.imported_by)
                    except ValueError as e:
                        all_errors.append({
                            "row": row["sample_id"],
                            "detail": f"Imported but could not submit for review: {e}",
                        })
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
            "import_interface": interface,
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
def process_instrument_import(self, import_id: int, schema_name: str):
    """Celery entrypoint: resolve the import row and delegate to apply_import.

    InstrumentResultImport is a tenant-app model — the Celery worker has no
    request context of its own, so without schema_context() this silently runs
    against the 'public' schema (where the table doesn't exist) and crashes
    with psycopg.errors.UndefinedTable on every single call, confirmed live.
    Same gap already documented/fixed for sync_storage_location_to_senaite —
    schema_name must be captured by the caller (which does have request
    context) and passed through explicitly."""
    from django_tenants.utils import schema_context
    from .models import InstrumentResultImport

    with schema_context(schema_name):
        try:
            imp = InstrumentResultImport.objects.select_related("instrument", "imported_by").get(pk=import_id)
        except InstrumentResultImport.DoesNotExist:
            logger.error("InstrumentResultImport %d not found in schema %s.", import_id, schema_name)
            return
        return apply_import(imp)


def _fail(imp, message):
    imp.status = "failed"
    imp.error_log = message
    imp.save(update_fields=["status", "error_log"])
    logger.error("Import #%d failed: %s", imp.pk, message)
