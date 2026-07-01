"""
Celery tasks for SENAITE sync.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_client_to_senaite(self, client_id: int):
    """Push a Client record to SENAITE and store the returned UID."""
    from core.models import Client
    from core.senaite_service import push_client

    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        logger.warning("sync_client_to_senaite: Client %s not found.", client_id)
        return

    uid = push_client(client)
    if uid:
        Client.objects.filter(pk=client_id).update(senaite_uid=uid)
        logger.info("Client %s senaite_uid saved: %s", client_id, uid)
    else:
        logger.error("Client %s SENAITE sync failed — will retry.", client_id)
        raise self.retry()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_analysis_request_to_senaite(self, ar_id: int):
    """Push an AnalysisRequest (with its Sample) to SENAITE."""
    from lims.models import AnalysisRequest
    from core.senaite_service import push_analysis_request

    try:
        ar = AnalysisRequest.objects.select_related(
            "sample", "sample__client", "sample__sample_type"
        ).prefetch_related("tests").get(pk=ar_id)
    except AnalysisRequest.DoesNotExist:
        logger.warning("sync_analysis_request_to_senaite: AR %s not found.", ar_id)
        return

    # Ensure client is synced first
    client = ar.sample.client
    if not client.senaite_uid:
        from core.tasks import sync_client_to_senaite
        sync_client_to_senaite.apply_async(args=[client.pk], countdown=5)
        # Retry this task after client has had time to sync
        raise self.retry(countdown=30)

    uid = push_analysis_request(ar)
    if uid:
        logger.info("AR %s synced to SENAITE: uid=%s", ar_id, uid)
    else:
        logger.error("AR %s SENAITE sync failed — will retry.", ar_id)
        raise self.retry()
