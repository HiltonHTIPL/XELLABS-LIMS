from django.db import migrations


class Migration(migrations.Migration):
    """Merge parallel core branches (staging client validators + Vinod org type)."""

    dependencies = [
        ("core", "0009_add_client_organization_type"),
        ("core", "0008_client_cc_emails"),
    ]

    operations = []
