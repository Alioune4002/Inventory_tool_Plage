from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0016_catalog_pdf_event"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="product",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RemoveConstraint(
            model_name="product",
            name="uniq_barcode_per_month_tenant_service_nonempty",
        ),
        migrations.RemoveConstraint(
            model_name="product",
            name="uniq_sku_per_month_tenant_service_nonempty",
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.UniqueConstraint(
                fields=("tenant", "service", "barcode", "inventory_month"),
                name="uniq_barcode_per_month_tenant_service_nonempty",
                condition=django.db.models.Q(
                    django.db.models.Q(("barcode__isnull", False)),
                    django.db.models.Q(("barcode", ""), _negated=True),
                    django.db.models.Q(("is_archived", False)),
                ),
            ),
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.UniqueConstraint(
                fields=("tenant", "service", "internal_sku", "inventory_month"),
                name="uniq_sku_per_month_tenant_service_nonempty",
                condition=django.db.models.Q(
                    django.db.models.Q(("internal_sku__isnull", False)),
                    django.db.models.Q(("internal_sku", ""), _negated=True),
                    django.db.models.Q(("is_archived", False)),
                ),
            ),
        ),
        migrations.CreateModel(
            name="LabelPdfEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("params", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="label_pdf_events", to="accounts.tenant"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="label_pdf_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="labelpdf_tenant_created_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Supplier",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("aliases", models.JSONField(blank=True, default=list)),
                ("contact_email", models.EmailField(blank=True, default="", max_length=254)),
                ("contact_phone", models.CharField(blank=True, default="", max_length=40)),
                ("address", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="suppliers", to="accounts.tenant"),
                ),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("tenant", "name")},
            },
        ),
        migrations.CreateModel(
            name="Receipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("supplier_name", models.CharField(blank=True, default="", max_length=150)),
                (
                    "source",
                    models.CharField(
                        choices=[("csv", "CSV"), ("pdf", "PDF")],
                        default="csv",
                        max_length=10,
                    ),
                ),
                ("file_name", models.CharField(blank=True, default="", max_length=200)),
                ("received_at", models.DateField(default=django.utils.timezone.now)),
                (
                    "status",
                    models.CharField(
                        choices=[("PENDING", "Pending"), ("APPLIED", "Applied"), ("FAILED", "Failed")],
                        default="PENDING",
                        max_length=10,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="receipts_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "service",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="receipts", to="accounts.service"),
                ),
                (
                    "supplier",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="receipts", to="products.supplier"),
                ),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="receipts", to="accounts.tenant"),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="receipt_tenant_created_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ReceiptLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("line_number", models.PositiveIntegerField(default=1)),
                ("raw_name", models.CharField(blank=True, default="", max_length=200)),
                ("quantity", models.DecimalField(decimal_places=3, default=0, max_digits=10)),
                ("unit", models.CharField(blank=True, default="pcs", max_length=10)),
                ("purchase_price", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("barcode", models.CharField(blank=True, default="", max_length=50)),
                ("internal_sku", models.CharField(blank=True, default="", max_length=50)),
                (
                    "status",
                    models.CharField(
                        choices=[("PENDING", "Pending"), ("MATCHED", "Matched"), ("CREATED", "Created"), ("IGNORED", "Ignored")],
                        default="PENDING",
                        max_length=10,
                    ),
                ),
                ("note", models.TextField(blank=True, default="")),
                (
                    "matched_product",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="products.product"),
                ),
                (
                    "receipt",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="products.receipt"),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["receipt", "line_number"], name="receipt_line_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ReceiptImportEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("params", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="receipt_import_events", to="accounts.tenant"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="receipt_import_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="rcpt_evt_tenant_created_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ProductMergeLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("summary", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="product_merge_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "master_product",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="merge_master", to="products.product"),
                ),
                (
                    "merged_product",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="merge_merged", to="products.product"),
                ),
                (
                    "service",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="product_merge_logs", to="accounts.service"),
                ),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="product_merge_logs", to="accounts.tenant"),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="prodmerge_tenant_created_idx"),
                ],
            },
        ),
    ]
