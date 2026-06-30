import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_tenant_multitenant'),
    ]

    operations = [
        # Organisation contact
        migrations.AddField(model_name='client', name='fax',    field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name='client', name='mobile', field=models.CharField(blank=True, max_length=30)),

        # Widen phone from 20 → 30
        migrations.AlterField(model_name='client', name='phone', field=models.CharField(blank=True, max_length=30)),

        # Primary contact person
        migrations.AddField(model_name='client', name='salutation',          field=models.CharField(blank=True, max_length=10)),
        migrations.AddField(model_name='client', name='contact_first_name',  field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='client', name='contact_last_name',   field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='client', name='contact_email',       field=models.EmailField(blank=True)),
        migrations.AddField(model_name='client', name='contact_phone',       field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name='client', name='contact_job_title',   field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='client', name='contact_department',  field=models.CharField(blank=True, max_length=100)),

        # Structured addresses
        migrations.AddField(model_name='client', name='physical_address', field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name='client', name='postal_address',   field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name='client', name='billing_address',  field=models.JSONField(blank=True, default=dict)),

        # Financial
        migrations.AddField(model_name='client', name='tax_number',     field=models.CharField(blank=True, max_length=50)),
        migrations.AddField(model_name='client', name='account_number', field=models.CharField(blank=True, max_length=50)),
        migrations.AddField(model_name='client', name='bank_name',      field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='client', name='bank_branch',    field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='client', name='swift_code',     field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name='client', name='iban',           field=models.CharField(blank=True, max_length=50)),
        migrations.AddField(model_name='client', name='nib',            field=models.CharField(blank=True, max_length=50)),
        migrations.AddField(model_name='client', name='bulk_discount',   field=models.DecimalField(decimal_places=2, default=0, max_digits=5)),
        migrations.AddField(model_name='client', name='member_discount', field=models.DecimalField(decimal_places=2, default=0, max_digits=5)),

        # Notes & sync
        migrations.AddField(model_name='client', name='remarks',     field=models.TextField(blank=True)),
        migrations.AddField(model_name='client', name='senaite_uid', field=models.CharField(blank=True, max_length=100)),
    ]
