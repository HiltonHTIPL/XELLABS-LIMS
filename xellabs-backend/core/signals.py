"""
Django signals to trigger SENAITE sync automatically.
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _register_client_signal():
    from core.models import Client
    from core.tasks import sync_client_to_senaite, deactivate_client_in_senaite, activate_client_in_senaite

    @receiver(pre_save, sender=Client, dispatch_uid="senaite_sync_client_pre_save")
    def stash_previous_is_active(sender, instance, **kwargs):
        # post_save can't tell what changed in this save vs. the row already on
        # disk — without this, EVERY save of an already-active, already-synced
        # client re-fires an "activate" transition, which SENAITE rejects as an
        # invalid transition on a client that's already active (confirmed live:
        # this flooded Celery/SENAITE with failing activate_client_in_senaite
        # retries during a bulk client sync/save, one per client per save, none
        # of which could ever succeed). Stash the prior value here so post_save
        # can compare and only fire the transition when is_active actually flips.
        if instance.pk:
            try:
                instance._orig_is_active = Client.objects.only("is_active").get(pk=instance.pk).is_active
            except Client.DoesNotExist:
                instance._orig_is_active = None
        else:
            instance._orig_is_active = None

    @receiver(post_save, sender=Client, dispatch_uid="senaite_sync_client")
    def on_client_saved(sender, instance, created, **kwargs):
        # Activate/deactivate are workflow transitions, not field updates — pushed
        # via their own tasks instead of sync_client_to_senaite (which only PATCHes
        # fields and never changes review_state). Only meaningful once a client
        # already exists in SENAITE (has a senaite_uid); a brand-new client is
        # created active by default, so there's nothing to transition yet.
        is_active_changed = created or getattr(instance, "_orig_is_active", None) != instance.is_active
        if instance.senaite_uid and is_active_changed:
            if not instance.is_active:
                deactivate_client_in_senaite.apply_async(args=[instance.pk], countdown=2)
                logger.debug("Queued SENAITE deactivation for client pk=%s", instance.pk)
                return
            elif not created:
                # A brand-new client is created active by default in SENAITE too —
                # nothing to transition on creation, only on a later reactivation.
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
