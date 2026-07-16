# Generated manually for instrument workflow + field parity

from django.db import migrations, models


def migrate_status_values(apps, schema_editor):
    Instrument = apps.get_model("instruments", "Instrument")
    Instrument.objects.filter(status="maintenance").update(status="under_maintenance")


def reverse_status_values(apps, schema_editor):
    Instrument = apps.get_model("instruments", "Instrument")
    Instrument.objects.filter(status="under_maintenance").update(status="maintenance")
    Instrument.objects.filter(status="out_of_service").update(status="inactive")


class Migration(migrations.Migration):

    dependencies = [
        ("instruments", "0007_instrument_manufacturer_supplier"),
    ]

    operations = [
        migrations.AddField(
            model_name="instrument",
            name="data_interface_options",
            field=models.TextField(
                blank=True,
                help_text="Key=Value lines passed to export/import modules",
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="usability",
            field=models.CharField(
                choices=[
                    ("valid", "Valid"),
                    ("expired", "Expired"),
                    ("out_of_service", "Out of Service"),
                ],
                db_index=True,
                default="valid",
                help_text="Derived from status + latest calibration/certification/validation",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="instrument",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("inactive", "Inactive"),
                    ("under_maintenance", "Under Maintenance"),
                    ("out_of_service", "Out of Service"),
                    ("retired", "Retired"),
                ],
                default="active",
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_status_values, reverse_status_values),
        migrations.AddIndex(
            model_name="instrument",
            index=models.Index(fields=["usability"], name="instrument_usability_idx"),
        ),
    ]
