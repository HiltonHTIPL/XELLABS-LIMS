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
def deactivate_client_in_senaite(self, client_id: int):
    """Push a Client's deactivation to SENAITE (workflow transition, not a field update)."""
    from core.models import Client
    from core.senaite_service import delete_object

    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        logger.warning("deactivate_client_in_senaite: Client %s not found.", client_id)
        return

    if not client.senaite_uid:
        logger.warning("deactivate_client_in_senaite: Client %s has no senaite_uid — nothing to deactivate.", client_id)
        return

    result = delete_object(client.senaite_uid)
    if result["ok"]:
        logger.info("Client %s deactivated in SENAITE (uid=%s).", client_id, client.senaite_uid)
    else:
        logger.error("Client %s SENAITE deactivation failed: %s — will retry.", client_id, result.get("error"))
        raise self.retry()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def activate_client_in_senaite(self, client_id: int):
    """Push a Client's reactivation to SENAITE (workflow transition, not a field update)."""
    from core.models import Client
    from core.senaite_service import activate_object

    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        logger.warning("activate_client_in_senaite: Client %s not found.", client_id)
        return

    if not client.senaite_uid:
        logger.warning("activate_client_in_senaite: Client %s has no senaite_uid — nothing to activate.", client_id)
        return

    result = activate_object(client.senaite_uid)
    if result["ok"]:
        logger.info("Client %s reactivated in SENAITE (uid=%s).", client_id, client.senaite_uid)
    else:
        logger.error("Client %s SENAITE reactivation failed: %s — will retry.", client_id, result.get("error"))
        raise self.retry()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_staff_user_to_senaite(self, user_id: int, temp_password: str):
    """Create a matching SENAITE member + group membership for a newly-created staff user.
    temp_password is only ever available in-memory at creation time (Django stores it
    hashed) — passed through as a task arg so this can retry without losing it."""
    from core.models import User
    from core.senaite_service import push_staff_user

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning("sync_staff_user_to_senaite: User %s not found.", user_id)
        return

    result = push_staff_user(user, temp_password)
    if result["ok"]:
        logger.info("Staff user '%s' synced to SENAITE.", user.username)
    else:
        logger.error("Staff user '%s' SENAITE sync failed: %s — will retry.", user.username, result.get("error"))
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
