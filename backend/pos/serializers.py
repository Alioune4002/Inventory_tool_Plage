from decimal import Decimal

from rest_framework import serializers


class PosCheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    qty = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    discount_type = serializers.ChoiceField(
        choices=["percent", "amount"], required=False, allow_blank=True, default="amount"
    )

    def validate_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à 0.")
        return value


class PosGlobalDiscountSerializer(serializers.Serializer):
    value = serializers.DecimalField(max_digits=12, decimal_places=2)
    type = serializers.ChoiceField(choices=["percent", "amount"])

    def validate_value(self, value):
        if value < 0:
            raise serializers.ValidationError("La remise doit être positive.")
        return value


class PosPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=["cash", "card", "cheque", "ticket_restaurant", "other"]
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0.")
        return value


class PosCheckoutSerializer(serializers.Serializer):
    items = PosCheckoutItemSerializer(many=True)
    global_discount = PosGlobalDiscountSerializer(required=False, allow_null=True)
    payments = PosPaymentSerializer(many=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        items = attrs.get("items") or []
        payments = attrs.get("payments") or []
        if not items:
            raise serializers.ValidationError({"items": "Ajoutez au moins un produit."})
        if not payments:
            raise serializers.ValidationError({"payments": "Ajoutez au moins un moyen de paiement."})
        return attrs


class PosTicketCancelSerializer(serializers.Serializer):
    REASON_CHOICES = [
        ("error", "Erreur de caisse"),
        ("customer_left", "Client parti"),
        ("breakage", "Casse"),
        ("mistake", "Erreur de commande"),
        ("other", "Autre"),
    ]

    reason_code = serializers.ChoiceField(choices=REASON_CHOICES)
    reason_text = serializers.CharField(required=False, allow_blank=True, default="")
    restock = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if attrs.get("reason_code") == "other" and not attrs.get("reason_text"):
            raise serializers.ValidationError({"reason_text": "Précisez la raison d’annulation."})
        return attrs


def _discount_amount(base: Decimal, value: Decimal, discount_type: str) -> Decimal:
    if base <= 0:
        return Decimal("0")
    if discount_type == "percent":
        return (base * value) / Decimal("100")
    return value
