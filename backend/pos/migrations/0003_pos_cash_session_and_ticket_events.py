from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("pos", "0002_rename_pos_payment_ticket__f2e2a8_idx_pos_pospaym_ticket__7bd4f1_idx_and_more"),
        ("accounts", "0017_unique_email_index"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PosCashSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("opened_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("closed_at", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("OPEN", "Ouverte"), ("CLOSED", "Clôturée")], default="OPEN", max_length=10)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_discount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_subtotal", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_tickets", models.PositiveIntegerField(default=0)),
                ("totals_by_method", models.JSONField(blank=True, default=dict)),
                ("closed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pos_sessions_closed", to=settings.AUTH_USER_MODEL)),
                ("opened_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pos_sessions_opened", to=settings.AUTH_USER_MODEL)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pos_sessions", to="accounts.service")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pos_sessions", to="accounts.tenant")),
            ],
        ),
        migrations.AddField(
            model_name="posticket",
            name="session",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="tickets", to="pos.poscashsession"),
        ),
        migrations.CreateModel(
            name="PosTicketEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("CANCEL", "Annulation")], max_length=20)),
                ("reason_code", models.CharField(blank=True, default="", max_length=30)),
                ("reason_text", models.TextField(blank=True, default="")),
                ("restock", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pos_ticket_events", to=settings.AUTH_USER_MODEL)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="pos.posticket")),
            ],
        ),
        migrations.AddIndex(
            model_name="poscashsession",
            index=models.Index(fields=["tenant", "service", "status"], name="pos_poscas_tenant__9a4660_idx"),
        ),
        migrations.AddIndex(
            model_name="poscashsession",
            index=models.Index(fields=["tenant", "service", "opened_at"], name="pos_poscas_tenant__d8a5fd_idx"),
        ),
        migrations.AddIndex(
            model_name="posticketevent",
            index=models.Index(fields=["ticket", "created_at"], name="pos_postic_ticket__7f6a5a_idx"),
        ),
    ]
