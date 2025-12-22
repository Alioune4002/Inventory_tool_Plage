# Deployed backend: https://inventory-tool-plage.onrender.com
# backend/accounts/views.py
from __future__ import annotations

import logging
from typing import Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import permissions, status, exceptions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from products.models import Product

from .models import (
    Service,
    Membership,
    Tenant,
    Plan,
    Subscription,
    UserProfile,
    AuditLog,  # ✅ NEW: traçabilité
)
from .serializers import (
    RegisterSerializer,
    SimpleTokenObtainPairSerializer,
    MeSerializer,
    ServiceSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    MembershipSerializer,
)
from .utils import get_tenant_for_request, get_user_role
from .services.access import check_limit, get_usage

LOGGER = logging.getLogger(__name__)
User = get_user_model()

# Stripe (backend only)
try:
    import stripe  # type: ignore
except Exception:  # pragma: no cover
    stripe = None


# --------------------------------
# Audit helpers
# --------------------------------

def _audit(
    *,
    tenant: Tenant,
    user,
    action: str,
    object_type: str = "",
    object_id: str = "",
    service: Optional[Service] = None,
    meta: Optional[dict] = None,
):
    """
    Enregistre une action dans AuditLog, sans bloquer l'API si ça échoue.
    """
    try:
        AuditLog.objects.create(
            tenant=tenant,
            user=user if user and getattr(user, "is_authenticated", False) else None,
            action=action,
            object_type=object_type or "",
            object_id=str(object_id or ""),
            service=service,
            meta=meta or {},
        )
    except Exception:
        LOGGER.exception("AuditLog failed")


# --------------------------------
# Auth / Account
# --------------------------------

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        profile = getattr(user, "profile", None)
        tenant = profile.tenant if profile else None

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "tenant": {
                    "id": tenant.id if tenant else None,
                    "name": tenant.name if tenant else None,
                    "domain": tenant.domain if tenant else None,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = SimpleTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tenant = get_tenant_for_request(request)
        serializer = MeSerializer(request.user, context={"request": request})
        data = serializer.data
        # forcer la clé "tenant" (le front s'appuie dessus)
        data["tenant"] = {
            "id": tenant.id,
            "name": tenant.name,
            "domain": tenant.domain,
        }
        return Response(data)


# --------------------------------
# Services / Memberships
# --------------------------------

class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = get_tenant_for_request(self.request)
        return Service.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour créer un service.")

        tenant = get_tenant_for_request(self.request)
        usage = get_usage(tenant)
        check_limit(tenant, "max_services", usage["services_count"], requested_increment=1)

        name = serializer.validated_data.get("name")
        if Service.objects.filter(tenant=tenant, name=name).exists():
            raise exceptions.ValidationError("Ce service existe déjà.")

        serializer.save(tenant=tenant)

    def perform_destroy(self, instance):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour supprimer un service.")

        # garde-fou: pas de suppression si des produits existent
        if hasattr(instance, "products") and instance.products.exists():
            raise exceptions.ValidationError("Impossible de supprimer : produits associés.")
        return super().perform_destroy(instance)


class MembershipPermission(permissions.BasePermission):
    """
    Dans ta logique actuelle, seule la personne "owner" peut gérer les memberships.
    """
    def has_permission(self, request, view):
        return get_user_role(request) in ["owner"]


class MembershipViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated, MembershipPermission]

    def get_queryset(self):
        tenant = get_tenant_for_request(self.request)
        # ✅ include service pour afficher scope
        return Membership.objects.filter(tenant=tenant).select_related("user", "service")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["tenant"] = get_tenant_for_request(self.request)
        return ctx

    def perform_create(self, serializer):
        tenant = get_tenant_for_request(self.request)
        email = (serializer.validated_data.get("email") or "").strip()
        username = (serializer.validated_data.get("username") or "").strip()
        user_obj = None
        if email:
            user_obj = User.objects.filter(email=email).first()
        if not user_obj and username:
            user_obj = User.objects.filter(username=username).first()
        is_existing_member = False
        if user_obj:
            is_existing_member = UserProfile.objects.filter(user=user_obj, tenant=tenant).exists()
        if not is_existing_member:
            usage = get_usage(tenant)
            check_limit(tenant, "max_users", usage["users_count"], requested_increment=1)
        membership = serializer.save()
        _audit(
            tenant=tenant,
            user=self.request.user,
            action="MEMBER_ADDED",
            object_type="Membership",
            object_id=str(membership.id),
            service=membership.service,
            meta={
                "role": membership.role,
                "service_id": membership.service_id,
                "email": membership.user.email,
                "username": membership.user.username,
            },
        )

    def perform_update(self, serializer):
        tenant = get_tenant_for_request(self.request)
        membership = serializer.save()
        _audit(
            tenant=tenant,
            user=self.request.user,
            action="MEMBER_UPDATED",
            object_type="Membership",
            object_id=str(membership.id),
            service=membership.service,
            meta={
                "role": membership.role,
                "service_id": membership.service_id,
                "email": membership.user.email,
                "username": membership.user.username,
            },
        )

    def perform_destroy(self, instance):
        tenant = get_tenant_for_request(self.request)
        _audit(
            tenant=tenant,
            user=self.request.user,
            action="MEMBER_REMOVED",
            object_type="Membership",
            object_id=str(instance.id),
            service=instance.service,
            meta={
                "role": instance.role,
                "service_id": instance.service_id,
                "email": instance.user.email,
                "username": instance.user.username,
            },
        )
        return super().perform_destroy(instance)


