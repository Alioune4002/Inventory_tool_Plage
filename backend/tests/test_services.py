import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import TenantFactory, UserFactory
from accounts.models import Service, Plan


@pytest.fixture
def auth_client():
    def _build(user):
        client = APIClient()
        token = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client
    return _build


@pytest.mark.django_db
def test_services_list_and_create(auth_client):
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = auth_client(user)

    res_list = client.get("/api/auth/services/")
    assert res_list.status_code == 200
    existing = [s["name"] for s in res_list.json()]
    assert "Principal" in existing

    res_create = client.post("/api/auth/services/", {"name": "Bar"}, format="json")
    assert res_create.status_code == 403
    assert res_create.data.get("code") == "LIMIT_MAX_SERVICES"
    assert not Service.objects.filter(name="Bar", tenant=tenant).exists()


@pytest.mark.django_db
def test_services_create_when_plan_allows(auth_client):
    tenant = TenantFactory()
    plan, _ = Plan.objects.get_or_create(code="BOUTIQUE", defaults={"name": "Duo"})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])
    user = UserFactory(profile=tenant)
    client = auth_client(user)

    res_create = client.post("/api/auth/services/", {"name": "Bar"}, format="json")
    assert res_create.status_code == 201
    assert Service.objects.filter(name="Bar", tenant=tenant).exists()


@pytest.mark.django_db
def test_services_isolation(auth_client):
    tenant_a = TenantFactory(name="A")
    tenant_b = TenantFactory(name="B")
    user_a = UserFactory(profile=tenant_a)
    Service.objects.create(tenant=tenant_b, name="Privé")

    client = auth_client(user_a)
    res_list = client.get("/api/auth/services/")
    assert res_list.status_code == 200
    names = [s["name"] for s in res_list.json()]
    assert "Privé" not in names


@pytest.mark.django_db
def test_delete_blocked_when_products(auth_client):
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.filter(tenant=tenant, name="Principal").first()
    client = auth_client(user)

    # Cannot delete if products linked: simulate by creating one via API to ensure linkage
    prod_res = client.post(
        "/api/products/",
        {
            "name": "Cola",
            "category": "sec",
            "purchase_price": "1.0",
            "selling_price": "2.0",
            "quantity": 1,
            "barcode": "xyz",
            "inventory_month": "2025-01",
            "service": service.id,
        },
        format="json",
    )
    assert prod_res.status_code == 201
    del_res = client.delete(f"/api/auth/services/{service.id}/")
    assert del_res.status_code == 400
    assert Service.objects.filter(id=service.id).exists()
