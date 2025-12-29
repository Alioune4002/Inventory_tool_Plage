import json
import time
from datetime import timedelta
from uuid import uuid4

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework import status

from accounts.services.access import check_entitlement, get_limits, get_plan_code, LimitExceeded
from accounts.utils import get_tenant_for_request
from inventory.metrics import track_ai_request

from .models import AIRequestEvent, AIConversation, AIMessage
from .services.assistant import (
    build_context,
    call_llm,
    validate_llm_json,
    call_llm_chat,
    SYSTEM_PROMPT,
)


class AiAssistantRateThrottle(SimpleRateThrottle):
    scope = "ai_assistant"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


def _enforce_ai_quotas(tenant, scope: str):
    """
    Quotas:
    - scope == support => weekly limit (ai_support_weekly_limit)
    - else => monthly limit (ai_requests_monthly_limit)
    """
    limits = get_limits(tenant)

    if scope == "support":
        ai_limit = limits.get("ai_support_weekly_limit")
        if ai_limit is None:
            return
        now = timezone.now()
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        used = AIRequestEvent.objects.filter(tenant=tenant, scope="support", created_at__gte=start).count()
        if used >= int(ai_limit):
            raise LimitExceeded(
                code="LIMIT_AI_REQUESTS_WEEK",
                detail="Quota IA hebdomadaire atteint. Passez à un plan supérieur pour continuer.",
            )
        return

    ai_limit = limits.get("ai_requests_monthly_limit")
    if ai_limit is None:
        return
    start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = AIRequestEvent.objects.filter(tenant=tenant, created_at__gte=start).exclude(scope="support").count()
    if used >= int(ai_limit):
        raise LimitExceeded(
            code="LIMIT_AI_REQUESTS_MONTH",
            detail="Quota IA mensuel atteint. Passez au plan Multi pour continuer.",
        )


