from datetime import timedelta

from rest_framework import status, viewsets, permissions, exceptions
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.response import Response

from django.http import JsonResponse
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.chart import BarChart, Reference
import numbers
import logging
import csv
import io
import json
from django.db.models import Q, F
from django.core.cache import cache
from django.utils import timezone
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm

from accounts.mixins import TenantQuerySetMixin
from accounts.utils import get_tenant_for_request, get_service_from_request, get_user_role
from accounts.permissions import ProductPermission, ManagerPermission
from accounts.services.access import (
    check_entitlement,
    check_limit,
    get_usage,
    get_retention_days,
    get_limits,
    get_entitlements,
    LimitExceeded,
)
from utils.sendgrid_email import send_email_with_sendgrid
from utils.renderers import XLSXRenderer, CSVRenderer
from inventory.metrics import track_export_event, track_off_lookup_failure

from .models import Product, Category, LossEvent, ExportEvent, CatalogPdfEvent
from .serializers import ProductSerializer, CategorySerializer, LossEventSerializer

logger = logging.getLogger(__name__)

EXPORT_HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
EXPORT_STRIPE_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
EXPORT_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
EXPORT_HEADER_FONT = Font(bold=True, color="FFFFFF")
OFF_TIMEOUT_SECONDS = 3
OFF_LOG_CODE = "OFF_LOOKUP_FAILED"
OFF_CACHE_TTL_SECONDS = 60 * 60 * 48
CATALOG_PDF_MAX_PRODUCTS = 500
CATALOG_ALLOWED_FIELDS = {
    "barcode",
    "sku",
    "unit",
    "purchase_price",
    "selling_price",
    "tva",
    "variants",
    "dlc",
    "lot",
    "min_qty",
    "supplier",
    "notes",
    "brand",
}
CATALOG_DEFAULT_FIELDS = ["barcode", "sku", "unit"]
CATALOG_FIELD_LABELS = {
    "barcode": "EAN",
    "sku": "SKU",
    "unit": "Unité",
    "purchase_price": "Prix achat",
    "selling_price": "Prix vente",
    "tva": "TVA",
    "variants": "Variante",
    "dlc": "DLC",
    "lot": "Lot",
    "min_qty": "Stock min",
    "supplier": "Fournisseur",
    "notes": "Notes",
    "brand": "Marque",
}


def _is_numeric(value):
    return isinstance(value, numbers.Number) and not isinstance(value, bool)


def _parse_positive_int(value, default, max_value=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed <= 0:
        return default
    if max_value is not None:
        return min(parsed, max_value)
    return parsed


def _retention_start(tenant):
    days = get_retention_days(tenant)
    if not days:
        return None
    return timezone.now() - timedelta(days=days)


def _apply_retention(qs, tenant):
    start = _retention_start(tenant)
    if not start:
        return qs
    return qs.filter(created_at__gte=start)


def _track_off_failure(reason):
    try:
        day = timezone.now().strftime("%Y-%m-%d")
        key = f"off_lookup_errors:{day}"
        count = int(cache.get(key) or 0) + 1
        cache.set(key, count, OFF_CACHE_TTL_SECONDS)
        track_off_lookup_failure(reason)
        return count
    except Exception:
        logger.warning("OFF_LOOKUP_METRIC_FAILED code=OFF_LOOKUP_METRIC_FAILED reason=%s", reason)
        return None


def _month_start(dt):
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _export_limit_for_format(tenant, export_format):
    limits = get_limits(tenant)
    if export_format == "csv":
        return limits.get("csv_monthly_limit")
    return limits.get("xlsx_monthly_limit")


def _enforce_export_quota(tenant, export_format):
    limit = _export_limit_for_format(tenant, export_format)
    if limit is None:
        return
    start = _month_start(timezone.now())
    used = ExportEvent.objects.filter(
        tenant=tenant,
        format=export_format,
        created_at__gte=start,
    ).count()
    if used >= int(limit):
        code = "LIMIT_EXPORT_CSV_MONTH" if export_format == "csv" else "LIMIT_EXPORT_XLSX_MONTH"
        raise LimitExceeded(code=code, detail="Limite d’export mensuelle atteinte pour votre plan.")


def _log_export_event(tenant, user, export_format, emailed=False, params=None):
    try:
        ExportEvent.objects.create(
            tenant=tenant,
            user=user if user and getattr(user, "is_authenticated", False) else None,
            format=export_format,
            emailed=bool(emailed),
            params=params or {},
        )
    except Exception:
        logger.exception("ExportEvent log failed")
    try:
        track_export_event(export_format, emailed)
    except Exception:
        logger.exception("ExportEvent metric failed")


def _pdf_catalog_limit(tenant):
    limits = get_limits(tenant)
    return limits.get("pdf_catalog_monthly_limit")


def _enforce_pdf_catalog_quota(tenant):
    limit = _pdf_catalog_limit(tenant)
    if limit is None:
        return
    start = _month_start(timezone.now())
    used = CatalogPdfEvent.objects.filter(tenant=tenant, created_at__gte=start).count()
    if used >= int(limit):
        raise LimitExceeded(code="LIMIT_PDF_CATALOG_MONTH", detail="Limite mensuelle du catalogue PDF atteinte.")


def _log_catalog_pdf_event(tenant, user, params=None):
    try:
        CatalogPdfEvent.objects.create(
            tenant=tenant,
            user=user if user and getattr(user, "is_authenticated", False) else None,
            params=params or {},
        )
    except Exception:
        logger.exception("CatalogPdfEvent log failed")


def _parse_pdf_fields(raw_fields):
    if not raw_fields:
        return list(CATALOG_DEFAULT_FIELDS)
    fields = [f.strip().lower() for f in str(raw_fields).split(",") if f.strip()]
    filtered = [f for f in fields if f in CATALOG_ALLOWED_FIELDS]
    return filtered if filtered else list(CATALOG_DEFAULT_FIELDS)


def _format_catalog_field(label, value):
    if value is None or value == "":
        return None
    return f"{label}: {value}"


def _format_catalog_line(product, fields, include_service=False):
    values = []
    if include_service and getattr(product, "service", None):
        values.append(_format_catalog_field("Service", product.service.name))

    if "barcode" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["barcode"], product.barcode))
    if "sku" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["sku"], product.internal_sku))
    if "unit" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["unit"], product.unit))
    if "variants" in fields:
        variant = _format_variant(product)
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["variants"], variant))
    if "purchase_price" in fields:
        val = f"{product.purchase_price} €" if product.purchase_price is not None else None
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["purchase_price"], val))
    if "selling_price" in fields:
        val = f"{product.selling_price} €" if product.selling_price is not None else None
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["selling_price"], val))
    if "tva" in fields:
        val = f"{product.tva}%" if product.tva is not None else None
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["tva"], val))
    if "dlc" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["dlc"], product.dlc))
    if "lot" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["lot"], product.lot_number))
    if "min_qty" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["min_qty"], product.min_qty))
    if "supplier" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["supplier"], product.supplier))
    if "brand" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["brand"], product.brand))
    if "notes" in fields:
        values.append(_format_catalog_field(CATALOG_FIELD_LABELS["notes"], product.notes))

    return " · ".join([v for v in values if v])


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_page_number(self, page_count):
        self.setFont("Helvetica", 9)
        self.setFillColorRGB(0.45, 0.45, 0.45)
        self.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {self._pageNumber} / {page_count}")


