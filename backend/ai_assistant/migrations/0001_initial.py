from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0017_unique_email_index"),
    ]

    operations = [
        migrations.CreateModel(
            name="AIRequestEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("scope", models.CharField(default="inventory", max_length=50)),
                ("mode", models.CharField(default="full", max_length=20)),
                ("meta", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_requests", to="accounts.tenant"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["tenant", "created_at"], name="ai_req_tenant_created_idx"),
                    models.Index(fields=["tenant", "created_at", "scope"], name="ai_req_tenant_scope_idx"),
                ],
            },
        ),
    ]