class MembersSummaryView(APIView):
    """
    GET /api/auth/members/summary/
    Owner only.

    Retour:
      {
        "members": [
          {
            "id": membership_id,
            "role": "operator|manager|owner",
            "service_scope": {"id": 1, "name": "Salle"} | null,
            "user": {"id": 2, "username": "...", "email": "..."},
            "last_action": {"action": "...", "at": "..."} | null
          }
        ],
        "recent_activity": [
          {"action": "...", "at": "...", "user": {...}|null, "object_type": "...", "object_id": "..."}
        ]
      }
    """
    permission_classes = [permissions.IsAuthenticated, MembershipPermission]

    def get(self, request):
        tenant = get_tenant_for_request(request)

        members_qs = (
            Membership.objects.filter(tenant=tenant)
            .select_related("user", "service")
            .order_by("created_at")
        )

        # Dernière action par user
        last_by_user = {}
        logs = AuditLog.objects.filter(tenant=tenant).select_related("user").order_by("-created_at")[:200]
        for l in logs:
            uid = l.user_id or 0
            if uid not in last_by_user:
                last_by_user[uid] = l

        members_payload = []
        for m in members_qs:
            last = last_by_user.get(m.user_id or 0)
            members_payload.append(
                {
                    "id": m.id,
                    "role": m.role,
                    "service_scope": {"id": m.service.id, "name": m.service.name} if m.service_id else None,
                    "user": {"id": m.user.id, "username": m.user.username, "email": m.user.email},
                    "last_action": (
                        {"action": last.action, "at": last.created_at.isoformat()}
                        if last
                        else None
                    ),
                }
            )

        recent = AuditLog.objects.filter(tenant=tenant).select_related("user").order_by("-created_at")[:20]
        recent_payload = []
        for a in recent:
            recent_payload.append(
                {
                    "action": a.action,
                    "at": a.created_at.isoformat(),
                    "user": {"id": a.user.id, "username": a.user.username, "email": a.user.email} if a.user_id else None,
                    "object_type": a.object_type,
                    "object_id": a.object_id,
                }
            )

        return Response({"members": members_payload, "recent_activity": recent_payload})


# --------------------------------
# Password reset
# --------------------------------

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = None
        if data.get("username"):
            user = User.objects.filter(username=data["username"]).first()
        if not user and data.get("email"):
            user = User.objects.filter(email=data["email"]).first()

        if not user:
            # réponse générique (anti-énumération)
            return Response({"detail": "Si le compte existe, un jeton a été généré."})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return Response({"uid": uid, "token": token})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]

        try:
            uid_int = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=uid_int)
        except (User.DoesNotExist, ValueError, TypeError):
            raise exceptions.ValidationError("Lien invalide.")

        if not default_token_generator.check_token(user, token):
            raise exceptions.ValidationError("Lien ou jeton invalide/expiré.")

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Mot de passe réinitialisé."})


