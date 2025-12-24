# Deployed backend: https://inventory-tool-plage.onrender.com
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers, exceptions  # type: ignore
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # pyright: ignore[reportMissingImports]

from .models import Tenant, UserProfile, Service, Membership
from .utils import get_default_service

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    # ✅ email optionnel (tests n'envoient pas d'email)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    tenant_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    domain = serializers.ChoiceField(choices=Tenant.DOMAIN_CHOICES, default="food")
    business_type = serializers.ChoiceField(choices=Tenant.BUSINESS_CHOICES, default="other")
    service_type = serializers.ChoiceField(choices=Service.SERVICE_TYPES, required=False, allow_blank=True)
    service_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    extra_services = serializers.JSONField(required=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate(self, attrs):
        if not attrs.get("password_confirm"):
            attrs["password_confirm"] = attrs.get("password")

        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs

    def create(self, validated_data):
        from .utils import apply_service_preset

        tenant_name = validated_data.get("tenant_name") or f"{validated_data['username']}'s store"
        business_type = validated_data.get("business_type", "other")
        service_type = validated_data.get("service_type") or "other"
        service_name = validated_data.get("service_name") or "Principal"
        extra_services = validated_data.get("extra_services") or []

        user_defined_services = [(service_name, service_type)]
        for item in extra_services:
            if isinstance(item, dict):
                name = (item.get("name") or item.get("service_name") or "").strip()
                stype = item.get("service_type") or "other"
            else:
                name = str(item or "").strip()
                stype = "other"
            if name:
                user_defined_services.append((name, stype))

        defaults_by_business = {
            "restaurant": [("Cuisine", "kitchen"), ("Salle", "dining")],
            "bar": [("Bar", "bar"), ("Stock", "retail_general")],
            "grocery": [("Principal", "grocery_food")],
            "retail": [("Boutique", "retail_general")],
            "camping_multi": [("Épicerie", "grocery_food"), ("Bar", "bar"), ("Restauration", "kitchen")],
        }
        chosen_services = (
            user_defined_services
            if any(n for n, _ in user_defined_services)
            else defaults_by_business.get(business_type, [("Principal", "other")])
        )

        # ✅ Respecte le domain envoyé par l’API (tests attendent "food")
        domain_from_request = validated_data.get("domain") or None
        if domain_from_request:
            domain = domain_from_request
        else:
            food_types = {"grocery_food", "bulk_food", "bar", "kitchen", "dining"}
            has_food_service = any(stype in food_types for _, stype in chosen_services)
            domain = "food" if has_food_service else "general"

        tenant = Tenant.objects.create(name=tenant_name, domain=domain, business_type=business_type)

        def create_service(name, stype):
            preset = apply_service_preset(stype)
            return Service.objects.create(
                tenant=tenant,
                name=name,
                service_type=stype,
                counting_mode=preset.get("counting_mode", "unit"),
                features=preset.get("features", {}),
            )

        created_names = set()
        for name, stype in chosen_services:
            if not name or name in created_names:
                continue
            create_service(name, stype)
            created_names.add(name)

        user = User.objects.create_user(
            username=validated_data["username"],
            email=(validated_data.get("email") or ""),
            password=validated_data["password"],
        )
        UserProfile.objects.create(user=user, tenant=tenant, role="owner")
        return user


class SimpleTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        profile = getattr(user, "profile", None)
        if profile:
            token["tenant_id"] = profile.tenant_id
            token["tenant_domain"] = profile.tenant.domain
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username and "@" in username:
            user_by_email = User.objects.filter(email__iexact=username).order_by("id").first()
            if user_by_email:
                attrs[self.username_field] = user_by_email.username

        candidate = None
        if attrs.get(self.username_field):
            candidate = User.objects.filter(username=attrs[self.username_field]).first()
        if not candidate and username and "@" in username:
            candidate = User.objects.filter(email__iexact=username).first()
        if candidate and not candidate.is_active:
            raise exceptions.AuthenticationFailed(
                "Email non vérifié. Vérifie ta boîte mail pour activer ton compte.",
                code="email_not_verified",
            )

        data = super().validate(attrs)

        profile = getattr(self.user, "profile", None)
        if not profile:
            tenant = Tenant.objects.first() or Tenant.objects.create(name="Default Tenant", domain="food")
            profile = UserProfile.objects.create(user=self.user, tenant=tenant, role="owner")

        data.update(
            {
                "user": {"id": self.user.id, "username": self.user.username, "email": self.user.email},
                "tenant": {"id": profile.tenant.id, "name": profile.tenant.name, "domain": profile.tenant.domain},
            }
        )
        return data


class MeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True, required=False)
    tenant = serializers.SerializerMethodField()

    def get_tenant(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return {"id": profile.tenant.id, "name": profile.tenant.name, "domain": profile.tenant.domain}


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "slug", "created_at", "service_type", "counting_mode", "features"]
        read_only_fields = ["id", "created_at", "slug"]
        extra_kwargs = {"features": {"required": False}, "counting_mode": {"required": False}}

    def create(self, validated_data):
        from .utils import apply_service_preset

        if not validated_data.get("features"):
            preset = apply_service_preset(validated_data.get("service_type") or "other")
            validated_data["counting_mode"] = preset.get("counting_mode", "unit")
            validated_data["features"] = preset.get("features", {})
        return super().create(validated_data)

    def update(self, instance, validated_data):
        features = validated_data.pop("features", None)
        if features is not None:
            instance.features = features
        counting_mode = validated_data.pop("counting_mode", None)
        if counting_mode:
            instance.counting_mode = counting_mode
        instance.name = validated_data.get("name", instance.name)
        instance.service_type = validated_data.get("service_type", instance.service_type)
        instance.save()
        return instance


class MembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True, required=False)
    username = serializers.CharField(write_only=True, required=False)

    # ✅ scope service
    service_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    service_scope = serializers.SerializerMethodField(read_only=True)

    user_display = serializers.SerializerMethodField()
    temp_password = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            "id",
            "user",
            "tenant",
            "role",
            "status",
            "service",
            "created_at",
            "email",
            "username",
            "service_id",
            "service_scope",
            "user_display",
            "temp_password",
        ]
        read_only_fields = [
            "id",
            "tenant",
            "created_at",
            "user",
            "service",
            "service_scope",
            "user_display",
            "temp_password",
            "status",
        ]

    def validate(self, attrs):
        if self.instance:
            return attrs

        if not attrs.get("email") and not attrs.get("username"):
            raise serializers.ValidationError("Fournissez un email ou un nom d'utilisateur.")
        return attrs

    def create(self, validated_data):
        tenant = self.context["tenant"]

        email = (validated_data.pop("email", "") or "").strip()
        username = (validated_data.pop("username", "") or "").strip()
        role = validated_data.get("role", "operator")
        service_id = validated_data.pop("service_id", None)

        service_obj = None
        if service_id:
            service_obj = Service.objects.filter(id=service_id, tenant=tenant).first()

        user_obj = None
        if email:
            user_obj = User.objects.filter(email=email).first()
        if not user_obj and username:
            user_obj = User.objects.filter(username=username).first()

        created_new = False
        if not user_obj:
            base_username = username or (email.split("@")[0] if email else "user")
            final_username = f"{base_username}-{Tenant.objects.count()+1}"
            temp_password = User.objects.make_random_password(length=10)
            user_obj = User.objects.create_user(username=final_username, email=email, password=temp_password)
            self._temp_password = temp_password
            created_new = True

        from django.db import IntegrityError

        try:
            membership, _ = Membership.objects.update_or_create(
                user=user_obj,
                tenant=tenant,
                defaults={
                    "role": role,
                    "service": service_obj,
                    "status": "ACTIVE",
                    "activated_at": timezone.now(),
                },
            )
        except IntegrityError:
            raise serializers.ValidationError("Ce membre existe déjà pour ce commerce.")

        if not hasattr(user_obj, "profile"):
            UserProfile.objects.create(user=user_obj, tenant=tenant, role=role)

        if not created_new:
            self._temp_password = None

        return membership

    def update(self, instance, validated_data):
        tenant = instance.tenant
        if "role" in validated_data:
            instance.role = validated_data.get("role") or instance.role

        if "service_id" in validated_data:
            service_id = validated_data.get("service_id")
            if service_id in ("", None):
                instance.service = None
            else:
                service_obj = Service.objects.filter(id=service_id, tenant=tenant).first()
                if not service_obj:
                    raise serializers.ValidationError({"service_id": "Service invalide pour ce tenant."})
                instance.service = service_obj

        instance.save()
        return instance

    def get_user_display(self, obj):
        return {"id": obj.user.id, "username": obj.user.username, "email": obj.user.email}

    def get_temp_password(self, obj):
        return getattr(self, "_temp_password", None)

    def get_service_scope(self, obj):
        if not obj.service_id:
            return None
        return {"id": obj.service.id, "name": obj.service.name}


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("username"):
            raise serializers.ValidationError("Fournissez un email ou un nom d'utilisateur.")
        return attrs


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs