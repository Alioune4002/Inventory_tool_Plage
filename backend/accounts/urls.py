# backend/accounts/urls.py
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
    VerifyEmailView,
    ResendVerificationEmailView,
    EmailChangeRequestView,
    EmailChangeConfirmView,
    MembershipViewSet,
    EntitlementsView,

    # Billing / Stripe (NOMS OK)
    CreateCheckoutSessionView,
    CreateBillingPortalView,
    BillingSyncView,
    StripeWebhookView,

    # Members summary
    MembersSummaryView,
    TenantCurrencyView,
)

from .views_delete import DeleteAccountView
from .views_invitations import InvitationCreateView, InvitationAcceptView, InvitationDeclineView

router = DefaultRouter()
router.register(r"services", ServiceViewSet, basename="services")
router.register(r"memberships", MembershipViewSet, basename="memberships")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),

    path("me/org/entitlements", EntitlementsView.as_view(), name="auth-entitlements"),

    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("verify-email/resend/", ResendVerificationEmailView.as_view(), name="auth-verify-email-resend"),
    path("email-change/", EmailChangeRequestView.as_view(), name="auth-email-change"),
    path("email-change/confirm/", EmailChangeConfirmView.as_view(), name="auth-email-change-confirm"),
    path("delete-account/", DeleteAccountView.as_view(), name="auth-delete-account"),

    # Stripe Billing
    path("billing/checkout/", CreateCheckoutSessionView.as_view(), name="billing-checkout"),
    path("billing/portal/", CreateBillingPortalView.as_view(), name="billing-portal"),
    path("billing/sync/", BillingSyncView.as_view(), name="billing-sync"),
    path("billing/webhook/", StripeWebhookView.as_view(), name="billing-webhook"),

    # Members summary (owner)
    path("members/summary/", MembersSummaryView.as_view(), name="members-summary"),
    path("tenant/currency/", TenantCurrencyView.as_view(), name="tenant-currency"),

    # Invitations
    path("invitations/", InvitationCreateView.as_view(), name="invite-create"),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invite-accept"),
    path("invitations/decline/", InvitationDeclineView.as_view(), name="invite-decline"),

    path("", include(router.urls)),
]
