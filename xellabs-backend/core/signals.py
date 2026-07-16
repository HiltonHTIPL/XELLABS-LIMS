"""
Django signals to trigger SENAITE sync automatically.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _register_client_signal():
    from core.models import Client
    from core.tasks import sync_client_to_senaite, deactivate_client_in_senaite, activate_client_in_senaite

    @receiver(post_save, sender=Client, dispatch_uid="senaite_sync_client")
    def on_client_saved(sender, instance, created, **kwargs):
        # Activate/deactivate are workflow transitions, not field updates — pushed
        # via their own tasks instead of sync_client_to_senaite (which only PATCHes
        # fields and never changes review_state). Only meaningful once a client
        # already exists in SENAITE (has a senaite_uid); a brand-new client is
        # created active by default, so there's nothing to transition yet.
        if instance.senaite_uid:
            if not instance.is_active:
                deactivate_client_in_senaite.apply_async(args=[instance.pk], countdown=2)
                logger.debug("Queued SENAITE deactivation for client pk=%s", instance.pk)
                return
            else:
                activate_client_in_senaite.apply_async(args=[instance.pk], countdown=2)
                logger.debug("Queued SENAITE reactivation for client pk=%s", instance.pk)

        # Skip if already queued within this save (avoid double-fire)
        sync_client_to_senaite.apply_async(args=[instance.pk], countdown=2)
        logger.debug("Queued SENAITE sync for client pk=%s", instance.pk)


def _register_ar_signal():
    from django.db import connection
    from lims.models import AnalysisRequest
    from core.tasks import sync_analysis_request_to_senaite

    @receiver(post_save, sender=AnalysisRequest, dispatch_uid="senaite_sync_ar")
    def on_ar_saved(sender, instance, created, **kwargs):
        if created:
            # AnalysisRequest is a tenant-app model — capture the schema the save
            # happened in now, since the Celery worker has no request context to
            # infer it from later (it would otherwise default to 'public').
            schema_name = connection.schema_name
            sync_analysis_request_to_senaite.apply_async(args=[instance.pk, schema_name], countdown=5)
            logger.debug("Queued SENAITE AR sync for AR pk=%s (schema=%s)", instance.pk, schema_name)


def register_all():
    _register_client_signal()
    _register_ar_signal()
