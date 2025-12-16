from django.urls import path
from django.views.generic import RedirectView

from .views import (
    export_excel,
    export_advanced,
    home,
    inventory_stats,
    lookup_product,
    search_products,
)

urlpatterns = [
    path('favicon.ico', RedirectView.as_view(url='/static/favicon.ico', permanent=False)),
    path('inventory-stats/', inventory_stats, name='inventory_stats'),
    path('export-excel/', export_excel, name='export_excel'),
    path('export-advanced/', export_advanced, name='export_advanced'),
    path('lookup/', lookup_product, name='lookup_product'),
    path('search/', search_products, name='search_products'),
    path('', home, name='home'),
]