class AiAssistantView(APIView):
    """
    Panel analyzer (réponse structurée), utilisé par AIAssistantPanel.jsx
    POST /api/ai/assistant/

    Retour (front-compatible):
    {
      enabled, analysis, watch_items, actions, message, insights, suggested_actions,
      question, request_id, mode, duration_ms, invalid_json
    }
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiAssistantRateThrottle]

    def post(self, request, *args, **kwargs):
        started = time.time()
        request_id = str(uuid4())

        payload = request.data or {}
        scope = str(payload.get("scope") or "inventory").strip()

        filters = payload.get("filters") or {}
        month = (
            filters.get("month")
            or payload.get("month")
            or payload.get("period_start")
            or payload.get("period_end")
            or ""
        )
        month = str(month).strip()

        service = (
            filters.get("service")
            or payload.get("service")
            or payload.get("service_id")
            or ""
        )
        service = "" if service is None else str(service)

        question = (payload.get("question") or payload.get("user_question") or "").strip()

        tenant = get_tenant_for_request(request)

        # Entitlement (soft paywall: 200 + enabled:false)
        try:
            check_entitlement(tenant, "ai_assistant_basic")
        except Exception as exc:
            code = getattr(exc, "code", None) or "FEATURE_NOT_INCLUDED"
            detail = getattr(exc, "detail", None) or "Cette fonctionnalité nécessite le plan Duo ou Multi."
            duration_ms = int((time.time() - started) * 1000)

            return Response(
                {
                    "enabled": False,
                    "code": code,
                    "analysis": str(detail),
                    "message": str(detail),
                    "watch_items": ["Passez à Duo ou Multi pour activer l’assistant IA."],
                    "actions": [{"label": "Voir les offres", "type": "link", "href": "/tarifs"}],
                    "insights": [
                        {
                            "title": "Plan requis",
                            "description": "Activez un plan Duo ou Multi pour accéder à l’assistant IA.",
                            "severity": "warning",
                        }
                    ],
                    "suggested_actions": [],
                    "question": None,
                    "request_id": request_id,
                    "mode": "paywall",
                    "duration_ms": duration_ms,
                    "invalid_json": False,
                },
                status=status.HTTP_200_OK,
            )

        # Quotas
        _enforce_ai_quotas(tenant, scope)

        plan_code = get_plan_code(tenant)
        ai_mode = "light" if plan_code == "BOUTIQUE" else "full"

        # Build context
        context = build_context(
            request.user,
            scope=scope,
            period_start=month or None,
            period_end=month or None,
            filters={"service": service or "all", "month": month or None},
            user_question=question or None,
            mode=ai_mode,
        )

        # Call structured LLM (panel)
        context_json = json.dumps(context or {}, ensure_ascii=False)
        raw = call_llm(SYSTEM_PROMPT, context_json, context=context)

        cleaned, invalid_json = validate_llm_json(raw, context=context)

        duration_ms = int((time.time() - started) * 1000)
        mode = raw.get("mode", "fallback")

        # Log request
        try:
            AIRequestEvent.objects.create(
                tenant=tenant,
                user=request.user,
                scope=scope or "inventory",
                mode=ai_mode,
                meta={
                    "duration_ms": duration_ms,
                    "llm_mode": mode,
                    "invalid_json": bool(invalid_json),
                },
            )
        except Exception:
            pass

        try:
            track_ai_request(ai_mode, template_used=(mode == "template"))
        except Exception:
            pass

        return Response(
            {
                "enabled": True,
                "analysis": cleaned.get("analysis") or cleaned.get("message"),
                "watch_items": cleaned.get("watch_items") or [],
                "actions": cleaned.get("actions") or [],
                "message": cleaned.get("message") or cleaned.get("analysis"),
                "insights": cleaned.get("insights") or [],
                "suggested_actions": cleaned.get("suggested_actions") or [],
                "question": cleaned.get("question"),
                "request_id": request_id,
                "mode": mode,
                "duration_ms": duration_ms,
                "invalid_json": bool(invalid_json),
            },
            status=status.HTTP_200_OK,
        )


class AiChatView(APIView):
    """
    Chat endpoint (drawer global)
    POST /api/ai/chat/

    Retour enrichi (backward compatible):
    {
      enabled, request_id, conversation_id, reply, mode, duration_ms,
      watch_items, actions, suggested_actions, question
    }
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiAssistantRateThrottle]

    def post(self, request, *args, **kwargs):
        started = time.time()
        request_id = str(uuid4())

        payload = request.data or {}
        scope = str(payload.get("scope") or "inventory").strip()
        month = str(payload.get("month") or payload.get("period_start") or "").strip()

        service = payload.get("service") or payload.get("service_id") or (payload.get("filters") or {}).get("service")
        service = "" if service is None else str(service)

        message = (payload.get("message") or payload.get("question") or "").strip()
        conversation_id = payload.get("conversation_id")

        tenant = get_tenant_for_request(request)

        # Entitlement (soft paywall)
        try:
            check_entitlement(tenant, "ai_assistant_basic")
        except Exception as exc:
            code = getattr(exc, "code", None) or "FEATURE_NOT_INCLUDED"
            detail = getattr(exc, "detail", None) or "Cette fonctionnalité nécessite le plan Duo ou Multi."
            return Response(
                {
                    "enabled": False,
                    "code": code,
                    "message": str(detail),
                    "request_id": request_id,
                    "conversation_id": conversation_id,
                    "reply": str(detail),
                    "mode": "paywall",
                    "duration_ms": int((time.time() - started) * 1000),
                },
                status=status.HTTP_200_OK,
            )

        # Quotas
        _enforce_ai_quotas(tenant, scope)

        plan_code = get_plan_code(tenant)
        ai_mode = "light" if plan_code == "BOUTIQUE" else "full"

        # Conversation
        conv = None
        if conversation_id:
            conv = AIConversation.objects.filter(id=conversation_id, tenant=tenant).first()

        if conv is None:
            conv = AIConversation.objects.create(
                tenant=tenant,
                user=request.user,
                scope=scope,
                service_id=service or "",
                month=month or "",
                title="",
            )

        if message:
            AIMessage.objects.create(conversation=conv, role="user", content=message)

        # History (last N)
        history_qs = conv.messages.order_by("-created_at")[:14]
        history = list(reversed(list(history_qs.values("role", "content"))))

        # Context
        context = build_context(
            request.user,
            scope=scope,
            period_start=month or None,
            period_end=month or None,
            filters={"service": service or "all", "month": month or None},
            user_question=message or None,
            mode=ai_mode,
        )
        context["chat_history"] = history

        raw = call_llm_chat(context)

        reply = (raw.get("reply") or "").strip()
        if reply:
            
            try:
                AIMessage.objects.create(
                    conversation=conv,
                    role="assistant",
                    content=reply,
                    meta={
                        "mode": raw.get("mode"),
                        "watch_items": raw.get("watch_items") or [],
                        "actions": raw.get("actions") or [],
                        "suggested_actions": raw.get("suggested_actions") or [],
                        "question": raw.get("question"),
                    },
                )
            except Exception:
                AIMessage.objects.create(conversation=conv, role="assistant", content=reply, meta={"mode": raw.get("mode")})

        duration_ms = int((time.time() - started) * 1000)

        
        try:
            AIRequestEvent.objects.create(
                tenant=tenant,
                user=request.user,
                scope=scope or "inventory",
                mode=ai_mode,
                meta={"duration_ms": duration_ms, "conversation_id": str(conv.id), "llm_mode": raw.get("mode")},
            )
        except Exception:
            pass

        try:
            track_ai_request(ai_mode, template_used=False)
        except Exception:
            pass

        return Response(
            {
                "enabled": True,
                "request_id": request_id,
                "conversation_id": str(conv.id),
                "reply": reply or "Je n’ai pas pu formuler une réponse. Pouvez-vous reformuler en une phrase ?",
                "mode": raw.get("mode", "fallback"),
                "duration_ms": duration_ms,
               
                "watch_items": raw.get("watch_items") or [],
                "actions": raw.get("actions") or [],
                "suggested_actions": raw.get("suggested_actions") or [],
                "question": raw.get("question"),
            },
            status=status.HTTP_200_OK,
        )