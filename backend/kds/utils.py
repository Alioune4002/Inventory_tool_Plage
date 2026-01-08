from rest_framework import exceptions

ELIGIBLE_SERVICE_TYPES = {
    "kitchen",
    "restaurant_dining",
    "bar",
    "bakery",
}


def is_kds_eligible(service) -> bool:
    return getattr(service, "service_type", None) in ELIGIBLE_SERVICE_TYPES


def is_kds_enabled(service) -> bool:
    features = getattr(service, "features", {}) or {}
    cfg = features.get("kds") or {}
    if isinstance(cfg, dict):
        return bool(cfg.get("enabled"))
    return bool(cfg)


def require_kds_enabled(service):
    if is_kds_enabled(service):
        return
    raise exceptions.PermissionDenied(
        "Module Commandes & Cuisine non activé pour ce service."
    )
