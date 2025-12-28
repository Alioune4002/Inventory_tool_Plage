from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0018_service_sku_sequence"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="currency_code",
            field=models.CharField(default="EUR", max_length=3),
        ),
    ]
