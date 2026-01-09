from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AdminDailyMetric",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "key",
                    models.CharField(
                        choices=[("visit_root", "Visit /"), ("visit_pos", "Visit /pos"), ("visit_kds", "Visit /kds")],
                        max_length=50,
                    ),
                ),
                ("date", models.DateField(db_index=True)),
                ("count", models.PositiveIntegerField(default=0)),
            ],
            options={
                "unique_together": {("key", "date")},
            },
        ),
        migrations.AddIndex(
            model_name="admindailymetric",
            index=models.Index(fields=["key", "date"], name="admin_dash_key_date_idx"),
        ),
    ]