def _build_catalog_pdf(*, tenant, company_name, company_email, company_phone, company_address, fields, products, truncated, include_service):
    buffer = io.BytesIO()
    c = NumberedCanvas(buffer, pagesize=A4)
    width, height = A4

    def draw_cover():
        c.setFont("Helvetica-Bold", 20)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(2 * cm, height - 3 * cm, company_name or tenant.name or "StockScan")
        c.setFont("Helvetica", 12)
        c.drawString(2 * cm, height - 3.8 * cm, "Catalogue produits")
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(2 * cm, height - 4.6 * cm, timezone.now().strftime("%d/%m/%Y"))

        info_lines = [company_email, company_phone, company_address]
        y = height - 6 * cm
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.25, 0.25, 0.25)
        for line in info_lines:
            if line:
                c.drawString(2 * cm, y, str(line))
                y -= 0.6 * cm

        if truncated:
            c.setFillColorRGB(0.55, 0.2, 0.2)
            c.drawString(2 * cm, y - 0.6 * cm, f"Liste tronquée à {CATALOG_PDF_MAX_PRODUCTS} produits.")

    draw_cover()
    c.showPage()

    y = height - 2.5 * cm
    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0.1, 0.1, 0.1)

    grouped = {}
    for p in products:
        key = (p.category or "Sans catégorie").strip() or "Sans catégorie"
        grouped.setdefault(key, []).append(p)

    for category, items in grouped.items():
        if y < 3 * cm:
            c.showPage()
            y = height - 2.5 * cm
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2 * cm, y, category)
        y -= 0.6 * cm

        c.setFont("Helvetica", 10)
        for p in items:
            if y < 2.5 * cm:
                c.showPage()
                y = height - 2.5 * cm
            line = _format_catalog_line(p, fields, include_service=include_service)
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.drawString(2 * cm, y, f"• {p.name}")
            y -= 0.45 * cm
            if line:
                c.setFillColorRGB(0.4, 0.4, 0.4)
                c.drawString(2.6 * cm, y, line[:160])
                y -= 0.45 * cm
        y -= 0.4 * cm

    c.save()
    return buffer.getvalue()


def _converted_quantity(product):
    factor = getattr(product, "conversion_factor", None)
    unit = getattr(product, "conversion_unit", None)
    if factor is None or not unit:
        return None, None
    try:
        return float(product.quantity or 0) * float(factor), unit
    except (TypeError, ValueError):
        return None, unit


def _format_variant(product):
    name = (getattr(product, "variant_name", None) or "").strip()
    value = (getattr(product, "variant_value", None) or "").strip()
    if name and value:
        return f"{name}: {value}"
    return value or name or ""


def _history_month_cutoff(months):
    if months is None:
        return None
    total = _parse_positive_int(months, None)
    if not total:
        return None
    today = timezone.now().date().replace(day=1)
    year = today.year
    month = today.month - (total - 1)
    while month <= 0:
        month += 12
        year -= 1
    return f"{year:04d}-{month:02d}"


def _build_csv_bytes(headers, rows, delimiter=";"):
    buffer = io.StringIO()
    buffer.write("sep=;\n")
    writer = csv.writer(buffer, delimiter=delimiter)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(["" if value is None else value for value in row])
    content = buffer.getvalue()
    return ("\ufeff" + content).encode("utf-8")


