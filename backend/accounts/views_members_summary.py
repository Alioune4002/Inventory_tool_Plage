# Deployed backend: https://inventory-tool-plage.onrender.com
from __future__ import annotations

from django.db.models import OuterRef, Subquery
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Membership, AuditLog
from accounts.utils import get_tenant_for_request, get_user_role


class MembersSummaryPermission(permissions.BasePermission):
    """
    Owner only (admin principal).
    """
    def has_permission(self, request, view):
        return get_user_role(request) == "owner"


class MembersSummaryView(APIView):
    """
    GET /api/auth/members/summary/

    Dashboard admin (read-only):
    - membres + rôles
    - scope service (si limité à un seul service)
    - dernière action
    - activité récente (AuditLog)
    """
    permission_classes = [permissions.IsAuthenticated, MembersSummaryPermission]

    def get(self, request):
        tenant = get_tenant_for_request(request)

        last_action_subq = AuditLog.objects.filter(
            tenant=tenant,
            user_id=OuterRef("user_id"),
        ).order_by("-created_at")

        members = (
            Membership.objects.filter(tenant=tenant)
            .select_related("user", "service")
            .annotate(
                last_action=Subquery(last_action_subq.values("action")[:1]),
                last_action_at=Subquery(last_action_subq.values("created_at")[:1]),
            )
            .order_by("role", "created_at")
        )

        members_payload = []
        for m in members:
            members_payload.append(
                {
                    "id": m.id,
                    "user": {
                        "id": m.user_id,
                        "username": getattr(m.user, "username", ""),
                        "email": getattr(m.user, "email", ""),
                    },
                    "role": m.role,
                    "service_scope": (
                        {"id": m.service_id, "name": m.service.name} if m.service_id else None
                    ),
                    "joined_at": m.created_at,
                    "last_action": (
                        {"action": m.last_action, "at": m.last_action_at}
                        if m.last_action
                        else None
                    ),
                }
            )

        recent = AuditLog.objects.filter(tenant=tenant).select_related("user")[:20]
        recent_payload = [
            {
                "action": r.action,
                "at": r.created_at,
                "user": {
                    "id": r.user_id,
                    "username": getattr(r.user, "username", None) if r.user_id else None,
                },
                "object_type": r.object_type,
                "object_id": r.object_id,
                "metadata": r.meta,
            }
            for r in recent
        ]

        return Response({"members": members_payload, "recent_activity": recent_payload})