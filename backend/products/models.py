from django.db import models
from django.db.models import Q
from accounts.models import Tenant, Service


class Product(models.Model):
    name = models.CharField(max_length=100)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='products')

    # catégorie libre afin de supporter les catégories par service dynamiques
    category = models.CharField(max_length=50, null=True, blank=True)
    brand = models.CharField(max_length=120, null=True, blank=True)
    supplier = models.CharField(max_length=120, null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='products')

    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tva = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    dlc = models.DateField(null=True, blank=True)

    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit = models.CharField(max_length=10, default="pcs")

    CONTAINER_STATUS = (
        ("SEALED", "Non entamé"),
        ("OPENED", "Entamé"),
    )
    container_status = models.CharField(max_length=10, choices=CONTAINER_STATUS, default="SEALED")

    pack_size = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    pack_uom = models.CharField(max_length=10, null=True, blank=True)
    remaining_qty = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    remaining_fraction = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)

    is_packaged_item = models.BooleanField(default=False)

    # Champs métier avancés (optionnels) pour templates sensibles
    lot_number = models.CharField(max_length=100, null=True, blank=True)
    storage_location = models.CharField(max_length=100, null=True, blank=True)  # ex: frigo, congélateur, réserve
    cold_chain = models.BooleanField(default=False)
    is_stupefiant = models.BooleanField(default=False)

    product_role = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=(
            ("raw_material", "Matière première"),
            ("finished_product", "Produit fini"),
            ("homemade_prep", "Préparation maison"),
        ),
    )

    expiry_type = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        choices=(
            ("24h", "24h"),
            ("DLC", "DLC"),
            ("DDM", "DDM"),
            ("none", "Aucune"),
        ),
    )

    fabrication_date = models.DateField(null=True, blank=True)

    barcode = models.CharField(max_length=50, null=True, blank=True)
    no_barcode = models.BooleanField(default=False)
    internal_sku = models.CharField(max_length=50, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    inventory_month = models.CharField(max_length=7, db_index=True)  # Format: YYYY-MM

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "inventory_month"]),
            models.Index(fields=["tenant", "service", "created_at"]),
            models.Index(fields=["tenant", "service", "barcode"]),
            models.Index(fields=["tenant", "service", "internal_sku"]),
        ]
        constraints = [
            # ✅ Unicité seulement si barcode non vide (évite collisions avec "")
            models.UniqueConstraint(
                fields=["tenant", "service", "barcode", "inventory_month"],
                name="uniq_barcode_per_month_tenant_service_nonempty",
                condition=Q(barcode__isnull=False) & ~Q(barcode=""),
            ),
            # ✅ Unicité seulement si internal_sku non vide (évite collisions avec "")
            models.UniqueConstraint(
                fields=["tenant", "service", "internal_sku", "inventory_month"],
                name="uniq_sku_per_month_tenant_service_nonempty",
                condition=Q(internal_sku__isnull=False) & ~Q(internal_sku=""),
            ),
        ]


class LossEvent(models.Model):
    REASON_CHOICES = [
        ("breakage", "Casse"),
        ("expired", "DLC dépassée"),
        ("theft", "Vol"),
        ("free", "Offert"),
        ("mistake", "Erreur"),
        ("other", "Autre"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="losses")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="losses")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="loss_events")

    occurred_at = models.DateTimeField()
    inventory_month = models.CharField(max_length=7, db_index=True)

    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    UNIT_CHOICES = getattr(
        Product,
        "UNIT_CHOICES",
        (("pcs", "pcs"), ("kg", "kg"), ("g", "g"), ("l", "l"), ("ml", "ml")),
    )
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="pcs")

    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="other")
    note = models.TextField(blank=True)

    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="losses_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["tenant", "service", "inventory_month"]),
            models.Index(fields=["tenant", "service", "occurred_at"]),
        ]

    def __str__(self):
        return f"Loss {self.quantity} {self.unit} ({self.reason})"


class Category(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="categories")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant", "service", "slug")
        ordering = ["name"]

    def save(self, *args, **kwargs):
        from django.utils.text import slugify
        if not self.slug:
            self.slug = slugify(self.name)[:160]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.service})"
