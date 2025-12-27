# Deployed backend: https://inventory-tool-plage.onrender.com
from django.conf import settings
from django.db import models
from django.utils import timezone

PLAN_SOURCES = (
    ("FREE", "Free"),
    ("TRIAL", "Trial"),
    ("PAID", "Paid"),
    ("MANUAL", "Manual"),
    ("LIFETIME", "Lifetime"),
)
BILLING_CYCLES = (("MONTHLY", "Monthly"), ("YEARLY", "Yearly"))
SUBSCRIPTION_STATUS = (
    ("ACTIVE", "Active"),
    ("PAST_DUE", "Past due"),
    ("CANCELED", "Canceled"),
    ("NONE", "None"),
)


class Plan(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    monthly_price_cents = models.PositiveIntegerField(default=0)
    yearly_price_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=10, default="EUR")
    entitlements = models.JSONField(default=dict)
    limits = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Tenant(models.Model):
    DOMAIN_CHOICES = (
        ("food", "Food"),
        ("general", "General"),
    )
    BUSINESS_CHOICES = (
        ("restaurant", "Restaurant"),
        ("bar", "Bar"),
        ("grocery", "Grocery / Epicerie"),
        ("retail", "Retail / Boutique"),
        ("camping_multi", "Camping / Hôtel multi-services"),
        ("pharmacy", "Pharmacie / Parapharmacie"),
        ("other", "Other"),
    )

    name = models.CharField(max_length=150)
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES, default="food")
    business_type = models.CharField(max_length=30, choices=BUSINESS_CHOICES, default="other")
    created_at = models.DateTimeField(auto_now_add=True)

    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True)
    plan_source = models.CharField(max_length=20, choices=PLAN_SOURCES, default="FREE")
    license_expires_at = models.DateTimeField(null=True, blank=True)
    billing_cycle = models.CharField(max_length=10, choices=BILLING_CYCLES, default="MONTHLY")
    is_lifetime = models.BooleanField(default=False)
    subscription_status = models.CharField(max_length=15, choices=SUBSCRIPTION_STATUS, default="NONE")
    grace_started_at = models.DateTimeField(null=True, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return self.name

    @property
    def is_license_active(self):
        if self.is_lifetime:
            return True
        if not self.license_expires_at:
            return False
        return self.license_expires_at > timezone.now()


from django.db.models import JSONField as ModelJSONField


def default_service_features():
    return {
        "barcode": {"enabled": True, "recommended": True},
        "sku": {"enabled": True, "recommended": False},
        "prices": {"purchase_enabled": True, "selling_enabled": True, "recommended": True},
        "dlc": {"enabled": True, "recommended": False},
        "tva": {"enabled": True, "recommended": False},
        "suppliers": {"enabled": False},
        "lot": {"enabled": False, "recommended": False},
        "multi_unit": {"enabled": False, "recommended": False},
        "variants": {"enabled": False, "recommended": False},
        "open_container_tracking": {"enabled": False},
        "item_type": {"enabled": False, "recommended": False},
    }


class Service(models.Model):
    SERVICE_TYPES = (
        ("grocery_food", "Epicerie alimentaire"),
        ("bulk_food", "Vrac"),
        ("bar", "Bar"),
        ("kitchen", "Cuisine / Restaurant"),
        ("bakery", "Boulangerie / Pâtisserie"),
        ("restaurant_dining", "Salle / Restaurant"),
        ("retail_general", "Boutique non-alimentaire"),
        ("pharmacy_parapharmacy", "Pharmacie / Parapharmacie"),
        ("other", "Autre"),
    )
    COUNTING_MODES = (
        ("unit", "Unité"),
        ("weight", "Poids"),
        ("volume", "Volume"),
        ("mixed", "Mixte"),
    )
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="services", db_index=True)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, blank=True, null=True)
    service_type = models.CharField(max_length=40, choices=SERVICE_TYPES, default="other")
    counting_mode = models.CharField(max_length=20, choices=COUNTING_MODES, default="unit")
    features = ModelJSONField(default=default_service_features)
    sku_sequence = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="unique_service_name_per_tenant"),
        ]

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="users")
    role = models.CharField(max_length=30, default="owner")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.tenant.name})"


