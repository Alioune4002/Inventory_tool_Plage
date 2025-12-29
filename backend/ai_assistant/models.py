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


class AIConversation(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="ai_conversations")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_conversations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    scope = models.CharField(max_length=50, default="inventory")  # inventory|support|...
    service_id = models.CharField(max_length=64, blank=True, default="")  # "all" or id as string
    month = models.CharField(max_length=10, blank=True, default="")  # "YYYY-MM"

    title = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "updated_at"], name="ai_conv_tenant_updated_idx"),
            # ✅ <= 30 chars (Postgres limit)
            models.Index(fields=["tenant", "user", "updated_at"], name="ai_conv_tenant_user_upd_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} conv {self.scope} ({self.updated_at.date()})"


class AIMessage(models.Model):
    ROLE_CHOICES = (
        ("user", "user"),
        ("assistant", "assistant"),
        ("system", "system"),
    )

    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name="messages")
    created_at = models.DateTimeField(auto_now_add=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()

    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["conversation", "created_at"], name="ai_msg_conv_created_idx"),
        ]

    def __str__(self):
        return f"{self.conversation_id} {self.role} ({self.created_at.date()})"