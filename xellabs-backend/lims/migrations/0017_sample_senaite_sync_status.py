from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lims", "0016_sampletype_retention_days"),
    ]

    operations = [
        migrations.AddField(
            model_name="sample",
            name="senaite_sync_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Unspecified"),
                    ("synced", "Synced"),
                    ("pending", "Pending"),
                    ("failed", "Failed"),
                    ("not_linked", "Not linked"),
                ],
                default="",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="sample",
            name="senaite_sync_error",
            field=models.TextField(blank=True),
        ),
    ]
