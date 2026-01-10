# backend/kds/services/orders.py
from decimal import Decimal, ROUND_FLOOR

from django.db import transaction
from django.utils import timezone

from products.models import Product
from pos.models import PosPayment, PosTicket, PosTicketLine

from ..models import (
    MenuItem,
    Order,
    OrderLine,
    RecipeItem,
    StockConsumption,
    WasteEvent,
)

PAYMENT_TOLERANCE = Decimal("0.01")


class KdsError(Exception):
    pass


class StockInsufficientError(KdsError):
    def __init__(self, items):
        super().__init__("Stock insuffisant")
        self.items = items


class MissingRecipeError(KdsError):
    def __init__(self, items):
        super().__init__("Recette manquante")
        self.items = items


class MissingMenuPriceError(KdsError):
    def __init__(self, items):
        super().__init__("Prix manquant")
        self.items = items


class MenuItemNotFoundError(KdsError):
    def __init__(self, items):
        super().__init__("Menu introuvable")
        self.items = items


class InvalidOrderStateError(KdsError):
    pass


class PaymentMismatchError(KdsError):
    pass


def _floor_div(stock: Decimal, needed: Decimal) -> int:
    if needed <= 0:
        return 0
    return int((stock / needed).to_integral_value(rounding=ROUND_FLOOR))


def compute_menu_item_availability(menu_item: MenuItem):
    recipe_items = list(menu_item.recipe_items.select_related("ingredient_product"))
    if not recipe_items:
        return 0, []

    limiting = []
    possible_counts = []
    for item in recipe_items:
        stock = item.ingredient_product.quantity
        possible = _floor_div(stock, item.qty)
        possible_counts.append(possible)
        limiting.append(
            {
                "product_id": item.ingredient_product_id,
                "name": item.ingredient_product.name,
                "needed": str(item.qty),
                "stock": str(stock),
                "possible": possible,
            }
        )

    available = min(possible_counts) if possible_counts else 0
    return available, limiting


def _compute_line_total(unit_price: Decimal, qty: Decimal) -> Decimal:
    return (unit_price or Decimal("0")) * qty


def create_order(tenant, service, user, table, lines_payload):
    menu_item_ids = [line["menu_item_id"] for line in lines_payload]
    menu_items = list(
        MenuItem.objects.filter(
            tenant=tenant, service=service, id__in=menu_item_ids, is_active=True
        )
    )
    menu_map = {item.id: item for item in menu_items}

    missing = [mid for mid in menu_item_ids if mid not in menu_map]
    if missing:
        raise MenuItemNotFoundError(missing)

    missing_price = []
    subtotal_amount = Decimal("0")
    order_lines = []

    for line in lines_payload:
        menu_item = menu_map[line["menu_item_id"]]
        unit_price = menu_item.price or Decimal("0")
        if unit_price <= 0:
            missing_price.append({"id": menu_item.id, "name": menu_item.name})
            continue

        qty = line["qty"]
        line_total = _compute_line_total(unit_price, qty)
        subtotal_amount += line_total
        order_lines.append(
            {
                "menu_item": menu_item,
                "qty": qty,
                "unit_price": unit_price,
                "line_total": line_total,
                "notes": line.get("notes", ""),
            }
        )

    if missing_price:
        raise MissingMenuPriceError(missing_price)

    order = Order.objects.create(
        tenant=tenant,
        service=service,
        table=table,
        created_by=user,
        subtotal_amount=subtotal_amount,
        discount_total=Decimal("0"),
        total_amount=subtotal_amount,
    )

    OrderLine.objects.bulk_create(
        [
            OrderLine(
                order=order,
                menu_item=line["menu_item"],
                qty=line["qty"],
                unit_price=line["unit_price"],
                line_discount=Decimal("0"),
                line_total=line["line_total"],
                notes=line["notes"],
                menu_item_name=line["menu_item"].name,
            )
            for line in order_lines
        ]
    )
    return order


