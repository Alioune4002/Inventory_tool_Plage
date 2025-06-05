from django.contrib import admin
from .models import Product

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'purchase_price', 'selling_price', 'tva', 'dlc', 'quantity', 'barcode']
    list_filter = ['category', 'dlc']
    search_fields = ['name', 'barcode']