from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product
from .factories import TenantFactory, UserFactory


@pytest.mark.django_db
def test_solo_retention_filters_old_products():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    old_product = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Old",
        inventory_month="2025-01",
        quantity=1,
    )
    Product.objects.filter(id=old_product.id).update(created_at=timezone.now() - timedelta(days=20))

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Fresh",
        inventory_month="2025-01",
        quantity=1,
    )

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get(f"/api/products/?month=2025-01&service={service.id}")
    assert res.status_code == 200
    names = [p["name"] for p in res.json()]
    assert "Fresh" in names
    assert "Old" not in names
