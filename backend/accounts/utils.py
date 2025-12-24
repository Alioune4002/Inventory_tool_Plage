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
    # ✅ compat: certains environnements/tests n'ont pas encore le champ status
    try:
        return any(f.name == "status" for f in Membership._meta.fields)
    except Exception:
        return False


def _get_membership_for_tenant(user, tenant: Tenant):
    """
    ✅ Compat:
    - si Membership.status existe -> on ne prend que ACTIVE
    - sinon -> on prend la membership (legacy)
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None

    qs = Membership.objects.filter(user=user, tenant=tenant).select_related("service")
    if _membership_has_status_field():
        qs = qs.filter(status="ACTIVE")
    return qs.first()


def get_user_role(request):
    """
    ✅ Fix:
    - Priorité au UserProfile (owner/manager/etc.) si présent pour ce tenant
    - Ensuite Membership (ACTIVE si champ status existe)
    - Sinon operator
    """
    user = getattr(request, "user", None)
    tenant = get_tenant_for_request(request)

    if not user or not user.is_authenticated:
        return "operator"

    profile = getattr(user, "profile", None)
    if profile and profile.tenant_id == tenant.id:
        return profile.role or "owner"

    m = _get_membership_for_tenant(user, tenant)
    if m:
        return m.role

    return "operator"


def get_service_from_request(request):
    """
    ✅ IMPORTANT (scope service):
    - owner => libre via ?service=
    - non-owner + membership ACTIVE + membership.service défini => service forcé
    - sinon => ?service= ou Principal
    """
    tenant = get_tenant_for_request(request)
    user = getattr(request, "user", None)

    role = get_user_role(request)
    membership = _get_membership_for_tenant(user, tenant)

    # 🔒 scope forcé si membership scoped + pas owner
    if role != "owner" and membership and membership.service_id:
        forced = membership.service
        requested_service_id = request.query_params.get("service") or (
            request.data.get("service") if hasattr(request, "data") else None
        )
        if requested_service_id and str(requested_service_id) != str(forced.id):
            raise exceptions.PermissionDenied("Accès limité : vous n'avez pas accès à ce service.")
        return forced

    service_id = request.query_params.get("service") or (
        request.data.get("service") if hasattr(request, "data") else None
    )

    if service_id:
        try:
            return Service.objects.get(id=service_id, tenant=tenant)
        except (Service.DoesNotExist, ValueError, TypeError):
            pass

    return get_default_service(tenant)