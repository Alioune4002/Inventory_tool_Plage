import time
from uuid import uuid4

def paywall_response(
    *,
    message: str,
    feature: str = None,
    required_plan: str = "MULTI",
    code: str = "FEATURE_NOT_INCLUDED",
    request_id: str = None,
    started_ts: float = None,
    insights=None,
    suggested_actions=None,
):
    if request_id is None:
        request_id = str(uuid4())
    duration_ms = int(((time.time() - started_ts) if started_ts else 0) * 1000)

    if insights is None:
        insights = [
            {
                "title": "Plan requis",
                "description": "Passez au plan Multi pour activer cette fonctionnalité.",
                "severity": "warning",
            }
        ]

    if suggested_actions is None:
        # action “safe” côté front (navigation)
        suggested_actions = [
            {
                "label": "Voir les plans",
                "endpoint": "/app/billing",
                "method": "GET",
                "payload": {},
                "requires_confirmation": False,
            }
        ]

    return {
        "enabled": False,
        "code": code,
        "feature": feature,
        "required_plan": required_plan,
        "message": message,
        "insights": insights,
        "suggested_actions": suggested_actions,
        "question": None,
        "request_id": request_id,
        "mode": "paywall",
        "duration_ms": duration_ms,
        "invalid_json": False,
    }