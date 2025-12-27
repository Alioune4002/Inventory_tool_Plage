from django.http import HttpResponse

try:
    from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST
except Exception:  # pragma: no cover
    Counter = None
    generate_latest = None
    CONTENT_TYPE_LATEST = "text/plain"


PROMETHEUS_AVAILABLE = Counter is not None

if PROMETHEUS_AVAILABLE:
    OFF_LOOKUP_FAILURES = Counter(
        "stockscan_off_lookup_failures_total",
        "OpenFoodFacts lookup failures",
        ["reason"],
    )
    EXPORT_EVENTS = Counter(
        "stockscan_export_events_total",
        "Export events",
        ["format", "emailed"],
    )
    AI_REQUESTS = Counter(
        "stockscan_ai_requests_total",
        "AI assistant requests",
        ["mode"],
    )


def metrics_view(request):
    if not PROMETHEUS_AVAILABLE or generate_latest is None:
        return HttpResponse("prometheus_client_not_installed", status=503)
    payload = generate_latest()
    return HttpResponse(payload, content_type=CONTENT_TYPE_LATEST)


def track_off_lookup_failure(reason):
    if PROMETHEUS_AVAILABLE:
        OFF_LOOKUP_FAILURES.labels(reason=reason or "unknown").inc()


def track_export_event(export_format, emailed):
    if PROMETHEUS_AVAILABLE:
        EXPORT_EVENTS.labels(format=export_format or "unknown", emailed=str(bool(emailed)).lower()).inc()


def track_ai_request(mode):
    if PROMETHEUS_AVAILABLE:
        AI_REQUESTS.labels(mode=mode or "unknown").inc()
