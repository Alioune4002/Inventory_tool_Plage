import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import TenantFactory, UserFactory, ProductFactory


@pytest.fixture
def client_with_user():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client, tenant, user


@pytest.mark.django_db
def test_create_and_list_products(client_with_user):
    client, tenant, _ = client_with_user
    res = client.post(
        "/api/products/",
        {
            "name": "Cola",
            "category": "sec",
            "purchase_price": "1.00",
            "selling_price": "2.00",
            "quantity": 5,
            "barcode": "999",
            "inventory_month": "2025-02",
            "service": tenant.services.first().id,
        },
        format="json",
    )
    assert res.status_code == 201
    res_list = client.get(f"/api/products/?month=2025-02&service={tenant.services.first().id}")
    assert res_list.status_code == 200
    assert any(p["name"] == "Cola" for p in res_list.json())


@pytest.mark.django_db
def test_update_quantity(client_with_user):
    client, tenant, _ = client_with_user
    product = ProductFactory(tenant=tenant, service=tenant.services.first(), quantity=3, barcode="555", inventory_month="2025-01")
    res = client.patch(
        f"/api/products/{product.id}/",
        {"quantity": 7},
        format="json",
    )
    assert res.status_code == 200
    assert res.json()["quantity"] == 7


@pytest.mark.django_db
def test_stats_return_expected_aggregates(client_with_user):
    client, tenant, _ = client_with_user
    ProductFactory(tenant=tenant, service=tenant.services.first(), quantity=4, purchase_price="2", selling_price="3", barcode="1111", inventory_month="2025-03", category="sec")
    ProductFactory(tenant=tenant, service=tenant.services.first(), quantity=6, purchase_price="1", selling_price="2", barcode="2222", inventory_month="2025-03", category="sec")

    res = client.get(f"/api/inventory-stats/?month=2025-03&service={tenant.services.first().id}")
    assert res.status_code == 200
    data = res.json()
    assert data["total_value"] == 4 * 2 + 6 * 1
    sec_category = next(c for c in data["categories"] if c["category"] == "sec")
    assert sec_category["total_quantity"] == 10


@pytest.mark.django_db
def test_no_barcode_requires_internal_sku(client_with_user):
    client, tenant, _ = client_with_user
    res = client.post(
        "/api/products/",
        {
            "name": "Pain",
            "category": "sec",
            "purchase_price": "0.5",
            "selling_price": "1.0",
            "quantity": 2,
            "inventory_month": "2025-04",
            "no_barcode": True,
            "service": tenant.services.first().id,
        },
        format="json",
    )
    assert res.status_code == 400

    res_ok = client.post(
        "/api/products/",
        {
            "name": "Pain",
            "category": "sec",
            "purchase_price": "0.5",
            "selling_price": "1.0",
            "quantity": 2,
            "inventory_month": "2025-04",
            "no_barcode": True,
            "internal_sku": "pain-001",
            "service": tenant.services.first().id,
        },
        format="json",
    )
    assert res_ok.status_code == 201
