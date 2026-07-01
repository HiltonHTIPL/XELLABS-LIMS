"""
Django signals to trigger SENAITE sync automatically.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _register_client_signal():
    from core.models import Client
    from core.tasks import sync_client_to_senaite

    @receiver(post_save, sender=Client, dispatch_uid="senaite_sync_client")
    def on_client_saved(sender, instance, created, **kwargs):
        # Skip if already queued within this save (avoid double-fire)
        sync_client_to_senaite.apply_async(args=[instance.pk], countdown=2)
        logger.debug("Queued SENAITE sync for client pk=%s", instance.pk)


def _register_ar_signal():
    from lims.models import AnalysisRequest
    from core.tasks import sync_analysis_request_to_senaite

    @receiver(post_save, sender=AnalysisRequest, dispatch_uid="senaite_sync_ar")
    def on_ar_saved(sender, instance, created, **kwargs):
        if created:
            sync_analysis_request_to_senaite.apply_async(args=[instance.pk], countdown=5)
            logger.debug("Queued SENAITE AR sync for AR pk=%s", instance.pk)


def register_all():
    _register_client_signal()
    _register_ar_signal()
