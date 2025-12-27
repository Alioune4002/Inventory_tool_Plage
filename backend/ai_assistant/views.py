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

from .services.assistant import build_context, call_llm, validate_llm_json, SYSTEM_PROMPT
from accounts.services.access import check_entitlement, get_limits, get_plan_code, LimitExceeded
from accounts.utils import get_tenant_for_request
from .models import AIRequestEvent
from inventory.metrics import track_ai_request


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
            detail = getattr(exc, "detail", None) or "Cette fonctionnalité nécessite le plan Duo ou Multi."

            return Response(
                {
                    "enabled": False,
                    "code": code,
                    "message": str(detail),
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
                    "duration_ms": int((time.time() - started) * 1000),
                    "invalid_json": False,
                },
                status=status.HTTP_200_OK,
            )

        limits = get_limits(tenant)
        if scope == "support":
            ai_limit = limits.get("ai_support_weekly_limit")
            if ai_limit is not None:
                now = timezone.now()
                start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                used = AIRequestEvent.objects.filter(
                    tenant=tenant, scope="support", created_at__gte=start
                ).count()
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

        context = build_context(
            request.user,
            scope,
            period_start,
            period_end,
            filters,
            user_question=question,
            mode=ai_mode,
        )

        context_json = json.dumps(context, ensure_ascii=False)
        raw = call_llm(SYSTEM_PROMPT, context_json, context)
        data, invalid_json = validate_llm_json(raw, context)

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
        try:
            AIRequestEvent.objects.create(
                tenant=tenant,
                user=request.user if request.user and request.user.is_authenticated else None,
                scope=scope or "inventory",
                mode=ai_mode,
                meta={"duration_ms": duration_ms},
            )
        except Exception:
            pass
        try:
            track_ai_request(ai_mode)
        except Exception:
            pass

        return Response(data, status=status.HTTP_200_OK)
