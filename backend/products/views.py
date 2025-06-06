from rest_framework import viewsets
from .models import Product
from .serializers import ProductSerializer 
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, get_object_or_404

from rest_framework.decorators import api_view
from rest_framework.response import Response
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def create(self, request, *args, **kwargs):
        logger.info("Données reçues: %s", request.data)
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

from django.http import JsonResponse

def home(request):
    return JsonResponse({"message": "Bienvenue sur l'API de Inventory Tool ! Utilisez /api/products/ pour accéder aux données."})

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        month = self.request.query_params.get('month', None)
        if month:
            queryset = queryset.filter(inventory_month=month)
        return queryset

@api_view(['GET'])
def inventory_stats(request):
    month = request.query_params.get('month', None)
    products = Product.objects.filter(inventory_month=month) if month else Product.objects.all()
    total_value = sum(float(p.purchase_price) * p.quantity for p in products if p.purchase_price and p.quantity) or 0
    total_selling_value = sum(float(p.selling_price) * p.quantity for p in products if p.selling_price and p.quantity) or 0
    categories = Product.objects.filter(inventory_month=month).values('category').distinct() if month else Product.objects.values('category').distinct()
    stats = [
        {
            'category': cat['category'],
            'total_quantity': sum(p.quantity for p in products.filter(category=cat['category']) if p.quantity) or 0,
            'total_purchase_value': sum(float(p.purchase_price) * p.quantity for p in products.filter(category=cat['category']) if p.purchase_price and p.quantity) or 0,
            'total_selling_value': sum(float(p.selling_price) * p.quantity for p in products.filter(category=cat['category']) if p.selling_price and p.quantity) or 0,
            'avg_margin': sum((float(p.selling_price) - float(p.purchase_price)) * p.quantity for p in products.filter(category=cat['category']) if p.selling_price and p.purchase_price and p.quantity) / (sum(p.quantity for p in products.filter(category=cat['category']) if p.quantity) or 1) or 0
        }
        for cat in categories
    ]
    return Response({'total_value': total_value, 'categories': stats})

@api_view(['GET'])
def export_excel(request):
    month = request.query_params.get('month', None)
    if not month:
        return Response({'error': 'Paramètre month requis'}, status=400)

    products = Product.objects.filter(inventory_month=month)

    wb = openpyxl.Workbook()
    ws = wb.active

    month_date = datetime.strptime(month, '%Y-%m')
    month_name = month_date.strftime('%B').capitalize()
    year = month_date.strftime('%Y')
    ws.title = f"Inventaire {month_name} {year}"
    ws['A1'] = f"INVENTAIRE ÉPICERIE {month_name.upper()} {year}"
    ws['A1'].font = Font(size=16, bold=True, color="FFFFFF")
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws['A1'].fill = PatternFill(start_color="4A90E2", end_color="4A90E2", fill_type="solid")
    ws.merge_cells('A1:G1')
    ws.row_dimensions[1].height = 30  # Hauteur de la ligne du titre

    headers = ['Nom', 'Catégorie', 'Prix d’achat (€)', 'Prix de vente (€)', 'TVA (%)', 'DLC', 'Quantité']
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num)
        cell.value = header
        cell.font = Font(bold=True, color="FFFFFF")
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.fill = PatternFill(start_color="6B7280", end_color="6B7280", fill_type="solid")
        cell.border = thin_border

    for row_num, product in enumerate(products, 4):
        ws.cell(row=row_num, column=1).value = product.name
        ws.cell(row=row_num, column=2).value = product.category
        ws.cell(row=row_num, column=3).value = float(product.purchase_price) if product.purchase_price else 0
        ws.cell(row=row_num, column=4).value = float(product.selling_price) if product.selling_price else 0
        ws.cell(row=row_num, column=5).value = float(product.tva) if product.tva else '-'
        ws.cell(row=row_num, column=6).value = product.dlc if product.dlc else '-'
        ws.cell(row=row_num, column=7).value = product.quantity

        for col_num in range(1, 8):
            cell = ws.cell(row=row_num, column=col_num)
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border

    for col in ws.columns:
        max_length = 0
        column = None
        for cell in col:
            if not isinstance(cell, openpyxl.cell.cell.MergedCell):
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                        column = cell.column_letter
                except:
                    pass
        if column:
            adjusted_width = (max_length + 2)
            ws.column_dimensions[column].width = adjusted_width

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    filename = f"inventaire_epicerie_{month_name.lower()}_{year}.xlsx"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response