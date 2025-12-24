# backend/accounts/views_invitations.py
from datetime import timedelta
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from .models import Invitation, Membership, UserProfile, Service, AuditLog
from .utils import get_tenant_for_request, get_user_role

User = get_user_model()


def _frontend_base() -> str:
    return getattr(settings, "FRONTEND_URL", "").rstrip("/") or "http://localhost:5173"


def _invite_link(token: str) -> str:
    return f"{_frontend_base()}/invitation/accept?token={token}"


def _gen_token() -> str:
    return secrets.token_urlsafe(32)[:64]


def _safe_get_profile(user):
    try:
        return user.profile
    except Exception:
        return None


class InvitationCreateView(APIView):
    """
    POST /api/auth/invitations/
    Body: { email, role?, service_id? }

    ✅ Anti-réinvitation:
      - si une invitation active existe déjà (SENT/PENDING non expirée) => 409 (on ne recrée pas)
      - si membership existe déjà (INVITED ou ACTIVE) => 409

    ✅ Robustesse email:
      - respecte settings.INVITATIONS_SEND_EMAILS
      - renvoie email_sent: true/false
      - si email pas envoyé => on renvoie quand même invite_link (utile pour fallback)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tenant = get_tenant_for_request(request)
        role = get_user_role(request)
        if role != "owner":
            raise PermissionDenied("Seul le owner peut inviter.")

        email = (request.data.get("email") or "").strip().lower()
        inv_role = (request.data.get("role") or "operator").strip()
        service_id = request.data.get("service_id", None)

        if not email:
            raise ValidationError({"email": "Email requis."})
        if inv_role not in ("owner", "manager", "operator"):
            raise ValidationError({"role": "Rôle invalide."})

        service_obj = None
        if service_id not in ("", None):
            try:
                service_obj = Service.objects.filter(id=int(service_id), tenant=tenant).first()
            except Exception:
                service_obj = None
            if not service_obj:
                raise ValidationError({"service_id": "Service invalide pour ce tenant."})

        now = timezone.now()

        # 1) Anti-réinvitation: invitation déjà active
        existing_active_inv = (
            Invitation.objects.filter(
                tenant=tenant,
                email=email,
                status__in=["PENDING", "SENT"],
                expires_at__gt=now,
            )
            .order_by("-created_at")
            .first()
        )
        if existing_active_inv:
            return Response(
                {
                    "detail": "Une invitation est déjà en cours pour cet email.",
                    "code": "INVITE_ALREADY_SENT",
                    "email": email,
                    "expires_at": existing_active_inv.expires_at.isoformat(),
                    "invite_link": _invite_link(existing_active_inv.token),
                    "email_sent": True,  # supposé déjà envoyé au moment de la création initiale
                },
                status=409,
            )

        # 2) Si user existe et membership existe déjà (INVITED ou ACTIVE): stop
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            existing_mem = Membership.objects.filter(user=existing_user, tenant=tenant).first()
            if existing_mem:
                return Response(
                    {
                        "detail": "Cet email est déjà lié à ce commerce (invité ou actif).",
                        "code": "ALREADY_MEMBER_OR_INVITED",
                        "status": existing_mem.status,
                    },
                    status=409,
                )

        # 3) Nettoyage soft: marque les invitations expirées restantes
        Invitation.objects.filter(
            tenant=tenant,
            email=email,
            status__in=["PENDING", "SENT"],
            expires_at__lte=now,
        ).update(status="EXPIRED")

        token = _gen_token()
        expires_at = now + timedelta(days=7)

        inv = Invitation.objects.create(
            tenant=tenant,
            email=email,
            role=inv_role,
            service=service_obj,
            token=token,
            expires_at=expires_at,
            status="SENT",
            created_by=request.user,
        )

        # ✅ Si user existe, on matérialise le membership INVITED
        if existing_user:
            Membership.objects.update_or_create(
                user=existing_user,
                tenant=tenant,
                defaults={
                    "role": inv_role,
                    "service": service_obj,
                    "status": "INVITED",
                    "invited_at": now,
                    "activated_at": None,
                },
            )

        AuditLog.objects.create(
            tenant=tenant,
            user=request.user,
            action="INVITE_SENT",
            object_type="Invitation",
            object_id=str(inv.id),
            service=service_obj,
            meta={"email": email, "role": inv_role},
        )

        link = _invite_link(token)

        # Email
        subject = f"Invitation StockScan — {tenant.name}"
        text_body = (
            f"Vous avez été invité à rejoindre {tenant.name} sur StockScan.\n\n"
            f"Créez votre mot de passe ici: {link}\n\n"
            f"Ce lien expire le {expires_at.strftime('%d/%m/%Y %H:%M')}."
        )

        email_sent = False
        email_error = None

        send_emails = getattr(settings, "INVITATIONS_SEND_EMAILS", True)
        if send_emails:
            try:
                from utils.sendgrid_email import send_email_with_sendgrid
                email_sent = bool(
                    send_email_with_sendgrid(
                        to_email=email,
                        subject=subject,
                        text_body=text_body,
                        html_body=None,
                        filename="",
                        file_bytes=None,
                        mimetype="text/plain",
                        fallback_to_django=True,
                    )
                )
            except Exception as exc:
                email_sent = False
                email_error = str(exc)
        else:
            email_sent = False

        payload = {
            "ok": True,
            "email": email,
            "expires_at": expires_at.isoformat(),
            "invite_link": link,
            "email_sent": email_sent,
        }
        # on ne leak pas l'erreur en prod, mais utile en debug
        if settings.DEBUG and email_error:
            payload["email_error"] = email_error

        return Response(payload, status=201)


class InvitationAcceptView(APIView):
    """
    GET  /api/auth/invitations/accept/?token=...   => preview
    POST /api/auth/invitations/accept/            => finalize (token + password)

    ✅ Accept => Membership.status = ACTIVE
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = (request.query_params.get("token") or "").strip()
        if not token:
            raise ValidationError({"token": "Token requis."})

        inv = Invitation.objects.filter(token=token).select_related("tenant", "service").first()
        if not inv:
            raise NotFound("Invitation introuvable.")

        if inv.status in ("CANCELED", "EXPIRED"):
            return Response({"status": inv.status}, status=410)
        if inv.accepted_at or inv.status == "ACCEPTED":
            return Response({"status": "ACCEPTED"}, status=409)
        if inv.expires_at <= timezone.now():
            inv.status = "EXPIRED"
            inv.save(update_fields=["status"])
            return Response({"status": "EXPIRED"}, status=410)

        return Response(
            {
                "status": "OK",
                "tenant": {"id": inv.tenant_id, "name": inv.tenant.name},
                "email": inv.email,
                "role": inv.role,
                "service": {"id": inv.service_id, "name": inv.service.name} if inv.service_id else None,
                "expires_at": inv.expires_at.isoformat(),
            }
        )

    @transaction.atomic
    def post(self, request):
        token = (request.data.get("token") or "").strip()
        password = request.data.get("password") or ""
        password_confirm = request.data.get("password_confirm") or ""
        username = (request.data.get("username") or "").strip()

        if not token:
            raise ValidationError({"token": "Token requis."})
        if len(password) < 8:
            raise ValidationError({"password": "8 caractères minimum."})
        if password != password_confirm:
            raise ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})

        inv = Invitation.objects.select_for_update().filter(token=token).select_related("tenant", "service").first()
        if not inv:
            raise NotFound("Invitation introuvable.")

        now = timezone.now()

        if inv.status in ("CANCELED", "EXPIRED"):
            return Response({"detail": "Invitation invalide."}, status=410)
        if inv.accepted_at or inv.status == "ACCEPTED":
            return Response({"detail": "Invitation déjà acceptée."}, status=409)
        if inv.expires_at <= now:
            inv.status = "EXPIRED"
            inv.save(update_fields=["status"])
            return Response({"detail": "Invitation expirée."}, status=410)

        tenant = inv.tenant
        email = inv.email.lower()
        service_obj = inv.service if inv.service_id else None

        user = User.objects.filter(email__iexact=email).first()
        created = False

        if not user:
            base = username or email.split("@")[0]
            base = "".join([c for c in base if c.isalnum() or c in ("-", "_")])[:24] or "user"
            final = base
            i = 0
            while User.objects.filter(username=final).exists():
                i += 1
                final = f"{base}{i}"
                if i > 50:
                    final = f"{base}{secrets.randbelow(9999)}"
                    break
            user = User.objects.create_user(username=final, email=email, password=password)
            created = True
        else:
            user.set_password(password)
            user.save(update_fields=["password"])

        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])

        existing_mem = Membership.objects.filter(user=user, tenant=tenant).first()
        if existing_mem and existing_mem.status == "ACTIVE":
            return Response({"detail": "Vous êtes déjà membre de ce commerce."}, status=409)

        membership, _ = Membership.objects.update_or_create(
            user=user,
            tenant=tenant,
            defaults={
                "role": inv.role,
                "service": service_obj,
                "status": "ACTIVE",
                "activated_at": now,
                "invited_at": existing_mem.invited_at if existing_mem else now,
            },
        )

        prof = _safe_get_profile(user)
        if not prof:
            UserProfile.objects.create(user=user, tenant=tenant, role=inv.role)
        else:
            changed = False
            if prof.tenant_id != tenant.id:
                prof.tenant = tenant
                changed = True
            if prof.role != inv.role:
                prof.role = inv.role
                changed = True
            if changed:
                prof.save(update_fields=["tenant", "role"])

        inv.status = "ACCEPTED"
        inv.accepted_at = now
        inv.save(update_fields=["status", "accepted_at"])

        Invitation.objects.filter(
            tenant=tenant,
            email=email,
            status__in=["PENDING", "SENT"],
        ).exclude(id=inv.id).update(status="CANCELED")

        AuditLog.objects.create(
            tenant=tenant,
            user=user,
            action="INVITE_ACCEPTED",
            object_type="Invitation",
            object_id=str(inv.id),
            service=service_obj,
            meta={"email": email, "created_user": created, "membership_status": "ACTIVE"},
        )

        return Response(
            {"ok": True, "detail": "Invitation acceptée. Vous pouvez vous connecter.", "email": email},
            status=200,
        )


class InvitationDeclineView(APIView):
    """
    POST /api/auth/invitations/decline/ { token }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        if not token:
            raise ValidationError({"token": "Token requis."})

        inv = Invitation.objects.filter(token=token).first()
        if not inv:
            raise NotFound("Invitation introuvable.")

        if inv.status in ("ACCEPTED",):
            return Response({"detail": "Invitation déjà acceptée."}, status=409)

        inv.status = "CANCELED"
        inv.save(update_fields=["status"])
        return Response({"ok": True}, status=200)