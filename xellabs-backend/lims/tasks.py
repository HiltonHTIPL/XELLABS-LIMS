"""
Celery tasks for LIMS — SENAITE pull sync and dispose dispatch.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="lims.tasks.sync_from_senaite")
def sync_from_senaite(self):
    """
    Pull sample status and results from SENAITE into Django for ALL tenant schemas.
    Runs every 5 minutes via Celery Beat.
    """
    from django_tenants.utils import schema_context
    from core.models import Tenant

    total = {"synced": 0, "skipped": 0, "errors": 0}

    try:
        # Run sync for every non-public tenant schema
        for tenant in Tenant.objects.exclude(schema_name="public"):
            with schema_context(tenant.schema_name):
                from lims.senaite_sync import pull_samples_and_results
                result = pull_samples_and_results()
                logger.info("sync_from_senaite[%s]: %s", tenant.schema_name, result)
                for k in total:
                    total[k] += result.get(k, 0)

        return total
    except Exception as exc:
        logger.exception("sync_from_senaite failed: %s", exc)
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="lims.tasks.dispatch_sample_to_lab",
)
def dispatch_sample_to_lab(self, schema_name: str, sample_id: int, comment: str):
    """
    Push dispose to the lab system of record: SENAITE dispatch → dispatched.
    Runs inside tenant schema_context; updates sample.senaite_sync_status.
    """
    from django_tenants.utils import schema_context

    from core.senaite_service import dispatch_sample
    from lims.models import Sample

    with schema_context(schema_name):
        try:
            sample = Sample.objects.get(pk=sample_id)
        except Sample.DoesNotExist:
            logger.warning(
                "dispatch_sample_to_lab: sample %s not found in schema %s",
                sample_id,
                schema_name,
            )
            return {"ok": False, "error": "sample not found"}

        if sample.status != "disposed":
            logger.warning(
                "dispatch_sample_to_lab: sample %s is not disposed (status=%s)",
                sample.sample_id,
                sample.status,
            )
            return {"ok": False, "error": "sample not disposed"}

        uid = (sample.senaite_uid or "").strip()
        if not uid:
            sample.senaite_sync_status = "not_linked"
            sample.senaite_sync_error = ""
            sample.save(update_fields=["senaite_sync_status", "senaite_sync_error"])
            return {"ok": False, "error": "not linked"}

        result = dispatch_sample(uid, comment)
        if result.get("ok"):
            sample.senaite_sync_status = "synced"
            sample.senaite_sync_error = ""
            sample.save(update_fields=["senaite_sync_status", "senaite_sync_error"])
            logger.info(
                "dispatch_sample_to_lab OK: %s → dispatched (schema=%s)",
                sample.sample_id,
                schema_name,
            )
            return {"ok": True}

        err = (result.get("error") or "Lab system dispatch failed.")[:500]
        sample.senaite_sync_status = "failed"
        sample.senaite_sync_error = err
        sample.save(update_fields=["senaite_sync_status", "senaite_sync_error"])
        logger.warning(
            "dispatch_sample_to_lab failed for %s (schema=%s): %s",
            sample.sample_id,
            schema_name,
            err,
        )
        raise self.retry(exc=Exception(err))
