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
from .services.assistant import build_context, call_llm_chat


class AiAssistantRateThrottle(SimpleRateThrottle):
    scope = "ai_assistant"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class AiAssistantView(APIView):
    """
    Endpoint "panel / analyse" (réponse structurée) utilisé par le front:
    POST /api/ai/assistant/

    Objectif: renvoyer un JSON compatible avec AIAssistantPanel.jsx :
    {
      enabled, analysis, watch_items, actions, message, insights, suggested_actions,
      question, request_id, mode, duration_ms, invalid_json
    }

    On s'appuie sur call_llm_chat() (réponse texte) puis on l'emballe en "analysis".
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiAssistantRateThrottle]

    def post(self, request, *args, **kwargs):
        started = time.time()
        request_id = str(uuid4())

        payload = request.data or {}
        scope = (payload.get("scope") or "inventory").strip()

        # Période / filtres
        month = (payload.get("filters") or {}).get("month") or payload.get("month") or payload.get("period_start") or ""
        month = str(month).strip()

        filters = payload.get("filters") or {}
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

        # Quotas (mêmes règles que chat)
        limits = get_limits(tenant)
        if scope == "support":
            ai_limit = limits.get("ai_support_weekly_limit")
            if ai_limit is not None:
                now = timezone.now()
                start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                used = AIRequestEvent.objects.filter(tenant=tenant, scope="support", created_at__gte=start).count()
                if used >= int(ai_limit):
                    raise LimitExceeded(
                        code="LIMIT_AI_REQUESTS_WEEK",
                        detail="Quota IA hebdomadaire atteint. Passez à un plan supérieur pour continuer.",
                    )
        else:
            ai_limit = limits.get("ai_requests_monthly_limit")
            if ai_limit is not None:
                start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                used = (
                    AIRequestEvent.objects.filter(tenant=tenant, created_at__gte=start)
                    .exclude(scope="support")
                    .count()
                )
                if used >= int(ai_limit):
                    raise LimitExceeded(
                        code="LIMIT_AI_REQUESTS_MONTH",
                        detail="Quota IA mensuel atteint. Passez à un plan supérieur pour continuer.",
                    )

        plan_code = get_plan_code(tenant)
        ai_mode = "light" if plan_code == "BOUTIQUE" else "full"

        # Contexte (réutilise build_context)
        context = build_context(
            request.user,
            scope=scope,
            period_start=month or None,
            period_end=month or None,
            filters={"service": service or "all", "month": month or None},
            user_question=question or None,
            mode=ai_mode,
        )

        # Appel LLM (format chat), puis on map vers la réponse "panel"
        # NB: pas besoin d'historique ici
        context["chat_history"] = []
        raw = call_llm_chat(context)
        reply = (raw.get("reply") or "").strip()

        duration_ms = int((time.time() - started) * 1000)

        # Log request
        try:
            AIRequestEvent.objects.create(
                tenant=tenant,
                user=request.user,
                scope=scope or "inventory",
                mode=ai_mode,
                meta={"duration_ms": duration_ms},
            )
        except Exception:
            pass

        try:
            track_ai_request(ai_mode, template_used=False)
        except Exception:
            pass

        analysis_text = reply or "Je n’ai pas pu formuler une réponse. Pouvez-vous reformuler en une phrase ?"

        return Response(
            {
                "enabled": True,
                "analysis": analysis_text,
                "watch_items": [],
                "actions": [],
                "message": analysis_text,
                "insights": [],
                "suggested_actions": [],
                "question": None,
                "request_id": request_id,
                "mode": raw.get("mode", "fallback"),
                "duration_ms": duration_ms,
                "invalid_json": False,
            },
            status=status.HTTP_200_OK,
        )


class AiChatView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiAssistantRateThrottle]

    def post(self, request, *args, **kwargs):
        started = time.time()
        request_id = str(uuid4())

        payload = request.data or {}
        scope = payload.get("scope") or "inventory"
        month = (payload.get("month") or payload.get("period_start") or "").strip()
        service = payload.get("service") or payload.get("service_id") or (payload.get("filters") or {}).get("service")
        if service is None:
            service = ""
        service = str(service)

        message = (payload.get("message") or payload.get("question") or "").strip()
        conversation_id = payload.get("conversation_id")

        tenant = get_tenant_for_request(request)

        # Entitlement
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
        limits = get_limits(tenant)
        if scope == "support":
            ai_limit = limits.get("ai_support_weekly_limit")
            if ai_limit is not None:
                now = timezone.now()
                start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                used = AIRequestEvent.objects.filter(tenant=tenant, scope="support", created_at__gte=start).count()
                if used >= int(ai_limit):
                    raise LimitExceeded(
                        code="LIMIT_AI_REQUESTS_WEEK",
                        detail="Quota IA hebdomadaire atteint. Passez à un plan supérieur pour continuer.",
                    )
        else:
            ai_limit = limits.get("ai_requests_monthly_limit")
            if ai_limit is not None:
                start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                used = (
                    AIRequestEvent.objects.filter(tenant=tenant, created_at__gte=start)
                    .exclude(scope="support")
                    .count()
                )
                if used >= int(ai_limit):
                    raise LimitExceeded(
                        code="LIMIT_AI_REQUESTS_MONTH",
                        detail="Quota IA mensuel atteint. Passez à un plan supérieur pour continuer.",
                    )

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

        # Historique
        history_qs = conv.messages.order_by("-created_at")[:14]
        history = list(reversed(list(history_qs.values("role", "content"))))

        # Contexte
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
            AIMessage.objects.create(conversation=conv, role="assistant", content=reply, meta={"mode": raw.get("mode")})

        duration_ms = int((time.time() - started) * 1000)

        # log request
        try:
            AIRequestEvent.objects.create(
                tenant=tenant,
                user=request.user,
                scope=scope or "inventory",
                mode=ai_mode,
                meta={"duration_ms": duration_ms, "conversation_id": str(conv.id)},
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
            },
            status=status.HTTP_200_OK,
        )