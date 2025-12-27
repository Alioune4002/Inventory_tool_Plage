from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_unique_email_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="sku_sequence",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
