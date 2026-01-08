import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Service
from products.models import Product
from pos.models import PosTicket
from kds.models import MenuItem, RecipeItem, StockConsumption, WasteEvent
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _enable_kds(service):
    features = service.features or {}
    features["kds"] = {"enabled": True, "recommended": True}
    service.features = features
    service.save(update_fields=["features"])


@pytest.mark.django_db
def test_kds_send_order_decrements_stock_and_consumes():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    ingredient = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Tomate",
        quantity=Decimal("10"),
        selling_price=Decimal("1.00"),
        inventory_month="2025-01",
    )
    menu_item = MenuItem.objects.create(
        tenant=tenant,
        service=service,
        name="Salade",
        price=Decimal("5.00"),
    )
    RecipeItem.objects.create(menu_item=menu_item, ingredient_product=ingredient, qty=Decimal("2"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": menu_item.id, "qty": "3"}]},
        format="json",
    )
    assert res.status_code == 201
    order_id = res.data["id"]

    send = client.post(f"/api/kds/orders/{order_id}/send/", {}, format="json")
    assert send.status_code == 200
    ingredient.refresh_from_db()
    assert ingredient.quantity == Decimal("4")
    assert StockConsumption.objects.filter(reason="ORDER_SENT").count() == 1


@pytest.mark.django_db
def test_kds_stock_insufficient_rolls_back():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    ingredient = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Fromage",
        quantity=Decimal("1"),
        selling_price=Decimal("1.00"),
        inventory_month="2025-01",
    )
    menu_item = MenuItem.objects.create(
        tenant=tenant,
        service=service,
        name="Croque",
        price=Decimal("6.00"),
    )
    RecipeItem.objects.create(menu_item=menu_item, ingredient_product=ingredient, qty=Decimal("2"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": menu_item.id, "qty": "1"}]},
        format="json",
    )
    order_id = res.data["id"]

    send = client.post(f"/api/kds/orders/{order_id}/send/", {}, format="json")
    assert send.status_code == 409
    ingredient.refresh_from_db()
    assert ingredient.quantity == Decimal("1")
    assert StockConsumption.objects.count() == 0


@pytest.mark.django_db
def test_kds_cross_tenant_menu_denied():
    tenant = TenantFactory()
    other_tenant = TenantFactory()
    user = UserFactory(profile=tenant)

    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    other_service = Service.objects.get(tenant=other_tenant, name="Principal")
    MenuItem.objects.create(tenant=other_tenant, service=other_service, name="Plat X", price=Decimal("9.00"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": MenuItem.objects.filter(tenant=other_tenant).first().id, "qty": "1"}]},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_kds_cancel_draft_no_stock_change():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    ingredient = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Oeuf",
        quantity=Decimal("5"),
        selling_price=Decimal("1.00"),
        inventory_month="2025-01",
    )
    menu_item = MenuItem.objects.create(tenant=tenant, service=service, name="Omelette", price=Decimal("4.00"))
    RecipeItem.objects.create(menu_item=menu_item, ingredient_product=ingredient, qty=Decimal("1"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": menu_item.id, "qty": "1"}]},
        format="json",
    )
    order_id = res.data["id"]

    cancel = client.post(
        f"/api/kds/orders/{order_id}/cancel/",
        {"reason_code": "cancelled"},
        format="json",
    )
    assert cancel.status_code == 200
    ingredient.refresh_from_db()
    assert ingredient.quantity == Decimal("5")
    assert WasteEvent.objects.count() == 0


@pytest.mark.django_db
def test_kds_cancel_after_sent_creates_waste():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    ingredient = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Poulet",
        quantity=Decimal("10"),
        selling_price=Decimal("1.00"),
        inventory_month="2025-01",
    )
    menu_item = MenuItem.objects.create(tenant=tenant, service=service, name="Poulet", price=Decimal("8.00"))
    RecipeItem.objects.create(menu_item=menu_item, ingredient_product=ingredient, qty=Decimal("2"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": menu_item.id, "qty": "1"}]},
        format="json",
    )
    order_id = res.data["id"]
    client.post(f"/api/kds/orders/{order_id}/send/", {}, format="json")

    cancel = client.post(
        f"/api/kds/orders/{order_id}/cancel/",
        {"reason_code": "breakage", "reason_text": "Brulé"},
        format="json",
    )
    assert cancel.status_code == 200
    assert WasteEvent.objects.count() == 1
    assert StockConsumption.objects.filter(reason="WASTE").count() == 1


@pytest.mark.django_db
def test_kds_mark_paid_creates_pos_ticket():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    service = Service.objects.get(tenant=tenant, name="Principal")
    _enable_kds(service)

    ingredient = Product.objects.create(
        tenant=tenant,
        service=service,
        name="Pate",
        quantity=Decimal("10"),
        selling_price=Decimal("1.00"),
        inventory_month="2025-01",
    )
    menu_item = MenuItem.objects.create(tenant=tenant, service=service, name="Pates", price=Decimal("7.00"))
    RecipeItem.objects.create(menu_item=menu_item, ingredient_product=ingredient, qty=Decimal("1"))

    client = _auth_client(user)
    res = client.post(
        "/api/kds/orders/",
        {"lines": [{"menu_item_id": menu_item.id, "qty": "1"}]},
        format="json",
    )
    order_id = res.data["id"]
    client.post(f"/api/kds/orders/{order_id}/send/", {}, format="json")
    ingredient.refresh_from_db()
    assert ingredient.quantity == Decimal("9")

    paid = client.post(
        f"/api/kds/pos/orders/{order_id}/mark-paid/",
        {"payments": [{"method": "card", "amount": "7.00"}]},
        format="json",
    )
    assert paid.status_code == 200
    assert PosTicket.objects.filter(tenant=tenant, service=service).count() == 1
    ingredient.refresh_from_db()
    assert ingredient.quantity == Decimal("9")
