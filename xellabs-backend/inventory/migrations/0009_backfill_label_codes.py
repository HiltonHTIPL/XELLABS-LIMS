"""One-time backfill of label_code for boxes/slots created before the field
existed — same pattern as the earlier SENAITE tier-field backfill. New records
get their codes from inventory/signals.py and the regenerate-slots action."""
from django.db import migrations


def backfill(apps, schema_editor):
    StorageLocation = apps.get_model('inventory', 'StorageLocation')

    boxes = list(StorageLocation.objects.filter(location_type='box', label_code__isnull=True))
    for box in boxes:
        box.label_code = f"BX-{box.pk:04d}"
    StorageLocation.objects.bulk_update(boxes, ['label_code'], batch_size=500)

    box_codes = dict(
        StorageLocation.objects.filter(location_type='box').values_list('pk', 'label_code')
    )
    slots = list(
        StorageLocation.objects.filter(location_type='box_location', label_code__isnull=True)
        .exclude(parent__isnull=True)
    )
    for slot in slots:
        code = box_codes.get(slot.parent_id)
        slot.label_code = f"{code}-{slot.slot_id}" if code and slot.slot_id else None
    StorageLocation.objects.bulk_update(slots, ['label_code'], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0008_storagelocation_label_code'),
    ]
    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
