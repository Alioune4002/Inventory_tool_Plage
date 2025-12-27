import importlib

import pytest
from django.contrib.auth import get_user_model

from .factories import TenantFactory, UserFactory


@pytest.mark.django_db
def test_has_duplicate_emails_case_insensitive():
    tenant = TenantFactory()
    UserFactory(email="Test@Example.com", profile=tenant)
    UserFactory(email="test@example.com", profile=tenant)

    User = get_user_model()
    migration = importlib.import_module("accounts.migrations.0017_unique_email_index")
    _has_duplicate_emails = migration._has_duplicate_emails
    assert _has_duplicate_emails(User) is True
