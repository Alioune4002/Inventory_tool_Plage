import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Plan, Tenant, Service, UserProfile
from ai_assistant.models import AIRequestEvent
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_ai_quota_monthly_limit(settings):
    settings.AI_ENABLED = True
    User = get_user_model()

    tenant = Tenant.objects.create(name="AI Tenant", domain="food")
    plan, _ = Plan.objects.get_or_create(code="BOUTIQUE", defaults={"name": "Duo"})
    tenant.plan = plan
    tenant.license_expires_at = timezone.now() + timedelta(days=30)
    tenant.save(update_fields=["plan", "license_expires_at"])

    user = User.objects.create_user(username="aiuser", password="pwd")
    UserProfile.objects.create(user=user, tenant=tenant)
    Service.objects.create(tenant=tenant, name="Principal")

    AIRequestEvent.objects.bulk_create(
        [
            AIRequestEvent(tenant=tenant, user=user, scope="inventory", mode="light")
            for _ in range(15)
        ]
    )

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    res = client.post("/api/ai/assistant/", data={"scope": "inventory"}, format="json")
    assert res.status_code == 403
    assert res.data.get("code") == "LIMIT_AI_REQUESTS_MONTH"
