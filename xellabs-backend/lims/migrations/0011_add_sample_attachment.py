from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lims', '0010_add_performance_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='sample',
            name='attachment',
            field=models.FileField(blank=True, null=True, upload_to='sample_attachments/'),
        ),
    ]
