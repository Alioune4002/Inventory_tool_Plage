from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def backfill_product_service(apps, schema_editor):
    Service = apps.get_model('accounts', 'Service')
    Tenant = apps.get_model('accounts', 'Tenant')
    Product = apps.get_model('products', 'Product')

    for tenant in Tenant.objects.all():
        service, _ = Service.objects.get_or_create(
            tenant=tenant,
            name="Principal",
            defaults={"slug": slugify("Principal")}
        )
        Product.objects.filter(tenant=tenant, service__isnull=True).update(service=service)


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('accounts', '0012_alter_tenant_business_type'),
        ('products', '0002_add_tenant_and_constraints'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='service',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='products', to='accounts.service'),
        ),
        migrations.AddField(
            model_name='product',
            name='no_barcode',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='product',
            name='internal_sku',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AlterField(
            model_name='product',
            name='barcode',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.RemoveConstraint(
            model_name='product',
            name='unique_barcode_per_month_tenant',
        ),
        migrations.RunPython(backfill_product_service, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='product',
            name='service',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='products', to='accounts.service'),
        ),
        migrations.AddConstraint(
            model_name='product',
            constraint=models.UniqueConstraint(fields=('tenant', 'service', 'barcode', 'inventory_month'), name='unique_barcode_per_month_tenant_service'),
        ),
        migrations.AddConstraint(
            model_name='product',
            constraint=models.UniqueConstraint(fields=('tenant', 'service', 'internal_sku', 'inventory_month'), name='unique_internal_sku_per_month_tenant_service'),
        ),
    ]
