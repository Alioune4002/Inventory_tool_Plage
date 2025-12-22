import json
import logging
from uuid import uuid4
from django.conf import settings
from django.db.models import Sum, Count, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
import time
import uuid

import jsonschema

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

from products.models import Product, LossEvent

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
"""

ACTION_TEMPLATES = {
    "refresh_stats": ("GET", "/api/inventory-stats/"),
    "suggest_export": ("GET", "/api/exports/"),
    "prefill_categories": ("POST", "/api/categories/"),
    "add_loss_placeholder": ("POST", "/api/losses/"),
}


def build_context(user, scope=None, period_start=None, period_end=None, filters=None, user_question=None):
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

    fast_movers = list(
        products_qs.order_by("-quantity").values("name", "quantity", "unit", "category")[:5]
    )
    slow_movers = list(
        products_qs.filter(quantity__gt=0).order_by("quantity").values("name", "quantity", "unit", "category")[:5]
    )
    top_losses = list(
        losses_qs.values("product__name")
        .annotate(total_qty=Sum("quantity"))
        .order_by("-total_qty")[:5]
    )

    # Focus items list (limit 50)
    items = list(
        products_qs.order_by("quantity")
        .values("name", "quantity", "unit", "category", "service_id", "barcode", "internal_sku", "container_status")[:50]
    )

    missing_id_count = products_qs.filter(barcode__isnull=True, internal_sku__isnull=True).count()
    question = (user_question or "").strip()[:500]
    context = {
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
            "L’IA est temporairement indisponible, mais ces repères peuvent déjà aider."
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
        return {**_local_assistant_summary(context), "request_id": request_id, "mode": "fallback"}

    if OpenAI is None or not getattr(settings, "OPENAI_API_KEY", None):
        LOGGER.warning("AI disabled: missing OpenAI client or API key.")
        return {**_local_assistant_summary(context), "request_id": request_id, "mode": "fallback"}

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"CONTEXT:\n{context_json}"},
        ]
        if context and context.get("user_question"):
            messages.append({"role": "user", "content": f"USER_QUESTION:\n{context['user_question']}"})
        response = client.chat.completions.create(
            model=getattr(settings, "AI_MODEL", "gpt-4o-mini"),
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
        return {**_fallback(), "request_id": request_id, "mode": "fallback"}


def validate_llm_json(data):
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
