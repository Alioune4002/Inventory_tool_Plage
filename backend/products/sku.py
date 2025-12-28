import re

from django.db import transaction
from rest_framework import serializers

from accounts.models import Service
from .models import Product

SKU_PREFIX = "SKU-"
SKU_PADDING = 6
SKU_MAX_ATTEMPTS = 20
SKU_RE = re.compile(r"^SKU-(\\d+)$")


def max_existing_sku_sequence(tenant, service):
    max_seq = 0
    skus = (
        Product.objects.filter(
            tenant=tenant,
            service=service,
            internal_sku__startswith=SKU_PREFIX,
        )
        .values_list("internal_sku", flat=True)
        .iterator()
    )
    for sku in skus:
        match = SKU_RE.match(str(sku))
        if not match:
            continue
        try:
            max_seq = max(max_seq, int(match.group(1)))
        except ValueError:
            continue
    return max_seq


def generate_auto_sku(tenant, service):
    with transaction.atomic():
        locked = Service.objects.select_for_update().get(id=service.id)
        seq = int(locked.sku_sequence or 0)
        if seq < 1:
            seq = max(seq, max_existing_sku_sequence(tenant, locked))

        for _ in range(SKU_MAX_ATTEMPTS):
            seq += 1
            candidate = f"{SKU_PREFIX}{seq:0{SKU_PADDING}d}"
            exists = Product.objects.filter(tenant=tenant, service=locked, internal_sku=candidate).exists()
            if exists:
                continue
            locked.sku_sequence = seq
            locked.save(update_fields=["sku_sequence"])
            return candidate

        locked.sku_sequence = seq
        locked.save(update_fields=["sku_sequence"])

    raise serializers.ValidationError(
        {"internal_sku": "Impossible de générer un SKU unique pour ce service. Réessayez."}
    )
