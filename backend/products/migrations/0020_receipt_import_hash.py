from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0019_receipts_invoice_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="receipt",
            name="import_hash",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddIndex(
            model_name="receipt",
            index=models.Index(fields=["tenant", "import_hash"], name="receipt_tenant_import_hash_idx"),
        ),
    ]
