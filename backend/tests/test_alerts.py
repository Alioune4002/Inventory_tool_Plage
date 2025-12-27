from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Plan, Service
from products.models import Product
from .factories import TenantFactory, UserFactory


@pytest.mark.django_db
def test_alerts_stock_and_expiry():
    tenant = TenantFactory()
    plan, _ = Plan.objects.get_or_create(code="PRO", defaults={"name": "Multi"})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])

    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="LowStock",
        inventory_month="2025-01",
        quantity=1,
        min_qty=5,
    )
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="ExpiringSoon",
        inventory_month="2025-01",
        quantity=1,
        dlc=(timezone.now() + timedelta(days=10)).date(),
        expiry_type="DLC",
    )

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get("/api/alerts/")
    assert res.status_code == 200
    types = {a["type"] for a in res.data.get("results", [])}
    assert "stock_low" in types
    assert "expiry" in types


@pytest.mark.django_db
def test_alerts_no_expiry_for_duo():
    tenant = TenantFactory()
    plan, _ = Plan.objects.get_or_create(code="BOUTIQUE", defaults={"name": "Duo"})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])

    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="LowStock",
        inventory_month="2025-01",
        quantity=1,
        min_qty=5,
    )
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="ExpiringSoon",
        inventory_month="2025-01",
        quantity=1,
        dlc=(timezone.now() + timedelta(days=10)).date(),
        expiry_type="DLC",
    )

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get("/api/alerts/")
    assert res.status_code == 200
    types = {a["type"] for a in res.data.get("results", [])}
    assert "stock_low" in types
    assert "expiry" not in types
