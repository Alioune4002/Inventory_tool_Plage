import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Plan
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_entitlements_use_active_subscription_when_no_expiry():
    tenant = TenantFactory()
    plan, _ = Plan.objects.get_or_create(code="PRO", defaults={"name": "PRO"})
    tenant.plan = plan
    tenant.plan_source = "PAID"
    tenant.subscription_status = "ACTIVE"
    tenant.license_expires_at = None
    tenant.save(update_fields=["plan", "plan_source", "subscription_status", "license_expires_at"])

    user = UserFactory(profile=tenant)
    client = _auth_client(user)

    res = client.get("/api/auth/me/org/entitlements")
    assert res.status_code == 200
    assert res.data.get("plan_effective") == "PRO"
    assert res.data.get("entitlements", {}).get("reports_advanced") is True
