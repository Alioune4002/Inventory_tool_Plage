import io
from datetime import timedelta

import openpyxl
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
@pytest.mark.parametrize("plan_code", ["ESSENTIEL", "BOUTIQUE"])
def test_export_summary_requires_reports_advanced(plan_code):
    tenant = TenantFactory()
    _set_plan(tenant, plan_code)
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="SumTest",
        inventory_month="2025-05",
        quantity=1,
    )

    client = _auth_client(user)
    payload = {
        "service": service.id,
        "format": "xlsx",
        "include_summary": True,
        "include_charts": True,
    }
    res = client.post("/api/export-advanced/", payload, format="json")
    assert res.status_code == 403
    assert res.data.get("code") == "FEATURE_NOT_INCLUDED"


@pytest.mark.django_db
def test_export_summary_allowed_for_multi():
    tenant = TenantFactory()
    _set_plan(tenant, "PRO")
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    Product.objects.create(
        tenant=tenant,
        service=service,
        name="SumTest",
        inventory_month="2025-05",
        quantity=1,
        purchase_price="2.00",
        selling_price="3.00",
    )

    client = _auth_client(user)
    payload = {
        "service": service.id,
        "format": "xlsx",
        "include_summary": True,
        "include_charts": True,
    }
    res = client.post("/api/export-advanced/", payload, format="json")
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    assert "Synthèse" in wb.sheetnames
