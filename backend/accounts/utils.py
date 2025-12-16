from copy import deepcopy
from django.utils.text import slugify
from accounts.models import Tenant, UserProfile, Service


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
    """
    Merge "features" de manière sûre.
    - garde les clés base
    - écrase proprement les sous-dicts (barcode/sku/dlc/prices/etc.)
    """
    out = deepcopy(base)
    for k, v in (overrides or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = deepcopy(v)
    return out


def apply_service_preset(service_type: str, domain: str = None):
    """
    Retourne counting_mode et features par défaut selon le type.
    domain: optionnel ("food" / "general" / etc.) pour forcer certaines règles produit.
    """
    base = _base_features()

    presets = {
        # Épicerie / petite distribution alimentaire
        "grocery_food": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "dlc": {"enabled": True, "recommended": True},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        # Vrac / épicerie vrac
        "bulk_food": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        # Bar
        "bar": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    # bar : souvent prix d’achat utile, prix de vente pas toujours nécessaire (marge “théorique”)
                    "prices": {"purchase_enabled": True, "selling_enabled": False, "recommended": False},
                    "dlc": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        # Cuisine / production interne (restaurant cuisine)
        "kitchen": {
            "counting_mode": "weight",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": False},
                    # cuisine : prix inutiles dans l’inventaire simple
                    "prices": {"purchase_enabled": False, "selling_enabled": False, "recommended": False},
                    "dlc": {"enabled": True, "recommended": False},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": False, "recommended": False},
                },
            ),
        },
        # Retail général (boutiques non alimentaires)
        "retail_general": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": False, "recommended": False},
                    "open_container_tracking": {"enabled": False},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        # Pharmacie / parapharmacie
        "pharmacy_parapharmacy": {
            "counting_mode": "unit",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": True},
                    "sku": {"enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": True},  # lots / péremption important
                    "open_container_tracking": {"enabled": False},
                    "tva": {"enabled": True, "recommended": True},
                    "suppliers": {"enabled": True},
                },
            ),
        },
        # Boulangerie / pâtisserie
        "bakery": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": True},
                    "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
                    "dlc": {"enabled": True, "recommended": True},  # DLC/DDM/24h géré côté front
                    "open_container_tracking": {"enabled": False},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
        # Salle / service restaurant (dining)
        "restaurant_dining": {
            "counting_mode": "mixed",
            "features": _merge_features(
                base,
                {
                    "barcode": {"enabled": True, "recommended": False},
                    "sku": {"enabled": True, "recommended": False},
                    "prices": {"purchase_enabled": False, "selling_enabled": False, "recommended": False},
                    "dlc": {"enabled": True, "recommended": True},
                    "open_container_tracking": {"enabled": True},
                    "tva": {"enabled": True, "recommended": False},
                },
            ),
        },
    }

    preset = presets.get(service_type) or {"counting_mode": "unit", "features": deepcopy(base)}

    # règle globale : si domain general => DLC OFF (promesse “non-alimentaire”)
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


def get_service_from_request(request):
    tenant = get_tenant_for_request(request)
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