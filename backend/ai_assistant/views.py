import json
import time
from uuid import uuid4

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework import status
from accounts.services.paywall import paywall_response

from .services.assistant import build_context, call_llm, validate_llm_json, SYSTEM_PROMPT
from accounts.services.access import check_entitlement
from accounts.utils import get_tenant_for_request


class AiAssistantRateThrottle(SimpleRateThrottle):
    scope = "ai_assistant"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class AiAssistantView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiAssistantRateThrottle]

    def post(self, request, *args, **kwargs):
      
        if not getattr(settings, "AI_ENABLED", True):
            return Response(
                {
                    "enabled": False,
                    "message": "Assistant IA désactivé.",
                    "insights": [],
                    "suggested_actions": [],
                    "question": None,
                },
                status=status.HTTP_200_OK,
            )

        started = time.time()
        request_id = str(uuid4())

        payload = request.data or {}
        scope = payload.get("scope") or "inventory"
        period_start = payload.get("period_start")
        period_end = payload.get("period_end")
        filters = payload.get("filters") or {}
        question = payload.get("question") or payload.get("user_question")

        tenant = get_tenant_for_request(request)

       
        try:
            check_entitlement(tenant, "ai_assistant_basic")
        except Exception as exc:
            code = getattr(exc, "code", None) or "FEATURE_NOT_INCLUDED"
            detail = getattr(exc, "detail", None) or "Cette fonctionnalité nécessite le plan Multi."

            return Response(
                {
                    "enabled": False,
                    "code": code,
                    "message": str(detail),
                    "insights": [
                        {
                            "title": "Plan requis",
                            "description": "Activez un plan supérieur pour accéder à l’assistant IA.",
                            "severity": "warning",
                        }
                    ],
                    "suggested_actions": [],
                    "question": None,
                    "request_id": request_id,
                    "mode": "paywall",
                    "duration_ms": int((time.time() - started) * 1000),
                    "invalid_json": False,
                },
                status=status.HTTP_200_OK,
            )

        context = build_context(
            request.user,
            scope,
            period_start,
            period_end,
            filters,
            user_question=question,
        )

        context_json = json.dumps(context, ensure_ascii=False)
        raw = call_llm(SYSTEM_PROMPT, context_json, context)
        data, invalid_json = validate_llm_json(raw)

        duration_ms = int((time.time() - started) * 1000)
        data.update(
            {
                "enabled": True,
                "request_id": raw.get("request_id") if isinstance(raw, dict) else request_id,
                "mode": raw.get("mode", "fallback") if isinstance(raw, dict) else "fallback",
                "duration_ms": duration_ms,
                "invalid_json": invalid_json,
            }
        )
        return Response(data, status=status.HTTP_200_OK)