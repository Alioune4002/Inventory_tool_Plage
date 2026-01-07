import pytest
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import TenantFactory, UserFactory
from products.models import Product, Service


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _inventory_csv():
    content = (
        "designation,quantity,unit,prix_vente,code_barres,sku\n"
        "Pain,2,pcs,3.50,12345,SKU-1\n"
        "Lait,1,l,1.20,,\n"
    )
    return SimpleUploadedFile("inventory.csv", content.encode("utf-8"), content_type="text/csv")


@pytest.mark.django_db
def test_inventory_import_preview_and_commit_set_qty():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    client = _auth_client(user)

    res = client.post(
        f"/api/imports/inventory/preview/?service={service.id}",
        {"file": _inventory_csv()},
        format="multipart",
    )
    assert res.status_code == 200
    preview_id = res.data.get("preview_id")
    assert preview_id

    commit = client.post(
        f"/api/imports/inventory/commit/?service={service.id}",
        {"preview_id": preview_id, "qty_mode": "set"},
        format="json",
    )
    assert commit.status_code == 200
    assert commit.data.get("created_count") == 2

    pain = Product.objects.filter(tenant=tenant, service=service, name="Pain").first()
    lait = Product.objects.filter(tenant=tenant, service=service, name="Lait").first()
    assert pain is not None
    assert lait is not None
    assert pain.quantity == Decimal("2")
    assert lait.quantity == Decimal("1")
    assert pain.selling_price == Decimal("3.50")


@pytest.mark.django_db
def test_inventory_import_row_overrides_apply():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    client = _auth_client(user)

    res = client.post(
        f"/api/imports/inventory/preview/?service={service.id}",
        {"file": _inventory_csv()},
        format="multipart",
    )
    preview_id = res.data.get("preview_id")
    assert preview_id

    commit = client.post(
        f"/api/imports/inventory/commit/?service={service.id}",
        {
            "preview_id": preview_id,
            "qty_mode": "set",
            "row_overrides": {"1": {"quantity": "10"}},
        },
        format="json",
    )
    assert commit.status_code == 200

    pain = Product.objects.filter(tenant=tenant, service=service, name="Pain").first()
    assert pain is not None
    assert pain.quantity == Decimal("10")
