from django.db import models


class AdminDailyMetric(models.Model):
    KEY_CHOICES = (
        ("visit_root", "Visit / (legacy)"),
        ("visit_landing", "Visit landing"),
        ("visit_pos", "Visit /pos"),
        ("visit_kds", "Visit /kds"),
    )

    key = models.CharField(max_length=50, choices=KEY_CHOICES)
    date = models.DateField(db_index=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("key", "date")
        indexes = [models.Index(fields=["key", "date"])]

    def __str__(self):
        return f"{self.key} {self.date} ({self.count})"


class AdminVisitEvent(models.Model):
    PAGE_CHOICES = (
        ("landing", "Landing"),
        ("pos", "POS landing"),
        ("kds", "KDS landing"),
    )

    page = models.CharField(max_length=20, choices=PAGE_CHOICES)
    ip_hash = models.CharField(max_length=64)
    ua_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["page", "created_at"], name="admin_dash_page_idx"),
            models.Index(fields=["ip_hash", "ua_hash", "page", "created_at"], name="admin_dash_hash_idx"),
        ]

    def __str__(self):
        return f"{self.page} {self.created_at}"
