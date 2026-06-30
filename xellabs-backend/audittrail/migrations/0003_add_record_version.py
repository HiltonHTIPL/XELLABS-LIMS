import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audittrail", "0002_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RecordVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("object_id", models.PositiveBigIntegerField()),
                ("version_number", models.PositiveIntegerField()),
                ("data", models.JSONField()),
                ("reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "changed_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="contenttypes.contenttype",
                    ),
                ),
            ],
            options={
                "db_table": "record_versions",
                "ordering": ["content_type", "object_id", "version_number"],
            },
        ),
        migrations.AddConstraint(
            model_name="recordversion",
            constraint=models.UniqueConstraint(
                fields=("content_type", "object_id", "version_number"),
                name="unique_record_version",
            ),
        ),
        migrations.AddIndex(
            model_name="recordversion",
            index=models.Index(fields=["content_type", "object_id"], name="record_ver_content_idx"),
        ),
    ]
