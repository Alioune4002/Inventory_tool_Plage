from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'category', 'purchase_price', 'selling_price', 'tva', 'dlc', 'quantity', 'barcode', 'inventory_month']
    list_filter = ['tenant', 'category', 'dlc', 'inventory_month']
    search_fields = ['name', 'barcode']