def _collect_requirements(order: Order):
    lines = list(
        order.lines.select_related("menu_item").prefetch_related(
            "menu_item__recipe_items__ingredient_product"
        )
    )

    missing = []
    requirements = {}
    for line in lines:
        menu_item = line.menu_item
        if not menu_item:
            missing.append({"id": None, "name": line.menu_item_name})
            continue
        recipe_items = list(menu_item.recipe_items.all())
        if not recipe_items:
            missing.append({"id": menu_item.id, "name": menu_item.name})
            continue
        for recipe in recipe_items:
            needed = recipe.qty * line.qty
            requirements[recipe.ingredient_product_id] = (
                requirements.get(recipe.ingredient_product_id, Decimal("0")) + needed
            )
    if missing:
        raise MissingRecipeError(missing)
    return requirements


def send_order_to_kitchen(order: Order, user):
    if order.status != "DRAFT":
        raise InvalidOrderStateError("Commande déjà envoyée ou terminée.")

    with transaction.atomic():
        order = (
            Order.objects.select_for_update()
            .select_related("tenant", "service")
            .get(id=order.id)
        )
        if order.status != "DRAFT":
            raise InvalidOrderStateError("Commande déjà envoyée ou terminée.")

        requirements = _collect_requirements(order)
        product_ids = list(requirements.keys())
        products = list(
            Product.objects.select_for_update().filter(
                tenant=order.tenant, service=order.service, id__in=product_ids
            )
        )
        product_map = {p.id: p for p in products}

        insufficient = []
        for pid, needed in requirements.items():
            product = product_map.get(pid)
            if not product:
                insufficient.append(
                    {"id": pid, "name": "Produit introuvable", "needed": str(needed)}
                )
                continue
            if product.quantity < needed:
                insufficient.append(
                    {
                        "id": product.id,
                        "name": product.name,
                        "needed": str(needed),
                        "available": str(product.quantity),
                    }
                )

        if insufficient:
            raise StockInsufficientError(insufficient)

        consumptions = []
        for pid, needed in requirements.items():
            product = product_map[pid]
            product.quantity -= needed
            product.save(update_fields=["quantity"])
            consumptions.append(
                StockConsumption(
                    tenant=order.tenant,
                    service=order.service,
                    order=order,
                    product=product,
                    qty_consumed=needed,
                    reason="ORDER_SENT",
                )
            )

        if consumptions:
            StockConsumption.objects.bulk_create(consumptions)

        order.status = "SENT"
        order.sent_at = timezone.now()
        order.save(update_fields=["status", "sent_at", "updated_at"])

    return order


def mark_order_ready(order: Order):
    if order.status != "SENT":
        raise InvalidOrderStateError("Commande non envoyée en cuisine.")
    order.status = "READY"
    order.ready_at = timezone.now()
    order.save(update_fields=["status", "ready_at", "updated_at"])
    return order


def mark_order_served(order: Order):
    if order.status not in {"READY", "SENT"}:
        raise InvalidOrderStateError("Commande non prête.")
    order.status = "SERVED"
    order.served_at = timezone.now()
    order.save(update_fields=["status", "served_at", "updated_at"])
    return order


