from django.db import migrations, models
import django.db.models.deletion


def backfill_tenant_and_fields(apps, schema_editor):
    Tenant = apps.get_model('accounts', 'Tenant')
    Product = apps.get_model('products', 'Product')
    if not Tenant.objects.exists():
        default_tenant = Tenant.objects.create(name='Default Tenant', domain='food')
    else:
        default_tenant = Tenant.objects.first()

    for product in Product.objects.filter(tenant__isnull=True):
        product.tenant = default_tenant
        if not product.barcode:
            product.barcode = f"UNSPECIFIED-{product.id or '0'}"
        if not product.inventory_month:
            product.inventory_month = "1970-01"
        product.save(update_fields=['tenant', 'barcode', 'inventory_month'])


class Migration(migrations.Migration):

    # Depend explicitly on the migration that introduces inventory_month to avoid
    # applying AlterField before the column exists (was causing FieldDoesNotExist in CI)
    dependencies = [
        ('accounts', '0001_initial'),
        ('products', '0002_product_inventory_month_alter_product_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='tenant',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='products', to='accounts.tenant'),
        ),
        migrations.AlterField(
            model_name='product',
            name='barcode',
            field=models.CharField(max_length=50, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='product',
            name='inventory_month',
            field=models.CharField(db_index=True, max_length=7, null=True, blank=True),
        ),
        migrations.RunPython(backfill_tenant_and_fields, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='product',
            name='tenant',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='products', to='accounts.tenant'),
        ),
        migrations.AlterField(
            model_name='product',
            name='barcode',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='product',
            name='inventory_month',
            field=models.CharField(db_index=True, max_length=7),
        ),
        migrations.AddConstraint(
            model_name='product',
            constraint=models.UniqueConstraint(fields=('tenant', 'barcode', 'inventory_month'), name='unique_barcode_per_month_tenant'),
        ),
    ]
