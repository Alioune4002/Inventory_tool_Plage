import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from .fields import CATALOG_FIELD_LABELS
from .components.utils import format_price, safe_text


def build_catalog_simple_pdf(
    *,
    tenant,
    products,
    fields,
    include_service=False,
    company_name=None,
):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=2.0 * cm,
        bottomMargin=1.5 * cm,
    )

    title_style = ParagraphStyle(
        name="SimpleTitle",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
    )
    meta_style = ParagraphStyle(
        name="SimpleMeta",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )

    columns = ["name"] + [f for f in fields if f != "name"]
    if include_service and "service" not in columns:
        columns.append("service")

    header = []
    for col in columns:
        if col == "name":
            header.append("Produit")
        elif col == "service":
            header.append("Service")
        else:
            header.append(CATALOG_FIELD_LABELS.get(col, col))

    data = [header]

    for product in products:
        row = []
        for col in columns:
            if col == "name":
                row.append(safe_text(product.name))
            elif col == "service":
                row.append(safe_text(getattr(product.service, "name", "")))
            elif col == "barcode":
                row.append(safe_text(product.barcode))
            elif col == "sku":
                row.append(safe_text(product.internal_sku))
            elif col == "unit":
                row.append(safe_text(product.unit))
            elif col == "purchase_price":
                row.append(format_price(product.purchase_price, tenant.currency_code) or "")
            elif col == "selling_price":
                row.append(format_price(product.selling_price, tenant.currency_code) or "")
            elif col == "tva":
                row.append(f"{product.tva}%" if product.tva is not None else "")
            elif col == "variants":
                variant = " · ".join([v for v in [product.variant_name, product.variant_value] if v])
                row.append(variant)
            elif col == "dlc":
                row.append(safe_text(product.dlc))
            elif col == "lot":
                row.append(safe_text(product.lot_number))
            elif col == "min_qty":
                row.append(str(product.min_qty) if product.min_qty is not None else "")
            elif col == "supplier":
                row.append(safe_text(product.supplier))
            elif col == "brand":
                row.append(safe_text(product.brand))
            elif col == "notes":
                row.append(safe_text(product.notes))
            else:
                row.append("")
        data.append(row)

    col_count = max(1, len(columns))
    col_width = doc.width / col_count
    table = Table(data, colWidths=[col_width] * col_count, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story = [
        Paragraph(safe_text(company_name) or tenant.name, title_style),
        Spacer(1, 0.1 * cm),
        Paragraph(datetime.now().strftime("%d/%m/%Y"), meta_style),
        Spacer(1, 0.4 * cm),
        table,
    ]

    doc.build(story)
    return buffer.getvalue()
