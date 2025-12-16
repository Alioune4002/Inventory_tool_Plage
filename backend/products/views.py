from rest_framework import status, viewsets, permissions, exceptions
from .models import Product, Category, LossEvent
from .serializers import ProductSerializer, CategorySerializer, LossEventSerializer
from django.http import HttpResponse, JsonResponse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from datetime import datetime
import logging
import csv
import io
import json
from django.db.models import Q
from django.conf import settings
from django.core.mail import EmailMessage

from accounts.mixins import TenantQuerySetMixin
from accounts.utils import get_tenant_for_request, get_service_from_request, get_user_role
from accounts.permissions import ProductPermission, ManagerPermission

logger = logging.getLogger(__name__)


def home(request):
    return JsonResponse({"message": "Bienvenue sur l'API de Inventory Tool ! Utilisez /api/products/ pour accéder aux données."})


class ProductViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, ProductPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        service = get_service_from_request(self.request)
        qs = qs.filter(service=service)

        # ✅ FIX: filtrage par mois si fourni (ton frontend en dépend)
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(inventory_month=month)

        return qs

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ['owner', 'manager', 'operator']:
            raise exceptions.PermissionDenied("Rôle insuffisant pour créer un produit.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        serializer.save(tenant=tenant, service=service)

    def perform_update(self, serializer):
        role = get_user_role(self.request)
        if role not in ['owner', 'manager', 'operator']:
            raise exceptions.PermissionDenied("Rôle insuffisant pour modifier un produit.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        serializer.save(tenant=tenant, service=service)

    def perform_destroy(self, instance):
        role = get_user_role(self.request)
        if role not in ['owner', 'manager']:
            raise exceptions.PermissionDenied("Rôle insuffisant pour supprimer un produit.")
        return super().perform_destroy(instance)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def lookup_product(request):
    """Lookup par code-barres dans le service/tenant courant."""
    barcode = request.query_params.get("barcode", "")
    if not barcode:
        return Response({"detail": "Paramètre barcode requis."}, status=400)

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    # ✅ FIX: prendre le produit le plus récent (au lieu d'un get() qui casse si plusieurs mois)
    product = (
        Product.objects
        .filter(tenant=tenant, service=service, barcode=barcode)
        .order_by("-inventory_month", "-created_at")
        .first()
    )

    if product:
        serializer = ProductSerializer(product)

        recent = (
            Product.objects.filter(tenant=tenant, service=service)
            .order_by("-created_at")[:5]
        )

        history = (
            Product.objects.filter(tenant=tenant, service=service, barcode=barcode)
            .order_by("-inventory_month", "-created_at")
        )

        return Response(
            {
                "found": True,
                "product": serializer.data,
                "recent": ProductSerializer(recent, many=True).data,
                "history": ProductSerializer(history, many=True).data,
            }
        )

    # tentative de lookup externe (OpenFoodFacts) uniquement pour domain food
    if tenant.domain == "food":
        try:
            import urllib.request
            url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
            with urllib.request.urlopen(url, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                status_ = data.get("status")
                if status_ == 1:
                    p = data.get("product", {}) or {}
                    suggestion = {
                        "name": p.get("product_name") or "",
                        "brand": p.get("brands") or "",
                        "category": (p.get("categories_tags") or [None])[0],
                        "quantity": p.get("quantity"),
                    }
                    return Response({"found": False, "suggestion": suggestion})
        except Exception:
            pass

    return Response({"found": False}, status=404)


class CategoryViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        service = get_service_from_request(self.request)
        return qs.filter(service=service)

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour créer une catégorie.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        if Category.objects.filter(tenant=tenant, service=service, name=serializer.validated_data.get("name")).exists():
            raise exceptions.ValidationError("Cette catégorie existe déjà pour ce service.")
        serializer.save()

    def perform_destroy(self, instance):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour supprimer une catégorie.")
        return super().perform_destroy(instance)


class LossEventViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = LossEvent.objects.all()
    serializer_class = LossEventSerializer
    permission_classes = [permissions.IsAuthenticated, ProductPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        service = get_service_from_request(self.request)
        qs = qs.filter(service=service)
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(inventory_month=month)
        return qs

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager", "operator"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour déclarer une perte.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        serializer.save(
            tenant=tenant,
            service=service,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )

    def perform_destroy(self, instance):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour supprimer une perte.")
        return super().perform_destroy(instance)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def inventory_stats(request):
    month = request.query_params.get('month', None)
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    products = Product.objects.filter(tenant=tenant, service=service)
    if month:
        products = products.filter(inventory_month=month)

    # Map des pertes par produit
    losses_qs = LossEvent.objects.filter(tenant=tenant, service=service)
    if month:
        losses_qs = losses_qs.filter(inventory_month=month)
    loss_by_product = {}
    for l in losses_qs:
        if l.product_id:
            loss_by_product[l.product_id] = loss_by_product.get(l.product_id, 0) + float(l.quantity or 0)

    # Pertes agrégées
    losses_total_qty = sum(float(l.quantity or 0) for l in losses_qs)
    losses_total_cost = 0
    losses_by_reason = []
    reasons = losses_qs.values_list("reason", flat=True).distinct()
    for r in reasons:
        subset = losses_qs.filter(reason=r)
        qty = sum(float(l.quantity or 0) for l in subset)
        cost = 0
        for l in subset:
            if l.product and l.product.purchase_price:
                cost += float(l.quantity or 0) * float(l.product.purchase_price)
        losses_by_reason.append({"reason": r, "total_qty": qty, "total_cost": cost})
        losses_total_cost += cost

    # Calculs par produit (avec limites réalistes : pas de stock initial/entrées dispos)
    by_product = []
    for p in products:
        stock_final = float(p.quantity or 0)
        loss_qty = loss_by_product.get(p.id, 0)
        purchase_price = float(p.purchase_price or 0)
        selling_price = float(p.selling_price or 0)

        quantity_sold = None
        ca_estime = None
        cout_matiere = None
        marge = None
        notes = []
        if purchase_price or selling_price:
            notes.append("Calculs complets limités: stock_initial/entrées/sorties non suivis.")

        by_product.append({
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "stock_final": stock_final,
            "losses_qty": loss_qty,
            "purchase_price": purchase_price,
            "selling_price": selling_price,
            "purchase_value_current": purchase_price * stock_final if purchase_price else 0,
            "selling_value_current": selling_price * stock_final if selling_price else 0,
            "quantity_sold_est": quantity_sold,
            "ca_estime": ca_estime,
            "cout_matiere": cout_matiere,
            "marge": marge,
            "notes": notes,
        })

    # Par catégorie
    categories = products.values_list("category", flat=True).distinct()
    by_category = []
    for cat in categories:
        cat_products = products.filter(category=cat)
        total_qty = sum(float(p.quantity or 0) for p in cat_products)
        total_purchase_value = sum((float(p.purchase_price or 0) * float(p.quantity or 0)) for p in cat_products)
        total_selling_value = sum((float(p.selling_price or 0) * float(p.quantity or 0)) for p in cat_products)
        cat_losses = sum(loss_by_product.get(p.id, 0) for p in cat_products)
        by_category.append({
            "category": cat,
            "total_quantity": total_qty,
            "total_purchase_value": total_purchase_value,
            "total_selling_value": total_selling_value,
            "losses_qty": cat_losses,
        })

    # Totaux service
    total_purchase_value = sum((float(p.purchase_price or 0) * float(p.quantity or 0)) for p in products)
    total_selling_value = sum((float(p.selling_price or 0) * float(p.quantity or 0)) for p in products)

    response = {
        "total_value": total_purchase_value,
        "total_selling_value": total_selling_value,
        "service_totals": {
            "purchase_value": total_purchase_value,
            "selling_value": total_selling_value,
            "losses_qty": losses_total_qty,
            "losses_cost": losses_total_cost,
            "notes": ["Quantité vendue et marge estimée limitées : pas de stock initial/entrées/sorties enregistrés."],
        },
        "by_product": by_product,
        "by_category": by_category,
        "losses_total_qty": losses_total_qty,
        "losses_total_cost": losses_total_cost,
        "losses_by_reason": losses_by_reason,
        "timeseries": [],
    }
    return Response(response)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def export_excel(request):
    month = request.query_params.get('month', None)
    if not month:
        return Response({'error': 'Paramètre month requis'}, status=400)

    try:
        month_date = datetime.strptime(month, '%Y-%m')
    except ValueError:
        return Response({'error': 'Paramètre month doit être au format YYYY-MM'}, status=400)

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    products = Product.objects.filter(tenant=tenant, service=service, inventory_month=month)

    wb = openpyxl.Workbook()
    ws = wb.active

    month_name = month_date.strftime('%B').capitalize()
    year = month_date.strftime('%Y')
    ws.title = f"Inventaire {month_name} {year}"
    ws['A1'] = f"INVENTAIRE ÉPICERIE {month_name.upper()} {year}"
    ws['A1'].font = Font(size=16, bold=True, color="FFFFFF")
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws['A1'].fill = PatternFill(start_color="4A90E2", end_color="4A90E2", fill_type="solid")
    ws.merge_cells('A1:G1')
    ws.row_dimensions[1].height = 30

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
                except Exception:
                    pass
        if column:
            ws.column_dimensions[column].width = (max_length + 2)

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    filename = f"inventaire_epicerie_{month_name.lower()}_{year}.xlsx"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def export_generic(request):
    """
    Export CSV/XLSX sur une plage de mois et services.
    Params (GET):
      from=YYYY-MM, to=YYYY-MM, service=<id|all>, format=csv|xlsx, mode=sealed|opened|all
      email=<dest> (optionnel) pour envoyer l’export par email (pièce jointe)
      message=<texte> (optionnel) corps du mail
    """
    tenant = get_tenant_for_request(request)
    service_param = request.query_params.get('service')
    export_format = request.query_params.get('format', 'xlsx')
    mode = request.query_params.get('mode', 'all')
    from_month = request.query_params.get('from')
    to_month = request.query_params.get('to')
    email_to = request.query_params.get('email')
    email_message = request.query_params.get('message', '')

    qs = Product.objects.filter(tenant=tenant)
    if service_param and service_param != "all":
        try:
            qs = qs.filter(service_id=int(service_param))
        except ValueError:
            pass
    if from_month:
        qs = qs.filter(inventory_month__gte=from_month)
    if to_month:
        qs = qs.filter(inventory_month__lte=to_month)
    if mode != "all":
        qs = qs.filter(container_status=mode.upper())

    attachment_bytes = None
    filename = "stockscan_export.xlsx" if export_format == "xlsx" else "stockscan_export.csv"
    mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if export_format == "xlsx" else "text/csv"

    if export_format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Month", "Service", "Category", "ProductName", "ContainerStatus", "Qty", "UOM",
                         "RemainingFraction", "PackSize", "PackUOM", "PurchasePrice", "SalePrice"])
        for p in qs.select_related("service"):
            writer.writerow([
                p.inventory_month, p.service.name if p.service else "", p.category or "", p.name,
                p.container_status, p.quantity, p.unit, p.remaining_fraction or "",
                p.pack_size or "", p.pack_uom or "", p.purchase_price or "", p.selling_price or ""
            ])
        attachment_bytes = buffer.getvalue().encode("utf-8")
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Export"
        ws.append(["Month", "Service", "Category", "ProductName", "ContainerStatus", "Qty", "UOM",
                   "RemainingFraction", "PackSize", "PackUOM", "PurchasePrice", "SalePrice"])
        for p in qs.select_related("service"):
            ws.append([
                p.inventory_month, p.service.name if p.service else "", p.category or "", p.name,
                p.container_status, float(p.quantity), p.unit, p.remaining_fraction or "",
                p.pack_size or "", p.pack_uom or "", p.purchase_price or "", p.selling_price or ""
            ])
        bio = io.BytesIO()
        wb.save(bio)
        attachment_bytes = bio.getvalue()

    if email_to:
        try:
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@stockscan.local")
            mail = EmailMessage(
                subject="Export StockScan",
                body=email_message or "Ci-joint votre export.",
                from_email=from_email,
                to=[email_to],
            )
            mail.attach(filename, attachment_bytes or b"", mimetype)
            mail.send(fail_silently=True)
        except Exception:
            logger.exception("Envoi email export échoué")

    resp = HttpResponse(attachment_bytes, content_type=mimetype)
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    return resp


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def export_advanced(request):
    """
    Export avancé (CSV ou XLSX) avec filtres combinés.
    """
    tenant = get_tenant_for_request(request)
    service_from_request = get_service_from_request(request)
    data = request.data or {}

    from_month = data.get('from_month') or data.get('fromMonth')
    to_month = data.get('to_month') or data.get('toMonth')
    services = data.get('services') or [service_from_request.id]
    categories = data.get('categories') or []
    price_min = data.get('price_min', data.get('priceMin'))
    price_max = data.get('price_max', data.get('priceMax'))
    stock_min = data.get('stock_min', data.get('stockMin'))
    include_tva = data.get('include_tva', data.get('includeTVA', True))
    include_dlc = data.get('include_dlc', data.get('includeDLC', True))
    include_sku = data.get('include_sku', data.get('includeSKU', True))
    export_format = data.get('format', data.get('exportFormat', 'xlsx'))

    qs = Product.objects.filter(tenant=tenant)

    if price_min == "" or price_min is None:
        price_min = None
    if price_max == "" or price_max is None:
        price_max = None
    if stock_min == "" or stock_min is None:
        stock_min = None

    if services:
        qs = qs.filter(service_id__in=services)
    else:
        qs = qs.filter(service=service_from_request)

    if from_month and to_month:
        qs = qs.filter(inventory_month__gte=from_month, inventory_month__lte=to_month)
    elif from_month:
        qs = qs.filter(inventory_month__gte=from_month)
    elif to_month:
        qs = qs.filter(inventory_month__lte=to_month)

    if categories:
        qs = qs.filter(category__in=categories)

    if price_min is not None:
        qs = qs.filter(selling_price__gte=price_min)
    if price_max is not None:
        qs = qs.filter(selling_price__lte=price_max)

    if stock_min is not None:
        qs = qs.filter(quantity__gte=stock_min)

    headers = ['Nom', 'Catégorie', 'Prix achat (€)', 'Prix vente (€)']
    if include_tva:
        headers.append('TVA (%)')
    if include_dlc:
        headers.append('DLC')
    headers.append('Quantité')
    if include_sku:
        headers.append('Code-barres / SKU')
    headers.append('Mois')
    headers.append('Service')

    if export_format == 'csv':
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        for p in qs.select_related("service"):
            row = [
                p.name,
                p.category,
                float(p.purchase_price) if p.purchase_price else 0,
                float(p.selling_price) if p.selling_price else 0,
            ]
            if include_tva:
                row.append(float(p.tva) if p.tva else '')
            if include_dlc:
                row.append(p.dlc or '')
            row.append(p.quantity or 0)
            if include_sku:
                row.append(p.internal_sku if p.no_barcode else p.barcode or '')
            row.append(p.inventory_month)
            row.append(p.service.name if p.service else '')
            writer.writerow(row)
        response = HttpResponse(buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="export_avance.csv"'
        return response

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Export avancé"
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num)
        cell.value = header
        cell.font = Font(bold=True, color="FFFFFF")
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.fill = PatternFill(start_color="6B7280", end_color="6B7280", fill_type="solid")
        cell.border = thin_border

    for row_num, p in enumerate(qs.select_related("service"), 2):
        values = [
            p.name,
            p.category,
            float(p.purchase_price) if p.purchase_price else 0,
            float(p.selling_price) if p.selling_price else 0,
        ]
        if include_tva:
            values.append(float(p.tva) if p.tva else '')
        if include_dlc:
            values.append(p.dlc or '')
        values.append(p.quantity or 0)
        if include_sku:
            values.append(p.internal_sku if p.no_barcode else p.barcode or '')
        values.append(p.inventory_month)
        values.append(p.service.name if p.service else '')

        for col_num, val in enumerate(values, 1):
            cell = ws.cell(row=row_num, column=col_num)
            cell.value = val
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border

    for col in ws.columns:
        max_length = 0
        column = None
        for cell in col:
            if not isinstance(cell, openpyxl.cell.cell.MergedCell):
                try:
                    max_length = max(max_length, len(str(cell.value)))
                    column = cell.column_letter
                except Exception:
                    pass
        if column:
            ws.column_dimensions[column].width = max_length + 2

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="export_avance.xlsx"'
    wb.save(response)
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def search_products(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    query = request.query_params.get('q', '')
    qs = Product.objects.filter(tenant=tenant, service=service)
    if query:
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(barcode__icontains=query) |
            Q(internal_sku__icontains=query)
        )
    results = list(
        qs.order_by('name')[:10].values(
            'id', 'name', 'barcode', 'internal_sku', 'category', 'inventory_month'
        )
    )
    return Response(results)