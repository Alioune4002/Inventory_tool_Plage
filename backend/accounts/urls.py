# Deployed backend: https://inventory-tool-plage.onrender.com
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LoginView,
    MeView,
    RefreshView,
    RegisterView,
    ServiceViewSet,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    MembershipViewSet,
    EntitlementsView,

    # Billing / Stripe
    CreateCheckoutSessionView,
    CreateBillingPortalView,
    StripeWebhookView,

    # ✅ NEW
    MembersSummaryView,
)
from .views_delete import DeleteAccountView

router = DefaultRouter()
router.register(r"services", ServiceViewSet, basename="services")
router.register(r"memberships", MembershipViewSet, basename="memberships")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),

    # Entitlements
    path("me/org/entitlements", EntitlementsView.as_view(), name="auth-entitlements"),

    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("delete-account/", DeleteAccountView.as_view(), name="auth-delete-account"),

    # Stripe Billing
    path("billing/checkout/", CreateCheckoutSessionView.as_view(), name="billing-checkout"),
    path("billing/portal/", CreateBillingPortalView.as_view(), name="billing-portal"),
    path("billing/webhook/", StripeWebhookView.as_view(), name="billing-webhook"),

    # ✅ Members summary (owner)
    path("members/summary/", MembersSummaryView.as_view(), name="members-summary"),

    path("", include(router.urls)),
]
