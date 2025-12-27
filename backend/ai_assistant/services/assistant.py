import json
import logging
from uuid import uuid4
from django.conf import settings
from django.db.models import Sum, Count, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone

import jsonschema

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
You are Inventarium AI, an inventory analyst AND product coach.
You ONLY answer in valid JSON with the shape:
{
  "message": "<string>",
  "insights": [{"title": "", "description": "", "severity": "info|warning|critical"}],
  "suggested_actions": [{"action_key": "", "label": "", "payload": {}, "requires_confirmation": true}],
  "question": "<string or null>"
}
Rules:
- Never invent data; rely strictly on provided CONTEXT.
- If data is sparse, provide short usage guidance (ex: créer des catégories, utiliser SKU interne, tester l'export, scanner un code-barres).
- Keep tool-help contextual (multi-services, catégories, SKU, export, pertes) and concise.
- If USER_QUESTION is present, answer it first in `message` in 1-3 sentences, then add insights.
- If data quality is low (ex: categories_count faible, sku_missing_count > 0, very few movements), propose at most 3 recommendations, each with: benefit in 1 sentence, an example (ex format SKU, liste de catégories, routine hebdo), and cite evidence using counters from CONTEXT (ex: "categories_count=0").
- Do not invent features; if FEATURES indicate a module is disabled, speak au conditionnel ("si vous activez l’option export/scan…").
- If data is missing or uncertain, ask a concise clarification in `question`.
- Keep `suggested_actions` empty if no safe action.
- Use French for message/insights/question.
- `payload` must stay small.
- If CONTEXT.ai_mode is "light", keep answers short, limit insights to essentials, and avoid destructive or irreversible suggested actions.
- If CONTEXT.scope is "support", answer with clear step-by-step help for StockScan usage/troubleshooting. Use SUPPORT_GUIDE if present.
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
    usage = ctx.get("usage", {})
    user_question = ctx.get("user_question")
    message = (
        f"{ctx.get('tenant', {}).get('name', 'Votre organisation')} : "
        f"{inv.get('total_skus', 0)} SKU(s), {inv.get('low_stock_count', 0)} (<3 unités), "
        f"{inv.get('out_of_stock_count', 0)} épuisés. "
        f"{losses.get('total_qty', 0)} pertes depuis {ctx.get('period', {}).get('month') or 'le mois actif'}."
    )
    if user_question:
        message = (
            f"Question reçue : {user_question}. "
            f"{message} "
            "Voici un point rapide basé sur vos données actuelles."
        )

    insights = []
    if inv.get("low_stock_count", 0) > 0:
        insights.append(
            {
                "title": "Stocks bas détectés",
                "description": f"{inv['low_stock_count']} produit(s) à moins de 3 unités.",
                "severity": "warning",
            }
        )
    if inv.get("out_of_stock_count", 0) > 0:
        insights.append(
            {
                "title": "Produits rupture",
                "description": f"{inv['out_of_stock_count']} produit(s) sont à 0 stock.",
                "severity": "critical",
            }
        )
    if losses.get("total_qty", 0) > 0:
        insights.append(
            {
                "title": "Pertes enregistrées",
                "description": f"{losses['total_qty']} unité(s) perdues ce mois.",
                "severity": "info",
            }
        )

    actions = []
    if insights and usage.get("services_count", 0) > 1:
        actions.append(
            {
                "action_key": "refresh_stats",
                "label": "Mettre à jour les stats",
                "payload": {},
                "requires_confirmation": False,
            }
        )

    return {
        "message": message,
        "insights": insights[:3],
        "suggested_actions": actions,
        "question": None,
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
            "message": text,
            "insights": [],
            "suggested_actions": [],
            "question": question,
        }

    if any(k in q for k in ["export", "csv", "excel"]):
        return _msg(
            "Exports: allez dans Exports, choisissez la periode et le format (CSV/Excel), puis lancez le telechargement. "
            "Si vous voyez une erreur 403, le quota de votre plan est atteint.",
            "Le probleme arrive-t-il sur CSV, Excel, ou les deux ?",
        )

    if any(k in q for k in ["403", "limite", "quota"]):
        return _msg(
            "Une erreur 403 indique souvent un quota de plan atteint (exports ou IA). "
            "Verifiez votre plan dans Parametres > Abonnement & facturation.",
            "Quelle action precise declenche l'erreur (export, IA, creation service) ?",
        )

    if any(k in q for k in ["assistant", "ia", "ai"]):
        quota_msg = ""
        if ai_limit is not None:
            quota_msg = f" Votre quota hebdomadaire est de {ai_limit} requete(s)."
        return _msg(
            "L'assistant IA est disponible sur Duo (mode light) et Multi (mode complet)."
            f"{quota_msg} Si l'IA repond peu, reessayez ou verifiez votre quota.",
            "Quel type d'aide attendez-vous (analyse stock, exports, configuration) ?",
        )

    if any(k in q for k in ["scan", "code-barres", "barcode", "openfoodfacts", "off"]):
        return _msg(
            "Scan: sur iOS Safari, la camera peut etre limitee. Utilisez la saisie manuelle si besoin. "
            "Le pre-remplissage OpenFoodFacts concerne surtout les produits alimentaires.",
            "Quel navigateur utilisez-vous et quel message d'erreur voyez-vous ?",
        )

    if any(k in q for k in ["service", "services"]):
        return _msg(
            "Pour changer de service, utilisez le selecteur en haut de l'app. "
            "Le nombre de services autorises depend du plan.",
            "Souhaitez-vous ajouter un service ou simplement en changer ?",
        )

    if any(k in q for k in ["paiement", "abonnement", "stripe", "facturation"]):
        return _msg(
            "Facturation: allez dans Parametres > Abonnement & facturation pour gerer votre abonnement. "
            "Si le plan n'est pas active apres paiement, rechargez la page de succes avec session_id.",
            "Pouvez-vous confirmer le plan achete et la date du paiement ?",
        )

    if any(k in q for k in ["connexion", "login", "mot de passe", "reset"]):
        return _msg(
            "Connexion: verifiez vos identifiants. Pour reinitialiser, utilisez 'Mot de passe oublie'. "
            "Si plusieurs comptes partagent un email, connectez-vous avec le nom d'utilisateur.",
            "Avez-vous un message d'erreur precis a l'ecran ?",
        )

    return _msg(
        "Je peux aider sur les exports, les services, la facturation, l'IA, le scan, ou les modules. "
        f"Si besoin, contactez {support_email}.",
        "Quel est votre besoin principal ?",
    )


def _fallback():
    return {
        "message": "Assistant IA indisponible pour le moment. Réessaie dans quelques secondes.",
        "insights": [],
        "suggested_actions": [],
        "question": None,
        "questions": [],
    }


def call_llm(system_prompt, context_json, context=None):
    request_id = str(uuid4())
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
        "required": ["message"],
    }

    try:
        validate(data, schema)
    except (ValidationError, Exception):
        if context:
            response = _local_support_response(context) if context.get("scope") == "support" else _local_assistant_summary(context)
            return response, True
        return _fallback(), True

    message = (data.get("message") or "")[:1200]
    insights = data.get("insights") or []
    actions = data.get("suggested_actions") or []
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
        action_key = act.get("action_key")
        if action_key not in ACTION_TEMPLATES:
            continue
        method, endpoint = ACTION_TEMPLATES[action_key]
        cleaned_actions.append(
            {
                "label": act.get("label", action_key)[:120],
                "endpoint": endpoint,
                "method": method,
                "payload": act.get("payload") or {},
                "requires_confirmation": bool(act.get("requires_confirmation", True)),
            }
        )

    return {
        "message": message,
        "insights": cleaned_insights,
        "suggested_actions": cleaned_actions,
        "question": question if question else None,
        "questions": [] if question else [],
    }, False
