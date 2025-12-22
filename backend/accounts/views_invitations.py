# backend/accounts/views_invitations.py
from __future__ import annotations

import secrets
from datetime import timedelta

import logging
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from accounts.models import Invitation, Membership, UserProfile, Service
from accounts.utils import get_tenant_for_request, get_user_role

from utils.sendgrid_email import invitations_email_enabled, send_email_with_sendgrid

logger = logging.getLogger(__name__)

User = get_user_model()

FRONTEND_URL = getattr(settings, "FRONTEND_URL", "https://stockscan.app")


class InvitationPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return get_user_role(request) == "owner"


class InvitationCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, InvitationPermission]

    def post(self, request):
        tenant = get_tenant_for_request(request)

        email = request.data.get("email")
        role = request.data.get("role", "operator")
        service_id = request.data.get("service_id", None)

        if not email:
            return Response({"detail": "Email requis."}, status=400)

        # éviter doublons actifs
        if Invitation.objects.filter(
            tenant=tenant,
            email=email,
            status__in=["PENDING", "SENT"],
        ).exists():
            return Response({"detail": "Invitation déjà envoyée."}, status=400)

        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=7)

        service_obj = None
        if service_id:
            service_obj = Service.objects.filter(id=service_id, tenant=tenant).first()
            if not service_obj:
                return Response({"detail": "Service invalide."}, status=400)

        invitation = Invitation.objects.create(
            tenant=tenant,
            email=email,
            role=role,
            service=service_obj,
            token=token,
            expires_at=expires_at,
            status="SENT",
            created_by=request.user,
        )

        accept_url = f"{FRONTEND_URL}/invitation/accept?token={token}"
        decline_url = f"{FRONTEND_URL}/invitation/decline?token={token}"
        scope_label = service_obj.name if service_obj else "Tous les services"

        subject = f"Invitation à rejoindre {tenant.name} sur StockScan"
        text = f"""
Bonjour,

Vous avez été invité à rejoindre le commerce "{tenant.name}" sur StockScan.
Accès : {role} · {scope_label}

👉 Accepter l’invitation :
{accept_url}

👉 Refuser l’invitation :
{decline_url}

Ce lien expire dans 7 jours.

— StockScan
"""

        html = f"""
<div style="font-family:Inter,system-ui;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb">
    <div style="background:#111827;color:#fff;padding:16px;font-weight:800">
      Invitation StockScan
    </div>
    <div style="padding:20px">
      <p>Bonjour,</p>
      <p>
        Vous avez été invité à rejoindre le commerce
        <strong>{tenant.name}</strong> sur StockScan.
      </p>
      <p style="margin:8px 0;font-size:14px;color:#4b5563">
        Accès : <strong>{role}</strong> · {scope_label}
      </p>
      <p style="margin:20px 0">
        <a href="{accept_url}"
           style="background:#2563eb;color:#fff;padding:12px 18px;
                  border-radius:10px;text-decoration:none;font-weight:700">
          Accepter l’invitation
        </a>
      </p>
      <p style="margin:8px 0">
        <a href="{decline_url}"
           style="color:#64748b;text-decoration:none;font-size:13px">
          Refuser l’invitation
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">
        Lien valable 7 jours.
      </p>
    </div>
  </div>
</div>
"""

        if invitations_email_enabled():
            sent = send_email_with_sendgrid(
                to_email=email,
                subject=subject,
                text_body=text,
                html_body=html,
                filename="invitation-stockscan.html",
                file_bytes=b"",
                mimetype="text/plain",
            )
            if not sent:
                logger.warning("Invitation créée mais l’email n’a pas pu être envoyé à %s", email)
        else:
            logger.info("Envoi d’email d’invitation désactivé (token=%s)", token)

        return Response(
            {
                "id": invitation.id,
                "email": email,
                "role": role,
                "service": {"id": service_obj.id, "name": service_obj.name} if service_obj else None,
                "status": invitation.status,
                "expires_at": expires_at,
            },
            status=201,
        )


class InvitationAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return Response({"detail": "Token manquant."}, status=400)

        invitation = Invitation.objects.filter(token=token).first()
        if not invitation:
            return Response({"detail": "Invitation invalide."}, status=400)

        if invitation.status != "SENT":
            return Response({"detail": "Invitation déjà traitée."}, status=400)

        if invitation.expires_at < timezone.now():
            invitation.status = "EXPIRED"
            invitation.save(update_fields=["status"])
            return Response({"detail": "Invitation expirée."}, status=400)

        # créer ou récupérer l’utilisateur
        user = User.objects.filter(email__iexact=invitation.email).first()
        if not user:
            username = invitation.email.split("@")[0]
            user = User.objects.create_user(
                username=f"{username}-{User.objects.count()+1}",
                email=invitation.email,
                password=User.objects.make_random_password(),
            )

        Membership.objects.get_or_create(
            tenant=invitation.tenant,
            user=user,
            defaults={"role": invitation.role, "service": invitation.service},
        )

        if not hasattr(user, "profile"):
            UserProfile.objects.create(
                user=user,
                tenant=invitation.tenant,
                role=invitation.role,
            )

        invitation.status = "ACCEPTED"
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["status", "accepted_at"])

        # redirection front (login)
        return Response(
            {
                "detail": "Invitation acceptée.",
                "redirect": f"{FRONTEND_URL}/login",
            }
        )


class InvitationDeclineView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token") or request.query_params.get("token")
        if not token:
            return Response({"detail": "Token manquant."}, status=400)

        invitation = Invitation.objects.filter(token=token).first()
        if not invitation:
            return Response({"detail": "Invitation invalide."}, status=400)

        if invitation.status != "SENT":
            return Response({"detail": "Invitation déjà traitée."}, status=400)

        invitation.status = "CANCELED"
        invitation.save(update_fields=["status"])
        return Response({"detail": "Invitation refusée."})
