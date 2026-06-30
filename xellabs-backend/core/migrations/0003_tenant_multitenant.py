# Migration: upgrade Tenant to django-tenants TenantMixin, add Domain model, add client_id to Client
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_add_tenant_model'),
    ]

    operations = [
        # 1. Add schema_name to Tenant (django-tenants requirement) — default to slug value
        migrations.AddField(
            model_name='tenant',
            name='schema_name',
            field=models.CharField(max_length=63, default='public', unique=False),
            preserve_default=False,
        ),
        # 2. Make schema_name unique after setting default
        migrations.AlterField(
            model_name='tenant',
            name='schema_name',
            field=models.CharField(max_length=63, unique=True),
        ),
        # 3. Create Domain model
        migrations.CreateModel(
            name='Domain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(max_length=253, unique=True)),
                ('is_primary', models.BooleanField(default=True)),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='domains',
                    to='core.tenant',
                )),
            ],
            options={'db_table': 'tenant_domains'},
        ),
        # 4. Add client_id field to Client
        migrations.AddField(
            model_name='client',
            name='client_id',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
