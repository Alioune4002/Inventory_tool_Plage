from rest_framework import serializers
from django.utils.text import slugify
from django.utils import timezone
from django.db import IntegrityError

from .models import Product, Category, LossEvent
from accounts.utils import get_service_from_request, get_tenant_for_request


class ProductSerializer(serializers.ModelSerializer):
    warnings = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = "__all__"
        extra_kwargs = {
            "tenant": {"read_only": True},
            "warnings": {"read_only": True},
        }

    def _clean_optional_str(self, v):
        if v is None:
            return None
        if not isinstance(v, str):
            return v
        s = v.strip()
        return s if s else None

    def _compute_warnings(self, attrs, service):
        warnings = []
        features = getattr(service, "features", {}) or {}

        prices_cfg = features.get("prices", {})
        barcode_cfg = features.get("barcode", {})
        sku_cfg = features.get("sku", {})
        dlc_cfg = features.get("dlc", {})
        open_cfg = features.get("open_container_tracking", {"enabled": False})
        service_type = getattr(service, "service_type", "other")

        barcode = attrs.get("barcode")
        sku = attrs.get("internal_sku")
        purchase_price = attrs.get("purchase_price")
        selling_price = attrs.get("selling_price")
        dlc = attrs.get("dlc")

        container_status = attrs.get("container_status", "SEALED")
        remaining_qty = attrs.get("remaining_qty")
        remaining_fraction = attrs.get("remaining_fraction")

        lot_number = attrs.get("lot_number")
        expiry_type = attrs.get("expiry_type")
        is_stupefiant = attrs.get("is_stupefiant")

        if not barcode and not sku:
            warnings.append("Aucun identifiant (EAN/SKU) : risque de doublons.")
        if prices_cfg.get("recommended") and purchase_price is None:
            warnings.append("Prix d'achat manquant : stats moins précises.")
        if prices_cfg.get("selling_enabled") and selling_price is None and prices_cfg.get("recommended"):
            warnings.append("Prix de vente manquant : export ventes moins précis.")
        if dlc_cfg.get("enabled") and not dlc and dlc_cfg.get("recommended"):
            warnings.append("DLC manquante pour ce service.")
        if barcode_cfg.get("enabled") is False and barcode:
            warnings.append("Code-barres fourni alors que non requis pour ce service.")
        if sku_cfg.get("enabled") is False and sku:
            warnings.append("SKU fourni alors que non requis pour ce service.")

        if container_status == "OPENED" and open_cfg.get("enabled"):
            if remaining_qty is None and remaining_fraction is None:
                warnings.append("Produit entamé : indiquez un reste (fraction ou quantité) pour un suivi précis.")

        if service_type == "pharmacy_parapharmacy":
            if is_stupefiant and not lot_number:
                warnings.append("Stupéfiant : le numéro de lot est recommandé.")
            if not dlc and expiry_type != "none":
                warnings.append("Péremption : renseignez la date pour les produits sensibles.")

        if service_type == "bakery" and expiry_type == "24h":
            if not dlc:
                warnings.append("Produit 24h : ajoutez une date pour suivre les invendus.")

        return warnings

    def validate(self, attrs):
        request = self.context.get("request")
        service = get_service_from_request(request)

        features = getattr(service, "features", {}) or {}
        counting_mode = getattr(service, "counting_mode", "unit")
        prices_cfg = features.get("prices", {})

        # ✅ Normalisation : ne jamais laisser "" en DB (sinon contraintes uniques explosent)
        attrs["barcode"] = self._clean_optional_str(attrs.get("barcode"))
        attrs["internal_sku"] = self._clean_optional_str(attrs.get("internal_sku"))

        # ✅ no_barcode cohérent : dérivé du barcode réel
        attrs["no_barcode"] = attrs.get("barcode") is None

        # ✅ Unité selon counting_mode
        unit = (attrs.get("unit") or "pcs").strip()
        if counting_mode == "weight" and unit not in ["kg", "g"]:
            unit = "kg"
        elif counting_mode == "volume" and unit not in ["l", "ml"]:
            unit = "l"
        elif counting_mode == "unit" and unit != "pcs":
            unit = "pcs"
        attrs["unit"] = unit

        # ✅ Prix désactivés => forcer à None
        if prices_cfg.get("purchase_enabled") is False:
            attrs["purchase_price"] = None
        if prices_cfg.get("selling_enabled") is False:
            attrs["selling_price"] = None

        # ✅ expiry_type par défaut
        if not attrs.get("expiry_type"):
            attrs["expiry_type"] = "none"

        self._service = service
        self._warnings = self._compute_warnings(attrs, service)
        return attrs

    def create(self, validated_data):
        try:
            instance = super().create(validated_data)
            instance._warnings = getattr(self, "_warnings", [])
            return instance
        except IntegrityError:
            raise serializers.ValidationError(
                {"detail": "Doublon : un produit avec ce code-barres ou ce SKU existe déjà pour ce mois/service."}
            )

    def update(self, instance, validated_data):
        try:
            obj = super().update(instance, validated_data)
            obj._warnings = getattr(self, "_warnings", [])
            return obj
        except IntegrityError:
            raise serializers.ValidationError(
                {"detail": "Doublon : un produit avec ce code-barres ou ce SKU existe déjà pour ce mois/service."}
            )

    def get_warnings(self, obj):
        return getattr(obj, "_warnings", [])


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "service", "tenant", "created_at"]
        read_only_fields = ["id", "slug", "created_at", "service", "tenant"]

    def create(self, validated_data):
        request = self.context.get("request")
        service = get_service_from_request(request)
        validated_data["service"] = service
        validated_data["slug"] = slugify(validated_data.get("name", ""))[:160]
        validated_data["tenant"] = service.tenant
        return super().create(validated_data)


class LossEventSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField(read_only=True)
    warnings = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LossEvent
        fields = "__all__"
        read_only_fields = [
            "id",
            "tenant",
            "service",
            "created_by",
            "created_at",
            "warnings",
            "inventory_month",
            "product_name",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        tenant = get_tenant_for_request(request)
        service = get_service_from_request(request)

        product = attrs.get("product")
        if product and (product.tenant_id != tenant.id or product.service_id != service.id):
            raise serializers.ValidationError({"product": "Produit hors du service/tenant courant."})

        occurred_at = attrs.get("occurred_at") or timezone.now()
        attrs["inventory_month"] = occurred_at.strftime("%Y-%m")
        attrs["tenant"] = tenant
        attrs["service"] = service
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        validated_data["created_by"] = user if user and user.is_authenticated else None
        instance = super().create(validated_data)
        instance._warnings = self.get_warnings(instance)
        return instance

    def get_warnings(self, obj):
        warnings = []
        product = obj.product
        if product and product.purchase_price is None:
            warnings.append("Prix d'achat manquant : le coût de la perte est approximatif.")
        return warnings

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None