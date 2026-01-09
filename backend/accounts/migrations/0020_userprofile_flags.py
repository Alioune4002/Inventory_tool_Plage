from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0019_tenant_currency_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="is_test_account",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
