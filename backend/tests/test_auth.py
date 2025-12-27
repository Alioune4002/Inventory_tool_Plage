import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import UserProfile, Tenant, Service
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import Count
from django.db.models.functions import Lower
from .factories import TenantFactory, UserFactory

User = get_user_model()


@pytest.mark.django_db
def test_register_creates_user_and_tenant():
    client = APIClient()
    res = client.post(
        "/api/auth/register/",
        {
            "username": "alice",
            "password": "password123",
            "tenant_name": "Alice Store",
            "domain": "food",
        },
        format="json",
    )
    assert res.status_code == 201
    user = User.objects.get(username="alice")
    assert user.is_active is False
    profile = user.profile
    assert profile.tenant.name == "Alice Store"
    assert res.data["requires_verification"] is True
    assert res.data["email"] == user.email


@pytest.mark.django_db
def test_login_returns_tokens():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = APIClient()
    res = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "password123"},
        format="json",
    )
    assert res.status_code == 200
    assert "access" in res.data and "refresh" in res.data
    assert res.data["tenant"]["id"] == user.profile.tenant.id


@pytest.mark.django_db
def test_login_with_email_unique():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = APIClient()
    res = client.post(
        "/api/auth/login/",
        {"username": user.email, "password": "password123"},
        format="json",
    )
    assert res.status_code == 200
    assert "access" in res.data


def _email_index_name():
    return f"{User._meta.db_table}_email_lower_uniq"


def _drop_email_index():
    index_name = _email_index_name()
    q_index = connection.ops.quote_name(index_name)
    with connection.cursor() as cursor:
        cursor.execute(f"DROP INDEX IF EXISTS {q_index}")


def _create_email_index():
    has_duplicates = (
        User.objects.exclude(email__isnull=True)
        .exclude(email="")
        .annotate(email_norm=Lower("email"))
        .values("email_norm")
        .annotate(cnt=Count("id"))
        .filter(cnt__gt=1)
        .exists()
    )
    if has_duplicates:
        return
    table = User._meta.db_table
    index_name = _email_index_name()
    q_table = connection.ops.quote_name(table)
    q_index = connection.ops.quote_name(index_name)
    if connection.vendor in ("postgresql", "sqlite"):
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE UNIQUE INDEX IF NOT EXISTS {q_index} "
                f"ON {q_table} (LOWER(email)) "
                "WHERE email IS NOT NULL AND email <> ''"
            )
    else:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE UNIQUE INDEX {q_index} ON {q_table} (email)")


@pytest.mark.django_db
def test_login_rejects_duplicate_email():
    _drop_email_index()
    try:
        User.objects.create_user(username="dup1", email="dup@example.com", password="password123")
        User.objects.create_user(username="dup2", email="dup@example.com", password="password123")
        client = APIClient()
        res = client.post(
            "/api/auth/login/",
            {"username": "dup@example.com", "password": "password123"},
            format="json",
        )
        assert res.status_code in (400, 401)
        detail = res.data.get("detail")
        code = getattr(detail, "code", None) or res.data.get("code")
        assert code == "email_not_unique"
    finally:
        User.objects.filter(email__iexact="dup@example.com").delete()
        _create_email_index()


@pytest.mark.django_db
def test_me_returns_user_and_tenant():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["tenant"]["id"] == tenant.id
    assert res.data["username"] == user.username


@pytest.mark.django_db
def test_register_with_extra_services_valid_types():
    client = APIClient()
    payload = {
        "username": "bruno",
        "password": "password123",
        "tenant_name": "Bruno Store",
        "domain": "food",
        "service_type": "kitchen",
        "service_name": "Cuisine",
        "extra_services": [{"name": "Salle", "service_type": "restaurant_dining"}],
    }
    res = client.post("/api/auth/register/", payload, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_register_rejects_invalid_extra_service_type():
    client = APIClient()
    payload = {
        "username": "sara",
        "password": "password123",
        "tenant_name": "Sara Store",
        "domain": "food",
        "extra_services": [{"name": "Salle", "service_type": "dining"}],
    }
    res = client.post("/api/auth/register/", payload, format="json")
    assert res.status_code == 400
