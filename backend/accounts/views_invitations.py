# accounts/views_invitations.py
from datetime import timedelta
import secrets

from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from .models import Invitation, Membership, UserProfile, Service, AuditLog
from .utils import get_tenant_for_request, get_user_role

User = get_user_model()


def _frontend_base():
    # Tu peux définir FRONTEND_URL dans env (ex: https://stockscan.app)
    return getattr(settings, "FRONTEND_URL", "").rstrip("/") or "http://localhost:5173"


def _invite_link(token: str):
    return f"{_frontend_base()}/invitation/accept?token={token}"


def _gen_token():
    # ~43 chars, on peut le laisser tel quel. Ton model token max_length=64.
    return secrets.token_urlsafe(32)[:64]


class InvitationCreateView(APIView):
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

        # Si déjà membre, on peut juste update le scope/role via memberships
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user and Membership.objects.filter(user=existing_user, tenant=tenant).exists():
            return Response(
                {"detail": "Cet email est déjà membre de ce commerce. Modifie ses accès via la liste des membres."},
                status=409,
            )

        # Invalide les anciennes invitations actives (optionnel mais propre)
        Invitation.objects.filter(
            tenant=tenant,
            email=email,
            status__in=["PENDING", "SENT"],
            expires_at__gt=timezone.now(),
        ).update(status="CANCELED")

        token = _gen_token()
        expires_at = timezone.now() + timedelta(days=7)

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

        AuditLog.objects.create(
            tenant=tenant,
            user=request.user,
            action="INVITE_SENT",
            object_type="Invitation",
            object_id=str(inv.id),
            service=service_obj,
            meta={"email": email, "role": inv_role},
        )

        # Email
        link = _invite_link(token)
        subject = f"Invitation StockScan — {tenant.name}"
        text_body = (
            f"Vous avez été invité à rejoindre {tenant.name} sur StockScan.\n\n"
            f"Créez votre mot de passe ici: {link}\n\n"
            f"Ce lien expire le {expires_at.strftime('%d/%m/%Y %H:%M')}."
        )

        # Ton helper existe déjà côté products; ici on suppose un helper similaire.
        # Si tu utilises le même: from utils.sendgrid_email import send_email_with_sendgrid
        from utils.sendgrid_email import send_email_with_sendgrid

        send_email_with_sendgrid(
            to_email=email,
            subject=subject,
            text_body=text_body,
            html_body=None,
            filename=None,
            file_bytes=None,
            mimetype=None,
            fallback_to_django=True,
        )

        return Response(
            {
                "ok": True,
                "email": email,
                "expires_at": expires_at.isoformat(),
                "invite_link": link,  # utile pour debug
            },
            status=201,
        )


class InvitationAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    # ✅ Preview (page publique) : GET /api/auth/invitations/accept/?token=...
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

    # ✅ Finalize : POST /api/auth/invitations/accept/ {token, password, password_confirm, username?}
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

        inv = Invitation.objects.filter(token=token).select_related("tenant", "service").first()
        if not inv:
            raise NotFound("Invitation introuvable.")

        if inv.status in ("CANCELED", "EXPIRED"):
            return Response({"detail": "Invitation invalide."}, status=410)
        if inv.accepted_at or inv.status == "ACCEPTED":
            return Response({"detail": "Invitation déjà acceptée."}, status=409)
        if inv.expires_at <= timezone.now():
            inv.status = "EXPIRED"
            inv.save(update_fields=["status"])
            return Response({"detail": "Invitation expirée."}, status=410)

        tenant = inv.tenant
        email = inv.email.lower()

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

        # IMPORTANT: chez toi, login bloque si user.is_active == False (“email non vérifié”)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])

        service_obj = inv.service if inv.service_id else None

        membership, _ = Membership.objects.update_or_create(
            user=user,
            tenant=tenant,
            defaults={"role": inv.role, "service": service_obj},
        )

        # Profile (compat)
        if not hasattr(user, "profile"):
            UserProfile.objects.create(user=user, tenant=tenant, role=inv.role)
        else:
            # s'assure tenant/role correct si besoin
            prof = user.profile
            if prof.tenant_id != tenant.id:
                prof.tenant = tenant
            prof.role = inv.role
            prof.save(update_fields=["tenant", "role"])

        inv.status = "ACCEPTED"
        inv.accepted_at = timezone.now()
        inv.save(update_fields=["status", "accepted_at"])

        AuditLog.objects.create(
            tenant=tenant,
            user=user,
            action="INVITE_ACCEPTED",
            object_type="Invitation",
            object_id=str(inv.id),
            service=service_obj,
            meta={"email": email, "created_user": created},
        )

        return Response(
            {
                "ok": True,
                "detail": "Invitation acceptée. Vous pouvez vous connecter.",
                "email": email,
            },
            status=200,
        )


class InvitationDeclineView(APIView):
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