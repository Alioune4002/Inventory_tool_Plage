# backend/accounts/services/access.py
import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.models import OrganizationOverrides, Tenant, Membership
from products.models import Product

User = get_user_model()

# Plan registry (source de vérité côté code)
PLAN_REGISTRY: Dict[str, Dict[str, Any]] = {
    "ESSENTIEL": {
        "entitlements": [
            "inventory_basic",
            "stock_movements_basic",
            "reports_basic",
            "exports_basic",
            "exports_xlsx",
            "pdf_catalog",
        ],
        "limits": {
            "max_products": 100,
            "max_services": 1,
            "max_users": 1,
            "csv_monthly_limit": 1,
            "xlsx_monthly_limit": 1,
            "pdf_catalog_monthly_limit": 1,
            "ai_requests_monthly_limit": 0,
            "ai_support_weekly_limit": 0,
            "history_days": 14,
        },
    },
    "BOUTIQUE": {
        "entitlements": [
            "inventory_basic",
            "stock_movements_basic",
            "reports_basic",
            "exports_basic",
            "loss_management",
            "low_stock_alerts_email",
            "reports_standard",
            "exports_unlimited_csv",
            "exports_xlsx",
            "roles_per_service",
            "ai_assistant_basic",
            "alerts_stock",
            "pdf_catalog",
        ],
        "limits": {
            "max_products": 1000,
            "max_services": 2,
            "max_users": 3,
            "csv_monthly_limit": None,
            "xlsx_monthly_limit": 30,
            "pdf_catalog_monthly_limit": 5,
            "ai_requests_monthly_limit": 15,
            "ai_support_weekly_limit": 4,
        },
    },
    "PRO": {
        "entitlements": [
            "inventory_basic",
            "stock_movements_basic",
            "reports_basic",
            "exports_basic",
            "loss_management",
            "low_stock_alerts_email",
            "reports_standard",
            "exports_unlimited_csv",
            "exports_xlsx",
            "exports_email",
            "roles_per_service",
            "expiry_batches",
            "reports_advanced",
            "automations",
            "ai_assistant_basic",
            "multi_service_analytics",
            "advanced_roles",
            "alerts_stock",
            "alerts_expiry",
            "pdf_catalog",
        ],
        "limits": {
            "max_products": None,  # illimité
            "max_services": 5,
            "max_users": 10,
            "csv_monthly_limit": None,
            "xlsx_monthly_limit": None,
            "pdf_catalog_monthly_limit": None,
            "ai_requests_monthly_limit": 200,
            "ai_support_weekly_limit": 50,
        },
    },
    # ENTERPRISE: via overrides
}

DEFAULT_PLAN_CODE = "ESSENTIEL"


def _now() -> datetime.datetime:
    return timezone.now()


def _normalize_plan_code(value: Optional[str]) -> str:
    v = (value or "").strip().upper()
    return v if v else DEFAULT_PLAN_CODE


def get_effective_plan(tenant: Tenant) -> Tuple[str, Dict[str, Any]]:
    """
    Plan effectif:
    - lifetime => tenant.plan.code (ou fallback)
    - license_expires_at future (trial/grace) => tenant.plan.code (ou fallback)
    - subscription active/past_due => tenant.plan.code (ou fallback)
    - manual override => tenant.plan.code (ou fallback)
    - sinon => ESSENTIEL
    """
    plan_code = DEFAULT_PLAN_CODE
    if tenant.plan_id and getattr(tenant.plan, "code", None):
        plan_code = _normalize_plan_code(tenant.plan.code)

    if tenant.is_lifetime:
        cfg = PLAN_REGISTRY.get(plan_code, PLAN_REGISTRY[DEFAULT_PLAN_CODE])
        return plan_code, cfg

    if tenant.license_expires_at and tenant.license_expires_at > _now():
        cfg = PLAN_REGISTRY.get(plan_code, PLAN_REGISTRY[DEFAULT_PLAN_CODE])
        return plan_code, cfg

    if getattr(tenant, "subscription_status", None) in ("ACTIVE", "PAST_DUE"):
        cfg = PLAN_REGISTRY.get(plan_code, PLAN_REGISTRY[DEFAULT_PLAN_CODE])
        return plan_code, cfg

    if getattr(tenant, "plan_source", None) in ("MANUAL", "LIFETIME"):
        cfg = PLAN_REGISTRY.get(plan_code, PLAN_REGISTRY[DEFAULT_PLAN_CODE])
        return plan_code, cfg

    return DEFAULT_PLAN_CODE, PLAN_REGISTRY[DEFAULT_PLAN_CODE]


def get_entitlements(tenant: Tenant) -> List[str]:
    _, plan_cfg = get_effective_plan(tenant)
    entitlements = list(plan_cfg.get("entitlements", []))

    # Overrides enterprise / custom
    try:
        overrides = OrganizationOverrides.objects.filter(tenant=tenant).first()
        if overrides and overrides.custom_entitlements:
            entitlements = list(set(entitlements) | set(overrides.custom_entitlements))
    except Exception:
        entitlements = list(plan_cfg.get("entitlements", []))

    return entitlements


def get_limits(tenant: Tenant) -> Dict[str, Optional[int]]:
    _, plan_cfg = get_effective_plan(tenant)
    limits: Dict[str, Optional[int]] = dict(plan_cfg.get("limits", {}))

    try:
        overrides = OrganizationOverrides.objects.filter(tenant=tenant).first()
        if overrides and overrides.custom_limits:
            # custom_limits peut forcer des valeurs
            for k, v in overrides.custom_limits.items():
                if v is not None:
                    limits[k] = v
    except Exception:
        limits = dict(plan_cfg.get("limits", {}))

    return limits


def get_retention_days(tenant: Tenant) -> Optional[int]:
    limits = get_limits(tenant)
    days = limits.get("history_days")
    return int(days) if days is not None else None


def get_plan_code(tenant: Tenant) -> str:
    plan_code, _ = get_effective_plan(tenant)
    return plan_code


def get_usage(tenant: Tenant) -> Dict[str, int]:
    products_count = Product.objects.filter(tenant=tenant).count()
    services_count = tenant.services.count()

    # ✅ IMPORTANT: compter les membres actifs si le champ status existe,
    # sinon fallback sur profils (compat anciennes migrations).
    try:
        users_count = Membership.objects.filter(tenant=tenant, status="ACTIVE").count()
    except Exception:
        users_count = User.objects.filter(profile__tenant=tenant).count()

    return {
        "products_count": products_count,
        "services_count": services_count,
        "users_count": users_count,
    }


def is_over_limit(tenant: Tenant) -> bool:
    limits = get_limits(tenant)
    usage = get_usage(tenant)

    if limits.get("max_products") is not None and usage["products_count"] > int(limits["max_products"]):
        return True
    if limits.get("max_services") is not None and usage["services_count"] > int(limits["max_services"]):
        return True
    if limits.get("max_users") is not None and usage["users_count"] > int(limits["max_users"]):
        return True
    return False


class LimitExceeded(Exception):
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


def check_limit(tenant: Tenant, key: str, current_usage: int, requested_increment: int = 0):
    limits = get_limits(tenant)
    limit_value = limits.get(key)
    if limit_value is None:
        return
    if current_usage + requested_increment > int(limit_value):
        raise LimitExceeded(code=f"LIMIT_{key.upper()}", detail=f"Limite {key} atteinte.")


def check_entitlement(tenant: Tenant, key: str):
    if key not in get_entitlements(tenant):
        raise LimitExceeded(code="FEATURE_NOT_INCLUDED", detail="Fonctionnalité non incluse dans le plan actuel.")
