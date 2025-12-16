from django.db import migrations, models


def fill_inventory_month(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    for p in Product.objects.filter(inventory_month__isnull=True):
        p.inventory_month = "1970-01"
        p.save(update_fields=["inventory_month"])


def dedupe_barcodes(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    seen = set()
    for p in Product.objects.all().order_by("id"):
        month = p.inventory_month or "1970-01"
        base_barcode = (p.barcode or "").strip() or f"auto-{p.id}"
        key = (p.tenant_id, p.service_id, base_barcode, month)

        if key in seen:
            base_barcode = f"{base_barcode}-dedup-{p.id}"

        # Even if the current tuple is new, suffix with pk to guarantee global uniqueness
        current_barcode = f"{base_barcode}-pk-{p.id}"
        seen.add((p.tenant_id, p.service_id, current_barcode, month))

        updates = []
        if p.inventory_month != month:
            p.inventory_month = month
            updates.append("inventory_month")
        if p.barcode != current_barcode:
            p.barcode = current_barcode
            updates.append("barcode")

        if updates:
            p.save(update_fields=updates)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0004_merge_20251213_2059"),
    ]

    operations = [
        migrations.RunPython(fill_inventory_month, reverse_code=migrations.RunPython.noop),
        migrations.RunPython(dedupe_barcodes, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="inventory_month",
            field=models.CharField(max_length=7, db_index=True, default="1970-01"),
        ),
    ]
