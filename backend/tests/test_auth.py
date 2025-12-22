import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import UserProfile, Tenant
from django.contrib.auth import get_user_model
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
