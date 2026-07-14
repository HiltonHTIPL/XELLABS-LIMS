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


def _register_label_code_signal():
    """Assign the hidden scannable label_code to new boxes.

    Registered BEFORE the slot-autogenerate receiver so the box's code exists
    by the time its slots are bulk_created (receivers run in connection order).
    pk-derived → unique, race-free, immutable across renames (printed stickers
    stay valid even if the user-editable name changes or duplicates).
    """
    from inventory.models import StorageLocation

    @receiver(post_save, sender=StorageLocation, dispatch_uid="inventory_box_label_code")
    def on_box_label_code(sender, instance, created, **kwargs):
        if not created or instance.location_type != 'box' or instance.label_code:
            return
        instance.label_code = f"BX-{instance.pk:04d}"
        # .update() — avoid recursive save()/signals
        StorageLocation.objects.filter(pk=instance.pk).update(label_code=instance.label_code)


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
                    label_code=StorageLocation.slot_label_code(instance, slot_id),
                ))

        StorageLocation.objects.bulk_create(slots)
        logger.info("Auto-generated %d slots for box '%s' (pk=%s)", len(slots), instance.name, instance.pk)

        # Slots are NOT pushed to SENAITE as their own objects — senaite.storage
        # represents a slot as an entry inside its box's own PositionsLayout, not
        # as a sibling content object. Nothing to sync here; occupancy is driven
        # into SENAITE only at assign/unassign time via the 'store'/'recover'
        # workflow transition (see inventory/views.py _assign_sample_to_slot).


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
    _register_label_code_signal()   # must connect before the slot signal
    _register_box_slot_signal()
    _register_senaite_sync_signal()
