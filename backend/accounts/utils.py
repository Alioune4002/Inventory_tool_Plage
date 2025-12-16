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
        "open_container_tracking": {"enabled": False},
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
                {"dlc": {"enabled": True, "recommended": True},
                 "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                 "tva": {"enabled": True, "recommended": False}},
            ),
        },
        "bulk_food": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": True},
                 "dlc": {"enabled": True, "recommended": False},
                 "open_container_tracking": {"enabled": True},
                 "tva": {"enabled": True, "recommended": False}},
            ),
        },
        "bar": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": True},
                 "prices": {"purchase_enabled": True, "selling_enabled": False, "recommended": False},
                 "dlc": {"enabled": True, "recommended": False},
                 "open_container_tracking": {"enabled": True},
                 "tva": {"enabled": True, "recommended": False}},
            ),
        },
        "kitchen": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": False},
                 "prices": {"purchase_enabled": False, "selling_enabled": False, "recommended": False},
                 "dlc": {"enabled": True, "recommended": False},
                 "open_container_tracking": {"enabled": True},
                 "tva": {"enabled": False, "recommended": False}},
            ),
        },
        "retail_general": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": True},
                 "dlc": {"enabled": False, "recommended": False},
                 "open_container_tracking": {"enabled": False},
                 "tva": {"enabled": True, "recommended": False}},
            ),
        },
        "pharmacy_parapharmacy": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": True},
                 "sku": {"enabled": True, "recommended": True},
                 "dlc": {"enabled": True, "recommended": True},
                 "open_container_tracking": {"enabled": False},
                 "tva": {"enabled": True, "recommended": True},
                 "suppliers": {"enabled": True}},
            ),
        },
        "bakery": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": True},
                 "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                 "dlc": {"enabled": True, "recommended": True},
                 "open_container_tracking": {"enabled": False},
                 "tva": {"enabled": True, "recommended": False}},
            ),
        },
        "restaurant_dining": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {"barcode": {"enabled": True, "recommended": False},
                 "sku": {"enabled": True, "recommended": False},
                 "prices": {"purchase_enabled": False, "selling_enabled": False, "recommended": False},
                 "dlc": {"enabled": True, "recommended": True},
                 "open_container_tracking": {"enabled": True},
                 "tva": {"enabled": True, "recommended": False}},
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


def _get_membership_for_tenant(user, tenant: Tenant):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return Membership.objects.filter(user=user, tenant=tenant).select_related("service").first()


def get_service_from_request(request):
    """
    ✅ IMPORTANT (scope service):
    - owner => libre de choisir n'importe quel service du tenant via ?service=
    - non-owner avec membership.service défini => service forcé (Salle only / Cuisine only)
    - non-owner sans scope => comportement historique (param ?service= sinon Principal)
    """
    tenant = get_tenant_for_request(request)
    user = getattr(request, "user", None)

    # owner = pas de restriction
    role = get_user_role(request)
    membership = _get_membership_for_tenant(user, tenant)

    # 🔒 Si scope fixé et non owner => on force le service
    if role != "owner" and membership and membership.service_id:
        forced = membership.service
        # Si le front tente de passer un autre service => interdit
        requested_service_id = request.query_params.get("service") or (request.data.get("service") if hasattr(request, "data") else None)
        if requested_service_id and str(requested_service_id) != str(forced.id):
            raise exceptions.PermissionDenied("Accès limité : vous n'avez pas accès à ce service.")
        return forced

    # sinon comportement normal
    service_id = request.query_params.get("service") or (
        request.data.get("service") if hasattr(request, "data") else None
    )

    if service_id:
        try:
            return Service.objects.get(id=service_id, tenant=tenant)
        except (Service.DoesNotExist, ValueError, TypeError):
            pass

    return get_default_service(tenant)


def get_user_role(request):
    user = getattr(request, "user", None)
    tenant = get_tenant_for_request(request)
    if not user or not user.is_authenticated:
        return "operator"

    membership = getattr(user, "memberships", None)
    if membership:
        m = user.memberships.filter(tenant=tenant).first()
        if m:
            return m.role

    profile = getattr(user, "profile", None)
    if profile and profile.tenant_id == tenant.id:
        return profile.role

    return "operator"