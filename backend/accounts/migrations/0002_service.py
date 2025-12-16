from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def create_default_services(apps, schema_editor):
    Tenant = apps.get_model('accounts', 'Tenant')
    Service = apps.get_model('accounts', 'Service')
    for tenant in Tenant.objects.all():
        Service.objects.get_or_create(
            tenant=tenant,
            name="Principal",
            defaults={"slug": slugify("Principal")}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Service',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('slug', models.SlugField(blank=True, max_length=160, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='services', to='accounts.tenant')),
            ],
        ),
        migrations.AddConstraint(
            model_name='service',
            constraint=models.UniqueConstraint(fields=('tenant', 'name'), name='unique_service_name_per_tenant'),
        ),
        migrations.RunPython(create_default_services, migrations.RunPython.noop),
    ]
