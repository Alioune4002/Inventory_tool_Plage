from django.contrib import admin
from django.http import JsonResponse
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ai_assistant.views import AiAssistantView
from inventory.metrics import metrics_view
from products.views import (
    ProductViewSet,
    CategoryViewSet,
    LossEventViewSet,
    inventory_stats,
    export_excel,
    export_advanced,
    export_generic,
    catalog_pdf,
    home,
    alerts,
    search_products,
    lookup_product,
)

router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="products")
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"losses", LossEventViewSet, basename="losses")


def health(request):
    return JsonResponse({"status": "ok"})


def health_db(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return JsonResponse({"status": "ok", "db": "ok"})
    except (OperationalError, ProgrammingError):
        return JsonResponse({"status": "degraded", "db": "unavailable"}, status=503)


urlpatterns = [
    path("", home, name="home"),
    path("health/", health, name="health"),
    path("health/db/", health_db, name="health-db"),
    path("metrics/", metrics_view, name="metrics"),
    path("admin/", admin.site.urls),

    path("api/inventory-stats/", inventory_stats),

    path("api/export-excel/", export_excel),
    path("api/products/export/excel/", export_excel), 
    path("api/export-advanced/", export_advanced),
    path("api/exports/", export_generic),
    path("api/catalog/pdf/", catalog_pdf),
    path("api/alerts/", alerts),

    path("api/products/lookup/", lookup_product),
    path("api/products/search/", search_products),

    path("api/auth/", include("accounts.urls")),
    path("api/ai/assistant/", AiAssistantView.as_view(), name="ai-assistant"),

    path("api/", include(router.urls)),
]
