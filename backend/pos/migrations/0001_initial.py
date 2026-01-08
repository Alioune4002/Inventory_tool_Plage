from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0017_unique_email_index"),
        ("products", "0015_product_alerts_variants_exports"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PosTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("subtotal_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("discount_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("status", models.CharField(choices=[("PAID", "Payé"), ("VOID", "Annulé")], default="PAID", max_length=10)),
                ("note", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pos_tickets", to=settings.AUTH_USER_MODEL)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pos_tickets", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pos_tickets", to="accounts.tenant")),
            ],
        ),
        migrations.CreateModel(
            name="PosTicketLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("qty", models.DecimalField(decimal_places=3, default=0, max_digits=10)),
                ("unit", models.CharField(default="pcs", max_length=10)),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("line_discount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("line_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("product_name", models.CharField(blank=True, default="", max_length=120)),
                ("barcode", models.CharField(blank=True, default="", max_length=50)),
                ("internal_sku", models.CharField(blank=True, default="", max_length=50)),
                ("category", models.CharField(blank=True, default="", max_length=80)),
                ("tva", models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pos_lines", to="products.product")),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="pos.posticket")),
            ],
        ),
        migrations.CreateModel(
            name="PosPayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("method", models.CharField(choices=[("cash", "Espèces"), ("card", "Carte"), ("cheque", "Chèque"), ("ticket_restaurant", "Ticket restaurant"), ("other", "Autre")], max_length=30)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="pos.posticket")),
            ],
        ),
        migrations.AddIndex(
            model_name="posticket",
            index=models.Index(fields=["tenant", "service", "created_at"], name="pos_postick_tenant__e9c15a_idx"),
        ),
        migrations.AddIndex(
            model_name="posticket",
            index=models.Index(fields=["tenant", "status"], name="pos_postick_tenant__8c9c26_idx"),
        ),
        migrations.AddIndex(
            model_name="posticketline",
            index=models.Index(fields=["ticket"], name="pos_postick_ticket__1702f2_idx"),
        ),
        migrations.AddIndex(
            model_name="pospayment",
            index=models.Index(fields=["ticket"], name="pos_payment_ticket__f2e2a8_idx"),
        ),
        migrations.AddIndex(
            model_name="pospayment",
            index=models.Index(fields=["method"], name="pos_payment_method__2a2b48_idx"),
        ),
    ]