class Membership(models.Model):
    ROLE_CHOICES = (
        ("owner", "Owner"),
        ("manager", "Manager"),
        ("operator", "Operator"),
    )
    STATUS_CHOICES = (
        ("ACTIVE", "Active"),
        ("INVITED", "Invited"),
        ("DISABLED", "Disabled"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="operator")

    # ✅ Scope service (null = accès multi-services)
    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships",
    )

    # ✅ NOUVEAU (aligné avec serializers/views/services/access.py)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE", db_index=True)
    activated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "tenant")

    def __str__(self):
        scope = self.service.name if self.service_id else "ALL"
        return f"{self.user.username} - {self.tenant.name} ({self.role}) [{scope}] ({self.status})"


class OrganizationOverrides(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE)
    custom_entitlements = models.JSONField(null=True, blank=True)
    custom_limits = models.JSONField(null=True, blank=True)


class Subscription(models.Model):
    PROVIDERS = (("STRIPE", "Stripe"), ("MANUAL", "Manual"))
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE)
    provider = models.CharField(max_length=20, choices=PROVIDERS, default="STRIPE")
    provider_sub_id = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=15, choices=SUBSCRIPTION_STATUS, default="NONE")
    current_period_end = models.DateTimeField(null=True, blank=True)
    grace_started_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)


class PromoCode(models.Model):
    code = models.CharField(max_length=50, unique=True)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    duration_days = models.PositiveIntegerField(default=14)
    max_uses = models.PositiveIntegerField(default=100)
    used_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="promos"
    )
    notes = models.TextField(blank=True, default="")

    def __str__(self):
        return self.code


class PromoRedemption(models.Model):
    promo = models.ForeignKey(PromoCode, on_delete=models.CASCADE)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    redeemed_at = models.DateTimeField(auto_now_add=True)
    granted_until = models.DateTimeField()


class NotificationLog(models.Model):
    STATUS_CHOICES = (
        ("SENT", "Sent"),
        ("FAILED", "Failed"),
        ("DELIVERED", "Delivered"),
        ("BOUNCED", "Bounced"),
        ("SPAM", "Spam"),
    )
    tenant = models.ForeignKey(Tenant, on_delete=models.SET_NULL, null=True, blank=True, related_name="logs")
    to_email = models.EmailField()
    template = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SENT")
    provider_message = models.TextField(blank=True, default="")
    event_type = models.CharField(max_length=50, blank=True, default="")
    logged_at = models.DateTimeField(auto_now_add=True)


class Invitation(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("SENT", "Sent"),
        ("ACCEPTED", "Accepted"),
        ("EXPIRED", "Expired"),
        ("CANCELED", "Canceled"),
    )
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField(db_index=True)
    role = models.CharField(max_length=20, choices=Membership.ROLE_CHOICES, default="operator")
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name="invitations")
    token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["email"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        return f"Invitation {self.email} ({self.tenant.name})"


class AuditLog(models.Model):
    ACTION_CHOICES = (
        ("MEMBER_ADDED", "Member added"),
        ("MEMBER_UPDATED", "Member updated"),
        ("MEMBER_REMOVED", "Member removed"),
        ("EXPORT_SENT", "Export sent"),
        ("INVITE_SENT", "Invite sent"),
        ("INVITE_ACCEPTED", "Invite accepted"),
        ("LOGIN", "Login"),
    )

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="audit_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )

    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    object_type = models.CharField(max_length=50, blank=True, default="")
    object_id = models.CharField(max_length=50, blank=True, default="")

    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"]),
            models.Index(fields=["tenant", "action"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant_id} {self.action} {self.object_type}#{self.object_id}"
