# Generated manually for SENAITE Instrument field parity gaps

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("instruments", "0005_instrument_type_location_cert_sched_validation"),
    ]

    operations = [
        migrations.AddField(
            model_name="instrument",
            name="installation_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="instrument",
            name="installation_certificate",
            field=models.FileField(blank=True, null=True, upload_to="instrument_install_certs/"),
        ),
        migrations.AddField(
            model_name="instrument",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="instrument_photos/"),
        ),
        migrations.AddField(
            model_name="instrument",
            name="data_interface",
            field=models.CharField(
                blank=True,
                help_text="Export data interface code (SENAITE DataInterface)",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="import_data_interface",
            field=models.CharField(
                blank=True,
                help_text="Comma-separated import interface codes (SENAITE ImportDataInterface)",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="result_files_folder",
            field=models.TextField(
                blank=True,
                help_text="One line per import path: InterfaceCode|/path/to/folder",
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="dispose_until_next_calibration",
            field=models.BooleanField(
                default=False,
                help_text="Unavailable until the next valid calibration (SENAITE DisposeUntilNextCalibrationTest)",
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="inlab_calibration_procedure",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="instrument",
            name="preventive_maintenance_procedure",
            field=models.TextField(blank=True),
        ),
    ]
