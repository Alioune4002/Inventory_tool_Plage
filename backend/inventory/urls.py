"""
URL configuration for inventory project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import JsonResponse
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ai_assistant.views import AiAssistantView
from products.views import (
    ProductViewSet,
    CategoryViewSet,
    LossEventViewSet,
    inventory_stats,
    export_excel,
    export_advanced,
    export_generic,
    home,
    search_products,
    lookup_product,
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='products')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'losses', LossEventViewSet, basename='losses')


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
    path('', home, name='home'),
    path('health/', health, name='health'),
    path('health/db/', health_db, name='health-db'),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/inventory-stats/', inventory_stats),
    path('api/export-excel/', export_excel),
    path('api/export-advanced/', export_advanced),
    path('api/exports/', export_generic),
    path('api/products/lookup/', lookup_product),
    path('api/products/search/', search_products),
    path('api/auth/', include('accounts.urls')),
    path('api/ai/assistant/', AiAssistantView.as_view(), name='ai-assistant'),
]
