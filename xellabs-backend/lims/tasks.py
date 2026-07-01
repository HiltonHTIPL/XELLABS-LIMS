"""
Celery tasks for LIMS — SENAITE pull sync.
"""
import logging
from celery import shared_task
from django.contrib.auth import get_user_model

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
