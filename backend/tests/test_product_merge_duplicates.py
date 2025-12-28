import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product, LossEvent
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_merge_products_archives_duplicates_and_moves_loss():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")

    master = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Farine T55",
        inventory_month="2025-01",
        quantity=5,
        unit="kg",
    )
    duplicate = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Farine T55",
        inventory_month="2025-01",
        quantity=3,
        unit="kg",
    )
    loss = LossEvent.objects.create(
        tenant=tenant,
        service=service,
        product=duplicate,
        occurred_at=timezone.now(),
        inventory_month="2025-01",
        quantity=1,
        unit="kg",
        reason="breakage",
    )

    client = _auth_client(user)
    res = client.post(
        "/api/products/merge/",
        {"master_id": master.id, "merge_ids": [duplicate.id]},
        format="json",
    )

    assert res.status_code == 200

    master.refresh_from_db()
    duplicate.refresh_from_db()
    loss.refresh_from_db()

    assert float(master.quantity) == 8.0
    assert duplicate.is_archived is True
    assert loss.product_id == master.id