def _apply_sheet_style(ws, headers):
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    ws.row_dimensions[1].height = 22

    header_lookup = {index + 1: (header or "") for index, header in enumerate(headers)}

    for col_idx, header in header_lookup.items():
        cell = ws.cell(row=1, column=col_idx)
        cell.value = header
        cell.font = EXPORT_HEADER_FONT
        cell.fill = EXPORT_HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = EXPORT_BORDER

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=ws.max_column):
        row_idx = row[0].row
        if row_idx % 2 == 0:
            for cell in row:
                cell.fill = EXPORT_STRIPE_FILL
        for cell in row:
            cell.border = EXPORT_BORDER
            header = header_lookup.get(cell.column, "")
            if _is_numeric(cell.value):
                header_lower = str(header).lower()
                if any(term in header_lower for term in ("prix", "valeur", "sale", "purchase", "€")):
                    cell.number_format = "#,##0.00"
                elif any(term in header_lower for term in ("tva", "vat")):
                    cell.number_format = "0.00"
                else:
                    cell.number_format = "#,##0.###"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    for col_cells in ws.columns:
        max_length = 0
        column_letter = None
        for cell in col_cells:
            if not isinstance(cell, openpyxl.cell.cell.MergedCell):
                column_letter = cell.column_letter
                if cell.value is None:
                    continue
                max_length = max(max_length, len(str(cell.value)))
        if column_letter:
            ws.column_dimensions[column_letter].width = min(max(max_length + 2, 10), 42)


def home(request):
    return JsonResponse({"message": "Bienvenue sur l'API de Inventory Tool ! Utilisez /api/products/ pour accéder aux données."})


class ProductViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, ProductPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        qs = qs.filter(service=service)

        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(inventory_month=month)

        qs = _apply_retention(qs, tenant)
        return qs

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager", "operator"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour créer un produit.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        usage = get_usage(tenant)
        check_limit(tenant, "max_products", usage["products_count"], requested_increment=1)
        serializer.save(tenant=tenant, service=service)

    def perform_update(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager", "operator"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour modifier un produit.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        serializer.save(tenant=tenant, service=service)

    def perform_destroy(self, instance):
        role = get_user_role(self.request)
        if role not in ["owner", "manager"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour supprimer un produit.")
        return super().perform_destroy(instance)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def lookup_product(request):
    barcode = request.query_params.get("barcode", "")
    if not barcode:
        return Response({"detail": "Paramètre barcode requis."}, status=400)

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    product_qs = Product.objects.filter(tenant=tenant, service=service, barcode=barcode)
    product_qs = _apply_retention(product_qs, tenant)
    product = product_qs.order_by("-inventory_month", "-created_at").first()

    if product:
        serializer = ProductSerializer(product)

        recent = Product.objects.filter(tenant=tenant, service=service).order_by("-created_at")
        recent = _apply_retention(recent, tenant)[:5]
        history = Product.objects.filter(tenant=tenant, service=service, barcode=barcode).order_by(
            "-inventory_month", "-created_at"
        )
        history = _apply_retention(history, tenant)
        history_limit = _parse_positive_int(request.query_params.get("history_limit"), 200, 500)
        history_months = request.query_params.get("history_months")
        if history_months in (None, ""):
            history_months = 12
        history_cutoff = _history_month_cutoff(history_months)
        if history_cutoff:
            history = history.filter(inventory_month__gte=history_cutoff)
        history = history[:history_limit]

        return Response(
            {
                "found": True,
                "product": serializer.data,
                "recent": ProductSerializer(recent, many=True).data,
                "history": ProductSerializer(history, many=True).data,
            }
        )

    if tenant.domain == "food":
        try:
            import socket
            import urllib.error
            import urllib.request

            url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
            with urllib.request.urlopen(url, timeout=OFF_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == 1:
                    p = data.get("product", {}) or {}
                    suggestion = {
                        "name": p.get("product_name") or "",
                        "brand": p.get("brands") or "",
                        "category": (p.get("categories_tags") or [None])[0],
                        "quantity": p.get("quantity"),
                    }
                    return Response({"found": False, "suggestion": suggestion})
        except (urllib.error.URLError, urllib.error.HTTPError, socket.timeout) as exc:
            count = _track_off_failure("url_error")
            logger.warning(
                "OFF_LOOKUP_FAILED code=%s reason=url_error count=%s barcode=%s",
                OFF_LOG_CODE,
                count,
                barcode,
                exc_info=exc,
            )
            return Response(
                {
                    "found": False,
                    "off_error": "Préremplissage indisponible (OpenFoodFacts). Réessayez plus tard.",
                },
                status=200,
            )
        except Exception:
            count = _track_off_failure("exception")
            logger.warning(
                "OFF_LOOKUP_FAILED code=%s reason=exception count=%s barcode=%s",
                OFF_LOG_CODE,
                count,
                barcode,
                exc_info=True,
            )
            return Response(
                {
                    "found": False,
                    "off_error": "Préremplissage indisponible (OpenFoodFacts). Réessayez plus tard.",
                },
                status=200,
            )

    return Response({"found": False}, status=200)


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
        if Category.objects.filter(
            tenant=tenant, service=service, name=serializer.validated_data.get("name")
        ).exists():
            raise exceptions.ValidationError("Cette catégorie existe déjà pour ce service.")
        serializer.save()


class LossEventViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = LossEvent.objects.all()
    serializer_class = LossEventSerializer
    permission_classes = [permissions.IsAuthenticated, ProductPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        qs = qs.filter(service=service)
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(inventory_month=month)
        qs = _apply_retention(qs, tenant)
        return qs

    def perform_create(self, serializer):
        role = get_user_role(self.request)
        if role not in ["owner", "manager", "operator"]:
            raise exceptions.PermissionDenied("Rôle insuffisant pour déclarer une perte.")
        tenant = get_tenant_for_request(self.request)
        service = get_service_from_request(self.request)
        check_entitlement(tenant, "loss_management")
        serializer.save(
            tenant=tenant,
            service=service,
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def inventory_stats(request):
    month = request.query_params.get("month", None)
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    features = getattr(service, "features", {}) or {}
    item_type_cfg = features.get("item_type", {}) or {}
    item_type_enabled = bool(item_type_cfg.get("enabled", False))

    products = Product.objects.filter(tenant=tenant, service=service)
    if month:
        products = products.filter(inventory_month=month)
    products = _apply_retention(products, tenant)

    losses_qs = LossEvent.objects.filter(tenant=tenant, service=service)
    if month:
        losses_qs = losses_qs.filter(inventory_month=month)
    losses_qs = _apply_retention(losses_qs, tenant)

    loss_by_product = {}
    for l in losses_qs:
        if l.product_id:
            loss_by_product[l.product_id] = loss_by_product.get(l.product_id, 0) + float(l.quantity or 0)

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

    by_product = []
    for p in products:
        stock_final = float(p.quantity or 0)
        loss_qty = loss_by_product.get(p.id, 0)
        purchase_price = float(p.purchase_price or 0)
        selling_price = float(p.selling_price or 0)
        converted_qty, converted_unit = _converted_quantity(p)

        is_raw_material = item_type_enabled and p.product_role == "raw_material"
        selling_value_current = 0
        if selling_price and not is_raw_material:
            selling_value_current = selling_price * stock_final

        by_product.append(
            {
                "name": p.name,
                "category": p.category,
                "unit": p.unit,
                "stock_final": stock_final,
                "losses_qty": loss_qty,
                "product_role": p.product_role,
                "purchase_price": purchase_price,
                "selling_price": selling_price,
                "purchase_value_current": purchase_price * stock_final if purchase_price else 0,
                "selling_value_current": selling_value_current,
                "converted_quantity": converted_qty,
                "converted_unit": converted_unit,
                "quantity_sold_est": None,
                "ca_estime": None,
                "cout_matiere": None,
                "marge": None,
                "notes": (
                    ["Calculs complets limités: stock_initial/entrées/sorties non suivis."]
                    + (["Matière première: valeur de vente potentielle non comptée."] if is_raw_material else [])
                ),
            }
        )

    categories = products.values_list("category", flat=True).distinct()
    by_category = []
    for cat in categories:
        cat_products = products.filter(category=cat)
        total_qty = sum(float(p.quantity or 0) for p in cat_products)
        total_purchase_value = sum((float(p.purchase_price or 0) * float(p.quantity or 0)) for p in cat_products)
        total_selling_value = 0
        for p in cat_products:
            if item_type_enabled and p.product_role == "raw_material":
                continue
            total_selling_value += float(p.selling_price or 0) * float(p.quantity or 0)
        cat_losses = sum(loss_by_product.get(p.id, 0) for p in cat_products)
        by_category.append(
            {
                "category": cat,
                "total_quantity": total_qty,
                "total_purchase_value": total_purchase_value,
                "total_selling_value": total_selling_value,
                "losses_qty": cat_losses,
            }
        )

    total_purchase_value = sum((float(p.purchase_price or 0) * float(p.quantity or 0)) for p in products)
    total_selling_value = 0
    for p in products:
        if item_type_enabled and p.product_role == "raw_material":
            continue
        total_selling_value += float(p.selling_price or 0) * float(p.quantity or 0)

    converted_totals = {}
    for p in products:
        converted_qty, converted_unit = _converted_quantity(p)
        if converted_qty is None or not converted_unit:
            continue
        converted_totals.setdefault(converted_unit, 0)
        converted_totals[converted_unit] += converted_qty

    return Response(
        {
            "total_value": total_purchase_value,
            "total_selling_value": total_selling_value,
            "service_totals": {
                "purchase_value": total_purchase_value,
                "selling_value": total_selling_value,
                "losses_qty": losses_total_qty,
                "losses_cost": losses_total_cost,
                "notes": (
                    [
                        "Quantité vendue et marge estimée limitées : pas de stock initial/entrées/sorties enregistrés.",
                        "Si le module Matière première / Produit fini est actif, la valeur de vente exclut les matières premières.",
                    ]
                    if item_type_enabled
                    else ["Quantité vendue et marge estimée limitées : pas de stock initial/entrées/sorties enregistrés."]
                ),
            },
            "by_product": by_product,
            "by_category": by_category,
            "losses_total_qty": losses_total_qty,
            "losses_total_cost": losses_total_cost,
            "losses_by_reason": losses_by_reason,
            "timeseries": [],
            "categories": by_category,
            "converted_totals": converted_totals,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
@renderer_classes([XLSXRenderer, CSVRenderer])
def export_excel(request):
    month = request.query_params.get("month", None)
    if not month:
        return Response({"error": "Paramètre month requis"}, status=400)

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    check_entitlement(tenant, "exports_basic")
    _enforce_export_quota(tenant, "xlsx")

    products = Product.objects.filter(tenant=tenant, service=service, inventory_month=month)
    products = _apply_retention(products, tenant)

    headers = [
        "Nom",
        "Catégorie",
        "Prix achat (€)",
        "Prix vente (€)",
        "TVA (%)",
        "DLC",
        "Quantité",
        "Variante",
        "Stock min",
        "Quantité convertie",
        "Unité convertie",
    ]
    rows = []
    for p in products:
        converted_qty, converted_unit = _converted_quantity(p)
        rows.append(
            [
                p.name,
                p.category or "",
                float(p.purchase_price or 0),
                float(p.selling_price or 0),
                float(p.tva or 0) if p.tva is not None else "",
                p.dlc or "",
                float(p.quantity or 0),
                _format_variant(p),
                float(p.min_qty) if p.min_qty is not None else "",
                converted_qty if converted_qty is not None else "",
                converted_unit or "",
            ]
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Inventaire {month}"
    ws.append(headers)
    for row in rows:
        ws.append(row)
    _apply_sheet_style(ws, headers)

    bio = io.BytesIO()
    wb.save(bio)
    xlsx_bytes = bio.getvalue()

    filename = f"inventaire_{month}.xlsx"
    resp = Response(xlsx_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    _log_export_event(
        tenant=tenant,
        user=request.user,
        export_format="xlsx",
        emailed=False,
        params={"month": month, "service": service.id},
    )
    return resp


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
@renderer_classes([XLSXRenderer, CSVRenderer])
def export_generic(request):
    tenant = get_tenant_for_request(request)

    service_param = request.query_params.get("service")
    export_format = (request.query_params.get("format", "xlsx") or "xlsx").lower()
    mode = request.query_params.get("mode", "all")
    from_month = request.query_params.get("from")
    to_month = request.query_params.get("to")
    email_to = request.query_params.get("email")
    email_message = request.query_params.get("message", "")

    check_entitlement(tenant, "exports_basic")
    if export_format == "xlsx":
        check_entitlement(tenant, "exports_xlsx")
    if email_to:
        check_entitlement(tenant, "exports_email")
    _enforce_export_quota(tenant, export_format)

    qs = Product.objects.filter(tenant=tenant)
    qs = _apply_retention(qs, tenant)
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

    headers = [
        "Month",
        "Service",
        "Category",
        "ProductName",
        "Variant",
        "ContainerStatus",
        "Qty",
        "UOM",
        "MinQty",
        "ConvertedQty",
        "ConvertedUnit",
        "RemainingFraction",
        "PackSize",
        "PackUOM",
        "PurchasePrice",
        "SalePrice",
    ]
    rows = []
    for p in qs.select_related("service"):
        converted_qty, converted_unit = _converted_quantity(p)
        rows.append(
            [
                p.inventory_month,
                p.service.name if p.service else "",
                p.category or "",
                p.name,
                _format_variant(p),
                p.container_status,
                float(p.quantity or 0),
                p.unit or "",
                float(p.min_qty) if p.min_qty is not None else "",
                converted_qty if converted_qty is not None else "",
                converted_unit or "",
                p.remaining_fraction or "",
                p.pack_size or "",
                p.pack_uom or "",
                float(p.purchase_price or 0),
                float(p.selling_price or 0),
            ]
        )

    filename = "stockscan_export.xlsx" if export_format == "xlsx" else "stockscan_export.csv"
    mimetype = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if export_format == "xlsx"
        else "text/csv"
    )

    if export_format == "csv":
        attachment_bytes = _build_csv_bytes(headers, rows)
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Export"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        _apply_sheet_style(ws, headers)
        bio = io.BytesIO()
        wb.save(bio)
        attachment_bytes = bio.getvalue()

    if email_to:
        send_email_with_sendgrid(
            to_email=email_to,
            subject="Export StockScan",
            text_body=email_message or "Ci-joint votre export.",
            html_body=email_message or None,
            filename=filename,
            file_bytes=attachment_bytes or b"",
            mimetype=mimetype,
            fallback_to_django=True,
        )

    resp = Response(attachment_bytes, content_type=mimetype if export_format == "xlsx" else f"{mimetype}; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    _log_export_event(
        tenant=tenant,
        user=request.user,
        export_format=export_format,
        emailed=bool(email_to),
        params={
            "service": service_param,
            "from": from_month,
            "to": to_month,
            "mode": mode,
            "email": email_to,
        },
    )
    return resp


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
@renderer_classes([XLSXRenderer, CSVRenderer])
def export_advanced(request):
    tenant = get_tenant_for_request(request)
    service_from_request = get_service_from_request(request)
    data = request.data or {}

    from_month = data.get("from_month") or data.get("fromMonth")
    to_month = data.get("to_month") or data.get("toMonth")

    service_single = data.get("service")
    services = data.get("services")
    if not services:
        if service_single:
            services = [service_single]
        else:
            services = [service_from_request.id]

    categories = data.get("categories") or []
    mode = (data.get("mode") or "all").upper()

    price_min = data.get("price_min", data.get("priceMin"))
    price_max = data.get("price_max", data.get("priceMax"))
    stock_min = data.get("stock_min", data.get("stockMin"))

    include_tva = data.get("include_tva", data.get("includeTVA", True))
    include_dlc = data.get("include_dlc", data.get("includeDLC", True))
    include_sku = data.get("include_sku", data.get("includeSKU", True))
    include_summary = data.get("include_summary", data.get("includeSummary", True))
    include_charts = data.get("include_charts", data.get("includeCharts", False))
    export_format = (data.get("format", data.get("exportFormat", "xlsx")) or "xlsx").lower()

    email_to = (data.get("email") or "").strip()
    email_message = (data.get("message") or "").strip()

    fields = data.get("fields") or data.get("columns")
    if isinstance(fields, str):
        fields = [v.strip() for v in fields.split(",") if v.strip()]

    check_entitlement(tenant, "exports_basic")
    if export_format == "xlsx":
        check_entitlement(tenant, "exports_xlsx")
    if include_summary or include_charts:
        check_entitlement(tenant, "reports_advanced")
    if email_to:
        check_entitlement(tenant, "exports_email")
    _enforce_export_quota(tenant, export_format)

    qs = Product.objects.filter(tenant=tenant)
    qs = _apply_retention(qs, tenant)

    def _none_if_blank(v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    price_min = _none_if_blank(price_min)
    price_max = _none_if_blank(price_max)
    stock_min = _none_if_blank(stock_min)

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

    if mode in ("SEALED", "OPENED"):
        qs = qs.filter(container_status=mode)

    if price_min is not None:
        qs = qs.filter(selling_price__gte=price_min)
    if price_max is not None:
        qs = qs.filter(selling_price__lte=price_max)
    if stock_min is not None:
        qs = qs.filter(quantity__gte=stock_min)

    field_map = {
        "name": ("Nom", lambda p: p.name or ""),
        "category": ("Catégorie", lambda p: p.category or ""),
        "purchase_price": ("Prix achat (€)", lambda p: float(p.purchase_price) if p.purchase_price else 0),
        "selling_price": ("Prix vente (€)", lambda p: float(p.selling_price) if p.selling_price else 0),
        "tva": ("TVA (%)", lambda p: float(p.tva) if p.tva else ""),
        "dlc": ("DLC", lambda p: p.dlc or ""),
        "quantity": ("Quantité", lambda p: p.quantity or 0),
        "identifier": (
            "Code-barres / SKU",
            lambda p: p.internal_sku if getattr(p, "no_barcode", False) else (p.barcode or ""),
        ),
        "inventory_month": ("Mois", lambda p: p.inventory_month or ""),
        "service": ("Service", lambda p: p.service.name if p.service else ""),
        "unit": ("Unité", lambda p: p.unit or ""),
        "min_qty": ("Stock min", lambda p: float(p.min_qty) if p.min_qty is not None else ""),
        "variant_name": ("Variante (libellé)", lambda p: p.variant_name or ""),
        "variant_value": ("Variante (valeur)", lambda p: p.variant_value or ""),
        "variant": ("Variante", lambda p: _format_variant(p)),
        "lot_number": ("Lot", lambda p: p.lot_number or ""),
        "container_status": ("Statut", lambda p: p.container_status or ""),
        "remaining_fraction": ("Reste (fraction)", lambda p: p.remaining_fraction if p.remaining_fraction is not None else ""),
        "conversion_unit": ("Unité conversion", lambda p: p.conversion_unit or ""),
        "conversion_factor": ("Facteur conversion", lambda p: float(p.conversion_factor) if p.conversion_factor else ""),
        "converted_quantity": (
            "Quantité convertie",
            lambda p: (_converted_quantity(p)[0] if _converted_quantity(p)[0] is not None else ""),
        ),
        "converted_unit": ("Unité convertie", lambda p: _converted_quantity(p)[1] or ""),
        "brand": ("Marque", lambda p: p.brand or ""),
        "supplier": ("Fournisseur", lambda p: p.supplier or ""),
        "notes": ("Notes", lambda p: p.notes or ""),
        "product_role": ("Type produit", lambda p: p.product_role or ""),
    }

    selected_fields = []
    if isinstance(fields, list):
        selected_fields = [f for f in fields if f in field_map]

    if selected_fields:
        headers = [field_map[f][0] for f in selected_fields]
    else:
        headers = ["Nom", "Catégorie", "Prix achat (€)", "Prix vente (€)"]
        if include_tva:
            headers.append("TVA (%)")
        if include_dlc:
            headers.append("DLC")
        headers.append("Quantité")
        if include_sku:
            headers.append("Code-barres / SKU")
        headers.extend(["Variante", "Stock min", "Quantité convertie", "Unité convertie"])
        headers.append("Mois")
        headers.append("Service")

    def build_row(product):
        if selected_fields:
            return [field_map[f][1](product) for f in selected_fields]
        row = [
            product.name,
            product.category,
            float(product.purchase_price) if product.purchase_price else 0,
            float(product.selling_price) if product.selling_price else 0,
        ]
        if include_tva:
            row.append(float(product.tva) if product.tva else "")
        if include_dlc:
            row.append(product.dlc or "")
        row.append(product.quantity or 0)
        if include_sku:
            row.append(product.internal_sku if getattr(product, "no_barcode", False) else product.barcode or "")
        converted_qty, converted_unit = _converted_quantity(product)
        row.extend(
            [
                _format_variant(product),
                float(product.min_qty) if product.min_qty is not None else "",
                converted_qty if converted_qty is not None else "",
                converted_unit or "",
            ]
        )
        row.append(product.inventory_month)
        row.append(product.service.name if product.service else "")
        return row

    products_qs = qs.select_related("service")
    rows = [build_row(p) for p in products_qs]

    filename = "export_avance.xlsx" if export_format != "csv" else "export_avance.csv"
    mimetype = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if export_format != "csv"
        else "text/csv"
    )

    if export_format == "csv":
        attachment_bytes = _build_csv_bytes(headers, rows)
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Export avancé"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        _apply_sheet_style(ws, headers)

        if include_summary or include_charts:
            summary = wb.create_sheet("Synthèse")
            summary["A1"] = "Synthèse export"
            summary["A1"].font = Font(bold=True, size=14)

            products_list = list(products_qs)
            total_products = len(products_list)
            total_qty = sum(float(p.quantity or 0) for p in products_list)
            total_purchase = sum(float(p.purchase_price or 0) * float(p.quantity or 0) for p in products_list)

            total_selling = 0
            for p in products_list:
                features = getattr(p.service, "features", {}) or {}
                item_cfg = features.get("item_type", {}) or {}
                if item_cfg.get("enabled") and p.product_role == "raw_material":
                    continue
                total_selling += float(p.selling_price or 0) * float(p.quantity or 0)

            dlc_count = sum(1 for p in products_list if p.dlc)

            has_item_type_enabled = any(
                (getattr(p.service, "features", {}) or {}).get("item_type", {}).get("enabled")
                for p in products_list
            )

            info_rows = [
                ("Produits", total_products),
                ("Quantité totale", total_qty),
                ("Valeur stock achat (€)", total_purchase),
                ("Valeur stock vente (€)", total_selling),
            ]
            if include_dlc and (not selected_fields or "dlc" in selected_fields):
                info_rows.append(("Produits avec DLC/DDM", dlc_count))
            if has_item_type_enabled:
                info_rows.append(("Note", "Valeur de vente exclut les matières premières."))

            row_cursor = 3
            for label, value in info_rows:
                summary.cell(row=row_cursor, column=1, value=label).font = Font(bold=True)
                summary.cell(row=row_cursor, column=2, value=value)
                row_cursor += 1

            row_cursor += 1
            summary.cell(row=row_cursor, column=1, value="Par catégorie").font = Font(bold=True)
            row_cursor += 1

            headers_summary = ["Catégorie", "Quantité", "Valeur achat (€)", "Valeur vente (€)"]
            for col_num, header in enumerate(headers_summary, 1):
                cell = summary.cell(row=row_cursor, column=col_num, value=header)
                cell.font = EXPORT_HEADER_FONT
                cell.fill = EXPORT_HEADER_FILL
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.border = EXPORT_BORDER
            row_cursor += 1

            category_totals = {}
            for p in products_list:
                cat = p.category or "Sans catégorie"
                category_totals.setdefault(cat, {"qty": 0, "purchase": 0, "selling": 0})
                category_totals[cat]["qty"] += float(p.quantity or 0)
                category_totals[cat]["purchase"] += float(p.purchase_price or 0) * float(p.quantity or 0)

                features = getattr(p.service, "features", {}) or {}
                item_cfg = features.get("item_type", {}) or {}
                if not (item_cfg.get("enabled") and p.product_role == "raw_material"):
                    category_totals[cat]["selling"] += float(p.selling_price or 0) * float(p.quantity or 0)

            start_category_row = row_cursor
            for cat, totals in sorted(category_totals.items()):
                summary.cell(row=row_cursor, column=1, value=cat)
                summary.cell(row=row_cursor, column=2, value=totals["qty"])
                summary.cell(row=row_cursor, column=3, value=totals["purchase"])
                summary.cell(row=row_cursor, column=4, value=totals["selling"])
                if row_cursor % 2 == 0:
                    for col_idx in range(1, 5):
                        summary.cell(row=row_cursor, column=col_idx).fill = EXPORT_STRIPE_FILL
                for col_idx in range(1, 5):
                    summary.cell(row=row_cursor, column=col_idx).border = EXPORT_BORDER
                row_cursor += 1

            if include_charts and category_totals:
                chart = BarChart()
                chart.title = "Valeur stock achat par catégorie"
                chart.y_axis.title = "€"
                data_ref = Reference(summary, min_col=3, min_row=start_category_row - 1, max_row=row_cursor - 1)
                categories_ref = Reference(summary, min_col=1, min_row=start_category_row, max_row=row_cursor - 1)
                chart.add_data(data_ref, titles_from_data=True)
                chart.set_categories(categories_ref)
                summary.add_chart(chart, "F4")

        for sheet in wb.worksheets:
            for col_cells in sheet.columns:
                max_length = 0
                column_letter = None
                for cell in col_cells:
                    if not isinstance(cell, openpyxl.cell.cell.MergedCell):
                        column_letter = cell.column_letter
                        if cell.value is None:
                            continue
                        max_length = max(max_length, len(str(cell.value)))
                if column_letter:
                    sheet.column_dimensions[column_letter].width = min(max(max_length + 2, 10), 42)

        bio = io.BytesIO()
        wb.save(bio)
        attachment_bytes = bio.getvalue()

    if email_to:
        try:
            send_email_with_sendgrid(
                to_email=email_to,
                subject="Export StockScan",
                text_body=email_message or "Ci-joint votre export.",
                html_body=email_message or None,
                filename=filename,
                file_bytes=attachment_bytes or b"",
                mimetype=mimetype,
                fallback_to_django=True,
            )
        except Exception:
            logger.exception("Erreur envoi email export_advanced")

    resp = Response(
        attachment_bytes,
        content_type=mimetype if export_format != "csv" else f"{mimetype}; charset=utf-8",
    )
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    _log_export_event(
        tenant=tenant,
        user=request.user,
        export_format=export_format,
        emailed=bool(email_to),
        params={
            "services": services,
            "from": from_month,
            "to": to_month,
            "mode": mode,
            "format": export_format,
            "email": email_to,
        },
    )
    return resp


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def catalog_pdf(request):
    tenant = get_tenant_for_request(request)
    check_entitlement(tenant, "pdf_catalog")
    _enforce_pdf_catalog_quota(tenant)

    service_param = request.query_params.get("service")
    include_service = service_param == "all"

    qs = Product.objects.filter(tenant=tenant)
    qs = _apply_retention(qs, tenant)
    if service_param and service_param != "all":
        try:
            qs = qs.filter(service_id=int(service_param))
        except (ValueError, TypeError):
            pass

    query = request.query_params.get("q")
    if query:
        qs = qs.filter(
            Q(name__icontains=query)
            | Q(barcode__icontains=query)
            | Q(internal_sku__icontains=query)
            | Q(brand__icontains=query)
            | Q(supplier__icontains=query)
        )

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category__iexact=category)

    qs = qs.select_related("service").order_by("category", "name")
    raw_products = list(qs[: CATALOG_PDF_MAX_PRODUCTS + 1])
    truncated = len(raw_products) > CATALOG_PDF_MAX_PRODUCTS
    products = raw_products[:CATALOG_PDF_MAX_PRODUCTS]

    fields = _parse_pdf_fields(request.query_params.get("fields"))
    company_name = (request.query_params.get("company_name") or "").strip() or tenant.name
    company_email = (request.query_params.get("company_email") or "").strip()
    company_phone = (request.query_params.get("company_phone") or "").strip()
    company_address = (request.query_params.get("company_address") or "").strip()

    pdf_bytes = _build_catalog_pdf(
        tenant=tenant,
        company_name=company_name,
        company_email=company_email,
        company_phone=company_phone,
        company_address=company_address,
        fields=fields,
        products=products,
        truncated=truncated,
        include_service=include_service,
    )

    _log_catalog_pdf_event(
        tenant=tenant,
        user=request.user,
        params={
            "service": service_param,
            "fields": fields,
            "q": query,
            "category": category,
        },
    )

    resp = Response(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = 'attachment; filename="stockscan_catalogue.pdf"'
    return resp


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def search_products(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    query = request.query_params.get("q", "")
    qs = Product.objects.filter(tenant=tenant, service=service)
    qs = _apply_retention(qs, tenant)
    if query:
        qs = qs.filter(
            Q(name__icontains=query)
            | Q(barcode__icontains=query)
            | Q(internal_sku__icontains=query)
        )
    results = list(
        qs.order_by("name")[:10].values(
            "id", "name", "barcode", "internal_sku", "category", "inventory_month"
        )
    )
    return Response(results)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def alerts(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    entitlements = set(get_entitlements(tenant))
    allow_stock = "alerts_stock" in entitlements
    allow_expiry = "alerts_expiry" in entitlements
    if not allow_stock and not allow_expiry:
        raise LimitExceeded(
            code="FEATURE_NOT_INCLUDED",
            detail="Alertes non incluses dans votre plan. Stock: plan Duo+. Dates: plan Multi+.",
        )

    limit = _parse_positive_int(request.query_params.get("limit"), 50, 200)
    offset = _parse_positive_int(request.query_params.get("offset"), 0)

    alerts_list = []
    now = timezone.now().date()
    expiry_critical_days = 30
    expiry_warning_days = 90

    base_qs = Product.objects.filter(tenant=tenant, service=service)
    base_qs = _apply_retention(base_qs, tenant)

    if allow_stock:
        stock_qs = base_qs.filter(min_qty__isnull=False, quantity__lte=F("min_qty"))
        for p in stock_qs:
            qty = float(p.quantity or 0)
            min_qty = float(p.min_qty or 0)
            severity = "critical" if qty <= 0 else "warning"
            alerts_list.append(
                {
                    "type": "stock_low",
                    "severity": severity,
                    "product_id": p.id,
                    "product_name": p.name,
                    "service_id": service.id,
                    "service_name": service.name,
                    "quantity": qty,
                    "min_qty": min_qty,
                    "message": f"Stock bas (min {min_qty}).",
                }
            )

    dlc_enabled = bool((getattr(service, "features", {}) or {}).get("dlc", {}).get("enabled"))
    if allow_expiry and dlc_enabled:
        expiry_qs = base_qs.filter(dlc__isnull=False).exclude(expiry_type="none")
        for p in expiry_qs:
            days_left = (p.dlc - now).days if p.dlc else None
            if days_left is None or days_left > expiry_warning_days:
                continue
            severity = "critical" if days_left <= expiry_critical_days else "warning"
            alerts_list.append(
                {
                    "type": "expiry",
                    "severity": severity,
                    "product_id": p.id,
                    "product_name": p.name,
                    "service_id": service.id,
                    "service_name": service.name,
                    "dlc": p.dlc.isoformat() if p.dlc else None,
                    "days_left": days_left,
                    "message": f"DLC/DDM proche ({days_left}j).",
                }
            )

    alerts_list.sort(
        key=lambda a: (
            0 if a["severity"] == "critical" else 1,
            a.get("days_left", 9999),
            a.get("product_name", ""),
        )
    )
    total = len(alerts_list)
    paginated = alerts_list[offset : offset + limit]

    return Response({"count": total, "limit": limit, "offset": offset, "results": paginated})
