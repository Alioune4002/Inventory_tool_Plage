from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0017_unique_email_index"),
        ("products", "0015_product_alerts_variants_exports"),
        ("pos", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="KdsTable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_tables", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_tables", to="accounts.tenant")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "service", "is_active"], name="kds_kdstab_tenant__0e61f0_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="MenuItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=140)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_menu_items", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_menu_items", to="accounts.tenant")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "service", "is_active"], name="kds_menuit_tenant__a8dd3c_idx"),
                    models.Index(fields=["tenant", "service", "name"], name="kds_menuit_tenant__9eb45f_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Order",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("DRAFT", "Brouillon"), ("SENT", "En cuisine"), ("READY", "Prêt"), ("SERVED", "Servi"), ("CANCELLED", "Annulé"), ("PAID", "Payé")], default="DRAFT", max_length=12)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("subtotal_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("discount_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("note", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("ready_at", models.DateTimeField(blank=True, null=True)),
                ("served_at", models.DateTimeField(blank=True, null=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="kds_orders", to=settings.AUTH_USER_MODEL)),
                ("pos_ticket", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="kds_orders", to="pos.posticket")),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_orders", to="accounts.service")),
                ("table", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="orders", to="kds.kdstable")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_orders", to="accounts.tenant")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "service", "status"], name="kds_order_tenant__32f2cc_idx"),
                    models.Index(fields=["tenant", "service", "created_at"], name="kds_order_tenant__5a55d0_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="RecipeItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("qty", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("unit", models.CharField(default="pcs", max_length=20)),
                ("ingredient_product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_recipe_items", to="products.product")),
                ("menu_item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recipe_items", to="kds.menuitem")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["menu_item"], name="kds_recipei_menu_it_2bc9a9_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="OrderLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("qty", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("line_discount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("line_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("notes", models.CharField(blank=True, default="", max_length=255)),
                ("status", models.CharField(choices=[("IN_ORDER", "Dans la commande"), ("CANCELLED", "Annulé")], default="IN_ORDER", max_length=12)),
                ("menu_item_name", models.CharField(blank=True, default="", max_length=140)),
                ("menu_item", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="kds.menuitem")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="kds.order")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["order"], name="kds_orderli_order_i_796461_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="WasteEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason_code", models.CharField(choices=[("cancelled", "Annulation"), ("mistake", "Erreur"), ("breakage", "Casse"), ("other", "Autre")], default="other", max_length=30)),
                ("reason_text", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="kds_waste_events", to=settings.AUTH_USER_MODEL)),
                ("related_order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="waste_events", to="kds.order")),
                ("related_order_line", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="waste_events", to="kds.orderline")),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_waste_events", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_waste_events", to="accounts.tenant")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "service", "created_at"], name="kds_wastee_tenant__4fa7b4_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="StockConsumption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("qty_consumed", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("reason", models.CharField(choices=[("ORDER_SENT", "Commande envoyée"), ("WASTE", "Perte"), ("ADJUSTMENT", "Ajustement")], default="ORDER_SENT", max_length=20)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="consumptions", to="kds.order")),
                ("order_line", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="consumptions", to="kds.orderline")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_consumptions", to="products.product")),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_consumptions", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="kds_consumptions", to="accounts.tenant")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "service", "created_at"], name="kds_stockc_tenant__1c6b86_idx"),
                    models.Index(fields=["product"], name="kds_stockc_product_a9b27d_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="recipeitem",
            constraint=models.UniqueConstraint(fields=("menu_item", "ingredient_product"), name="uniq_recipe_ingredient"),
        ),
        migrations.AddConstraint(
            model_name="kdstable",
            constraint=models.UniqueConstraint(fields=("tenant", "service", "name"), name="uniq_kds_table_name"),
        ),
    ]

