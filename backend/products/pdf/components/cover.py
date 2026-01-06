import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

from .utils import hex_to_color, safe_text

SERVICE_TITLES = {
    "pharmacy_parapharmacy": "Catalogue pharmacie",
    "bakery": "Catalogue boulangerie",
    "kitchen": "Catalogue restauration",
    "restaurant_dining": "Catalogue restauration",
}


def _cover_title(service_type: str) -> str:
    return SERVICE_TITLES.get(service_type or "", "Catalogue produits")


def build_cover_flowables(
    *,
    doc,
    theme,
    company_name,
    company_email,
    company_phone,
    company_address,
    service_type=None,
    service_name=None,
    cover_image_bytes=None,
    logo_bytes=None,
    truncated=False,
):
    width = doc.width
    accent = hex_to_color(theme.get("accent", "#1E3A8A"))
    muted = hex_to_color(theme.get("muted", "#475569"))

    title_style = ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=colors.white,
        leading=26,
    )
    subtitle_style = ParagraphStyle(
        name="CoverSubtitle",
        fontName="Helvetica",
        fontSize=11,
        textColor=colors.white,
        leading=14,
    )
    info_style = ParagraphStyle(
        name="CoverInfo",
        fontName="Helvetica",
        fontSize=9,
        textColor=muted,
        leading=12,
    )

    flowables = []

    header_table = Table(
        [[Paragraph(safe_text(company_name) or "StockScan", title_style)]],
        colWidths=[width],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), hex_to_color(theme.get("cover_bg", "#0B1220"))),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("TOPPADDING", (0, 0), (-1, -1), 20),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
            ]
        )
    )
    flowables.append(header_table)

    subtitle = _cover_title(service_type)
    if service_name:
        subtitle = f"{subtitle} · {service_name}"

    flowables.append(
        Table(
            [[Paragraph(subtitle, subtitle_style)]],
            colWidths=[width],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), hex_to_color(theme.get("cover_bg", "#0B1220"))),
                    ("LEFTPADDING", (0, 0), (-1, -1), 18),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ]
            ),
        )
    )

    if cover_image_bytes:
        try:
            img = Image(io.BytesIO(cover_image_bytes))
            img.drawWidth = width
            img.drawHeight = 7.5 * cm
            flowables.append(img)
        except Exception:
            pass
    else:
        placeholder = Table(
            [[Paragraph("Aucune photo de couverture", info_style)]],
            colWidths=[width],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.lightgrey),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 30),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 30),
                ]
            ),
        )
        flowables.append(placeholder)

    flowables.append(Spacer(1, 0.4 * cm))

    info_lines = [
        safe_text(company_email),
        safe_text(company_phone),
        safe_text(company_address),
    ]
    info_lines = [line for line in info_lines if line]

    info_block = "<br/>".join(info_lines) if info_lines else "Coordonnées non renseignées."

    info_table = Table(
        [[Paragraph(info_block, info_style)]],
        colWidths=[width],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.lightgrey),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        ),
    )
    flowables.append(info_table)

    flowables.append(Spacer(1, 0.2 * cm))

    if truncated:
        flowables.append(
            Paragraph(
                "Catalogue tronqué : maximum de produits atteint.",
                ParagraphStyle(
                    name="Truncated",
                    fontName="Helvetica-Bold",
                    fontSize=9,
                    textColor=accent,
                ),
            )
        )

    flowables.append(Spacer(1, 0.4 * cm))
    flowables.append(
        Paragraph(
            datetime.now().strftime("%d/%m/%Y"),
            ParagraphStyle(name="Date", fontName="Helvetica", fontSize=9, textColor=muted),
        )
    )

    return flowables
