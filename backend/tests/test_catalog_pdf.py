from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Plan, Service
from products.models import Product
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _set_plan(tenant, code):
    plan, _ = Plan.objects.get_or_create(code=code, defaults={"name": code})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])


@pytest.mark.django_db
def test_catalog_pdf_solo_quota():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Test PDF",
        inventory_month="2025-01",
        quantity=1,
    )

    client = _auth_client(user)
    res1 = client.get(f"/api/catalog/pdf/?service={service.id}")
    assert res1.status_code == 200
    assert res1["Content-Type"].startswith("application/pdf")

    res2 = client.get(f"/api/catalog/pdf/?service={service.id}")
    assert res2.status_code == 403
    assert res2.data.get("code") == "LIMIT_PDF_CATALOG_MONTH"


@pytest.mark.django_db
def test_catalog_pdf_duo_limit():
    tenant = TenantFactory()
    _set_plan(tenant, "BOUTIQUE")
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Test PDF",
        inventory_month="2025-01",
        quantity=1,
    )

    client = _auth_client(user)
    for _ in range(5):
        res = client.get(f"/api/catalog/pdf/?service={service.id}")
        assert res.status_code == 200

    res6 = client.get(f"/api/catalog/pdf/?service={service.id}")
    assert res6.status_code == 403
    assert res6.data.get("code") == "LIMIT_PDF_CATALOG_MONTH"


@pytest.mark.django_db
def test_catalog_pdf_multi_unlimited():
    tenant = TenantFactory()
    _set_plan(tenant, "PRO")
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    Product.objects.create(
        tenant=tenant,
        service=service,
        name="Test PDF",
        inventory_month="2025-01",
        quantity=1,
    )

    client = _auth_client(user)
    for _ in range(3):
        res = client.get(f"/api/catalog/pdf/?service={service.id}")
        assert res.status_code == 200
        assert res["Content-Type"].startswith("application/pdf")
