from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Plan, Service
from products.models import Product
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_loss_event_affects_monthly_stats():
    tenant = TenantFactory()
    plan, _ = Plan.objects.get_or_create(code="BOUTIQUE", defaults={"name": "Duo"})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])

    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="PerteTest",
        inventory_month="2025-06",
        quantity=10,
        purchase_price="5.00",
        barcode="LOSS-001",
    )

    client = _auth_client(user)
    occurred_at = timezone.now().replace(year=2025, month=6, day=15)
    res_loss = client.post(
        "/api/losses/",
        {
            "product": product.id,
            "quantity": 2,
            "reason": "breakage",
            "occurred_at": occurred_at.isoformat(),
        },
        format="json",
    )
    assert res_loss.status_code == 201

    res_stats = client.get("/api/inventory-stats/?month=2025-06")
    assert res_stats.status_code == 200
    data = res_stats.json()
    assert data["losses_total_qty"] == 2
    assert data["losses_total_cost"] == 10.0

    by_product = next(p for p in data["by_product"] if p["name"] == "PerteTest")
    assert by_product["losses_qty"] == 2
