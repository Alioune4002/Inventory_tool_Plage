import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _csv_file():
    content = "name,quantity,unit,barcode\nFarine,2,kg,\n"
    return SimpleUploadedFile("receipt.csv", content.encode("utf-8"), content_type="text/csv")


@pytest.mark.django_db
def test_smoke_auth_inventory_export_receipt_labels():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant, password="password123")
    service = Service.objects.get(tenant=tenant, name="Principal")

    public_client = APIClient()
    login = public_client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "password123"},
        format="json",
    )
    assert login.status_code == 200

    client = _auth_client(user)

    create = client.post(
        "/api/products/",
        {
            "name": "Produit smoke",
            "inventory_month": "2025-01",
            "quantity": 2,
            "service": service.id,
        },
        format="json",
    )
    assert create.status_code == 201
    product_id = create.data.get("id")

    export_csv = client.get(f"/api/exports/?service={service.id}&format=csv")
    assert export_csv.status_code == 200
    assert export_csv["Content-Type"].startswith("text/csv")

    receipt = client.post(
        f"/api/receipts/import/?service={service.id}",
        {"file": _csv_file()},
        format="multipart",
    )
    assert receipt.status_code == 201
    lines = receipt.data.get("lines") or []
    assert lines
    apply_res = client.post(
        f"/api/receipts/{receipt.data.get('receipt_id')}/apply/",
        {"decisions": [{"line_id": lines[0]["id"], "action": "ignore"}]},
        format="json",
    )
    assert apply_res.status_code == 200

    labels = client.get(
        f"/api/labels/pdf/?service={service.id}&ids={product_id}&company_name=Smoke",
    )
    assert labels.status_code == 200
    assert labels["Content-Type"].startswith("application/pdf")
