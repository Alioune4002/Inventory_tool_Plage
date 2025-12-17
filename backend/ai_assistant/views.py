import json

import time
from uuid import uuid4

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework import status

from .services.assistant import build_context, call_llm, validate_llm_json, SYSTEM_PROMPT


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

        context = build_context(request.user, scope, period_start, period_end, filters)
        context_json = json.dumps(context, ensure_ascii=False)
        raw = call_llm(SYSTEM_PROMPT, context_json, context)
        data, invalid_json = validate_llm_json(raw)
        duration_ms = int((time.time() - started) * 1000)
        data.update(
            {
                "request_id": raw.get("request_id") if isinstance(raw, dict) else request_id,
                "mode": raw.get("mode", "fallback") if isinstance(raw, dict) else "fallback",
                "duration_ms": duration_ms,
                "invalid_json": invalid_json,
            }
        )
        return Response(data, status=status.HTTP_200_OK)
