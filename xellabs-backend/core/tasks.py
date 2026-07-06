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


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def sync_test_to_senaite(self, test_id: int, schema_name: str):
    """Push a Test (with schema_context) as a SENAITE Analysis Service and store its UID."""
    from django_tenants.utils import schema_context
    from lims.models import Test
    from core.senaite_service import push_test

    with schema_context(schema_name):
        try:
            test = Test.objects.get(pk=test_id)
        except Test.DoesNotExist:
            logger.warning("sync_test_to_senaite: Test %s not found in schema %s.", test_id, schema_name)
            return

        uid = push_test(test)
        if uid:
            Test.objects.filter(pk=test_id).update(senaite_uid=uid)
            logger.info("Test %s senaite_uid saved: %s", test_id, uid)
        else:
            logger.error("Test %s SENAITE sync failed — will retry.", test_id)
            raise self.retry()


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def sync_sample_type_to_senaite(self, sample_type_id: int, schema_name: str):
    """Push a SampleType (with schema_context) to SENAITE and store its UID."""
    from django_tenants.utils import schema_context
    from lims.models import SampleType
    from core.senaite_service import push_sample_type

    with schema_context(schema_name):
        try:
            sample_type = SampleType.objects.get(pk=sample_type_id)
        except SampleType.DoesNotExist:
            logger.warning("sync_sample_type_to_senaite: SampleType %s not found in schema %s.", sample_type_id, schema_name)
            return

        uid = push_sample_type(sample_type)
        if uid:
            SampleType.objects.filter(pk=sample_type_id).update(senaite_uid=uid)
            logger.info("SampleType %s senaite_uid saved: %s", sample_type_id, uid)
        else:
            logger.error("SampleType %s SENAITE sync failed — will retry.", sample_type_id)
            raise self.retry()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_analysis_request_to_senaite(self, ar_id: int, schema_name: str):
    """Push an AnalysisRequest (with its Sample) to SENAITE."""
    from django_tenants.utils import schema_context
    from lims.models import AnalysisRequest
    from core.senaite_service import push_analysis_request

    # AnalysisRequest/Sample are tenant-app models — the Celery worker has no
    # tenant context of its own, so without this the query silently runs
    # against the 'public' schema instead of the tenant that created the AR.
    with schema_context(schema_name):
        try:
            ar = AnalysisRequest.objects.select_related(
                "sample", "sample__client", "sample__sample_type"
            ).prefetch_related("tests").get(pk=ar_id)
        except AnalysisRequest.DoesNotExist:
            logger.warning("sync_analysis_request_to_senaite: AR %s not found in schema %s.", ar_id, schema_name)
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
            ar.senaite_uid = uid
            ar.save(update_fields=["senaite_uid"])
            logger.info("AR %s synced to SENAITE: uid=%s", ar_id, uid)
        else:
            logger.error("AR %s SENAITE sync failed — will retry.", ar_id)
            raise self.retry()
