from django.db import migrations


class Migration(migrations.Migration):
    """Merge Vinod-branch migrations (retention/sync/method fields) with staging 0025."""

    dependencies = [
        ("lims", "0025_sampling_deviation_free_text"),
        ("lims", "0018_method_accredited_fields"),
    ]

    operations = []
