from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0009_category"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="category",
            field=models.CharField(max_length=50, null=True, blank=True),
        ),
    ]
