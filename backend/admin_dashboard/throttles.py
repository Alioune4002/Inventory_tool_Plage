from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class VisitTrackThrottle(SimpleRateThrottle):
    scope = "admin_visit"

    def get_cache_key(self, request, view):
        ip = self.get_ident(request)
        if not ip:
            return None
        return f"admin-visit:{ip}"

    def get_rate(self):
        return getattr(settings, "ADMIN_VISIT_THROTTLE_RATE", "20/min")
