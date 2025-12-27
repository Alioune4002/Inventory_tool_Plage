# backend/accounts/views_billing.py
import logging
from datetime import datetime
from typing import Optional

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Plan, Subscription, Tenant
from accounts.utils import get_tenant_for_request

LOGGER = logging.getLogger(__name__)

try:
    import stripe
except Exception:  # pragma: no cover
    stripe = None


def _stripe_ready() -> bool:
    return bool(stripe and getattr(settings, "STRIPE_API_KEY", None))


def _init_stripe():
    stripe.api_key = settings.STRIPE_API_KEY


def _get_price_id(plan_code: str, cycle: str) -> Optional[str]:
    plan_code = (plan_code or "").upper().strip()
    cycle = (cycle or "").upper().strip()

    if plan_code == "BOUTIQUE" and cycle == "MONTHLY":
        return getattr(settings, "STRIPE_PRICE_BOUTIQUE_MONTHLY", None)
    if plan_code == "BOUTIQUE" and cycle == "YEARLY":
        return getattr(settings, "STRIPE_PRICE_BOUTIQUE_YEARLY", None)
    if plan_code == "PRO" and cycle == "MONTHLY":
        return getattr(settings, "STRIPE_PRICE_PRO_MONTHLY", None)
    if plan_code == "PRO" and cycle == "YEARLY":
        return getattr(settings, "STRIPE_PRICE_PRO_YEARLY", None)
    return None


def _get_or_create_plan(plan_code: str) -> Optional[Plan]:
    code = (plan_code or "").upper().strip()
    if not code:
        return None
    plan, _ = Plan.objects.get_or_create(
        code=code,
        defaults={
            "name": code.title(),
            "monthly_price_cents": 0,
            "yearly_price_cents": 0,
            "currency": "EUR",
            "entitlements": {},
            "limits": {},
            "is_active": True,
        },
    )
    return plan


def _set_tenant_subscription_state(
    tenant: Tenant,
    *,
    plan_code: str,
    cycle: str,
    status_value: str,  # ACTIVE | PAST_DUE | CANCELED | NONE
    period_end: Optional[datetime] = None,
    stripe_customer_id: str = "",
    stripe_subscription_id: str = "",
    grace_started_at: Optional[datetime] = None,
    canceled_at: Optional[datetime] = None,
):
    plan_obj = _get_or_create_plan(plan_code) if plan_code else None

    tenant.plan = plan_obj
    tenant.plan_source = "PAID" if status_value == "ACTIVE" else tenant.plan_source
    tenant.billing_cycle = (cycle or "MONTHLY").upper()
    tenant.subscription_status = status_value

    if stripe_customer_id:
        tenant.stripe_customer_id = stripe_customer_id

    if status_value == "ACTIVE" and period_end:
        tenant.license_expires_at = period_end
        tenant.grace_started_at = None
    elif status_value == "PAST_DUE":
        if not tenant.grace_started_at:
            tenant.grace_started_at = grace_started_at or timezone.now()
    elif status_value in ("CANCELED", "NONE"):
        if period_end:
            tenant.license_expires_at = period_end

    tenant.save(update_fields=[
        "plan",
        "plan_source",
        "billing_cycle",
        "subscription_status",
        "license_expires_at",
        "grace_started_at",
        "stripe_customer_id",
    ])

    sub, _ = Subscription.objects.get_or_create(tenant=tenant, defaults={"provider": "STRIPE"})
    sub.provider = "STRIPE"
    if stripe_subscription_id:
        sub.provider_sub_id = stripe_subscription_id
    sub.status = status_value
    sub.current_period_end = period_end
    sub.grace_started_at = grace_started_at
    sub.canceled_at = canceled_at
    sub.save()


