from decimal import Decimal

from rest_framework import serializers

from .models import KdsTable, MenuItem, Order, OrderLine, RecipeItem


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ["id", "name", "description", "is_active", "price", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class RecipeItemSerializer(serializers.ModelSerializer):
    ingredient_product_id = serializers.IntegerField()

    class Meta:
        model = RecipeItem
        fields = ["ingredient_product_id", "qty", "unit"]

    def validate_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à 0.")
        return value


class KdsTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = KdsTable
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class OrderLineInputSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField()
    qty = serializers.DecimalField(max_digits=12, decimal_places=3)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à 0.")
        return value


class OrderCreateSerializer(serializers.Serializer):
    table_id = serializers.IntegerField(required=False, allow_null=True)
    lines = OrderLineInputSerializer(many=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        lines = attrs.get("lines") or []
        if not lines:
            raise serializers.ValidationError({"lines": "Ajoutez au moins un plat."})
        return attrs


class OrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderLine
        fields = [
            "id",
            "menu_item_id",
            "menu_item_name",
            "qty",
            "unit_price",
            "line_total",
            "notes",
            "status",
        ]


class OrderSerializer(serializers.ModelSerializer):
    table = serializers.SerializerMethodField()
    lines = OrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "status",
            "table",
            "subtotal_amount",
            "discount_total",
            "total_amount",
            "note",
            "created_at",
            "sent_at",
            "ready_at",
            "served_at",
            "cancelled_at",
            "paid_at",
            "lines",
        ]

    def get_table(self, obj):
        if not obj.table_id:
            return None
        return {"id": obj.table_id, "name": obj.table.name}


class PaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=["cash", "card", "cheque", "ticket_restaurant", "other"]
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    metadata = serializers.JSONField(required=False)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0.")
        return value


class OrderCancelSerializer(serializers.Serializer):
    reason_code = serializers.ChoiceField(
        choices=["cancelled", "mistake", "breakage", "other"]
    )
    reason_text = serializers.CharField(required=False, allow_blank=True, default="")


class PosCheckoutPayloadSerializer(serializers.Serializer):
    payments = PaymentSerializer(many=True)
