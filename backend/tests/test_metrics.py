from rest_framework.test import APIClient

try:
    import prometheus_client  # noqa: F401

    PROM_AVAILABLE = True
except Exception:
    PROM_AVAILABLE = False


def test_metrics_endpoint():
    client = APIClient()
    res = client.get("/metrics/")

    if PROM_AVAILABLE:
        assert res.status_code == 200
        content_type = res.headers.get("Content-Type", "")
        assert "text/plain" in content_type
        content = res.content.decode("utf-8", errors="ignore")
        assert "stockscan_off_lookup_failures_total" in content
        assert "stockscan_export_events_total" in content
        assert "stockscan_ai_requests_total" in content
    else:
        assert res.status_code == 503
