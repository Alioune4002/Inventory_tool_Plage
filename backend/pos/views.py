from decimal import Decimal
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import ProductPermission
from accounts.services.access import get_retention_days
from accounts.utils import get_service_from_request, get_tenant_for_request
from products.models import Product

from .models import PosTicket, PosTicketLine, PosPayment
from .serializers import PosCheckoutSerializer, _discount_amount

PAYMENT_TOLERANCE = Decimal("0.01")


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


def _parse_date(value: str):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_products_search(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    query = (request.query_params.get("q") or "").strip()

    if not query:
        return Response([])

    qs = Product.objects.filter(tenant=tenant, service=service)
    qs = _apply_retention(qs, tenant)
    qs = qs.filter(
        Q(name__icontains=query)
        | Q(barcode__icontains=query)
        | Q(internal_sku__icontains=query)
    )

    results = list(
        qs.order_by("name")[:30].values(
            "id",
            "name",
            "barcode",
            "internal_sku",
            "quantity",
            "unit",
            "selling_price",
            "tva",
            "category",
        )
    )
    return Response(results)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_checkout(request):
    serializer = PosCheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    items = data["items"]
    payments = data["payments"]
    global_discount = data.get("global_discount")

    product_ids = [item["product_id"] for item in items]

    with transaction.atomic():
        products = list(
            Product.objects.select_for_update()
            .filter(tenant=tenant, service=service, id__in=product_ids)
        )

        product_map = {p.id: p for p in products}
        missing_ids = [pid for pid in product_ids if pid not in product_map]
        if missing_ids:
            raise PermissionDenied("Accès interdit à un ou plusieurs produits.")

        missing_price = []
        line_payloads = []
        subtotal_amount = Decimal("0")
        line_discount_total = Decimal("0")

        for item in items:
            product = product_map[item["product_id"]]
            qty = item["qty"]
            unit_price = item.get("unit_price")
            if unit_price is None:
                if product.selling_price is None:
                    missing_price.append(
                        {"id": product.id, "name": product.name, "barcode": product.barcode}
                    )
                    continue
                unit_price = product.selling_price

            line_subtotal = unit_price * qty
            discount_value = item.get("discount") or Decimal("0")
            discount_type = item.get("discount_type") or "amount"
            line_discount = _discount_amount(line_subtotal, discount_value, discount_type)
            if line_discount > line_subtotal:
                return Response(
                    {
                        "detail": f"Remise ligne trop élevée pour {product.name}.",
                        "code": "line_discount_invalid",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            line_total = line_subtotal - line_discount
            subtotal_amount += line_subtotal
            line_discount_total += line_discount

            line_payloads.append(
                {
                    "product": product,
                    "qty": qty,
                    "unit": product.unit,
                    "unit_price": unit_price,
                    "line_discount": line_discount,
                    "line_total": line_total,
                }
            )

        if missing_price:
            return Response(
                {
                    "detail": "Prix de vente manquant pour certains produits.",
                    "code": "missing_selling_price",
                    "products": missing_price,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if subtotal_amount <= 0:
            return Response(
                {"detail": "Total invalide.", "code": "invalid_total"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        global_discount_value = Decimal("0")
        if global_discount:
            global_discount_value = _discount_amount(
                subtotal_amount, global_discount["value"], global_discount["type"]
            )
            if global_discount_value > subtotal_amount:
                return Response(
                    {
                        "detail": "Remise globale trop élevée.",
                        "code": "global_discount_invalid",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        discount_total = line_discount_total + global_discount_value
        total_amount = subtotal_amount - discount_total

        payment_total = sum(p["amount"] for p in payments)
        if abs(payment_total - total_amount) > PAYMENT_TOLERANCE:
            return Response(
                {
                    "detail": "Le total des paiements ne correspond pas au total du ticket.",
                    "code": "payment_total_mismatch",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        insufficient = []
        for payload in line_payloads:
            product = payload["product"]
            if product.quantity < payload["qty"]:
                insufficient.append(
                    {
                        "id": product.id,
                        "name": product.name,
                        "available": str(product.quantity),
                    }
                )

        if insufficient:
            return Response(
                {
                    "detail": "Stock insuffisant pour certains produits.",
                    "code": "stock_insufficient",
                    "products": insufficient,
                },
                status=status.HTTP_409_CONFLICT,
            )

        ticket = PosTicket.objects.create(
            tenant=tenant,
            service=service,
            created_by=request.user,
            subtotal_amount=subtotal_amount,
            discount_total=discount_total,
            total_amount=total_amount,
            status="PAID",
            note=data.get("note") or "",
        )

        for payload in line_payloads:
            product = payload["product"]
            PosTicketLine.objects.create(
                ticket=ticket,
                product=product,
                qty=payload["qty"],
                unit=payload["unit"],
                unit_price=payload["unit_price"],
                line_discount=payload["line_discount"],
                line_total=payload["line_total"],
                product_name=product.name,
                barcode=product.barcode or "",
                internal_sku=product.internal_sku or "",
                category=product.category or "",
                tva=product.tva,
            )

        for payment in payments:
            PosPayment.objects.create(
                ticket=ticket,
                method=payment["method"],
                amount=payment["amount"],
            )

        for payload in line_payloads:
            product = payload["product"]
            product.quantity = product.quantity - payload["qty"]
            product.save(update_fields=["quantity"])

    return Response(
        {
            "ticket_id": ticket.id,
            "subtotal_amount": str(subtotal_amount),
            "discount_total": str(discount_total),
            "total_amount": str(total_amount),
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_reports_summary(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    date_from = _parse_date(request.query_params.get("from") or "")
    date_to = _parse_date(request.query_params.get("to") or "")

    qs = PosTicket.objects.filter(tenant=tenant, service=service, status="PAID")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    totals = qs.aggregate(
        total_net=Sum("total_amount"),
        total_remises=Sum("discount_total"),
        total_brut=Sum("subtotal_amount"),
    )

    payments_qs = PosPayment.objects.filter(ticket__in=qs)
    payments_by_method = (
        payments_qs.values("method").annotate(total=Sum("amount")).order_by("method")
    )

    top_products = (
        PosTicketLine.objects.filter(ticket__in=qs)
        .values("product_name")
        .annotate(total_qty=Sum("qty"), total_amount=Sum("line_total"))
        .order_by("-total_amount")[:5]
    )

    return Response(
        {
            "total_net": str(totals.get("total_net") or Decimal("0")),
            "total_remises": str(totals.get("total_remises") or Decimal("0")),
            "total_brut": str(totals.get("total_brut") or Decimal("0")),
            "payments_by_method": list(payments_by_method),
            "top_products": list(top_products),
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_tickets(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    limit = min(int(request.query_params.get("limit") or 20), 100)

    qs = PosTicket.objects.filter(tenant=tenant, service=service).order_by("-created_at")[:limit]
    payload = []
    for t in qs:
        payload.append(
            {
                "id": t.id,
                "created_at": t.created_at.isoformat(),
                "subtotal_amount": str(t.subtotal_amount),
                "discount_total": str(t.discount_total),
                "total_amount": str(t.total_amount),
                "status": t.status,
            }
        )
    return Response({"tickets": payload})
