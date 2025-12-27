import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product
from .factories import TenantFactory, UserFactory


@pytest.mark.django_db
def test_product_conversion_fields_in_response():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Bottle",
        inventory_month="2025-01",
        quantity=2,
        unit="pcs",
        conversion_unit="l",
        conversion_factor="0.75",
        variant_name="Taille",
        variant_value="M",
    )

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get(f"/api/products/?month=2025-01&service={service.id}")
    assert res.status_code == 200
    data = res.json()
    assert data[0]["converted_unit"] == "l"
    assert data[0]["converted_quantity"] == pytest.approx(1.5)
    assert data[0]["variant_name"] == "Taille"
    assert data[0]["variant_value"] == "M"
