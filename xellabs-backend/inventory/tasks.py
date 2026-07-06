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


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def sync_storage_location_to_senaite(self, location_id: int):
    """Sync a single StorageLocation to SENAITE and store the returned UID."""
    from inventory.models import StorageLocation
    from core.senaite_service import push_storage_location

    try:
        location = StorageLocation.objects.get(id=location_id)
    except StorageLocation.DoesNotExist:
        logger.warning("sync_storage_location_to_senaite: location %s not found", location_id)
        return

    uid = push_storage_location(location)
    if uid:
        StorageLocation.objects.filter(id=location_id).update(senaite_uid=uid)
        logger.info("Updated senaite_uid for location %s -> %s", location_id, uid)
    else:
        logger.warning("SENAITE sync returned no UID for location %s, retrying...", location_id)
        raise self.retry(exc=Exception(f"SENAITE sync returned no UID for location {location_id}"), countdown=30)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def sync_box_slots_to_senaite(self, box_id: int):
    """Sync all slot children of a box to SENAITE."""
    from inventory.models import StorageLocation
    from core.senaite_service import push_storage_location

    slots = StorageLocation.objects.filter(parent_id=box_id, location_type='box_location')
    for slot in slots:
        uid = push_storage_location(slot)
        if uid:
            StorageLocation.objects.filter(id=slot.id).update(senaite_uid=uid)
    logger.info("Synced %d slots for box %s to SENAITE", slots.count(), box_id)
