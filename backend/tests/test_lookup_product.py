import pytest
import urllib.error
import urllib.request

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from django.utils import timezone
from accounts.models import Service
from products.models import Product
from .factories import TenantFactory, UserFactory


@pytest.mark.django_db
def test_lookup_product_history_limit():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    barcode = "123456"
    today = timezone.now().date()
    year = today.year
    month = today.month - 19
    while month <= 0:
        month += 12
        year -= 1
    for i in range(20):
        inventory_month = f"{year:04d}-{month:02d}"
        Product.objects.create(
            tenant=tenant,
            service=service,
            name=f"Product {i}",
            barcode=barcode,
            inventory_month=inventory_month,
            quantity=1,
        )
        month += 1
        if month > 12:
            month = 1
            year += 1

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get(f"/api/products/lookup/?barcode={barcode}&history_limit=5")
    assert res.status_code == 200
    assert res.data["found"] is True
    assert len(res.data["history"]) == 5


@pytest.mark.django_db
def test_lookup_product_non_food_returns_200():
    tenant = TenantFactory(domain="general")
    user = UserFactory(profile=tenant)
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    res = client.get("/api/products/lookup/?barcode=9999")
    assert res.status_code == 200
    assert res.data["found"] is False


@pytest.mark.django_db
def test_lookup_product_off_down_returns_message(monkeypatch):
    tenant = TenantFactory(domain="food")
    user = UserFactory(profile=tenant)
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _raise(*args, **kwargs):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(urllib.request, "urlopen", _raise)

    res = client.get("/api/products/lookup/?barcode=9999")
    assert res.status_code == 200
    assert res.data["found"] is False
    assert "off_error" in res.data
