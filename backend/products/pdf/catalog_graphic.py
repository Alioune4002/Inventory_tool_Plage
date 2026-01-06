import io
from collections import OrderedDict

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    NextPageTemplate,
)

from .themes import get_theme
from .components.cover import build_cover_flowables
from .components.header import draw_header
from .components.product_card import build_product_card
from .components.utils import hex_to_color, safe_text


def _group_by_category(products):
    grouped = OrderedDict()
    for product in products:
        key = (product.category or "Sans catégorie").strip() or "Sans catégorie"
        grouped.setdefault(key, []).append(product)
    return grouped


def _build_cards_grid(cards, doc_width, gap=0.5 * cm):
    col_width = (doc_width - gap) / 2.0
    rows = []
    for idx in range(0, len(cards), 2):
        left = cards[idx]
        right = cards[idx + 1] if idx + 1 < len(cards) else ""
        rows.append([left, right])

    table = Table(rows, colWidths=[col_width, col_width], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (0, -1), gap / 2),
                ("LEFTPADDING", (1, 0), (1, -1), gap / 2),
            ]
        )
    )
    return table


def build_catalog_graphic_pdf(
    *,
    tenant,
    products,
    fields,
    truncated=False,
    include_service=False,
    template="classic",
    company_name=None,
    company_email=None,
    company_phone=None,
    company_address=None,
    service_type=None,
    service_name=None,
    logo_bytes=None,
    cover_image_bytes=None,
    product_images=None,
):
    theme = get_theme(template)
    buffer = io.BytesIO()

    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=2.2 * cm,
        bottomMargin=1.6 * cm,
    )

    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")

    cover_template = PageTemplate(id="cover", frames=[frame])
    body_template = PageTemplate(
        id="body",
        frames=[frame],
        onPage=lambda canvas, doc_ref: draw_header(
            canvas,
            doc_ref,
            theme,
            company_name=safe_text(company_name) or tenant.name,
            logo_bytes=logo_bytes,
            subtitle="Catalogue produits",
        ),
    )
    doc.addPageTemplates([cover_template, body_template])

    story = []
    story.extend(
        build_cover_flowables(
            doc=doc,
            theme=theme,
            company_name=company_name or tenant.name,
            company_email=company_email,
            company_phone=company_phone,
            company_address=company_address,
            service_type=service_type,
            service_name=service_name,
            cover_image_bytes=cover_image_bytes,
            logo_bytes=logo_bytes,
            truncated=truncated,
        )
    )
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    grouped = _group_by_category(products)

    category_style = ParagraphStyle(
        name="Category",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=hex_to_color(theme.get("accent", "#1E3A8A")),
        spaceAfter=6,
        spaceBefore=6,
    )

    for category, items in grouped.items():
        story.append(Paragraph(category, category_style))
        cards = []
        for product in items:
            img_bytes = (product_images or {}).get(product.id)
            cards.append(
                build_product_card(
                    product=product,
                    fields=fields,
                    theme=theme,
                    currency_code=tenant.currency_code,
                    include_service=include_service,
                    card_width=(doc.width - 0.5 * cm) / 2.0,
                    product_image_bytes=img_bytes,
                )
            )

        if cards:
            story.append(_build_cards_grid(cards, doc.width))
            story.append(Spacer(1, 0.2 * cm))

    doc.build(story)
    return buffer.getvalue()
