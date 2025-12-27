import re

from rest_framework import serializers
from django.utils.text import slugify
from django.utils import timezone
from django.db import IntegrityError, transaction

from .models import Product, Category, LossEvent
from accounts.models import Service
from accounts.utils import get_service_from_request, get_tenant_for_request

SKU_PREFIX = "SKU-"
SKU_PADDING = 6
SKU_MAX_ATTEMPTS = 20
SKU_RE = re.compile(r"^SKU-(\d+)$")


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
        item_type_cfg = features.get("item_type", {"enabled": False})
        service_type = getattr(service, "service_type", "other")

        barcode = attrs.get("barcode")
        sku = attrs.get("internal_sku")
        purchase_price = attrs.get("purchase_price")
        selling_price = attrs.get("selling_price")
        dlc = attrs.get("dlc")
        product_role = attrs.get("product_role")

        container_status = attrs.get("container_status", "SEALED")
        remaining_qty = attrs.get("remaining_qty")
        remaining_fraction = attrs.get("remaining_fraction")

        lot_number = attrs.get("lot_number")
        expiry_type = attrs.get("expiry_type")
        is_stupefiant = attrs.get("is_stupefiant")

        if not barcode and not sku:
            warnings.append("Aucun identifiant (EAN/SKU) : risque de doublons.")
        if prices_cfg.get("recommended") and purchase_price is None and product_role not in ("finished_product", "homemade_prep"):
            warnings.append("Prix d'achat manquant : stats moins précises.")
        if prices_cfg.get("selling_enabled") and selling_price is None and prices_cfg.get("recommended"):
            if product_role in ("finished_product", "homemade_prep") or not product_role:
                warnings.append("Prix de vente manquant : export ventes moins précis.")
        if item_type_cfg.get("enabled") and item_type_cfg.get("recommended") and not product_role:
            warnings.append("Type d'article non précisé : aide pour marge et suivi matières/produits finis.")
        if product_role == "raw_material" and purchase_price is None and prices_cfg.get("purchase_enabled", True):
            warnings.append("Matière première sans prix d'achat : coût des pertes approximatif.")
        if product_role in ("finished_product", "homemade_prep") and selling_price is None and prices_cfg.get(
            "selling_enabled", True
        ):
            warnings.append("Produit fini sans prix de vente : marge théorique indisponible.")
        if "dlc" in attrs and dlc_cfg.get("enabled") and not dlc and dlc_cfg.get("recommended"):
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

    def _max_existing_sku_sequence(self, tenant, service):
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

    def _generate_auto_sku(self, tenant, service):
        with transaction.atomic():
            locked = Service.objects.select_for_update().get(id=service.id)
            seq = int(locked.sku_sequence or 0)
            if seq < 1:
                seq = max(seq, self._max_existing_sku_sequence(tenant, locked))

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

    def validate(self, attrs):
        request = self.context.get("request")
        service = get_service_from_request(request)

        features = getattr(service, "features", {}) or {}
        counting_mode = getattr(service, "counting_mode", "unit")
        prices_cfg = features.get("prices", {})
        sku_cfg = features.get("sku", {})
        sku_enabled = sku_cfg.get("enabled") is not False

        # ✅ Normalisation : ne jamais laisser "" en DB (sinon contraintes uniques explosent)
        current_barcode = attrs.get("barcode", getattr(self.instance, "barcode", None))
        current_sku = attrs.get("internal_sku", getattr(self.instance, "internal_sku", None))
        attrs["barcode"] = self._clean_optional_str(current_barcode)
        attrs["internal_sku"] = self._clean_optional_str(current_sku)

        attrs["variant_name"] = self._clean_optional_str(
            attrs.get("variant_name", getattr(self.instance, "variant_name", None))
        )
        attrs["variant_value"] = self._clean_optional_str(
            attrs.get("variant_value", getattr(self.instance, "variant_value", None))
        )

        attrs["conversion_unit"] = self._clean_optional_str(
            attrs.get("conversion_unit", getattr(self.instance, "conversion_unit", None))
        )
        conversion_factor = attrs.get("conversion_factor", getattr(self.instance, "conversion_factor", None))
        if conversion_factor is not None:
            if conversion_factor <= 0:
                raise serializers.ValidationError({"conversion_factor": "Le facteur de conversion doit être positif."})
            if not attrs.get("conversion_unit"):
                raise serializers.ValidationError({"conversion_unit": "Unité de conversion requise."})
        if attrs.get("conversion_unit") and conversion_factor is None:
            raise serializers.ValidationError({"conversion_factor": "Facteur de conversion requis."})

        min_qty = attrs.get("min_qty", getattr(self.instance, "min_qty", None))
        if min_qty is not None and min_qty < 0:
            raise serializers.ValidationError({"min_qty": "Le stock minimum doit être positif."})

        # ✅ no_barcode cohérent : dérivé du barcode réel, avec enforcement seulement si explicitement demandé
        explicit_no_barcode = False
        if hasattr(self, "initial_data"):
            raw_flag = self.initial_data.get("no_barcode")
            explicit_no_barcode = str(raw_flag).lower() in ("true", "1", "yes")

        self._auto_generate_sku = False
        if self.instance is None and sku_enabled and not attrs.get("internal_sku"):
            self._auto_generate_sku = True

        attrs["no_barcode"] = attrs.get("barcode") is None
        if explicit_no_barcode and not attrs.get("internal_sku") and not self._auto_generate_sku:
            raise serializers.ValidationError({"internal_sku": "SKU requis quand le code-barres est absent."})

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
        if getattr(self, "_auto_generate_sku", False):
            tenant = validated_data.get("tenant") or get_tenant_for_request(self.context.get("request"))
            service = validated_data.get("service") or get_service_from_request(self.context.get("request"))
            validated_data["internal_sku"] = self._generate_auto_sku(tenant, service)
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for num_field in [
            "quantity",
            "purchase_price",
            "selling_price",
            "remaining_qty",
            "remaining_fraction",
            "pack_size",
            "min_qty",
            "conversion_factor",
        ]:
            if num_field in data and data[num_field] is not None:
                try:
                    data[num_field] = float(data[num_field])
                except (TypeError, ValueError):
                    pass
        factor = getattr(instance, "conversion_factor", None)
        unit = getattr(instance, "conversion_unit", None)
        if factor is not None and unit:
            try:
                data["converted_quantity"] = float(instance.quantity or 0) * float(factor)
                data["converted_unit"] = unit
            except (TypeError, ValueError):
                data["converted_quantity"] = None
                data["converted_unit"] = unit
        return data


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
            raise serializers.ValidationError({"product": "Ce produit appartient à un autre service. Sélectionnez le bon service puis réessayez."})

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
