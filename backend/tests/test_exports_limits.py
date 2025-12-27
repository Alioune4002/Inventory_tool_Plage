import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_export_csv_monthly_limit():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Test",
        inventory_month="2025-01",
        quantity=1,
    )

    client = _auth_client(user)
    payload = {
        "service": service.id,
        "format": "csv",
        "include_summary": False,
        "include_charts": False,
    }
    res1 = client.post("/api/export-advanced/", payload, format="json")
    assert res1.status_code == 200

    res2 = client.post("/api/export-advanced/", payload, format="json")
    assert res2.status_code == 403
    assert res2.data.get("code") == "LIMIT_EXPORT_CSV_MONTH"


@pytest.mark.django_db
def test_export_xlsx_monthly_limit():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Test",
        inventory_month="2025-01",
        quantity=1,
    )

    client = _auth_client(user)
    res1 = client.get("/api/export-excel/?month=2025-01")
    assert res1.status_code == 200

    res2 = client.get("/api/export-excel/?month=2025-01")
    assert res2.status_code == 403
    assert res2.data.get("code") == "LIMIT_EXPORT_XLSX_MONTH"


@pytest.mark.django_db
def test_export_global_service_all_csv_limit():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service_main = Service.objects.get(tenant=tenant, name="Principal")
    service_two = Service.objects.create(tenant=tenant, name="Secondaire")

    Product.objects.create(
        tenant=tenant,
        service=service_main,
        name="Test A",
        inventory_month="2025-01",
        quantity=1,
    )
    Product.objects.create(
        tenant=tenant,
        service=service_two,
        name="Test B",
        inventory_month="2025-01",
        quantity=2,
    )

    client = _auth_client(user)
    res1 = client.get("/api/exports/?service=all&format=csv")
    assert res1.status_code == 200
    content = res1.content.decode("utf-8-sig")
    assert "Month" in content
    assert "Test A" in content
    assert "Test B" in content

    res2 = client.get("/api/exports/?service=all&format=csv")
    assert res2.status_code == 403
    assert res2.data.get("code") == "LIMIT_EXPORT_CSV_MONTH"
