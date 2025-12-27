from django.conf import settings
from django.db import models

from accounts.models import Tenant


class AIRequestEvent(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="ai_requests")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    scope = models.CharField(max_length=50, default="inventory")
    mode = models.CharField(max_length=20, default="full")
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="ai_req_tenant_created_idx"),
            models.Index(fields=["tenant", "created_at", "scope"], name="ai_req_tenant_scope_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} ai {self.scope} ({self.created_at.date()})"
