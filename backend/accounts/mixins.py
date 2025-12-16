from accounts.utils import get_tenant_for_request
from accounts.utils import get_service_from_request


class TenantQuerySetMixin:
    """
    Mixin pour forcer le filtrage et l'insertion du tenant sur les queryset DRF.
    """

    def get_queryset(self):
        base_qs = super().get_queryset()
        tenant = get_tenant_for_request(self.request)
        qs = base_qs.filter(tenant=tenant)
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(inventory_month=month)
        return qs

    def perform_create(self, serializer):
        tenant = get_tenant_for_request(self.request)
        extra = {"tenant": tenant}
        # Si le modèle contient un champ service, on le renseigne automatiquement
        model = getattr(serializer, "Meta", None) and getattr(serializer.Meta, "model", None)
        if model and hasattr(model, "service"):
            extra["service"] = get_service_from_request(self.request)
        serializer.save(**extra)
