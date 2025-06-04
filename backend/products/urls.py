from django.urls import path
from .views import inventory_stats, export_excel, home
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

urlpatterns = [
    path('favicon.ico', RedirectView.as_view(url='/static/favicon.ico', permanent=False)),
    path('inventory-stats/', inventory_stats, name='inventory_stats'),
    path('export-excel/', export_excel, name='export_excel'),
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('', include('inventory.urls')),
    
]