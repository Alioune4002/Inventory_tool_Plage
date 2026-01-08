from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Tenant, Service
from products.models import Product


class PosTicket(models.Model):
    STATUS_CHOICES = [
        ("PAID", "Payé"),
        ("VOID", "Annulé"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="pos_tickets")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="pos_tickets")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="pos_tickets"
    )
    created_at = models.DateTimeField(default=timezone.now)

    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PAID")
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "service", "created_at"]),
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self):
        return f"POS Ticket #{self.id} ({self.tenant_id})"


class PosTicketLine(models.Model):
    ticket = models.ForeignKey(PosTicket, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="pos_lines")

    qty = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit = models.CharField(max_length=10, default="pcs")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    product_name = models.CharField(max_length=120, blank=True, default="")
    barcode = models.CharField(max_length=50, blank=True, default="")
    internal_sku = models.CharField(max_length=50, blank=True, default="")
    category = models.CharField(max_length=80, blank=True, default="")
    tva = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["ticket"]),
        ]

    def __str__(self):
        return f"{self.product_name or 'Ligne'} x{self.qty}"


class PosPayment(models.Model):
    METHOD_CHOICES = [
        ("cash", "Espèces"),
        ("card", "Carte"),
        ("cheque", "Chèque"),
        ("ticket_restaurant", "Ticket restaurant"),
        ("other", "Autre"),
    ]

    ticket = models.ForeignKey(PosTicket, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=30, choices=METHOD_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["ticket"]),
            models.Index(fields=["method"]),
        ]

    def __str__(self):
        return f"{self.method} {self.amount}"
