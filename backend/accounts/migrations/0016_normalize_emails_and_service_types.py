from django.db import migrations


def normalize_service_types(apps, schema_editor):
    Service = apps.get_model("accounts", "Service")
    Service.objects.filter(service_type="dining").update(service_type="restaurant_dining")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0015_membership_activated_at_membership_status"),
    ]

    operations = [
        migrations.RunPython(normalize_service_types, reverse_code=migrations.RunPython.noop),
    ]
