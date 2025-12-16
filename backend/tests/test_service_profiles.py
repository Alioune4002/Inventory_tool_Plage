import pytest
from rest_framework.test import APIClient

from accounts.models import Service
from accounts.utils import apply_service_preset
from tests.factories import UserFactory, TenantFactory


def create_service_with_preset(tenant, service_type, name):
    preset = apply_service_preset(service_type)
    return Service.objects.create(
        tenant=tenant,
        name=name,
        service_type=service_type,
        counting_mode=preset.get("counting_mode", "unit"),
        features=preset.get("features", {}),
    )


@pytest.mark.django_db
def test_product_creation_kitchen_without_prices_ok():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = create_service_with_preset(tenant, "kitchen", "Cuisine")

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "name": "Plat du jour",
        "inventory_month": "2025-12",
        "quantity": 2,
        "service": service.id,
        "unit": "kg",
    }
    res = client.post("/api/products/", payload, format="json")
    assert res.status_code == 201
    data = res.json()
    assert data.get("purchase_price") is None
    assert data.get("selling_price") is None
    assert isinstance(data.get("warnings", []), list)


@pytest.mark.django_db
def test_product_retail_without_identifier_returns_warnings():
    tenant = TenantFactory(domain="general")
    user = UserFactory(profile=tenant)
    service = create_service_with_preset(tenant, "retail_general", "Boutique")

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "name": "Collier",
        "inventory_month": "2025-12",
        "quantity": 1,
        "service": service.id,
        "unit": "pcs",
    }
    res = client.post("/api/products/", payload, format="json")
    assert res.status_code == 201
    warnings = res.json().get("warnings", [])
    assert any("Aucun identifiant" in w for w in warnings)
    assert any("Prix d'achat manquant" in w for w in warnings)
