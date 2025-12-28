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
def test_labels_pdf_generates_sku_and_enforces_quota():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Produit sans code",
        inventory_month="2025-01",
        quantity=1,
        barcode="",
        internal_sku="",
    )

    client = _auth_client(user)
    res1 = client.get(f"/api/labels/pdf/?service={service.id}&ids={product.id}")
    assert res1.status_code == 200
    assert res1["Content-Type"].startswith("application/pdf")

    product.refresh_from_db()
    assert product.internal_sku

    res2 = client.get(f"/api/labels/pdf/?service={service.id}&ids={product.id}")
    assert res2.status_code == 200

    res3 = client.get(f"/api/labels/pdf/?service={service.id}&ids={product.id}")
    assert res3.status_code == 403
    assert res3.data.get("code") == "LIMIT_LABELS_PDF_MONTH"
