from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lims", "0015_merge_20260710_0943"),
    ]

    operations = [
        migrations.AddField(
            model_name="sampletype",
            name="retention_days",
            field=models.PositiveIntegerField(
                default=14,
                help_text="Days after collection before the sample is past retention (drives due/expiry date).",
            ),
        ),
    ]
