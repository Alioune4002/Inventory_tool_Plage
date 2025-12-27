from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0014_product_brand_product_notes_product_supplier"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="min_qty",
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="variant_name",
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="variant_value",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="conversion_unit",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="conversion_factor",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=12, null=True),
        ),
        migrations.CreateModel(
            name="ExportEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("format", models.CharField(choices=[("csv", "CSV"), ("xlsx", "XLSX")], max_length=10)),
                ("emailed", models.BooleanField(default=False)),
                ("params", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="export_events", to="accounts.tenant"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="export_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="exp_evt_tenant_created_idx"),
                    models.Index(fields=["tenant", "format", "created_at"], name="exp_evt_tenant_fmt_idx"),
                ],
            },
        ),
    ]
