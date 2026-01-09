from decimal import Decimal
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import ProductPermission
from accounts.services.access import get_retention_days
from accounts.utils import get_service_from_request, get_tenant_for_request
from products.models import Product, LossEvent

from .models import PosCashSession, PosTicket, PosTicketLine, PosPayment, PosTicketEvent
from .serializers import PosCheckoutSerializer, PosTicketCancelSerializer, _discount_amount

PAYMENT_TOLERANCE = Decimal("0.01")

LOSS_REASON_MAP = {
    "error": "mistake",
    "customer_left": "other",
    "breakage": "breakage",
    "mistake": "mistake",
    "other": "other",
}


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


def _get_open_session(tenant, service, user):
    session = (
        PosCashSession.objects.filter(tenant=tenant, service=service, status="OPEN")
        .order_by("-opened_at")
        .first()
    )
    if session:
        return session
    return PosCashSession.objects.create(
        tenant=tenant,
        service=service,
        opened_by=user,
        status="OPEN",
    )


def _ticket_reference(ticket):
    return f"POS-{ticket.created_at.strftime('%Y%m%d')}-{ticket.id:05d}"


def _serialize_ticket_detail(ticket):
    return {
        "id": ticket.id,
        "reference": _ticket_reference(ticket),
        "created_at": ticket.created_at.isoformat(),
        "subtotal_amount": str(ticket.subtotal_amount),
        "discount_total": str(ticket.discount_total),
        "total_amount": str(ticket.total_amount),
        "status": ticket.status,
        "note": ticket.note or "",
        "lines": [
            {
                "id": line.id,
                "product_id": line.product_id,
                "product_name": line.product_name,
                "qty": str(line.qty),
                "unit": line.unit,
                "unit_price": str(line.unit_price),
                "line_discount": str(line.line_discount),
                "line_total": str(line.line_total),
                "barcode": line.barcode,
                "internal_sku": line.internal_sku,
            }
            for line in ticket.lines.all()
        ],
        "payments": [
            {
                "id": pay.id,
                "method": pay.method,
                "amount": str(pay.amount),
                "created_at": pay.created_at.isoformat(),
            }
            for pay in ticket.payments.all()
        ],
    }


def _build_session_summary(session):
    tickets_qs = PosTicket.objects.filter(session=session, status="PAID")
    totals = tickets_qs.aggregate(
        total_net=Sum("total_amount"),
        total_remises=Sum("discount_total"),
        total_brut=Sum("subtotal_amount"),
        total_tickets=Count("id"),
    )
    payments_qs = PosPayment.objects.filter(ticket__in=tickets_qs)
    payments_by_method = (
        payments_qs.values("method").annotate(total=Sum("amount")).order_by("method")
    )
    return {
        "session_id": session.id,
        "opened_at": session.opened_at.isoformat(),
        "closed_at": session.closed_at.isoformat() if session.closed_at else None,
        "status": session.status,
        "total_net": str(totals.get("total_net") or Decimal("0")),
        "total_remises": str(totals.get("total_remises") or Decimal("0")),
        "total_brut": str(totals.get("total_brut") or Decimal("0")),
        "total_tickets": int(totals.get("total_tickets") or 0),
        "payments_by_method": list(payments_by_method),
    }


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

        session = _get_open_session(tenant, service, request.user)

        ticket = PosTicket.objects.create(
            tenant=tenant,
            service=service,
            session=session,
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
                "reference": _ticket_reference(t),
                "created_at": t.created_at.isoformat(),
                "subtotal_amount": str(t.subtotal_amount),
                "discount_total": str(t.discount_total),
                "total_amount": str(t.total_amount),
                "status": t.status,
            }
        )
    return Response({"tickets": payload})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_ticket_detail(request, ticket_id):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    ticket = (
        PosTicket.objects.filter(id=ticket_id, tenant=tenant, service=service)
        .prefetch_related("lines", "payments")
        .first()
    )
    if not ticket:
        return Response({"detail": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(_serialize_ticket_detail(ticket))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_ticket_cancel(request, ticket_id):
    serializer = PosTicketCancelSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    with transaction.atomic():
        ticket = (
            PosTicket.objects.select_for_update()
            .filter(id=ticket_id, tenant=tenant, service=service)
            .first()
        )
        if not ticket:
            return Response({"detail": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if ticket.status == "VOID":
            return Response(
                {"detail": "Ce ticket est déjà annulé.", "code": "ticket_already_void"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lines = list(ticket.lines.select_related("product"))
        product_ids = [line.product_id for line in lines if line.product_id]
        products = {
            p.id: p
            for p in Product.objects.select_for_update().filter(
                tenant=tenant, service=service, id__in=product_ids
            )
        }

        restock = bool(data.get("restock"))
        reason_code = data.get("reason_code") or "other"
        reason_text = data.get("reason_text") or ""
        loss_reason = LOSS_REASON_MAP.get(reason_code, "other")

        if restock:
            for line in lines:
                product = products.get(line.product_id)
                if not product:
                    continue
                product.quantity = product.quantity + line.qty
                product.save(update_fields=["quantity"])
        else:
            now = timezone.now()
            inventory_month = now.strftime("%Y-%m")
            for line in lines:
                LossEvent.objects.create(
                    tenant=tenant,
                    service=service,
                    product=line.product,
                    occurred_at=now,
                    inventory_month=inventory_month,
                    quantity=line.qty,
                    unit=line.unit,
                    reason=loss_reason,
                    note=reason_text or "Annulation POS",
                    created_by=request.user,
                )

        PosTicketEvent.objects.create(
            ticket=ticket,
            event_type="CANCEL",
            reason_code=reason_code,
            reason_text=reason_text,
            restock=restock,
            created_by=request.user,
            metadata={"status_before": ticket.status},
        )

        ticket.status = "VOID"
        ticket.metadata = {
            **(ticket.metadata or {}),
            "cancel_reason": reason_code,
            "cancel_restock": restock,
        }
        ticket.save(update_fields=["status", "metadata"])

    return Response({"detail": "Ticket annulé.", "status": ticket.status})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_session_active(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    session = (
        PosCashSession.objects.filter(tenant=tenant, service=service, status="OPEN")
        .order_by("-opened_at")
        .first()
    )
    if not session:
        return Response({"active": False})
    summary = _build_session_summary(session)
    return Response({"active": True, "summary": summary})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def pos_session_close(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    with transaction.atomic():
        session = (
            PosCashSession.objects.select_for_update()
            .filter(tenant=tenant, service=service, status="OPEN")
            .first()
        )
        if not session:
            return Response(
                {"detail": "Aucune caisse ouverte.", "code": "no_open_session"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary = _build_session_summary(session)
        session.status = "CLOSED"
        session.closed_at = timezone.now()
        session.closed_by = request.user
        session.total_amount = Decimal(summary["total_net"])
        session.total_discount = Decimal(summary["total_remises"])
        session.total_subtotal = Decimal(summary["total_brut"])
        session.total_tickets = summary["total_tickets"]
        session.totals_by_method = {
            row["method"]: str(row["total"]) for row in summary["payments_by_method"]
        }
        session.save(
            update_fields=[
                "status",
                "closed_at",
                "closed_by",
                "total_amount",
                "total_discount",
                "total_subtotal",
                "total_tickets",
                "totals_by_method",
            ]
        )

    return Response({"detail": "Caisse clôturée.", "summary": summary})