class CreateCheckoutSessionView(APIView):
    """
    POST /api/auth/billing/checkout/
    Body: { "plan_code": "BOUTIQUE"|"PRO", "cycle": "MONTHLY"|"YEARLY" }
    Return: { "url": "<stripe_checkout_url>" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _stripe_ready():
            return Response(
                {"detail": "Stripe n’est pas configuré côté serveur."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        _init_stripe()

        tenant = get_tenant_for_request(request)
        plan_code = (request.data.get("plan_code") or request.data.get("plan") or "").upper().strip()
        cycle = (request.data.get("cycle") or "MONTHLY").upper().strip()

        if plan_code not in ("BOUTIQUE", "PRO"):
            return Response({"detail": "Plan invalide. Choisissez BOUTIQUE ou PRO."}, status=400)
        if cycle not in ("MONTHLY", "YEARLY"):
            return Response({"detail": "Cycle invalide. Choisissez MONTHLY ou YEARLY."}, status=400)

        price_id = _get_price_id(plan_code, cycle)
        if not price_id:
            return Response({"detail": "Prix Stripe manquant (PRICE_ID non configuré)."}, status=500)

        customer_id = tenant.stripe_customer_id or ""
        if not customer_id:
            customer = stripe.Customer.create(
                name=tenant.name,
                email=getattr(request.user, "email", "") or None,
                metadata={
                    "tenant_id": str(tenant.id),
                    "tenant_name": tenant.name,
                    "created_by_user_id": str(request.user.id),
                },
            )
            customer_id = customer["id"]
            tenant.stripe_customer_id = customer_id
            tenant.save(update_fields=["stripe_customer_id"])
        else:
            try:
                stripe.Customer.modify(customer_id, metadata={"tenant_id": str(tenant.id)})
            except Exception:
                pass

        success_url = getattr(settings, "STRIPE_SUCCESS_URL", f"{settings.FRONTEND_URL}/billing/success")
        cancel_url = getattr(settings, "STRIPE_CANCEL_URL", f"{settings.FRONTEND_URL}/billing/cancel")

        try:
            session = stripe.checkout.Session.create(
                mode="subscription",
                customer=customer_id,
                line_items=[{"price": price_id, "quantity": 1}],
                allow_promotion_codes=True,
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{cancel_url}?canceled=1",
                metadata={
                    "tenant_id": str(tenant.id),
                    "plan_code": plan_code,
                    "billing_cycle": cycle,
                    "user_id": str(request.user.id),
                },
                subscription_data={
                    "metadata": {
                        "tenant_id": str(tenant.id),
                        "plan_code": plan_code,
                        "billing_cycle": cycle,
                    }
                },
            )
            return Response({"url": session["url"]})
        except Exception as e:
            LOGGER.exception("Stripe checkout error: %s", e)
            return Response({"detail": "Impossible de créer la session de paiement."}, status=502)


class CreateBillingPortalView(APIView):
    """
    POST /api/auth/billing/portal/
    Return: { "url": "<stripe_portal_url>" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _stripe_ready():
            return Response({"detail": "Stripe n’est pas configuré côté serveur."}, status=503)

        _init_stripe()

        tenant = get_tenant_for_request(request)
        if not tenant.stripe_customer_id:
            return Response({"detail": "Aucun client Stripe associé à ce commerce."}, status=400)

        try:
            portal = stripe.billing_portal.Session.create(
                customer=tenant.stripe_customer_id,
                return_url=f"{getattr(settings, 'FRONTEND_URL', 'https://stockscan.app')}/app/settings",
            )
            return Response({"url": portal["url"]})
        except Exception as e:
            LOGGER.exception("Stripe portal error: %s", e)
            return Response({"detail": "Impossible d’ouvrir le portail Stripe."}, status=502)


class StripeWebhookView(APIView):
    """
    POST /api/auth/billing/webhook/
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _stripe_ready() or not getattr(settings, "STRIPE_WEBHOOK_SECRET", None):
            return Response({"detail": "Webhook Stripe non configuré."}, status=400)

        _init_stripe()

        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        try:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except Exception as e:
            LOGGER.warning("Stripe webhook signature failed: %s", e)
            return Response({"detail": "Signature invalide."}, status=400)

        event_type = event.get("type")
        data_object = (event.get("data") or {}).get("object") or {}

        tenant_id = None
        try:
            tenant_id = (data_object.get("metadata") or {}).get("tenant_id")
        except Exception:
            tenant_id = None

        customer_id = data_object.get("customer") or ""
        if not tenant_id and customer_id:
            t = Tenant.objects.filter(stripe_customer_id=customer_id).first()
            tenant_id = str(t.id) if t else None

        tenant = Tenant.objects.filter(id=tenant_id).first() if tenant_id else None
        if not tenant:
            return Response({"received": True})

        try:
            if event_type == "checkout.session.completed":
                sub_id = data_object.get("subscription") or ""
                cust_id = data_object.get("customer") or ""
                plan_code = (data_object.get("metadata") or {}).get("plan_code") or ""
                cycle = (data_object.get("metadata") or {}).get("billing_cycle") or "MONTHLY"

                period_end = None
                if sub_id:
                    try:
                        sub = stripe.Subscription.retrieve(sub_id)
                        cur_end = sub.get("current_period_end")
                        if cur_end:
                            period_end = datetime.fromtimestamp(cur_end, tz=timezone.utc)
                    except Exception:
                        period_end = None

                _set_tenant_subscription_state(
                    tenant,
                    plan_code=plan_code or "PRO",
                    cycle=cycle or "MONTHLY",
                    status_value="ACTIVE",
                    period_end=period_end,
                    stripe_customer_id=cust_id,
                    stripe_subscription_id=sub_id,
                )

            elif event_type == "customer.subscription.updated":
                sub_id = data_object.get("id") or ""
                cust_id = data_object.get("customer") or ""
                status_stripe = (data_object.get("status") or "").lower()

                plan_code = (data_object.get("metadata") or {}).get("plan_code") or ""
                cycle = (data_object.get("metadata") or {}).get("billing_cycle") or "MONTHLY"

                cur_end = data_object.get("current_period_end")
                period_end = datetime.fromtimestamp(cur_end, tz=timezone.utc) if cur_end else None

                if status_stripe in ("active", "trialing"):
                    status_value = "ACTIVE"
                elif status_stripe in ("past_due", "unpaid"):
                    status_value = "PAST_DUE"
                elif status_stripe in ("canceled", "incomplete_expired"):
                    status_value = "CANCELED"
                else:
                    status_value = "NONE"

                _set_tenant_subscription_state(
                    tenant,
                    plan_code=plan_code or (tenant.plan.code if tenant.plan else "ESSENTIEL"),
                    cycle=cycle or tenant.billing_cycle,
                    status_value=status_value,
                    period_end=period_end,
                    stripe_customer_id=cust_id,
                    stripe_subscription_id=sub_id,
                    grace_started_at=timezone.now() if status_value == "PAST_DUE" else None,
                    canceled_at=timezone.now() if status_value == "CANCELED" else None,
                )

            elif event_type == "customer.subscription.deleted":
                sub_id = data_object.get("id") or ""
                cust_id = data_object.get("customer") or ""
                cur_end = data_object.get("current_period_end")
                period_end = datetime.fromtimestamp(cur_end, tz=timezone.utc) if cur_end else None

                _set_tenant_subscription_state(
                    tenant,
                    plan_code=(tenant.plan.code if tenant.plan else "ESSENTIEL"),
                    cycle=tenant.billing_cycle,
                    status_value="CANCELED",
                    period_end=period_end,
                    stripe_customer_id=cust_id,
                    stripe_subscription_id=sub_id,
                    canceled_at=timezone.now(),
                )

            elif event_type == "invoice.payment_failed":
                _set_tenant_subscription_state(
                    tenant,
                    plan_code=(tenant.plan.code if tenant.plan else "ESSENTIEL"),
                    cycle=tenant.billing_cycle,
                    status_value="PAST_DUE",
                    period_end=tenant.license_expires_at,
                    stripe_customer_id=customer_id,
                    grace_started_at=timezone.now(),
                )

            elif event_type == "invoice.payment_succeeded":
                sub_id = data_object.get("subscription") or ""
                period_end = None
                if sub_id:
                    try:
                        sub = stripe.Subscription.retrieve(sub_id)
                        cur_end = sub.get("current_period_end")
                        if cur_end:
                            period_end = datetime.fromtimestamp(cur_end, tz=timezone.utc)
                    except Exception:
                        period_end = tenant.license_expires_at

                _set_tenant_subscription_state(
                    tenant,
                    plan_code=(tenant.plan.code if tenant.plan else "ESSENTIEL"),
                    cycle=tenant.billing_cycle,
                    status_value="ACTIVE",
                    period_end=period_end,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=sub_id,
                )

            return Response({"received": True})
        except Exception as e:
            LOGGER.exception("Webhook processing error: %s", e)
            return Response({"received": True})
