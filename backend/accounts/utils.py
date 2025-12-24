# Deployed backend: https://inventory-tool-plage.onrender.com
from copy import deepcopy

from django.utils.text import slugify
from rest_framework import exceptions

from accounts.models import Tenant, UserProfile, Service, Membership


def _base_features():
    return {
        "barcode": {"enabled": True, "recommended": True},
        "sku": {"enabled": True, "recommended": False},
        "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
        "dlc": {"enabled": True, "recommended": False},
        "tva": {"enabled": False, "recommended": False},
        "suppliers": {"enabled": False},
        "lot": {"enabled": False, "recommended": False},
        "multi_unit": {"enabled": False, "recommended": False},
        "variants": {"enabled": False, "recommended": False},
        "open_container_tracking": {"enabled": False},
        "item_type": {"enabled": False, "recommended": False},
    }


def _merge_features(base: dict, overrides: dict) -> dict:
    out = deepcopy(base)
    for k, v in (overrides or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = deepcopy(v)
    return out


def apply_service_preset(service_type: str, domain: str = None):
    base = _base_features()

    presets = {
        "grocery_food": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": True},
                    "sku": {"enabled": False, "recommended": False},
                    "dlc": {"enabled": True, "recommended": True},
                    "multi_unit": {"enabled": True, "recommended": False},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        "bulk_food": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": False},
                    "multi_unit": {"enabled": True, "recommended": True},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        "bar": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": True},
                    "sku": {"enabled": False, "recommended": False},
                    "prices": {"purchase_enabled": True, "selling_enabled": False, "recommended": False},
                    "dlc": {"enabled": True, "recommended": False},
                    "lot": {"enabled": True, "recommended": True},
                    "multi_unit": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        "kitchen": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": False},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": False},
                    "lot": {"enabled": True, "recommended": False},
                    "multi_unit": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "item_type": {"enabled": True, "recommended": True},
                    "tva": {"enabled": False, "recommended": False},
                },
            ),
        },
        "retail_general": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": False, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": False, "recommended": False},
                    "variants": {"enabled": True, "recommended": True},
                    "open_container_tracking": {"enabled": False},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        "pharmacy_parapharmacy": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": True},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": True},
                    "lot": {"enabled": True, "recommended": True},
                    "open_container_tracking": {"enabled": False},
                    "tva": {"enabled": True, "recommended": True},
                    "suppliers": {"enabled": True},
                },
            ),
        },
        "bakery": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": True},
                    "lot": {"enabled": True, "recommended": True},
                    "multi_unit": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "item_type": {"enabled": True, "recommended": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        "restaurant_dining": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": False},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": True},
                    "lot": {"enabled": True, "recommended": False},
                    "multi_unit": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "item_type": {"enabled": True, "recommended": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
    }

    preset = presets.get(service_type) or {"counting_mode": "unit", "features": deepcopy(base)}

    if domain == "general":
        preset = deepcopy(preset)
        preset["features"] = deepcopy(preset.get("features") or {})
        preset["features"]["dlc"] = {"enabled": False, "recommended": False}
        preset["features"]["open_container_tracking"] = {"enabled": False}

    return preset


def get_or_create_default_tenant():
    tenant = Tenant.objects.first()
    if tenant is None:
        tenant = Tenant.objects.create(name="Default Tenant", domain="food")
    return tenant


def get_tenant_for_request(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return get_or_create_default_tenant()

    profile = getattr(user, "profile", None)
    if profile:
        return profile.tenant

    tenant = get_or_create_default_tenant()
    UserProfile.objects.create(user=user, tenant=tenant, role="owner")
    return tenant


def get_default_service(tenant: Tenant):
    service, _ = Service.objects.get_or_create(
        tenant=tenant,
        name="Principal",
        defaults={"slug": slugify("Principal")},
    )
    return service


def _membership_has_status_field() -> bool:
    try:
        return any(f.name == "status" for f in Membership._meta.fields)
    except Exception:
        return False


def _get_membership_for_tenant(user, tenant: Tenant):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    qs = Membership.objects.filter(user=user, tenant=tenant).select_related("service")
    if _membership_has_status_field():
        qs = qs.filter(status="ACTIVE")
    return qs.first()


def get_user_role(request):
    """
    ✅ Règle: le compte principal est piloté par UserProfile.
    - Si profile existe sur le tenant, on renvoie owner/manager si dispo,
      sinon fallback owner.
    - Sinon on se base sur Membership (ACTIVE si champ status existe).
    """
    user = getattr(request, "user", None)
    tenant = get_tenant_for_request(request)

    if not user or not user.is_authenticated:
        return "operator"

    profile = getattr(user, "profile", None)
    if profile and profile.tenant_id == tenant.id:
        role = (profile.role or "").strip().lower()
        if role in ("owner", "manager"):
            return role
        return "owner"

    m = _get_membership_for_tenant(user, tenant)
    if m:
        return m.role

    return "operator"


def _extract_service_id_from_headers(request):
    """
    Front envoie X-Service-Id pour fixer le contexte service.
    Supporte aussi X-Service (fallback).
    """
    raw = (
        request.headers.get("X-Service-Id")
        or request.headers.get("X-Service")
        or request.META.get("HTTP_X_SERVICE_ID")
        or request.META.get("HTTP_X_SERVICE")
    )
    if raw is None:
        return None
    raw = str(raw).strip()
    if not raw:
        return None
    return raw


def get_service_from_request(request):
    """
    ✅ IMPORTANT (scope service):
    - owner => libre via ?service= / body / header X-Service-Id
    - non-owner + membership ACTIVE + membership.service défini => service forcé
    - sinon => ?service= / body / header, ou Principal
    """
    tenant = get_tenant_for_request(request)
    user = getattr(request, "user", None)

    role = get_user_role(request)
    membership = _get_membership_for_tenant(user, tenant)

    # 1) service demandé (query/body/header)
    service_id = request.query_params.get("service") or (
        request.data.get("service") if hasattr(request, "data") else None
    )
    if not service_id:
        service_id = _extract_service_id_from_headers(request)

    # Si "all" (mode lecture), on ne peut pas sélectionner un service concret => fallback
    if service_id and str(service_id).lower() == "all":
        service_id = None

    # 2) membership scope forcé
    if role != "owner" and membership and membership.service_id:
        forced = membership.service
        if service_id and str(service_id) != str(forced.id):
            raise exceptions.PermissionDenied("Accès limité : vous n'avez pas accès à ce service.")
        return forced

    # 3) owner / manager: utiliser service demandé si présent
    if service_id:
        try:
            return Service.objects.get(id=service_id, tenant=tenant)
        except (Service.DoesNotExist, ValueError, TypeError):
            pass

    # 4) fallback
    return get_default_service(tenant)