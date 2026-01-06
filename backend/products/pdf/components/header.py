from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader

from .utils import hex_to_color, safe_text


def draw_header(canvas, doc, theme, *, company_name, logo_bytes=None, subtitle="Catalogue produits"):
    width, height = doc.pagesize
    header_h = 1.6 * cm
    margin_x = doc.leftMargin

    header_bg = hex_to_color(theme.get("header_bg", "#0B1220"))
    header_text = hex_to_color(theme.get("header_text", "#FFFFFF"))
    header_subtext = hex_to_color(theme.get("header_subtext", "#CBD5E1"))
    accent = hex_to_color(theme.get("accent", "#1E3A8A"))

    canvas.saveState()
    canvas.setFillColor(header_bg)
    canvas.rect(0, height - header_h, width, header_h, fill=1, stroke=0)

    canvas.setFillColor(accent)
    canvas.rect(0, height - header_h, width, 0.08 * cm, fill=1, stroke=0)

    name_x = margin_x
    if logo_bytes:
        try:
            logo = ImageReader(logo_bytes)
            size = 0.95 * cm
            canvas.drawImage(
                logo,
                margin_x,
                height - header_h + 0.32 * cm,
                width=size,
                height=size,
                preserveAspectRatio=True,
                mask="auto",
            )
            name_x = margin_x + size + 0.35 * cm
        except Exception:
            name_x = margin_x

    canvas.setFillColor(header_text)
    canvas.setFont("Helvetica-Bold", 11.5)
    canvas.drawString(name_x, height - 0.95 * cm, safe_text(company_name) or "StockScan")

    canvas.setFillColor(header_subtext)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(name_x, height - 1.35 * cm, safe_text(subtitle) or "Catalogue produits")

    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(header_subtext)
    canvas.drawRightString(width - margin_x, height - 1.2 * cm, f"Page {doc.page}")

    canvas.restoreState()
