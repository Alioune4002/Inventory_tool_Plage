from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0018_remove_product_uniq_barcode_per_month_tenant_service_nonempty_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="receipt",
            name="invoice_number",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="receipt",
            name="invoice_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="receiptline",
            name="tva",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="receiptline",
            name="category",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddIndex(
            model_name="receipt",
            index=models.Index(fields=["tenant", "invoice_number"], name="receipt_tenant_invoice_idx"),
        ),
    ]
