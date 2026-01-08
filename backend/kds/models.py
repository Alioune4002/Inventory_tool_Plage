from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Tenant, Service
from products.models import Product
from pos.models import PosTicket


class MenuItem(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="kds_menu_items")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="kds_menu_items")

    name = models.CharField(max_length=140)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "is_active"]),
            models.Index(fields=["tenant", "service", "name"]),
        ]

    def __str__(self):
        return self.name


class RecipeItem(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name="recipe_items")
    ingredient_product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="kds_recipe_items"
    )
    qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit = models.CharField(max_length=20, default="pcs")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["menu_item", "ingredient_product"], name="uniq_recipe_ingredient"
            )
        ]
        indexes = [
            models.Index(fields=["menu_item"]),
        ]

    def __str__(self):
        return f"{self.menu_item_id} -> {self.ingredient_product_id}"


class KdsTable(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="kds_tables")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="kds_tables")
    name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "service", "name"], name="uniq_kds_table_name"
            )
        ]

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_CHOICES = [
        ("DRAFT", "Brouillon"),
        ("SENT", "En cuisine"),
        ("READY", "Prêt"),
        ("SERVED", "Servi"),
        ("CANCELLED", "Annulé"),
        ("PAID", "Payé"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="kds_orders")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="kds_orders")
    table = models.ForeignKey(KdsTable, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders")

    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="DRAFT")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kds_orders",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    pos_ticket = models.ForeignKey(
        PosTicket, on_delete=models.SET_NULL, null=True, blank=True, related_name="kds_orders"
    )

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "status"]),
            models.Index(fields=["tenant", "service", "created_at"]),
        ]

    def __str__(self):
        return f"Commande #{self.id}"


class OrderLine(models.Model):
    STATUS_CHOICES = [
        ("IN_ORDER", "Dans la commande"),
        ("CANCELLED", "Annulé"),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True, blank=True)

    qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="IN_ORDER")

    menu_item_name = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["order"]),
        ]

    def __str__(self):
        return f"{self.menu_item_name or 'Ligne'} x{self.qty}"


class StockConsumption(models.Model):
    REASON_CHOICES = [
        ("ORDER_SENT", "Commande envoyée"),
        ("WASTE", "Perte"),
        ("ADJUSTMENT", "Ajustement"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="kds_consumptions")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="kds_consumptions")
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="consumptions")
    order_line = models.ForeignKey(
        OrderLine, on_delete=models.SET_NULL, null=True, blank=True, related_name="consumptions"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="kds_consumptions")
    qty_consumed = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="ORDER_SENT")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "created_at"]),
            models.Index(fields=["product"]),
        ]

    def __str__(self):
        return f"{self.product_id} {self.qty_consumed}"


class WasteEvent(models.Model):
    REASON_CHOICES = [
        ("cancelled", "Annulation"),
        ("mistake", "Erreur"),
        ("breakage", "Casse"),
        ("other", "Autre"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="kds_waste_events")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="kds_waste_events")
    related_order = models.ForeignKey(
        Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="waste_events"
    )
    related_order_line = models.ForeignKey(
        OrderLine, on_delete=models.SET_NULL, null=True, blank=True, related_name="waste_events"
    )
    reason_code = models.CharField(max_length=30, choices=REASON_CHOICES, default="other")
    reason_text = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kds_waste_events",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "created_at"]),
        ]

    def __str__(self):
        return f"Waste {self.reason_code}"
