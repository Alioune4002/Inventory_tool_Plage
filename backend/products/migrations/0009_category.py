from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_tenant_business_type"),
        ("products", "0008_product_container_status_product_is_packaged_item_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("slug", models.SlugField(blank=True, max_length=160)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="categories", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="categories", to="accounts.tenant")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("tenant", "service", "slug")},
            },
        ),
    ]
