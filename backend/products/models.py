from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models import Q
from accounts.models import Tenant, Service


class ActiveProductManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_archived=False)


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
    min_qty = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)

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

    variant_name = models.CharField(max_length=80, null=True, blank=True)
    variant_value = models.CharField(max_length=120, null=True, blank=True)

    conversion_unit = models.CharField(max_length=10, null=True, blank=True)
    conversion_factor = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    inventory_month = models.CharField(max_length=7, db_index=True)  # Format: YYYY-MM
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

    objects = ActiveProductManager()
    all_objects = models.Manager()

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
                condition=Q(barcode__isnull=False) & ~Q(barcode="") & Q(is_archived=False),
            ),
            # ✅ Unicité seulement si internal_sku non vide (évite collisions avec "")
            models.UniqueConstraint(
                fields=["tenant", "service", "internal_sku", "inventory_month"],
                name="uniq_sku_per_month_tenant_service_nonempty",
                condition=Q(internal_sku__isnull=False) & ~Q(internal_sku="") & Q(is_archived=False),
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


class ExportEvent(models.Model):
    FORMAT_CHOICES = (
        ("csv", "CSV"),
        ("xlsx", "XLSX"),
    )

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="export_events")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="export_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    emailed = models.BooleanField(default=False)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="exp_evt_tenant_created_idx"),
            models.Index(fields=["tenant", "format", "created_at"], name="exp_evt_tenant_fmt_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} export {self.format} ({self.created_at.date()})"


class CatalogPdfEvent(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="catalog_pdf_events")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="catalog_pdf_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="catpdf_tenant_created_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} catalog_pdf ({self.created_at.date()})"


class LabelPdfEvent(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="label_pdf_events")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="label_pdf_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="labelpdf_tenant_created_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} labels_pdf ({self.created_at.date()})"


class Supplier(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=150)
    aliases = models.JSONField(default=list, blank=True)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=40, blank=True, default="")
    address = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.tenant_id})"

    def add_alias(self, alias):
        alias = (alias or "").strip()
        if not alias:
            return
        current = set(self.aliases or [])
        if alias not in current:
            current.add(alias)
            self.aliases = sorted(current)
            self.save(update_fields=["aliases"])


class Receipt(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("APPLIED", "Applied"),
        ("FAILED", "Failed"),
    )

    SOURCE_CHOICES = (
        ("csv", "CSV"),
        ("pdf", "PDF"),
    )

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="receipts")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="receipts")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="receipts")
    supplier_name = models.CharField(max_length=150, blank=True, default="")
    invoice_number = models.CharField(max_length=80, blank=True, default="")
    invoice_date = models.DateField(null=True, blank=True)
    import_hash = models.CharField(max_length=64, blank=True, default="")
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="csv")
    file_name = models.CharField(max_length=200, blank=True, default="")
    received_at = models.DateField(default=timezone.now)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="receipt_tenant_created_idx"),
            models.Index(fields=["tenant", "invoice_number"], name="receipt_tenant_invoice_idx"),
            models.Index(fields=["tenant", "import_hash"], name="receipt_tenant_import_hash_idx"),
        ]

    def __str__(self):
        return f"Receipt {self.id} ({self.tenant_id})"


class ReceiptLine(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("MATCHED", "Matched"),
        ("CREATED", "Created"),
        ("IGNORED", "Ignored"),
    )

    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="lines")
    line_number = models.PositiveIntegerField(default=1)
    raw_name = models.CharField(max_length=200, blank=True, default="")
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit = models.CharField(max_length=10, blank=True, default="pcs")
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tva = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    category = models.CharField(max_length=80, blank=True, default="")
    barcode = models.CharField(max_length=50, blank=True, default="")
    internal_sku = models.CharField(max_length=50, blank=True, default="")
    matched_product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    note = models.TextField(blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["receipt", "line_number"], name="receipt_line_idx"),
        ]

    def __str__(self):
        return f"ReceiptLine {self.receipt_id}#{self.line_number}"


class ReceiptImportEvent(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="receipt_import_events")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_import_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="rcpt_evt_tenant_created_idx"),
        ]

    def __str__(self):
        return f"{self.tenant_id} receipt_import ({self.created_at.date()})"


class ProductMergeLog(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="product_merge_logs")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="product_merge_logs")
    master_product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name="merge_master")
    merged_product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name="merge_merged")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_merge_logs",
    )
    summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "created_at"], name="prodmerge_tenant_created_idx"),
        ]

    def __str__(self):
        return f"Merge {self.tenant_id} {self.master_product_id}->{self.merged_product_id}"