def cancel_order(order: Order, reason_code: str, reason_text: str, user, restock: bool = True):
    """
    restock=True  -> annulation "propre": on restock les ingrédients si la commande avait été envoyée.
    restock=False -> annulation "perte": on trace WasteEvent + StockConsumption(reason=WASTE),
                     sans restocker (le stock a déjà été décrémenté à l'envoi).
    """
    if order.status == "PAID":
        raise InvalidOrderStateError("Commande déjà payée.")

    with transaction.atomic():
        order = (
            Order.objects.select_for_update()
            .select_related("tenant", "service")
            .get(id=order.id)
        )
        if order.status == "PAID":
            raise InvalidOrderStateError("Commande déjà payée.")

        # DRAFT -> annulation simple (aucun impact stock)
        if order.status == "DRAFT":
            order.status = "CANCELLED"
            order.cancelled_at = timezone.now()
            order.save(update_fields=["status", "cancelled_at", "updated_at"])
            return order

        # Commande déjà envoyée (SENT/READY/SERVED)
        requirements = _collect_requirements(order)
        product_ids = list(requirements.keys())
        products = list(
            Product.objects.select_for_update().filter(
                tenant=order.tenant, service=order.service, id__in=product_ids
            )
        )
        product_map = {p.id: p for p in products}

        if restock:
            # ✅ Restock : on remet les quantités
            consumptions = []
            for pid, needed in requirements.items():
                product = product_map.get(pid)
                if not product:
                    continue
                product.quantity += needed
                product.save(update_fields=["quantity"])
                # On trace un mouvement inverse (quantité négative consommée = restock)
                consumptions.append(
                    StockConsumption(
                        tenant=order.tenant,
                        service=order.service,
                        order=order,
                        product=product,
                        qty_consumed=-needed,
                        reason="CANCEL_RESTOCK",
                    )
                )
            if consumptions:
                StockConsumption.objects.bulk_create(consumptions)
        else:
            # ✅ Perte : on trace la perte (sans toucher au stock car déjà décrémenté à l'envoi)
            waste_events = []
            consumptions = []

            for line in order.lines.select_related("menu_item"):
                waste_events.append(
                    WasteEvent(
                        tenant=order.tenant,
                        service=order.service,
                        related_order=order,
                        related_order_line=line,
                        reason_code=reason_code,
                        reason_text=reason_text or "",
                        created_by=user,
                    )
                )

            for pid, needed in requirements.items():
                product = product_map.get(pid)
                if not product:
                    continue
                consumptions.append(
                    StockConsumption(
                        tenant=order.tenant,
                        service=order.service,
                        order=order,
                        product=product,
                        qty_consumed=needed,
                        reason="WASTE",
                    )
                )

            if waste_events:
                WasteEvent.objects.bulk_create(waste_events)
            if consumptions:
                StockConsumption.objects.bulk_create(consumptions)

        order.status = "CANCELLED"
        order.cancelled_at = timezone.now()
        order.save(update_fields=["status", "cancelled_at", "updated_at"])

    return order


def mark_order_paid(order: Order, user, payments_payload):
    if order.status in {"CANCELLED", "PAID"}:
        raise InvalidOrderStateError("Commande non encaissable.")

    payment_total = sum(p["amount"] for p in payments_payload)
    if abs(payment_total - order.total_amount) > PAYMENT_TOLERANCE:
        raise PaymentMismatchError("Paiements incomplets.")

    with transaction.atomic():
        order = Order.objects.select_for_update().get(id=order.id)
        if order.status in {"CANCELLED", "PAID"}:
            raise InvalidOrderStateError("Commande non encaissable.")

        ticket = PosTicket.objects.create(
            tenant=order.tenant,
            service=order.service,
            created_by=user,
            subtotal_amount=order.subtotal_amount,
            discount_total=order.discount_total,
            total_amount=order.total_amount,
            status="PAID",
            note=order.note,
        )

        lines = []
        for line in order.lines.all():
            lines.append(
                PosTicketLine(
                    ticket=ticket,
                    product=None,
                    qty=line.qty,
                    unit="pcs",
                    unit_price=line.unit_price,
                    line_discount=line.line_discount,
                    line_total=line.line_total,
                    product_name=line.menu_item_name,
                    barcode="",
                    internal_sku="",
                    category="",
                    tva=None,
                )
            )
        if lines:
            PosTicketLine.objects.bulk_create(lines)

        payments = [
            PosPayment(
                ticket=ticket,
                method=p["method"],
                amount=p["amount"],
                metadata=p.get("metadata") or {},
            )
            for p in payments_payload
        ]
        if payments:
            PosPayment.objects.bulk_create(payments)

        order.status = "PAID"
        order.paid_at = timezone.now()
        order.pos_ticket = ticket
        order.save(update_fields=["status", "paid_at", "pos_ticket", "updated_at"])

    return order
