from ..themes import get_theme


def build_preview_svg(template_id: str) -> str:
    theme = get_theme(template_id)
    accent = theme.get("accent", "#1E3A8A")
    header_bg = theme.get("header_bg", "#0B1220")
    card_bg = theme.get("card_bg", "#F8FAFC")
    text = theme.get("text", "#0F172A")
    muted = theme.get("muted", "#475569")

    return f"""<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"200\" viewBox=\"0 0 300 200\">
  <rect width=\"300\" height=\"200\" rx=\"16\" fill=\"#ffffff\"/>
  <rect x=\"0\" y=\"0\" width=\"300\" height=\"36\" fill=\"{header_bg}\"/>
  <rect x=\"0\" y=\"0\" width=\"300\" height=\"4\" fill=\"{accent}\"/>
  <circle cx=\"18\" cy=\"18\" r=\"8\" fill=\"{accent}\"/>
  <rect x=\"32\" y=\"12\" width=\"140\" height=\"6\" fill=\"#ffffff\" opacity=\"0.9\"/>
  <rect x=\"32\" y=\"22\" width=\"100\" height=\"5\" fill=\"#ffffff\" opacity=\"0.6\"/>

  <rect x=\"16\" y=\"52\" width=\"128\" height=\"60\" rx=\"10\" fill=\"{card_bg}\" stroke=\"#E2E8F0\"/>
  <rect x=\"24\" y=\"62\" width=\"80\" height=\"8\" fill=\"{text}\" opacity=\"0.85\"/>
  <rect x=\"24\" y=\"76\" width=\"60\" height=\"6\" fill=\"{muted}\" opacity=\"0.7\"/>
  <rect x=\"24\" y=\"88\" width=\"90\" height=\"6\" fill=\"{muted}\" opacity=\"0.6\"/>
  <rect x=\"98\" y=\"60\" width=\"40\" height=\"14\" rx=\"6\" fill=\"{accent}\"/>

  <rect x=\"156\" y=\"52\" width=\"128\" height=\"60\" rx=\"10\" fill=\"{card_bg}\" stroke=\"#E2E8F0\"/>
  <rect x=\"164\" y=\"62\" width=\"80\" height=\"8\" fill=\"{text}\" opacity=\"0.85\"/>
  <rect x=\"164\" y=\"76\" width=\"60\" height=\"6\" fill=\"{muted}\" opacity=\"0.7\"/>
  <rect x=\"164\" y=\"88\" width=\"90\" height=\"6\" fill=\"{muted}\" opacity=\"0.6\"/>
  <rect x=\"238\" y=\"60\" width=\"40\" height=\"14\" rx=\"6\" fill=\"{accent}\"/>

  <rect x=\"16\" y=\"122\" width=\"268\" height=\"50\" rx=\"12\" fill=\"#F8FAFC\" stroke=\"#E2E8F0\"/>
  <rect x=\"26\" y=\"136\" width=\"200\" height=\"8\" fill=\"{muted}\" opacity=\"0.5\"/>
  <rect x=\"26\" y=\"150\" width=\"160\" height=\"8\" fill=\"{muted}\" opacity=\"0.4\"/>
  <rect x=\"230\" y=\"136\" width=\"40\" height=\"20\" rx=\"6\" fill=\"{accent}\"/>
</svg>"""