# --------------------------------
# Entitlements (compatibles front)
# --------------------------------

def _tenant_plan_code(tenant: Tenant) -> str:
    # tenant.plan est un FK vers Plan
    if tenant.plan_id and getattr(tenant.plan, "code", None):
        return str(tenant.plan.code).upper()
    return "ESSENTIEL"


class EntitlementsView(APIView):
    """
    Endpoint pour fournir plan/entitlements/limits/usage.
    Compatible avec le hook frontend useEntitlements:
      GET /api/auth/me/org/entitlements
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_usage(self, tenant: Tenant):
        products_count = Product.objects.filter(tenant=tenant).count()
        services_count = tenant.services.count()
        users_count = UserProfile.objects.filter(tenant=tenant).count()
        return {
            "products_count": products_count,
            "services_count": services_count,
            "users_count": users_count,
        }

    def _resolve_plan_cfg(self, plan_code: str):
        # On s'appuie sur accounts/services/access.py si disponible
        try:
            from accounts.services.access import PLAN_REGISTRY  # import local
            return PLAN_REGISTRY.get(plan_code, PLAN_REGISTRY.get("ESSENTIEL", {}))
        except Exception:
            return {}

    def get(self, request):
        tenant = get_tenant_for_request(request)
        usage = self.get_usage(tenant)
        now = timezone.now()

        plan_code = _tenant_plan_code(tenant)
        if tenant.is_lifetime:
            plan_effective = plan_code
        elif tenant.license_expires_at and tenant.license_expires_at > now:
            plan_effective = plan_code
        else:
            plan_effective = "ESSENTIEL"

        plan_cfg = self._resolve_plan_cfg(plan_effective)

        limits = plan_cfg.get("limits") or {"max_products": 100, "max_services": 1, "max_users": 1}
        ent_list = plan_cfg.get("entitlements") or [
            "inventory_basic",
            "stock_movements_basic",
            "reports_basic",
            "exports_basic",
        ]

        # ton frontend attend un dict { key: true }
        entitlements = {k: True for k in ent_list}

        plan_source = tenant.plan_source or "FREE"
        subscription_status = tenant.subscription_status or "NONE"
        expires_at = tenant.license_expires_at

        over_limit = {
            "products": limits.get("max_products") is not None and usage["products_count"] > limits["max_products"],
            "services": limits.get("max_services") is not None and usage["services_count"] > limits["max_services"],
            "users": limits.get("max_users") is not None and usage["users_count"] > limits["max_users"],
        }

        return Response(
            {
                "plan_effective": plan_effective,
                "plan_source": plan_source,
                "expires_at": expires_at,
                "subscription_status": subscription_status,
                "entitlements": entitlements,
                "limits": limits,
                "usage": usage,
                "over_limit": over_limit,
                "last_plan_was_trial": False,  # tu brancheras promo/trial après
            }
        )


# --------------------------------
# Stripe helpers
# --------------------------------

def _stripe_enabled() -> bool:
    return bool(getattr(settings, "STRIPE_API_KEY", None) and stripe is not None)


def _stripe_init():
    if not _stripe_enabled():
        return
    stripe.api_key = settings.STRIPE_API_KEY


def _get_price_id(plan_code: str, billing_cycle: str) -> Optional[str]:
    plan_code = (plan_code or "").upper()
    billing_cycle = (billing_cycle or "MONTHLY").upper()

    if plan_code == "BOUTIQUE":
        return (
            settings.STRIPE_PRICE_BOUTIQUE_YEARLY
            if billing_cycle == "YEARLY"
            else settings.STRIPE_PRICE_BOUTIQUE_MONTHLY
        )
    if plan_code == "PRO":
        return (
            settings.STRIPE_PRICE_PRO_YEARLY
            if billing_cycle == "YEARLY"
            else settings.STRIPE_PRICE_PRO_MONTHLY
        )
    return None


def _normalize_checkout_plan(plan_code: str) -> str:
    code = (plan_code or "").upper().strip()
    aliases = {
        "SOLO": "ESSENTIEL",
        "DUO": "BOUTIQUE",
        "MULTI": "PRO",
    }
    return aliases.get(code, code)


def _reverse_price_id(price_id: str) -> Tuple[str, str]:
    """
    Retourne (plan_code, billing_cycle) depuis un Stripe Price ID.
    """
    mapping = {
        getattr(settings, "STRIPE_PRICE_BOUTIQUE_MONTHLY", None): ("BOUTIQUE", "MONTHLY"),
        getattr(settings, "STRIPE_PRICE_BOUTIQUE_YEARLY", None): ("BOUTIQUE", "YEARLY"),
        getattr(settings, "STRIPE_PRICE_PRO_MONTHLY", None): ("PRO", "MONTHLY"),
        getattr(settings, "STRIPE_PRICE_PRO_YEARLY", None): ("PRO", "YEARLY"),
    }
    found = mapping.get(price_id)
    return found if found else ("ESSENTIEL", "MONTHLY")


def _ensure_plan_row(plan_code: str) -> Plan:
    """
    Sécurise la DB : crée Plan si non seedé.
    """
    plan_code = (plan_code or "ESSENTIEL").upper()
    defaults = {
        "name": plan_code.title(),
        "code": plan_code,
        "monthly_price_cents": 0,
        "yearly_price_cents": 0,
        "currency": "EUR",
        "entitlements": {},
        "limits": {},
    }
    plan, _ = Plan.objects.get_or_create(code=plan_code, defaults=defaults)
    return plan


def _get_or_create_stripe_customer(tenant: Tenant, user: User) -> str:
    _stripe_init()
    if tenant.stripe_customer_id:
        return tenant.stripe_customer_id

    email = user.email or ""
    name = tenant.name or user.username or "Client"

    customer = stripe.Customer.create(  # type: ignore
        email=email if email else None,
        name=name,
        metadata={"tenant_id": str(tenant.id)},
    )
    tenant.stripe_customer_id = customer["id"]
    tenant.save(update_fields=["stripe_customer_id"])
    return tenant.stripe_customer_id


def _set_tenant_plan_active(
    tenant: Tenant,
    plan_code: str,
    billing_cycle: str,
    status_code: str,
    current_period_end: Optional[timezone.datetime] = None,
    source: str = "PAID",
):
    plan = _ensure_plan_row(plan_code)

    tenant.plan = plan
    tenant.plan_source = source
    tenant.billing_cycle = (billing_cycle or "MONTHLY").upper()
    tenant.subscription_status = status_code

    if current_period_end:
        tenant.license_expires_at = current_period_end

    tenant.save(
        update_fields=[
            "plan",
            "plan_source",
            "billing_cycle",
            "subscription_status",
            "license_expires_at",
        ]
    )


# --------------------------------
# Stripe endpoints
# --------------------------------

class CreateCheckoutSessionView(APIView):
    """
    POST /api/auth/billing/checkout/
    Body: { "plan": "BOUTIQUE|PRO|DUO|MULTI", "cycle": "MONTHLY|YEARLY" }
    Retour: { "url": "https://checkout.stripe.com/..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _stripe_enabled():
            return Response({"detail": "Stripe non configuré côté serveur."}, status=503)

        tenant = get_tenant_for_request(request)
        plan_code = _normalize_checkout_plan(request.data.get("plan"))
        cycle = (request.data.get("cycle") or "MONTHLY").upper().strip()

        if plan_code not in ["BOUTIQUE", "PRO"]:
            return Response({"detail": "Plan invalide."}, status=400)

        price_id = _get_price_id(plan_code, cycle)
        if not price_id:
            return Response({"detail": "Price Stripe manquant (env vars)."}, status=500)

        customer_id = _get_or_create_stripe_customer(tenant, request.user)

        _stripe_init()
        success_url = getattr(settings, "STRIPE_SUCCESS_URL", None) or f"{settings.FRONTEND_URL}/billing/success"
        cancel_url = getattr(settings, "STRIPE_CANCEL_URL", None) or f"{settings.FRONTEND_URL}/billing/cancel"

        session = stripe.checkout.Session.create(  # type: ignore
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            allow_promotion_codes=True,
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            client_reference_id=str(tenant.id),
            metadata={
                "tenant_id": str(tenant.id),
                "plan_code": plan_code,
                "billing_cycle": cycle,
            },
        )

        return Response({"url": session["url"]}, status=200)


class CreateBillingPortalView(APIView):
    """
    POST /api/auth/billing/portal/
    Retour: { "url": "https://billing.stripe.com/..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _stripe_enabled():
            return Response({"detail": "Stripe non configuré côté serveur."}, status=503)

        tenant = get_tenant_for_request(request)
        customer_id = _get_or_create_stripe_customer(tenant, request.user)

        _stripe_init()
        return_url = getattr(settings, "FRONTEND_URL", "https://stockscan.app") + "/settings"

        portal = stripe.billing_portal.Session.create(  # type: ignore
            customer=customer_id,
            return_url=return_url,
        )
        return Response({"url": portal["url"]}, status=200)


class StripeWebhookView(APIView):
    """
    POST /api/auth/billing/webhook/
    - pas d'auth
    - vérif signature obligatoire (STRIPE_WEBHOOK_SECRET)
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not _stripe_enabled():
            return Response({"detail": "Stripe non configuré measuring."}, status=503)

        secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)
        if not secret:
            return Response({"detail": "STRIPE_WEBHOOK_SECRET manquant."}, status=500)

        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        _stripe_init()
        try:
            event = stripe.Webhook.construct_event(  # type: ignore
                payload=payload,
                sig_header=sig_header,
                secret=secret,
            )
        except Exception as e:
            LOGGER.warning("Stripe webhook signature failed: %s", e)
            return Response({"detail": "Signature invalide."}, status=400)

        event_type = event.get("type")
        data_obj = (event.get("data") or {}).get("object") or {}

        try:
            self._handle_event(event_type, data_obj)
        except Exception as e:
            LOGGER.exception("Stripe webhook handling error: %s", e)
            # Stripe retente => 500 seulement si erreur serveur
            return Response({"detail": "Erreur serveur lors du traitement webhook."}, status=500)

        return Response({"received": True}, status=200)

    @transaction.atomic
    def _handle_event(self, event_type: str, obj: dict):
        """
        Synchronise Stripe -> (Tenant + Subscription).
        """
        # 1) Checkout terminé (création subscription)
        if event_type == "checkout.session.completed":
            tenant_id = (obj.get("metadata") or {}).get("tenant_id") or obj.get("client_reference_id")
            if not tenant_id:
                return
            tenant = Tenant.objects.filter(id=tenant_id).first()
            if not tenant:
                return

            customer_id = obj.get("customer") or ""
            subscription_id = obj.get("subscription") or ""

            if customer_id and not tenant.stripe_customer_id:
                tenant.stripe_customer_id = customer_id
                tenant.save(update_fields=["stripe_customer_id"])

            if subscription_id:
                sub, _ = Subscription.objects.get_or_create(tenant=tenant, defaults={"provider": "STRIPE"})
                sub.provider_sub_id = subscription_id
                sub.status = "ACTIVE"
                sub.save(update_fields=["provider_sub_id", "status"])

            plan_code = ((obj.get("metadata") or {}).get("plan_code") or "ESSENTIEL").upper()
            cycle = ((obj.get("metadata") or {}).get("billing_cycle") or "MONTHLY").upper()
            _set_tenant_plan_active(
                tenant,
                plan_code=plan_code,
                billing_cycle=cycle,
                status_code="ACTIVE",
                current_period_end=None,
                source="PAID",
            )
            return

        # 2) Subscription create/update
        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            sub_id = obj.get("id") or ""
            customer_id = obj.get("customer") or ""
            status_raw = (obj.get("status") or "").lower()

            tenant = Tenant.objects.filter(stripe_customer_id=customer_id).first()
            if not tenant:
                tenant_id = (obj.get("metadata") or {}).get("tenant_id")
                if tenant_id:
                    tenant = Tenant.objects.filter(id=tenant_id).first()
            if not tenant:
                return

            price_id = None
            try:
                items = (obj.get("items") or {}).get("data") or []
                if items:
                    price_id = (((items[0] or {}).get("price") or {}).get("id")) or None
            except Exception:
                price_id = None

            plan_code, cycle = _reverse_price_id(price_id) if price_id else ("ESSENTIEL", "MONTHLY")

            cpe = obj.get("current_period_end")
            current_period_end = timezone.datetime.fromtimestamp(cpe, tz=timezone.utc) if cpe else None

            if status_raw in ("active", "trialing"):
                status_code = "ACTIVE"
            elif status_raw in ("past_due", "unpaid"):
                status_code = "PAST_DUE"
            elif status_raw in ("canceled", "incomplete_expired"):
                status_code = "CANCELED"
            else:
                status_code = "ACTIVE"

            sub, _ = Subscription.objects.get_or_create(tenant=tenant, defaults={"provider": "STRIPE"})
            sub.provider_sub_id = sub_id
            sub.status = status_code
            sub.current_period_end = current_period_end
            if status_code == "CANCELED":
                sub.canceled_at = timezone.now()
            sub.save()

            if status_code == "CANCELED":
                tenant.grace_started_at = tenant.grace_started_at or timezone.now()
                tenant.subscription_status = "CANCELED"
                if not tenant.plan_source:
                    tenant.plan_source = "FREE"
                tenant.save(update_fields=["grace_started_at", "subscription_status", "plan_source"])
                return

            _set_tenant_plan_active(
                tenant,
                plan_code=plan_code,
                billing_cycle=cycle,
                status_code=status_code,
                current_period_end=current_period_end,
                source="PAID",
            )
            return

        # 3) Subscription supprimée
        if event_type == "customer.subscription.deleted":
            customer_id = obj.get("customer") or ""
            tenant = Tenant.objects.filter(stripe_customer_id=customer_id).first()
            if not tenant:
                return

            tenant.subscription_status = "CANCELED"
            tenant.plan_source = "FREE"
            tenant.license_expires_at = None
            tenant.save(update_fields=["subscription_status", "plan_source", "license_expires_at"])

            sub = Subscription.objects.filter(tenant=tenant).first()
            if sub:
                sub.status = "CANCELED"
                sub.canceled_at = timezone.now()
                sub.save(update_fields=["status", "canceled_at"])
            return

        # 4) Paiement échoué / payé
        if event_type == "invoice.payment_failed":
            customer_id = obj.get("customer") or ""
            tenant = Tenant.objects.filter(stripe_customer_id=customer_id).first()
            if not tenant:
                return
            tenant.subscription_status = "PAST_DUE"
            tenant.grace_started_at = tenant.grace_started_at or timezone.now()
            tenant.save(update_fields=["subscription_status", "grace_started_at"])

            sub = Subscription.objects.filter(tenant=tenant).first()
            if sub:
                sub.status = "PAST_DUE"
                sub.grace_started_at = sub.grace_started_at or timezone.now()
                sub.save(update_fields=["status", "grace_started_at"])
            return

        if event_type == "invoice.paid":
            customer_id = obj.get("customer") or ""
            tenant = Tenant.objects.filter(stripe_customer_id=customer_id).first()
            if not tenant:
                return
            tenant.subscription_status = "ACTIVE"
            tenant.grace_started_at = None
            tenant.plan_source = "PAID"
            tenant.save(update_fields=["subscription_status", "grace_started_at", "plan_source"])

            sub = Subscription.objects.filter(tenant=tenant).first()
            if sub:
                sub.status = "ACTIVE"
                sub.grace_started_at = None
                sub.save(update_fields=["status", "grace_started_at"])
            return

        # event ignoré
        return
