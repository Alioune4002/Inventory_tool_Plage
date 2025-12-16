import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import TenantFactory, UserFactory, ProductFactory


@pytest.fixture
def auth_client():
    def _build(user):
        client = APIClient()
        token = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client
    return _build


@pytest.mark.django_db
def test_user_cannot_see_other_tenant_products(auth_client):
    tenant_a = TenantFactory()
    tenant_b = TenantFactory()
    user_a = UserFactory(profile=tenant_a)
    service_a = tenant_a.services.first()
    service_b = tenant_b.services.first()
    ProductFactory(tenant=tenant_a, service=service_a, name="A-product", barcode="111", inventory_month="2025-01")
    ProductFactory(tenant=tenant_b, service=service_b, name="B-product", barcode="222", inventory_month="2025-01")

    client = auth_client(user_a)
    res = client.get(f"/api/products/?month=2025-01&service={service_a.id}")
    assert res.status_code == 200
    names = [p["name"] for p in res.json()]
    assert "A-product" in names
    assert "B-product" not in names


@pytest.mark.django_db
def test_isolation_on_stats(auth_client):
    tenant_a = TenantFactory()
    tenant_b = TenantFactory()
    user_a = UserFactory(profile=tenant_a)
    service_a = tenant_a.services.first()
    service_b = tenant_b.services.first()
    ProductFactory(tenant=tenant_a, service=service_a, quantity=5, purchase_price="2", selling_price="3", barcode="111", inventory_month="2025-01")
    ProductFactory(tenant=tenant_b, service=service_b, quantity=10, purchase_price="5", selling_price="7", barcode="222", inventory_month="2025-01")

    client = auth_client(user_a)
    res = client.get(f"/api/inventory-stats/?month=2025-01&service={service_a.id}")
    assert res.status_code == 200
    assert res.json()["total_value"] == 10  # 5 * 2


@pytest.mark.django_db
def test_isolation_on_export(auth_client):
    tenant_a = TenantFactory()
    tenant_b = TenantFactory()
    user_a = UserFactory(profile=tenant_a)
    service_a = tenant_a.services.first()
    service_b = tenant_b.services.first()
    ProductFactory(tenant=tenant_a, service=service_a, name="A-product", barcode="111", inventory_month="2025-01")
    ProductFactory(tenant=tenant_b, service=service_b, name="B-product", barcode="222", inventory_month="2025-01")

    client = auth_client(user_a)
    res = client.get(f"/api/export-excel/?month=2025-01&service={service_a.id}")
    assert res.status_code == 200
    assert "spreadsheetml" in res["Content-Type"]
    content = res.content.decode(errors="ignore")
    assert "A-product" in content
    assert "B-product" not in content
