import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import UserProfile
from admin_dashboard.models import AdminVisitEvent
from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_admin_users_requires_staff():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = _auth_client(user)
    res = client.get("/api/admin/users/")
    assert res.status_code == 403


@pytest.mark.django_db
def test_admin_disable_and_soft_delete():
    tenant = TenantFactory()
    staff = UserFactory(profile=tenant, is_staff=True)
    target = UserFactory(profile=tenant)
    client = _auth_client(staff)

    disable = client.post(f"/api/admin/users/{target.id}/disable/")
    assert disable.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False

    soft = client.post(f"/api/admin/users/{target.id}/soft-delete/")
    assert soft.status_code == 200
    profile = UserProfile.objects.get(user=target)
    assert profile.deleted_at is not None


@pytest.mark.django_db
def test_admin_users_requires_auth():
    client = APIClient()
    res = client.get("/api/admin/users/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_track_visit_valid_and_dedup():
    client = APIClient()
    res1 = client.post("/api/admin/track-visit/", {"page": "pos"}, format="json")
    assert res1.status_code == 200
    res2 = client.post("/api/admin/track-visit/", {"page": "pos"}, format="json")
    assert res2.status_code == 200
    assert AdminVisitEvent.objects.filter(page="pos").count() == 1


@pytest.mark.django_db
def test_track_visit_invalid_page():
    client = APIClient()
    res = client.post("/api/admin/track-visit/", {"page": "unknown"}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
@override_settings(ADMIN_VISIT_THROTTLE_RATE="2/min")
def test_track_visit_throttle():
    client = APIClient()
    client.post("/api/admin/track-visit/", {"page": "landing"}, format="json")
    client.post("/api/admin/track-visit/", {"page": "landing"}, format="json")
    res = client.post("/api/admin/track-visit/", {"page": "landing"}, format="json")
    assert res.status_code == 429


@pytest.mark.django_db
def test_soft_deleted_user_cannot_login():
    tenant = TenantFactory()
    staff = UserFactory(profile=tenant, is_staff=True)
    target = UserFactory(profile=tenant, password="password123")
    client = _auth_client(staff)
    client.post(f"/api/admin/users/{target.id}/soft-delete/")

    auth_client = APIClient()
    res = auth_client.post(
        "/api/auth/login/",
        {"username": target.username, "password": "password123"},
        format="json",
    )
    assert res.status_code in (400, 401)


@pytest.mark.django_db
def test_csv_exports_require_staff():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = _auth_client(user)
    res_users = client.get("/api/admin/users/export.csv")
    res_visits = client.get("/api/admin/visits/export.csv")
    assert res_users.status_code == 403
    assert res_visits.status_code == 403


@pytest.mark.django_db
def test_csv_exports_for_staff():
    tenant = TenantFactory()
    staff = UserFactory(profile=tenant, is_staff=True)
    client = _auth_client(staff)
    AdminVisitEvent.objects.create(page="landing", ip_hash="ip", ua_hash="ua")

    res_users = client.get("/api/admin/users/export.csv")
    assert res_users.status_code == 200
    assert res_users["Content-Type"].startswith("text/csv")
    assert res_users.content

    res_visits = client.get("/api/admin/visits/export.csv")
    assert res_visits.status_code == 200
    assert res_visits["Content-Type"].startswith("text/csv")
    assert res_visits.content
