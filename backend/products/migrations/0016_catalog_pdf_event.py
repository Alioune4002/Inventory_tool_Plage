from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0015_product_alerts_variants_exports"),
    ]

    operations = [
        migrations.CreateModel(
            name="CatalogPdfEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("params", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="catalog_pdf_events", to="accounts.tenant"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="catalog_pdf_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="catpdf_tenant_created_idx"),
                ],
            },
        ),
    ]
