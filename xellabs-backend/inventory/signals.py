"""
Inventory signals:
  1. Auto-generate box_location slots when a box is created.
  2. Queue SENAITE sync for every StorageLocation create/update.
"""
import logging
import string
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _register_box_slot_signal():
    from django.db import connection
    from inventory.models import StorageLocation

    @receiver(post_save, sender=StorageLocation, dispatch_uid="inventory_box_slot_autogenerate")
    def on_storage_location_saved(sender, instance, created, **kwargs):
        if not created or instance.location_type != 'box':
            return
        if not instance.rows or not instance.columns:
            return

        rows = min(instance.rows, 26)
        cols = min(instance.columns, 99)
        inherited = StorageLocation.slot_inherited_fields(instance)

        slots = []
        for r in range(rows):
            row_letter = string.ascii_uppercase[r]
            for c in range(1, cols + 1):
                slot_id = f"{row_letter}{c}"
                slots.append(StorageLocation(
                    name=f"{instance.name} - {slot_id}",
                    location_type='box_location',
                    parent=instance,
                    slot_id=slot_id,
                    is_occupied=False,
                    **inherited,
                ))

        StorageLocation.objects.bulk_create(slots)
        logger.info("Auto-generated %d slots for box '%s' (pk=%s)", len(slots), instance.name, instance.pk)

        # StorageLocation is a tenant-app model — capture the schema the save
        # happened in now, since the Celery worker has no request context to
        # infer it from later (it would otherwise default to 'public').
        from inventory.tasks import sync_box_slots_to_senaite
        pk = instance.pk
        schema_name = connection.schema_name
        transaction.on_commit(lambda: sync_box_slots_to_senaite.apply_async(args=[pk, schema_name], countdown=2))


def _register_senaite_sync_signal():
    from django.db import connection
    from inventory.models import StorageLocation

    @receiver(post_save, sender=StorageLocation, dispatch_uid="inventory_senaite_sync")
    def on_storage_location_sync(sender, instance, created, **kwargs):
        if instance.location_type == 'box_location':
            return
        from inventory.tasks import sync_storage_location_to_senaite
        pk = instance.pk
        schema_name = connection.schema_name
        transaction.on_commit(lambda: sync_storage_location_to_senaite.apply_async(args=[pk, schema_name]))
        logger.debug("Queued SENAITE sync for StorageLocation pk=%s (schema=%s)", instance.pk, schema_name)


def register_all():
    _register_box_slot_signal()
    _register_senaite_sync_signal()
