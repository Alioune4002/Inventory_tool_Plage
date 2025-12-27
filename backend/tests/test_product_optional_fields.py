import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_create_update_variants_lot_opened_fields():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    client = _auth_client(user)

    res = client.post(
        "/api/products/",
        {
            "name": "Tee",
            "category": "mode",
            "quantity": 3,
            "barcode": "OPT-001",
            "inventory_month": "2025-06",
            "variant_name": "Taille",
            "variant_value": "M",
            "lot_number": "LOT-001",
            "container_status": "OPENED",
            "remaining_fraction": "0.5",
            "service": service.id,
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data.get("variant_name") == "Taille"
    assert res.data.get("variant_value") == "M"
    assert res.data.get("lot_number") == "LOT-001"
    assert res.data.get("container_status") == "OPENED"

    res_update = client.patch(
        f"/api/products/{res.data['id']}/",
        {"variant_value": "L", "lot_number": "LOT-002"},
        format="json",
    )
    assert res_update.status_code == 200
    assert res_update.data.get("variant_value") == "L"
    assert res_update.data.get("lot_number") == "LOT-002"


@pytest.mark.django_db
def test_export_advanced_includes_variant_lot_opened_fields():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    client = _auth_client(user)

    client.post(
        "/api/products/",
        {
            "name": "Tee",
            "category": "mode",
            "quantity": 3,
            "barcode": "OPT-002",
            "inventory_month": "2025-06",
            "variant_name": "Couleur",
            "variant_value": "Bleu",
            "lot_number": "LOT-009",
            "container_status": "OPENED",
            "remaining_fraction": "0.25",
            "service": service.id,
        },
        format="json",
    )

    payload = {
        "service": service.id,
        "format": "csv",
        "include_summary": False,
        "include_charts": False,
        "fields": ["variant", "variant_name", "variant_value", "lot_number", "container_status", "remaining_fraction"],
    }
    res = client.post("/api/export-advanced/", payload, format="json")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    assert "Variante" in content
    assert "LOT-009" in content
    assert "OPENED" in content
