from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("admin_dashboard", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminVisitEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "page",
                    models.CharField(
                        choices=[("landing", "Landing"), ("pos", "POS landing"), ("kds", "KDS landing")],
                        max_length=20,
                    ),
                ),
                ("ip_hash", models.CharField(max_length=64)),
                ("ua_hash", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="adminvisitevent",
            index=models.Index(fields=["page", "created_at"], name="admin_dash_page_idx"),
        ),
        migrations.AddIndex(
            model_name="adminvisitevent",
            index=models.Index(fields=["ip_hash", "ua_hash", "page", "created_at"], name="admin_dash_hash_idx"),
        ),
    ]
