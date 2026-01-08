from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import ProductPermission
from accounts.utils import get_service_from_request, get_tenant_for_request
from products.models import Product

from .models import KdsTable, MenuItem, Order, OrderLine, RecipeItem
from .serializers import (
    KdsTableSerializer,
    MenuItemSerializer,
    OrderCancelSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    PosCheckoutPayloadSerializer,
    RecipeItemSerializer,
)
from .services.orders import (
    MenuItemNotFoundError,
    MissingMenuPriceError,
    MissingRecipeError,
    PaymentMismatchError,
    StockInsufficientError,
    create_order,
    mark_order_paid,
    mark_order_ready,
    mark_order_served,
    send_order_to_kitchen,
    cancel_order,
    compute_menu_item_availability,
)
from .utils import require_kds_enabled


def _parse_since(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _get_scope(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)
    require_kds_enabled(service)
    return tenant, service


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_menu_items(request):
    tenant, service = _get_scope(request)

    if request.method == "POST":
        serializer = MenuItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        menu_item = serializer.save(tenant=tenant, service=service)
        return Response(MenuItemSerializer(menu_item).data, status=status.HTTP_201_CREATED)

    qs = MenuItem.objects.filter(tenant=tenant, service=service)
    with_availability = request.query_params.get("with_availability") == "1"
    if with_availability:
        qs = qs.prefetch_related("recipe_items__ingredient_product")

    items = list(qs.order_by("name"))
    data = MenuItemSerializer(items, many=True).data
    if with_availability:
        for idx, item in enumerate(items):
            available, limiting = compute_menu_item_availability(item)
            data[idx]["available_count"] = available
            data[idx]["limiting_ingredients"] = limiting
    return Response(data)


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_menu_item_detail(request, menu_item_id: int):
    tenant, service = _get_scope(request)
    menu_item = MenuItem.objects.filter(tenant=tenant, service=service, id=menu_item_id).first()
    if not menu_item:
        return Response({"detail": "Plat introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        serializer = MenuItemSerializer(menu_item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    return Response(MenuItemSerializer(menu_item).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_menu_item_availability(request, menu_item_id: int):
    tenant, service = _get_scope(request)
    menu_item = (
        MenuItem.objects.filter(tenant=tenant, service=service, id=menu_item_id)
        .prefetch_related("recipe_items__ingredient_product")
        .first()
    )
    if not menu_item:
        return Response({"detail": "Plat introuvable."}, status=status.HTTP_404_NOT_FOUND)

    available, limiting = compute_menu_item_availability(menu_item)
    return Response({"available_count": available, "limiting_ingredients": limiting})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_menu_item_recipe(request, menu_item_id: int):
    tenant, service = _get_scope(request)
    menu_item = MenuItem.objects.filter(tenant=tenant, service=service, id=menu_item_id).first()
    if not menu_item:
        return Response({"detail": "Plat introuvable."}, status=status.HTTP_404_NOT_FOUND)

    items_payload = request.data.get("items") if isinstance(request.data, dict) else request.data
    serializer = RecipeItemSerializer(data=items_payload, many=True)
    serializer.is_valid(raise_exception=True)

    ingredient_ids = [row["ingredient_product_id"] for row in serializer.validated_data]
    products = list(
        Product.objects.filter(tenant=tenant, service=service, id__in=ingredient_ids)
    )
    product_map = {p.id: p for p in products}
    missing = [pid for pid in ingredient_ids if pid not in product_map]
    if missing:
        raise PermissionDenied("Accès interdit à un ou plusieurs produits.")

    with transaction.atomic():
        RecipeItem.objects.filter(menu_item=menu_item).delete()
        RecipeItem.objects.bulk_create(
            [
                RecipeItem(
                    menu_item=menu_item,
                    ingredient_product=product_map[item["ingredient_product_id"]],
                    qty=item["qty"],
                    unit=item.get("unit") or "pcs",
                )
                for item in serializer.validated_data
            ]
        )

    return Response({"detail": "Recette mise à jour."})


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_tables(request):
    tenant, service = _get_scope(request)

    if request.method == "POST":
        serializer = KdsTableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        table = serializer.save(tenant=tenant, service=service)
        return Response(KdsTableSerializer(table).data, status=status.HTTP_201_CREATED)

    qs = KdsTable.objects.filter(tenant=tenant, service=service)
    return Response(KdsTableSerializer(qs.order_by("name"), many=True).data)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_table_detail(request, table_id: int):
    tenant, service = _get_scope(request)
    table = KdsTable.objects.filter(tenant=tenant, service=service, id=table_id).first()
    if not table:
        return Response({"detail": "Table introuvable."}, status=status.HTTP_404_NOT_FOUND)

    serializer = KdsTableSerializer(table, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_orders(request):
    tenant, service = _get_scope(request)
    serializer = OrderCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    table_id = serializer.validated_data.get("table_id")
    table = None
    if table_id:
        table = KdsTable.objects.filter(tenant=tenant, service=service, id=table_id).first()
        if not table:
            return Response({"detail": "Table introuvable."}, status=status.HTTP_404_NOT_FOUND)

    try:
        order = create_order(
            tenant=tenant,
            service=service,
            user=request.user,
            table=table,
            lines_payload=serializer.validated_data["lines"],
        )
    except MenuItemNotFoundError:
        raise PermissionDenied("Accès interdit à un ou plusieurs plats.")
    except MissingMenuPriceError as exc:
        return Response(
            {
                "detail": "Prix manquant pour certains plats.",
                "code": "missing_menu_price",
                "items": exc.items,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    order.note = serializer.validated_data.get("note") or ""
    if order.note:
        order.save(update_fields=["note"])

    return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_orders_open(request):
    tenant, service = _get_scope(request)
    qs = Order.objects.filter(
        tenant=tenant,
        service=service,
        status__in=["DRAFT", "SENT", "READY"],
    ).prefetch_related("lines")
    return Response(OrderSerializer(qs.order_by("-created_at"), many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_order_detail(request, order_id: int):
    tenant, service = _get_scope(request)
    order = (
        Order.objects.filter(tenant=tenant, service=service, id=order_id)
        .prefetch_related("lines")
        .first()
    )
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_order_send(request, order_id: int):
    tenant, service = _get_scope(request)
    order = Order.objects.filter(tenant=tenant, service=service, id=order_id).first()
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    try:
        order = send_order_to_kitchen(order, request.user)
    except MissingRecipeError as exc:
        return Response(
            {"detail": "Recette manquante pour certains plats.", "code": "missing_recipe", "items": exc.items},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except StockInsufficientError as exc:
        return Response(
            {
                "detail": "Stock insuffisant pour certains ingrédients.",
                "code": "stock_insufficient",
                "items": exc.items,
            },
            status=status.HTTP_409_CONFLICT,
        )

    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_order_ready(request, order_id: int):
    tenant, service = _get_scope(request)
    order = Order.objects.filter(tenant=tenant, service=service, id=order_id).first()
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    try:
        order = mark_order_ready(order)
    except Exception:
        return Response({"detail": "Commande non prête."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_order_served(request, order_id: int):
    tenant, service = _get_scope(request)
    order = Order.objects.filter(tenant=tenant, service=service, id=order_id).first()
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    try:
        order = mark_order_served(order)
    except Exception:
        return Response({"detail": "Commande non servie."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_order_cancel(request, order_id: int):
    tenant, service = _get_scope(request)
    order = Order.objects.filter(tenant=tenant, service=service, id=order_id).first()
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    serializer = OrderCancelSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        order = cancel_order(
            order,
            serializer.validated_data["reason_code"],
            serializer.validated_data.get("reason_text") or "",
            request.user,
        )
    except Exception:
        return Response({"detail": "Commande non annulable."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(OrderSerializer(order).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_kitchen_feed(request):
    tenant, service = _get_scope(request)
    since = _parse_since(request.query_params.get("since"))

    qs = Order.objects.filter(
        tenant=tenant,
        service=service,
        status__in=["SENT", "READY"],
    ).prefetch_related("lines")
    if since:
        qs = qs.filter(updated_at__gte=since)

    return Response(OrderSerializer(qs.order_by("-created_at"), many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_pos_open_tables(request):
    tenant, service = _get_scope(request)
    orders = (
        Order.objects.filter(
            tenant=tenant,
            service=service,
            status__in=["DRAFT", "SENT", "READY", "SERVED"],
        )
        .select_related("table")
        .order_by("-created_at")
    )

    payload = []
    for order in orders:
        payload.append(
            {
                "order_id": order.id,
                "table_id": order.table_id,
                "table_name": order.table.name if order.table_id else "À emporter",
                "total": str(order.total_amount),
                "status": order.status,
            }
        )
    return Response(payload)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_pos_order_for_checkout(request, order_id: int):
    tenant, service = _get_scope(request)
    order = (
        Order.objects.filter(tenant=tenant, service=service, id=order_id)
        .prefetch_related("lines")
        .first()
    )
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    return Response(
        {
            "order_id": order.id,
            "table": order.table.name if order.table_id else "À emporter",
            "status": order.status,
            "subtotal": str(order.subtotal_amount),
            "discount_total": str(order.discount_total),
            "total": str(order.total_amount),
            "lines": [
                {
                    "menu_item_name": line.menu_item_name,
                    "qty": str(line.qty),
                    "unit_price": str(line.unit_price),
                    "line_total": str(line.line_total),
                    "notes": line.notes,
                }
                for line in order.lines.all()
            ],
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ProductPermission])
def kds_pos_order_mark_paid(request, order_id: int):
    tenant, service = _get_scope(request)
    order = Order.objects.filter(tenant=tenant, service=service, id=order_id).first()
    if not order:
        return Response({"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND)

    serializer = PosCheckoutPayloadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        order = mark_order_paid(order, request.user, serializer.validated_data["payments"])
    except PaymentMismatchError:
        return Response(
            {"detail": "Le total des paiements ne correspond pas.", "code": "payment_total_mismatch"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return Response({"detail": "Commande non encaissable."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(OrderSerializer(order).data)
