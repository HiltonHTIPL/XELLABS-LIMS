# Generated manually — Manufacturer/Supplier catalog FKs (SENAITE parity)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("instruments", "0006_instrument_senaite_parity_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="InstrumentManufacturer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "instrument_manufacturers",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="InstrumentSupplier",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "instrument_suppliers",
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="instrument",
            name="manufacturer_org",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="instruments",
                to="instruments.instrumentmanufacturer",
            ),
        ),
        migrations.AddField(
            model_name="instrument",
            name="supplier_org",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="instruments",
                to="instruments.instrumentsupplier",
            ),
        ),
    ]
