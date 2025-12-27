import json
import logging
from uuid import uuid4
from django.conf import settings
from django.db.models import Sum, Count, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

try:
    from products.models import Product, LossEvent
except ImportError:  # pragma: no cover
    Product = None
    LossEvent = None

LOGGER = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are StockScan AI: a professional inventory coach for SMBs.
Return ONLY valid JSON with this shape:
{
  "analysis": "<string>",
  "watch_items": ["<string>", "..."],
  "actions": [{"label": "<string>", "type": "link|info", "href": "<string or null>"}],
  "question": "<string or null>"
}
Rules (strict):
- No markdown, no emojis, no bullet prefixes in strings.
- Never invent data; rely strictly on CONTEXT.
- Never explain what StockScan is.
- Do NOT repeat raw stats already visible unless it directly supports a decision.
- Avoid vague phrasing (ex: “vous pouvez améliorer”, “il serait utile”).
- Always prioritize and say what to do now.
- Tone: concise, professional, premium, like a store manager coach.
- If FEATURES indicate a module is disabled, speak conditionally (ex: “si vous activez…”).
- If data is sparse, say it clearly and propose 1-2 concrete next steps to improve data quality.
- If CONTEXT.ai_mode == "light": keep it short, 1 analysis, 1-2 watch items, 1-2 actions, no projections.
- If CONTEXT.ai_mode == "full": add prioritization, risk/opportunity framing, up to 3 actions, allow a “if you continue…” sentence.
- If USER_QUESTION is present, answer it first in analysis, then continue with watch_items/actions.
- If unsure, ask ONE concise clarification in question.
- If CONTEXT.scope == "support": provide step-by-step help and actionable next clicks (routes from SUPPORT_GUIDE).
- If you include actions with href, use paths from CONTEXT.support_guide.routes.
"""

ACTION_TEMPLATES = {
    "refresh_stats": ("GET", "/api/inventory-stats/"),
    "suggest_export": ("GET", "/api/exports/"),
    "prefill_categories": ("POST", "/api/categories/"),
    "add_loss_placeholder": ("POST", "/api/losses/"),
}

SUPPORT_GUIDE = {
    "app": {
        "name": "StockScan",
        "purpose": "Inventaire multi-services (cuisine, bar, boutique) avec exports CSV/Excel.",
    },
    "routes": {
        "dashboard": "/app",
        "products": "/app/products",
        "inventory": "/app/inventory",
        "exports": "/app/exports",
        "settings": "/app/settings",
        "support": "/app/support",
    },
    "exports": {
        "csv": "Export CSV depuis la page Exports. Respecte les quotas du plan.",
        "xlsx": "Export Excel disponible selon le plan (Duo/Multi).",
        "email": "Partage email possible sur Multi.",
        "errors": "Si erreur 403, verifiez le quota ou le plan.",
    },
    "services": {
        "switch": "Utiliser le selecteur de service en haut de l'app.",
        "limits": "Nombre de services limite selon le plan.",
    },
    "ai": {
        "duo": "Duo: IA light, quota hebdomadaire limite.",
        "multi": "Multi: IA complet, quota hebdomadaire plus eleve.",
    },
    "alerts": {
        "stock": "Alertes stock basees sur min_qty.",
        "expiry": "Alertes dates disponibles en Multi.",
    },
    "scan": {
        "barcode": "Le scan depend du navigateur. iOS Safari peut etre limite.",
        "off": "Pre-remplissage OpenFoodFacts: aliments uniquement.",
    },
    "billing": {
        "manage": "Parametres > Abonnement & facturation pour gerer Stripe.",
        "sync": "En cas de plan non active apres paiement, relancer /billing/success?session_id=...",
    },
    "support": {
        "email": "support@stockscan.app",
        "tip": "Envoyer page + capture + message d'erreur.",
    },
}

INTENT_KEYWORDS = {
    "losses": ["perte", "pertes", "écart", "ecart", "gaspillage", "casse", "vol", "dlc", "ddm"],
    "modules": ["module", "modules", "activer", "activation", "options", "fonctionnalite", "fonctionnalité", "parametres", "paramètres"],
    "summary": ["résumé", "resume", "bilan", "mensuel", "mensuelle", "ce mois", "ce mois-ci", "stock du mois"],
}

MODULE_LABELS = {
    "identifier": "Référence (SKU / code-barres)",
    "pricing": "Prix & TVA",
    "expiry": "Dates (DLC / DDM)",
    "lot": "Lots",
    "opened": "Entamé / non-entamé",
    "variants": "Variantes",
    "multi_unit": "Multi-unités",
    "item_type": "Matières premières / produits finis",
}


def detect_intent(question: str):
    if not question:
        return None
    q = question.lower()
    for key in ("losses", "modules", "summary"):
        if any(token in q for token in INTENT_KEYWORDS[key]):
            return key
    return None


def _module_enabled(features, module_id):
    if not features:
        return False
    if module_id == "identifier":
        return features.get("barcode", {}).get("enabled") is True or features.get("sku", {}).get("enabled") is True
    if module_id == "pricing":
        prices = features.get("prices") or {}
        return prices.get("purchase_enabled") is not False or prices.get("selling_enabled") is not False
    if module_id == "expiry":
        return features.get("dlc", {}).get("enabled") is True
    if module_id == "lot":
        return features.get("lot", {}).get("enabled") is True
    if module_id == "opened":
        return features.get("open_container_tracking", {}).get("enabled") is True
    if module_id == "variants":
        return features.get("variants", {}).get("enabled") is True
    if module_id == "multi_unit":
        return features.get("multi_unit", {}).get("enabled") is True
    if module_id == "item_type":
        return features.get("item_type", {}).get("enabled") is True
    return False


def _recommended_modules_for_service(service_type):
    mapping = {
        "bar": ["identifier", "pricing", "expiry", "opened", "lot", "multi_unit"],
        "kitchen": ["identifier", "pricing", "expiry", "lot", "opened", "item_type"],
        "bakery": ["identifier", "pricing", "expiry", "opened", "lot", "multi_unit"],
        "grocery_food": ["identifier", "pricing", "expiry", "multi_unit"],
        "bulk_food": ["identifier", "pricing", "expiry", "multi_unit", "opened"],
        "restaurant_dining": ["identifier", "pricing", "item_type"],
        "retail_general": ["identifier", "pricing", "variants"],
        "pharmacy_parapharmacy": ["identifier", "pricing", "expiry", "lot"],
        "other": ["identifier", "pricing"],
    }
    return mapping.get(service_type or "other", mapping["other"])


def build_template_response(context, intent):
    ctx = context or {}
    mode = ctx.get("ai_mode") or "full"
    inv = ctx.get("inventory_summary", {})
    losses = ctx.get("losses", {})
    quality = ctx.get("data_quality", {})
    features = ctx.get("features", {})
    service = ctx.get("service") or {}
    service_type = service.get("service_type") or "other"

    total_skus = inv.get("total_skus", 0)
    low_stock = inv.get("low_stock_count", 0)
    out_stock = inv.get("out_of_stock_count", 0)
    loss_qty = losses.get("total_qty", 0) or 0
    loss_by_reason = losses.get("by_reason") or []

    analysis = []
    watch_items = []
    actions = []

    if intent == "losses":
        if loss_qty > 0:
            main_reason = loss_by_reason[0]["reason"] if loss_by_reason else "écarts"
            analysis.append("Les pertes sont réelles mais concentrées sur peu d’articles.")
            analysis.append(f"La cause dominante semble liée à {main_reason}.")
        else:
            analysis.append("Aucune perte n’est enregistrée sur la période.")
            analysis.append("La priorité est de fiabiliser la saisie pour confirmer la tendance.")

        if quality.get("products_without_identifier_count", 0) > 0:
            watch_items.append("Des produits sans référence rendent les pertes difficiles à tracer.")
        if quality.get("products_without_purchase_price_count", 0) > 0 and _module_enabled(features, "pricing"):
            watch_items.append("Des prix d’achat manquants masquent l’impact réel des pertes.")
        if _module_enabled(features, "expiry") and quality.get("products_without_dlc_count", 0) > 0:
            watch_items.append("Des dates manquantes limitent la prévention des pertes liées aux DLC.")

        if loss_qty > 0:
            actions.append({"label": "Analyser les pertes enregistrées", "type": "link", "href": "/app/losses"})
        if quality.get("products_without_identifier_count", 0) > 0 and not _module_enabled(features, "identifier"):
            actions.append({"label": "Activer le module Référence (SKU / code-barres)", "type": "link", "href": "/app/settings"})
        if quality.get("products_without_purchase_price_count", 0) > 0 and _module_enabled(features, "pricing"):
            actions.append({"label": "Compléter les prix d’achat des produits sensibles", "type": "link", "href": "/app/products"})
        if service_type in ("bar", "kitchen", "bakery") and not _module_enabled(features, "opened"):
            actions.append({"label": "Activer le suivi entamé / non-entamé", "type": "link", "href": "/app/settings"})

    elif intent == "modules":
        recommended = _recommended_modules_for_service(service_type)
        inactive = [m for m in recommended if not _module_enabled(features, m)]
        active = [m for m in recommended if m not in inactive]

        analysis.append("Les modules adaptés à votre métier améliorent directement la fiabilité du stock.")
        if inactive:
            analysis.append("Certains modules clés ne sont pas encore actifs.")
        else:
            analysis.append("Les modules essentiels sont déjà actifs.")

        if inactive:
            watch_items.append("Priorité : activer les modules qui bloquent les données critiques.")
            watch_items.append(f"Modules à activer : {', '.join(MODULE_LABELS.get(m, m) for m in inactive[:3])}.")
        elif active:
            watch_items.append("Vous êtes déjà aligné sur les modules recommandés pour ce métier.")

        actions.append({"label": "Ouvrir Paramètres → Modules", "type": "link", "href": "/app/settings"})
        if inactive:
            actions.append({"label": "Compléter un produit avec les nouveaux champs", "type": "link", "href": "/app/products"})

    else:  # summary
        if total_skus == 0:
            analysis.append("Votre base produits est vide sur la période.")
            analysis.append("Commencez par structurer les fiches produits.")
        else:
            if out_stock > 0:
                analysis.append("Le stock est sous tension avec des ruptures visibles.")
            elif low_stock > 0:
                analysis.append("Le stock est globalement stable mais des références sont à surveiller.")
            else:
                analysis.append("Le stock est stable et sans alerte critique immédiate.")

        if loss_qty > 0:
            analysis.append("Des pertes existent et doivent être expliquées.")
        if quality.get("products_without_identifier_count", 0) > 0:
            watch_items.append("Des références manquent, ce qui fragilise la lecture des écarts.")
        if quality.get("products_without_category_count", 0) > 0:
            watch_items.append("Des catégories manquantes limitent l’analyse par rayon/service.")
        if loss_qty > 0:
            watch_items.append("Les pertes doivent être surveillées pour éviter un écart récurrent.")

        if out_stock > 0 or low_stock > 0:
            actions.append({"label": "Vérifier les produits à risque", "type": "link", "href": "/app/inventory"})
        if loss_qty > 0:
            actions.append({"label": "Analyser les pertes", "type": "link", "href": "/app/losses"})
        if quality.get("products_without_identifier_count", 0) > 0:
            actions.append({"label": "Compléter les références produit", "type": "link", "href": "/app/products"})

    if mode != "light" and analysis:
        analysis.append("Si la tendance continue, l’écart entre stock réel et stock attendu va se creuser.")

    max_watch = 2 if mode == "light" else 4
    max_actions = 2 if mode == "light" else 3
    analysis_text = " ".join(analysis).strip()

    return {
        "analysis": analysis_text,
        "watch_items": watch_items[:max_watch],
        "actions": actions[:max_actions],
        "question": None,
        "message": analysis_text,
        "insights": [],
        "suggested_actions": [],
    }


def maybe_template_response(context):
    if not context:
        return None
    if (context.get("scope") or "") == "support":
        return None
    intent = detect_intent(context.get("user_question") or "")
    if not intent:
        return None
    return build_template_response(context, intent)


def build_context(user, scope=None, period_start=None, period_end=None, filters=None, user_question=None, mode="full"):
    filters = filters or {}
    tenant = getattr(user, "profile", None) and user.profile.tenant
    if tenant is None:
        return {}

    service_id = filters.get("service")
    month = filters.get("month") or period_start
    service = None
    if service_id and service_id != "all":
        service = tenant.services.filter(id=service_id).first()

    def decimal_zero():
        return Value(0, output_field=DecimalField(max_digits=14, decimal_places=4))

    products_qs = Product.objects.filter(tenant=tenant)
    losses_qs = LossEvent.objects.filter(tenant=tenant)

    if service_id and service_id != "all":
        products_qs = products_qs.filter(service_id=service_id)
        losses_qs = losses_qs.filter(service_id=service_id)

    if month:
        products_qs = products_qs.filter(inventory_month=month)
        losses_qs = losses_qs.filter(inventory_month=month)

    summary = products_qs.aggregate(
        total_skus=Count("id"),
        total_units=Coalesce(Sum("quantity"), decimal_zero(), output_field=DecimalField(max_digits=14, decimal_places=4)),
        low_stock_count=Count("id", filter=Q(quantity__lte=2)),
        out_of_stock_count=Count("id", filter=Q(quantity__lte=0)),
    )

    loss_totals = losses_qs.aggregate(
        loss_count=Count("id"),
        losses_total_qty=Coalesce(Sum("quantity"), decimal_zero(), output_field=DecimalField(max_digits=14, decimal_places=4)),
    )

    loss_by_reason = list(
        losses_qs.values("reason").annotate(total_qty=Sum("quantity")).order_by("-total_qty")[:5]
    )

    movers_limit = 3 if mode == "light" else 5
    fast_movers = list(
        products_qs.order_by("-quantity").values("name", "quantity", "unit", "category")[:movers_limit]
    )
    slow_movers = list(
        products_qs.filter(quantity__gt=0).order_by("quantity").values("name", "quantity", "unit", "category")[:movers_limit]
    )
    top_losses = list(
        losses_qs.values("product__name")
        .annotate(total_qty=Sum("quantity"))
        .order_by("-total_qty")[:movers_limit]
    )

    # Focus items list (limit 50)
    items_limit = 12 if mode == "light" else 50
    items = list(
        products_qs.order_by("quantity")
        .values("name", "quantity", "unit", "category", "service_id", "barcode", "internal_sku", "container_status")[:items_limit]
    )

    missing_id_count = products_qs.filter(barcode__isnull=True, internal_sku__isnull=True).count()
    missing_category_count = products_qs.filter(Q(category__isnull=True) | Q(category="")).count()
    missing_purchase_count = products_qs.filter(Q(purchase_price__isnull=True) | Q(purchase_price=0)).count()
    missing_selling_count = products_qs.filter(Q(selling_price__isnull=True) | Q(selling_price=0)).count()
    missing_dlc_count = products_qs.filter(dlc__isnull=True).count()
    opened_count = products_qs.filter(container_status="OPENED").count()
    question = (user_question or "").strip()[:500]
    plan_code = None
    plan_entitlements = []
    plan_limits = {}
    try:
        from accounts.services.access import get_plan_code, get_entitlements, get_limits

        plan_code = get_plan_code(tenant)
        plan_entitlements = get_entitlements(tenant)
        plan_limits = get_limits(tenant)
    except Exception:
        plan_code = None
        plan_entitlements = []
        plan_limits = {}

    context = {
        "ai_mode": mode,
        "tenant": {"id": tenant.id, "name": tenant.name, "business_type": tenant.business_type, "domain": tenant.domain},
        "service": (
            {
                "id": service.id,
                "name": service.name,
                "service_type": service.service_type,
            }
            if service
            else None
        ),
        "features": service.features if service else {},
        "scope": scope or "inventory",
        "period": {"start": period_start, "end": period_end, "month": month},
        "inventory_summary": {
            "total_skus": summary.get("total_skus") or 0,
            "total_units": float(summary.get("total_units") or 0),
            "low_stock_count": summary.get("low_stock_count") or 0,
            "out_of_stock_count": summary.get("out_of_stock_count") or 0,
        },
        "movements": {
            "inbound_count": 0,  # non suivi en V1
            "outbound_count": 0,
            "loss_count": loss_totals.get("loss_count") or 0,
            "adjustments_count": 0,
        },
        "losses": {
            "total_qty": float(loss_totals.get("losses_total_qty") or 0),
            "by_reason": [
                {"reason": r["reason"], "total_qty": float(r["total_qty"] or 0)} for r in loss_by_reason
            ],
        },
        "usage": {
            "services_count": tenant.services.count(),
            "categories_count": tenant.categories.count(),
            "sku_missing_count": missing_id_count,
        },
        "plan": {
            "code": plan_code,
            "entitlements": plan_entitlements,
            "limits": plan_limits,
        },
        "support_guide": SUPPORT_GUIDE,
        "data_quality": {
            "categories_count": tenant.categories.count(),
            "products_without_identifier_count": missing_id_count,
            "products_without_category_count": missing_category_count,
            "products_without_purchase_price_count": missing_purchase_count,
            "products_without_selling_price_count": missing_selling_count,
            "products_without_dlc_count": missing_dlc_count,
            "opened_containers_count": opened_count,
            "loss_events_count": loss_totals.get("loss_count") or 0,
        },
        "top_items": {
            "fast_movers": [
                {**i, "quantity": float(i.get("quantity") or 0)} for i in fast_movers
            ],
            "slow_movers": [
                {**i, "quantity": float(i.get("quantity") or 0)} for i in slow_movers
            ],
            "highest_loss_rate": [
                {"name": i.get("product__name") or "N/A", "loss_qty": float(i.get("total_qty") or 0)}
                for i in top_losses
            ],
        },
        "items": [
            {
                "name": (i.get("name") or "")[:120],
                "quantity": float(i.get("quantity") or 0),
                "unit": i.get("unit"),
                "category": (i.get("category") or "")[:100],
                "service_id": i.get("service_id"),
                "barcode": i.get("barcode"),
                "internal_sku": i.get("internal_sku"),
                "container_status": i.get("container_status"),
            }
            for i in items
        ],
        "user_question": question or None,
        "generated_at": timezone.now().isoformat(),
    }
    return context


def _local_assistant_summary(context):
    ctx = context or {}
    inv = ctx.get("inventory_summary", {})
    losses = ctx.get("losses", {})
    features = ctx.get("features") or {}
    quality = ctx.get("data_quality") or {}
    mode = ctx.get("ai_mode") or "full"
    service = ctx.get("service") or {}
    service_type = service.get("service_type") or "other"
    top_losses = (ctx.get("top_items") or {}).get("highest_loss_rate") or []

    def _enabled(flag, price=False):
        if price:
            prices = features.get("prices") or {}
            return prices.get("purchase_enabled") is not False or prices.get("selling_enabled") is not False
        cfg = features.get(flag) or {}
        return cfg.get("enabled") is True

    total_skus = inv.get("total_skus", 0)
    low_stock = inv.get("low_stock_count", 0)
    out_stock = inv.get("out_of_stock_count", 0)
    loss_qty = losses.get("total_qty", 0) or 0

    analysis_parts = []
    if total_skus == 0:
        analysis_parts.append("Aucun produit n’est suivi sur la période. L’enjeu principal est de structurer la base.")
    else:
        if out_stock > 0:
            analysis_parts.append("Le stock est sous tension avec des ruptures visibles.")
        elif low_stock > 0:
            analysis_parts.append("Le stock est globalement en place, mais certaines références manquent de marge.")
        else:
            analysis_parts.append("Le stock est stable, sans alerte critique immédiate.")

        if loss_qty > 0:
            if top_losses:
                top_names = [i.get("name") for i in top_losses if i.get("name") and i.get("name") != "N/A"][:2]
                if top_names:
                    analysis_parts.append(
                        f"Les pertes se concentrent surtout sur {', '.join(top_names)}."
                    )
                else:
                    analysis_parts.append("Des pertes sont enregistrées et restent concentrées sur quelques articles.")
            else:
                analysis_parts.append("Des pertes sont enregistrées et doivent être expliquées.")

        if mode != "light" and (out_stock > 0 or low_stock > 0 or loss_qty > 0):
            analysis_parts.append("Si cette tendance continue, l’écart entre stock réel et stock attendu va se creuser.")

    analysis = " ".join(analysis_parts).strip() or "Analyse indisponible pour le moment."

    watch_items = []
    if out_stock > 0:
        watch_items.append("Des ruptures existent : risque de ventes ou usages bloqués.")
    if low_stock > 0 and out_stock == 0:
        watch_items.append("Stocks faibles sur certaines références : marge de sécurité réduite.")
    if loss_qty > 0:
        watch_items.append("Pertes récurrentes : surveiller les produits sensibles.")
    if quality.get("products_without_identifier_count", 0) > 0:
        watch_items.append("Des produits sans référence rendent le suivi des pertes imprécis.")
    if quality.get("products_without_purchase_price_count", 0) > 0 and _enabled("prices", price=True):
        watch_items.append("Des prix d’achat manquants sous-estiment l’impact réel des pertes.")
    if quality.get("products_without_category_count", 0) > 0:
        watch_items.append("Des catégories manquantes rendent l’analyse moins fiable.")
    if _enabled("dlc") and quality.get("products_without_dlc_count", 0) > 0:
        watch_items.append("Des dates manquantes limitent la prévention des pertes liées aux DLC.")

    actions = []
    if quality.get("products_without_identifier_count", 0) > 0 and not _enabled("barcode") and not _enabled("sku"):
        actions.append(
            {
                "label": "Activer le module Référence (SKU / code-barres)",
                "type": "link",
                "href": "/app/settings",
            }
        )
    elif quality.get("products_without_identifier_count", 0) > 0:
        actions.append(
            {
                "label": "Compléter les références des produits à risque",
                "type": "link",
                "href": "/app/products",
            }
        )

    if loss_qty > 0:
        actions.append(
            {
                "label": "Analyser les pertes enregistrées",
                "type": "link",
                "href": "/app/losses",
            }
        )

    if out_stock > 0:
        actions.append(
            {
                "label": "Vérifier les ruptures dans l’inventaire",
                "type": "link",
                "href": "/app/inventory",
            }
        )

    if quality.get("products_without_purchase_price_count", 0) > 0 and _enabled("prices", price=True):
        actions.append(
            {
                "label": "Renseigner les prix d’achat sur les produits clés",
                "type": "link",
                "href": "/app/products",
            }
        )

    if service_type in ("bar", "kitchen", "bakery") and not _enabled("open_container_tracking"):
        actions.append(
            {
                "label": "Activer le suivi entamé / non-entamé",
                "type": "link",
                "href": "/app/settings",
            }
        )

    max_watch = 2 if mode == "light" else 4
    max_actions = 2 if mode == "light" else 3

    return {
        "analysis": analysis,
        "watch_items": watch_items[:max_watch],
        "actions": actions[:max_actions],
        "question": None,
        "message": analysis,
        "insights": [],
        "suggested_actions": [],
    }


def _local_support_response(context):
    ctx = context or {}
    q = (ctx.get("user_question") or "").lower()
    plan = ctx.get("plan") or {}
    limits = plan.get("limits") or {}
    ai_limit = limits.get("ai_support_weekly_limit")
    support_email = (ctx.get("support_guide") or {}).get("support", {}).get("email") or "support@stockscan.app"

    def _msg(text, question=None):
        return {
            "analysis": text,
            "watch_items": [],
            "actions": [],
            "question": question,
            "message": text,
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["export", "csv", "excel"]):
        return {
            "analysis": "Ouvrez Exports, choisissez la période et le format, puis lancez le téléchargement.",
            "watch_items": [
                "Une erreur 403 indique un quota de plan atteint.",
                "Excel est disponible selon le plan (Duo/Multi).",
            ],
            "actions": [
                {"label": "Ouvrir Exports", "type": "link", "href": "/app/exports"},
            ],
            "question": "Le problème arrive-t-il sur CSV, Excel, ou les deux ?",
            "message": "Ouvrez Exports, choisissez la période et le format, puis lancez le téléchargement.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["403", "limite", "quota"]):
        return {
            "analysis": "Une erreur 403 signifie généralement qu’un quota de plan est atteint.",
            "watch_items": ["Le quota peut concerner exports, IA ou services.", "Vérifiez votre plan et l’usage actuel."],
            "actions": [
                {
                    "label": "Ouvrir Abonnement & facturation",
                    "type": "link",
                    "href": "/app/settings",
                }
            ],
            "question": "Quelle action précise déclenche l’erreur (export, IA, création de service) ?",
            "message": "Une erreur 403 signifie généralement qu’un quota de plan est atteint.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["assistant", "ia", "ai"]):
        quota_msg = ""
        if ai_limit is not None:
            quota_msg = f" Votre quota hebdomadaire est de {ai_limit} requete(s)."
        return {
            "analysis": "L’assistant IA est disponible sur Duo (light) et Multi (coach)."
            f"{quota_msg} Si l’IA ne répond pas, vérifiez le quota.",
            "watch_items": ["Le quota support est hebdomadaire.", "Le mode Multi fournit des conseils plus approfondis."],
            "actions": [{"label": "Ouvrir Support", "type": "link", "href": "/app/support"}],
            "question": "Quel type d’aide attendez-vous (stock, exports, configuration) ?",
            "message": "L’assistant IA est disponible sur Duo (light) et Multi (coach)."
            f"{quota_msg} Si l’IA ne répond pas, vérifiez le quota.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["scan", "code-barres", "barcode", "openfoodfacts", "off"]):
        return {
            "analysis": "Sur iOS Safari, la caméra peut être limitée. Utilisez la saisie manuelle si besoin.",
            "watch_items": ["OpenFoodFacts préremplit surtout les produits alimentaires."],
            "actions": [{"label": "Ouvrir Inventaire", "type": "link", "href": "/app/inventory"}],
            "question": "Quel navigateur utilisez-vous et quel message d’erreur voyez-vous ?",
            "message": "Sur iOS Safari, la caméra peut être limitée. Utilisez la saisie manuelle si besoin.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["service", "services"]):
        return {
            "analysis": "Utilisez le sélecteur en haut de l’app pour changer de service.",
            "watch_items": ["Le nombre de services dépend du plan."],
            "actions": [{"label": "Ouvrir Services & modules", "type": "link", "href": "/app/settings"}],
            "question": "Souhaitez-vous ajouter un service ou simplement en changer ?",
            "message": "Utilisez le sélecteur en haut de l’app pour changer de service.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["paiement", "abonnement", "stripe", "facturation"]):
        return {
            "analysis": "Allez dans Paramètres → Abonnement & facturation pour gérer Stripe.",
            "watch_items": ["Si le plan n’est pas activé après paiement, rechargez la page de succès."],
            "actions": [{"label": "Ouvrir Abonnement & facturation", "type": "link", "href": "/app/settings"}],
            "question": "Pouvez-vous confirmer le plan acheté et la date du paiement ?",
            "message": "Allez dans Paramètres → Abonnement & facturation pour gérer Stripe.",
            "insights": [],
            "suggested_actions": [],
        }

    if any(k in q for k in ["connexion", "login", "mot de passe", "reset"]):
        return {
            "analysis": "Vérifiez vos identifiants. Pour réinitialiser, utilisez “Mot de passe oublié”.",
            "watch_items": ["Si plusieurs comptes partagent un email, utilisez le nom d’utilisateur."],
            "actions": [{"label": "Ouvrir Connexion", "type": "link", "href": "/login"}],
            "question": "Avez-vous un message d’erreur précis à l’écran ?",
            "message": "Vérifiez vos identifiants. Pour réinitialiser, utilisez “Mot de passe oublié”.",
            "insights": [],
            "suggested_actions": [],
        }

    return _msg(
        "Je peux aider sur exports, services, facturation, IA, scan ou modules. "
        f"Si besoin, contactez {support_email}.",
        "Quel est votre besoin principal ?",
    )


def _fallback():
    message = "Assistant IA indisponible pour le moment. Réessaie dans quelques secondes."
    return {
        "analysis": message,
        "watch_items": [],
        "actions": [],
        "message": message,
        "insights": [],
        "suggested_actions": [],
        "question": None,
        "questions": [],
    }


def call_llm(system_prompt, context_json, context=None):
    request_id = str(uuid4())
    template = maybe_template_response(context or {})
    if template:
        return {**template, "request_id": request_id, "mode": "template"}
    if not getattr(settings, "AI_ENABLED", False):
        response = _local_support_response(context) if (context or {}).get("scope") == "support" else _local_assistant_summary(context)
        return {**response, "request_id": request_id, "mode": "fallback"}

    if OpenAI is None or not getattr(settings, "OPENAI_API_KEY", None):
        LOGGER.warning("AI disabled: missing OpenAI client or API key.")
        response = _local_support_response(context) if (context or {}).get("scope") == "support" else _local_assistant_summary(context)
        return {**response, "request_id": request_id, "mode": "fallback"}

    try:
        ai_mode = (context or {}).get("ai_mode") or "full"
        model_default = getattr(settings, "AI_MODEL", "gpt-4o-mini")
        model_light = getattr(settings, "AI_MODEL_LIGHT", model_default)
        model_full = getattr(settings, "AI_MODEL_FULL", model_default)
        model = model_full if ai_mode == "full" else model_light

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"CONTEXT:\n{context_json}"},
        ]
        if context and context.get("user_question"):
            messages.append({"role": "user", "content": f"USER_QUESTION:\n{context['user_question']}"})
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        data["request_id"] = request_id
        data["mode"] = "ai_enabled"
        return data
    except Exception as exc:  # pragma: no cover
        LOGGER.exception("AI call failed: %s", exc)
        response = _local_support_response(context) if (context or {}).get("scope") == "support" else _local_assistant_summary(context)
        return {**response, "request_id": request_id, "mode": "fallback"}


def validate_llm_json(data, context=None):
    from jsonschema import validate, ValidationError

    schema = {
        "type": "object",
        "properties": {
            "analysis": {"type": "string"},
            "watch_items": {"type": "array", "items": {"type": "string"}},
            "actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "type": {"type": "string"},
                        "href": {"type": ["string", "null"]},
                    },
                    "required": ["label"],
                },
            },
            "message": {"type": "string"},
            "insights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "severity": {"type": "string"},
                    },
                    "required": ["title", "description"],
                },
            },
            "suggested_actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action_key": {"type": "string"},
                        "label": {"type": "string"},
                        "payload": {"type": "object"},
                        "requires_confirmation": {"type": "boolean"},
                    },
                    "required": ["action_key"],
                },
            },
            "question": {"type": ["string", "null"]},
        },
    }

    try:
        validate(data, schema)
    except (ValidationError, Exception):
        if context:
            response = _local_support_response(context) if context.get("scope") == "support" else _local_assistant_summary(context)
            return response, True
        return _fallback(), True

    analysis = (data.get("analysis") or data.get("message") or "")[:1400]
    watch_items = data.get("watch_items") or []
    actions = data.get("actions") or []
    message = analysis
    insights = data.get("insights") or []
    suggested_actions = data.get("suggested_actions") or []
    question = data.get("question", None)

    cleaned_insights = []
    for ins in insights:
        if not isinstance(ins, dict):
            continue
        cleaned_insights.append(
            {
                "title": ins.get("title", "")[:200],
                "description": ins.get("description", "")[:800],
                "severity": ins.get("severity", "info"),
            }
        )

    cleaned_actions = []
    for act in actions:
        if not isinstance(act, dict):
            continue
        label = (act.get("label") or "").strip()
        if not label:
            continue
        action_type = act.get("type") if act.get("type") in ("link", "info") else None
        href = act.get("href") if isinstance(act.get("href"), str) else None
        cleaned_actions.append(
            {
                "label": label[:160],
                "type": action_type or ("link" if href else "info"),
                "href": href[:200] if href else None,
            }
        )

    cleaned_suggested_actions = []
    for act in suggested_actions:
        if not isinstance(act, dict):
            continue
        action_key = act.get("action_key")
        if action_key not in ACTION_TEMPLATES:
            continue
        method, endpoint = ACTION_TEMPLATES[action_key]
        cleaned_suggested_actions.append(
            {
                "label": act.get("label", action_key)[:120],
                "endpoint": endpoint,
                "method": method,
                "payload": act.get("payload") or {},
                "requires_confirmation": bool(act.get("requires_confirmation", True)),
            }
        )

    if not watch_items and cleaned_insights:
        watch_items = []
        for ins in cleaned_insights:
            title = (ins.get("title") or "").strip()
            desc = (ins.get("description") or "").strip()
            if not title and not desc:
                continue
            watch_items.append(f"{title} — {desc}".strip(" —"))

    if not analysis:
        if context:
            response = _local_support_response(context) if context.get("scope") == "support" else _local_assistant_summary(context)
            return response, True
        return _fallback(), True

    return {
        "analysis": message,
        "watch_items": [item[:240] for item in watch_items if isinstance(item, str)][:4],
        "actions": cleaned_actions[:4],
        "message": message,
        "insights": cleaned_insights,
        "suggested_actions": cleaned_suggested_actions,
        "question": question if question else None,
        "questions": [] if question else [],
    }, False
