# backend/accounts/migrations/0017_unique_email_index.py

import logging

from django.conf import settings
from django.db import migrations
from django.db.models import Count
from django.db.models.functions import Lower

logger = logging.getLogger(__name__)


def _get_user_model(apps):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    return apps.get_model(app_label, model_name)


def _has_duplicate_emails(User) -> bool:
    """
    Detect duplicates case-insensitively.
    NOTE: excludes null/empty emails so we only consider real emails.
    """
    return (
        User.objects.exclude(email__isnull=True)
        .exclude(email="")
        .annotate(email_norm=Lower("email"))
        .values("email_norm")
        .annotate(cnt=Count("id"))
        .filter(cnt__gt=1)
        .exists()
    )


def add_unique_email_index(apps, schema_editor):
    """
    Pro SaaS / safe strategy:
    - Never modifies user emails.
    - If duplicates exist -> log + NO-OP (do not create the unique index).
    - Only creates the "LOWER(email)" partial unique index on Postgres/SQLite.
    - For other vendors, skip (safer than creating a potentially breaking index).
    """
    User = _get_user_model(apps)

    if _has_duplicate_emails(User):
        logger.warning(
            "Duplicate emails detected (case-insensitive). Skipping unique index creation for %s. "
            "Resolve duplicates first (see RUNBOOK) then re-run migrations / apply index manually.",
            User._meta.db_table,
        )
        return

    table = User._meta.db_table
    index_name = f"{table}_email_lower_uniq"
    q_table = schema_editor.quote_name(table)
    q_index = schema_editor.quote_name(index_name)

    vendor = schema_editor.connection.vendor

    # ✅ Supported & safe: Postgres/SQLite
    if vendor in ("postgresql", "sqlite"):
        schema_editor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {q_index} "
            f"ON {q_table} (LOWER(email)) "
            "WHERE email IS NOT NULL AND email <> ''"
        )
        return

    # ⚠️ Other vendors (MySQL/MariaDB/etc.)
    # Creating an equivalent safe unique + case-insensitive + non-empty index is vendor-specific.
    # To avoid breaking production unexpectedly, we skip here.
    logger.warning(
        "Skipping unique email index creation for unsupported DB vendor '%s' on table %s. "
        "Use Postgres/SQLite or implement a vendor-specific strategy (e.g. generated lower column).",
        vendor,
        table,
    )


def remove_unique_email_index(apps, schema_editor):
    """
    Reverse: drop the index (vendor-aware).
    - Postgres/SQLite: DROP INDEX IF EXISTS <index>
    - MySQL: DROP INDEX <index> ON <table>
    - Others: best-effort attempt + warning
    """
    User = _get_user_model(apps)
    table = User._meta.db_table
    index_name = f"{table}_email_lower_uniq"

    vendor = schema_editor.connection.vendor
    q_table = schema_editor.quote_name(table)
    q_index = schema_editor.quote_name(index_name)

    try:
        if vendor in ("postgresql", "sqlite"):
            schema_editor.execute(f"DROP INDEX IF EXISTS {q_index}")
        elif vendor in ("mysql", "mariadb"):
            # MySQL syntax requires table name.
            schema_editor.execute(f"DROP INDEX {q_index} ON {q_table}")
        else:
            # Best-effort: try Postgres-like drop
            schema_editor.execute(f"DROP INDEX IF EXISTS {q_index}")
    except Exception as exc:
        logger.warning(
            "Failed to drop unique email index %s on %s for vendor '%s': %s",
            index_name,
            table,
            vendor,
            exc,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0016_normalize_emails_and_service_types"),
    ]

    operations = [
        migrations.RunPython(add_unique_email_index, reverse_code=remove_unique_email_index),
    ]