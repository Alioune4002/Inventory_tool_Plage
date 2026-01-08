import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product
from pos.models import PosTicket
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_pos_checkout_success_decrements_stock():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Cafe",
        selling_price="2.50",
        quantity=Decimal("10"),
        inventory_month="2025-01",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/pos/tickets/checkout/",
        {
            "items": [{"product_id": product.id, "qty": "2"}],
            "payments": [{"method": "cash", "amount": "5.00"}],
        },
        format="json",
    )
    assert res.status_code == 200
    product.refresh_from_db()
    assert product.quantity == Decimal("8")
    assert PosTicket.objects.filter(tenant=tenant, service=service).count() == 1


@pytest.mark.django_db
def test_pos_checkout_stock_insufficient_rolls_back():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Sucre",
        selling_price="1.00",
        quantity=Decimal("1"),
        inventory_month="2025-01",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/pos/tickets/checkout/",
        {
            "items": [{"product_id": product.id, "qty": "2"}],
            "payments": [{"method": "cash", "amount": "2.00"}],
        },
        format="json",
    )
    assert res.status_code == 409
    assert res.data.get("code") == "stock_insufficient"
    product.refresh_from_db()
    assert product.quantity == Decimal("1")
    assert PosTicket.objects.count() == 0


@pytest.mark.django_db
def test_pos_checkout_missing_selling_price():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Eau",
        selling_price=None,
        quantity=Decimal("5"),
        inventory_month="2025-01",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/pos/tickets/checkout/",
        {
            "items": [{"product_id": product.id, "qty": "1"}],
            "payments": [{"method": "cash", "amount": "1.00"}],
        },
        format="json",
    )
    assert res.status_code == 400
    assert res.data.get("code") == "missing_selling_price"


@pytest.mark.django_db
def test_pos_checkout_tenant_mismatch_returns_403():
    tenant = TenantFactory()
    other_tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    other_service = Service.objects.get(tenant=other_tenant, name="Principal")
    product = Product.objects.create(
        tenant=other_tenant,
        service=other_service,
        name="The",
        selling_price="1.00",
        quantity=Decimal("5"),
        inventory_month="2025-01",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/pos/tickets/checkout/",
        {
            "items": [{"product_id": product.id, "qty": "1", "unit_price": "1.00"}],
            "payments": [{"method": "cash", "amount": "1.00"}],
        },
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_pos_reports_summary_returns_totals():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Baguette",
        selling_price="1.50",
        quantity=Decimal("10"),
        inventory_month="2025-01",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/pos/tickets/checkout/",
        {
            "items": [{"product_id": product.id, "qty": "2"}],
            "payments": [{"method": "cash", "amount": "3.00"}],
        },
        format="json",
    )
    assert res.status_code == 200

    report = client.get("/api/pos/reports/summary/")
    assert report.status_code == 200
    assert Decimal(report.data.get("total_net")) == Decimal("3.00")
