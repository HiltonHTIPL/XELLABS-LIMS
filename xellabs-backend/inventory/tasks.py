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
