from django.db import migrations


def refresh_all_usability(apps, schema_editor):
    Instrument = apps.get_model("instruments", "Instrument")
    Calibration = apps.get_model("instruments", "Calibration")
    Certification = apps.get_model("instruments", "Certification")
    Validation = apps.get_model("instruments", "Validation")
    from django.utils import timezone

    today = timezone.now().date()
    for instrument in Instrument.objects.all():
        status = instrument.status
        if status in ("out_of_service", "retired", "inactive", "under_maintenance"):
            value = "out_of_service"
        elif instrument.dispose_until_next_calibration:
            value = "expired"
        else:
            value = "valid"
            for v in Validation.objects.filter(instrument_id=instrument.pk).order_by("-id")[:5]:
                if v.down_from and today >= v.down_from and (not v.down_to or today <= v.down_to):
                    value = "out_of_service"
                    break
            if value == "valid":
                latest_cal = (
                    Calibration.objects.filter(instrument_id=instrument.pk)
                    .order_by("-calibration_date")
                    .first()
                )
                if latest_cal:
                    if latest_cal.status == "failed":
                        value = "expired"
                    else:
                        due = latest_cal.next_due or instrument.next_calibration
                        if due and due < today:
                            value = "expired"
                if value == "valid" and instrument.next_calibration and instrument.next_calibration < today:
                    value = "expired"
                if value == "valid":
                    latest_cert = (
                        Certification.objects.filter(instrument_id=instrument.pk)
                        .order_by("-valid_from")
                        .first()
                    )
                    if latest_cert and latest_cert.valid_from and latest_cert.valid_to:
                        if today > latest_cert.valid_to:
                            value = "expired"
        if instrument.usability != value:
            instrument.usability = value
            instrument.save(update_fields=["usability"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("instruments", "0008_instrument_workflow_usability"),
    ]

    operations = [
        migrations.RunPython(refresh_all_usability, noop),
    ]
