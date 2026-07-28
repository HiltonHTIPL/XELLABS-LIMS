"""
Celery tasks for inventory management.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_inventory_expiry(days_ahead=30):
    """
    Scan all Lots expiring within `days_ahead` days and create ExpiryAlert records
    if one does not already exist for today's alert window.
    """
    from .models import Lot, ExpiryAlert

    cutoff = timezone.now().date() + timezone.timedelta(days=days_ahead)
    lots = Lot.objects.filter(
        expiry_date__isnull=False,
        expiry_date__lte=cutoff,
    )

    created_count = 0
    for lot in lots:
        _, created = ExpiryAlert.objects.get_or_create(
            lot=lot,
            alert_date=lot.expiry_date,
        )
        if created:
            created_count += 1

    logger.info("check_inventory_expiry: %d new alerts created", created_count)
    return created_count


@shared_task
def check_sample_expiry(days_ahead=7):
    """
    Find samples expiring within `days_ahead` days and log a warning.
    Returns list of sample_ids that are at risk.
    """
    from lims.models import Sample

    now = timezone.now()
    cutoff = now + timezone.timedelta(days=days_ahead)
    at_risk = Sample.objects.filter(
        expiry_date__isnull=False,
        expiry_date__lte=cutoff,
        status__in=["registered", "received", "in_progress", "results_pending"],
    ).values_list("sample_id", flat=True)

    ids = list(at_risk)
    if ids:
        logger.warning("Samples expiring within %d days: %s", days_ahead, ids)
    return ids


@shared_task(bind=True, max_retries=6, default_retry_delay=30)
def sync_storage_location_to_senaite(self, location_id: int, schema_name: str):
    """Sync a single StorageLocation to SENAITE (as its mapped senaite.storage
    content type — see LOCATION_TYPE_TO_PORTAL_TYPE) and store the returned uid+path.

    StorageLocation is a tenant-app model — the Celery worker has no request
    context, so without schema_context() this runs against the 'public'
    schema (where the table doesn't exist) and silently fails every time.

    max_retries raised from 3 to 6: a deep node (e.g. a shelf under a fridge
    under a room) can now be blocked on its own parent's sync completing
    first, not just a single flat push — a chain a few levels deep needs a
    few more retry rounds to fully settle than the old flat-list sync did.
    """
    from django_tenants.utils import schema_context
    from inventory.models import StorageLocation
    from core.senaite_service import push_storage_location

    with schema_context(schema_name):
        try:
            location = StorageLocation.objects.get(id=location_id)
        except StorageLocation.DoesNotExist:
            logger.warning("sync_storage_location_to_senaite: location %s not found in schema %s", location_id, schema_name)
            return

        uid, path = push_storage_location(location)
        if uid and path:
            StorageLocation.objects.filter(id=location_id).update(senaite_uid=uid, senaite_path=path)
            logger.info("Updated senaite_uid/path for location %s -> %s (schema=%s)", location_id, path, schema_name)
        else:
            logger.warning("SENAITE sync returned no uid/path for location %s, retrying... (schema=%s)", location_id, schema_name)
            raise self.retry(exc=Exception(f"SENAITE sync returned no uid/path for location {location_id}"), countdown=30)


@shared_task(bind=True, max_retries=3, default_retry_delay=15)
def sync_sample_storage_transition(self, ar_uid: str, transition: str):
    """Fire the 'store'/'recover' workflow transition on a SENAITE AnalysisRequest
    to reflect a XelLabs slot assign/unassign as a real sample state change.
    No schema_context needed — this only talks to SENAITE, no Django DB access."""
    from core.senaite_service import set_sample_storage_transition

    result = set_sample_storage_transition(ar_uid, transition)
    if not result.get("ok"):
        logger.warning(
            "SENAITE '%s' transition failed for AR uid=%s: %s — retrying...",
            transition, ar_uid, result.get("error"),
        )
        raise self.retry(exc=Exception(result.get("error")), countdown=15)
    logger.info("SENAITE '%s' transition OK for AR uid=%s", transition, ar_uid)


@shared_task(bind=True, max_retries=3, default_retry_delay=15)
def sync_sample_storage_position(self, box_uid: str, slot_id: str, ar_uid: str, occupy: bool):
    """Write/clear the occupying sample's AR uid into the exact row/column entry
    of a storage box's own PositionsLayout, so SENAITE's own storage box view
    (not just the AR's workflow state, see sync_sample_storage_transition above)
    shows which slot holds which sample. No schema_context needed — this only
    talks to SENAITE, no Django DB access."""
    from core.senaite_service import set_storage_position

    result = set_storage_position(box_uid, slot_id, ar_uid, occupy)
    if not result.get("ok"):
        logger.warning(
            "SENAITE storage position sync failed for box=%s slot=%s occupy=%s: %s — retrying...",
            box_uid, slot_id, occupy, result.get("error"),
        )
        raise self.retry(exc=Exception(result.get("error")), countdown=15)
    logger.info("SENAITE storage position sync OK: box=%s slot=%s occupy=%s", box_uid, slot_id, occupy)
