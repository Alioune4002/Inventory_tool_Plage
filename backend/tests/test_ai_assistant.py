import json
import pytest
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import Tenant, Service, UserProfile
from products.models import Product
from ai_assistant.services.assistant import validate_llm_json, build_context, call_llm, SYSTEM_PROMPT
from products.models import LossEvent


@pytest.mark.django_db
def test_validate_llm_json_fallback():
    data, invalid = validate_llm_json("not a dict")
    assert data["insights"] == []
    assert data["suggested_actions"] == []
    assert data["questions"] == []
    assert invalid is True


@pytest.mark.django_db
def test_validate_llm_json_action_whitelist():
    payload = {
        "message": "ok",
        "insights": [],
        "suggested_actions": [
            {"action_key": "unknown", "label": "nope"},
            {"action_key": "refresh_stats", "label": "Refresh"},
        ],
        "question": None,
    }
    cleaned, invalid = validate_llm_json(payload)
    # only the whitelisted one is kept
    assert len(cleaned["suggested_actions"]) == 1
    assert cleaned["suggested_actions"][0]["endpoint"].startswith("/api/")
    assert invalid is False


@pytest.mark.django_db
def test_ai_assistant_endpoint_returns_200_when_disabled(django_user_model, settings):
    settings.AI_ENABLED = False
    tenant = Tenant.objects.create(name="Test", domain="food")
    user = django_user_model.objects.create_user(username="u1", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    service = Service.objects.create(tenant=tenant, name="Principal")
    Product.objects.create(name="Test", tenant=tenant, service=service, quantity=1, inventory_month="2025-12")

    client = APIClient()
    token = client.post("/api/auth/login/", {"username": "u1", "password": "pwd"}).data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    resp = client.post(
        reverse("ai-assistant"),
        data={"scope": "inventory", "filters": {"service": service.id, "month": "2025-12"}},
        format="json",
    )
    assert resp.status_code == 200
    assert "message" in resp.data


@pytest.mark.django_db
def test_build_context_basic(django_user_model):
    tenant = Tenant.objects.create(name="Test", domain="general")
    user = django_user_model.objects.create_user(username="u2", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    service = Service.objects.create(tenant=tenant, name="Shop", service_type="retail_general")
    Product.objects.create(name="P1", tenant=tenant, service=service, quantity=5, inventory_month="2025-12")
    ctx = build_context(
        user,
        scope="inventory",
        period_start="2025-12",
        period_end="2025-12",
        filters={"service": service.id},
        user_question="Quels modules activer ?",
    )
    assert ctx["inventory_summary"]["total_skus"] == 1
    assert ctx["service"]["id"] == service.id
    assert ctx["user_question"] == "Quels modules activer ?"


@pytest.mark.django_db
def test_validate_llm_json_invalid_schema():
    cleaned, invalid = validate_llm_json({"insights": "bad"})
    assert cleaned["message"].startswith("Assistant IA indisponible")
    assert invalid is True


@pytest.mark.django_db
def test_whitelist_actions_removed():
    data, invalid = validate_llm_json(
        {
            "message": "ok",
            "suggested_actions": [{"action_key": "evil", "label": "hack"}],
        }
    )
    assert data["suggested_actions"] == []
    assert invalid is False


@pytest.mark.django_db
def test_template_losses_response_used(django_user_model):
    tenant = Tenant.objects.create(name="Test", domain="food")
    user = django_user_model.objects.create_user(username="u3", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    service = Service.objects.create(tenant=tenant, name="Cuisine", service_type="kitchen")
    product = Product.objects.create(
        name="P1", tenant=tenant, service=service, quantity=2, inventory_month="2025-12"
    )
    LossEvent.objects.create(
        tenant=tenant,
        service=service,
        product=product,
        occurred_at=timezone.now(),
        quantity=2,
        reason="breakage",
        inventory_month="2025-12",
    )
    ctx = build_context(
        user,
        scope="inventory",
        period_start="2025-12",
        period_end="2025-12",
        filters={"service": service.id, "month": "2025-12"},
        user_question="Où sont mes pertes les plus importantes ?",
        mode="light",
    )
    raw = call_llm(SYSTEM_PROMPT, json.dumps(ctx, ensure_ascii=False), ctx)
    assert raw.get("mode") == "template"
    assert raw.get("analysis")
    assert raw.get("watch_items") is not None
    assert raw.get("actions") is not None
    assert "Question reçue" not in raw.get("analysis", "")


@pytest.mark.django_db
def test_template_modules_response_used(django_user_model):
    tenant = Tenant.objects.create(name="Test", domain="general")
    user = django_user_model.objects.create_user(username="u4", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    service = Service.objects.create(tenant=tenant, name="Boutique", service_type="retail_general")
    Product.objects.create(name="P1", tenant=tenant, service=service, quantity=5, inventory_month="2025-12")
    ctx = build_context(
        user,
        scope="inventory",
        period_start="2025-12",
        period_end="2025-12",
        filters={"service": service.id, "month": "2025-12"},
        user_question="Quels modules dois-je activer ?",
        mode="full",
    )
    raw = call_llm(SYSTEM_PROMPT, json.dumps(ctx, ensure_ascii=False), ctx)
    assert raw.get("mode") == "template"
    assert raw.get("analysis")
    assert raw.get("watch_items") is not None
    assert raw.get("actions") is not None
    assert "Question reçue" not in raw.get("analysis", "")


@pytest.mark.django_db
def test_template_summary_response_used(django_user_model):
    tenant = Tenant.objects.create(name="Test", domain="food")
    user = django_user_model.objects.create_user(username="u5", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    service = Service.objects.create(tenant=tenant, name="Principal", service_type="grocery_food")
    Product.objects.create(name="P1", tenant=tenant, service=service, quantity=1, inventory_month="2025-12")
    ctx = build_context(
        user,
        scope="inventory",
        period_start="2025-12",
        period_end="2025-12",
        filters={"service": service.id, "month": "2025-12"},
        user_question="Peux-tu me faire un résumé mensuel ?",
        mode="light",
    )
    raw = call_llm(SYSTEM_PROMPT, json.dumps(ctx, ensure_ascii=False), ctx)
    assert raw.get("mode") == "template"
    assert raw.get("analysis")
    assert raw.get("watch_items") is not None
    assert raw.get("actions") is not None
    assert "Question reçue" not in raw.get("analysis", "")
