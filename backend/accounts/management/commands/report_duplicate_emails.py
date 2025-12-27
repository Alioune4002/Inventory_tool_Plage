import csv

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Count
from django.db.models.functions import Lower


class Command(BaseCommand):
    help = "Report duplicate emails (case-insensitive) with user ids."

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv",
            dest="csv_path",
            default="",
            help="Optional CSV output path. If omitted, prints to stdout.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        csv_path = (options.get("csv_path") or "").strip()

        duplicates = (
            User.objects.exclude(email__isnull=True)
            .exclude(email="")
            .annotate(email_norm=Lower("email"))
            .values("email_norm")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
            .order_by("-count", "email_norm")
        )

        rows = []
        for entry in duplicates:
            email_norm = entry["email_norm"]
            user_ids = list(
                User.objects.filter(email__iexact=email_norm)
                .order_by("id")
                .values_list("id", flat=True)
            )
            rows.append(
                {
                    "email_normalized": email_norm,
                    "count": entry["count"],
                    "user_ids": ",".join(str(uid) for uid in user_ids),
                }
            )

        total = len(rows)
        if not rows:
            self.stdout.write(self.style.SUCCESS("Aucun doublon d'email detecte."))
            return

        if csv_path:
            with open(csv_path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["email_normalized", "count", "user_ids"])
                writer.writeheader()
                writer.writerows(rows)
            self.stdout.write(
                self.style.WARNING(
                    f"{total} doublon(s) trouve(s). CSV ecrit dans {csv_path}."
                )
            )
        else:
            self.stdout.write(self.style.WARNING(f"{total} doublon(s) d'email detecte(s)."))
            for row in rows:
                self.stdout.write(
                    f"{row['email_normalized']} | count={row['count']} | user_ids={row['user_ids']}"
                )
