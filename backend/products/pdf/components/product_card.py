from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import ParagraphStyle
import io

from ..fields import CATALOG_FIELD_LABELS
from .utils import format_price, safe_text, clamp_text, hex_to_color


def _build_lines(product, fields, currency_code="EUR", include_service=False):
    lines = []

    if include_service and getattr(product, "service", None):
        lines.append(f"Service : {product.service.name}")

    if "barcode" in fields and product.barcode:
        lines.append(f"{CATALOG_FIELD_LABELS['barcode']} : {product.barcode}")
    if "sku" in fields and product.internal_sku:
        lines.append(f"{CATALOG_FIELD_LABELS['sku']} : {product.internal_sku}")
    if "unit" in fields and product.unit:
        lines.append(f"{CATALOG_FIELD_LABELS['unit']} : {product.unit}")
    if "variants" in fields and (product.variant_name or product.variant_value):
        variant = " · ".join([v for v in [product.variant_name, product.variant_value] if v])
        lines.append(f"{CATALOG_FIELD_LABELS['variants']} : {variant}")
    if "purchase_price" in fields and product.purchase_price is not None:
        val = format_price(product.purchase_price, currency_code)
        if val:
            lines.append(f"{CATALOG_FIELD_LABELS['purchase_price']} : {val}")
    if "selling_price" in fields and product.selling_price is not None:
        val = format_price(product.selling_price, currency_code)
        if val:
            lines.append(f"{CATALOG_FIELD_LABELS['selling_price']} : {val}")
    if "tva" in fields and product.tva is not None:
        lines.append(f"{CATALOG_FIELD_LABELS['tva']} : {product.tva}%")
    if "dlc" in fields and product.dlc:
        lines.append(f"{CATALOG_FIELD_LABELS['dlc']} : {product.dlc}")
    if "lot" in fields and product.lot_number:
        lines.append(f"{CATALOG_FIELD_LABELS['lot']} : {product.lot_number}")
    if "min_qty" in fields and product.min_qty is not None:
        lines.append(f"{CATALOG_FIELD_LABELS['min_qty']} : {product.min_qty}")
    if "supplier" in fields and product.supplier:
        lines.append(f"{CATALOG_FIELD_LABELS['supplier']} : {product.supplier}")
    if "brand" in fields and product.brand:
        lines.append(f"{CATALOG_FIELD_LABELS['brand']} : {product.brand}")
    if "notes" in fields and product.notes:
        lines.append(f"{CATALOG_FIELD_LABELS['notes']} : {clamp_text(product.notes, 120)}")

    return lines


def build_product_card(
    *,
    product,
    fields,
    theme,
    currency_code="EUR",
    include_service=False,
    card_width=8 * cm,
    product_image_bytes=None,
):
    name_style = ParagraphStyle(
        name="CardName",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=13,
        textColor=hex_to_color(theme.get("text", "#0F172A")),
    )
    meta_style = ParagraphStyle(
        name="CardMeta",
        fontName="Helvetica",
        fontSize=8.6,
        leading=11,
        textColor=hex_to_color(theme.get("muted", "#475569")),
    )
    price_style = ParagraphStyle(
        name="CardPrice",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=hex_to_color(theme.get("accent", "#1E3A8A")),
        alignment=2,
    )

    flow = []

    if product_image_bytes:
        try:
            img = Image(io.BytesIO(product_image_bytes))
            img.drawWidth = card_width - 1.1 * cm
            img.drawHeight = 2.0 * cm
            flow.append(img)
            flow.append(Spacer(1, 0.15 * cm))
        except Exception:
            pass

    name = safe_text(product.name) or "Produit"
    flow.append(Paragraph(name, name_style))

    price_value = None
    if "selling_price" in fields and product.selling_price is not None:
        price_value = format_price(product.selling_price, currency_code)
    elif "purchase_price" in fields and product.purchase_price is not None:
        price_value = format_price(product.purchase_price, currency_code)

    if price_value:
        flow.append(Paragraph(price_value, price_style))

    lines = _build_lines(product, fields, currency_code, include_service)
    for line in lines:
        flow.append(Paragraph(line, meta_style))

    if not lines and not price_value:
        flow.append(Paragraph("Infos limitées – complétez la fiche produit.", meta_style))

    card = Table(
        [[flow]],
        colWidths=[card_width],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), hex_to_color(theme.get("card_bg", "#F8FAFC"))),
                ("BOX", (0, 0), (-1, -1), 0.6, hex_to_color(theme.get("card_border", "#E2E8F0"))),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        ),
    )
    return card
