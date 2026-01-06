TEMPLATES = {
    "classic": {
        "label": "Classic",
        "description": "Sobre, lisible, multi-métiers",
        "recommended": False,
        "accent": "#1E3A8A",
        "header_bg": "#0B1220",
        "header_text": "#FFFFFF",
        "header_subtext": "#CBD5E1",
        "card_bg": "#F8FAFC",
        "card_border": "#E2E8F0",
        "text": "#0F172A",
        "muted": "#475569",
        "cover_bg": "#FFFFFF",
        "cover_accent": "#1E3A8A",
    },
    "midnight": {
        "label": "Midnight",
        "description": "Premium sombre, contraste fort",
        "recommended": True,
        "accent": "#0F172A",
        "header_bg": "#0B1220",
        "header_text": "#FFFFFF",
        "header_subtext": "#94A3B8",
        "card_bg": "#F1F5F9",
        "card_border": "#E2E8F0",
        "text": "#0F172A",
        "muted": "#475569",
        "cover_bg": "#0B1220",
        "cover_accent": "#1E293B",
    },
    "emerald": {
        "label": "Émeraude",
        "description": "Énergie naturelle, frais",
        "recommended": True,
        "accent": "#047857",
        "header_bg": "#052E16",
        "header_text": "#FFFFFF",
        "header_subtext": "#A7F3D0",
        "card_bg": "#F0FDF4",
        "card_border": "#DCFCE7",
        "text": "#0F172A",
        "muted": "#475569",
        "cover_bg": "#052E16",
        "cover_accent": "#10B981",
    },
    "royal": {
        "label": "Royal",
        "description": "Chic moderne, contrasté",
        "recommended": False,
        "accent": "#4F46E5",
        "header_bg": "#111827",
        "header_text": "#FFFFFF",
        "header_subtext": "#C7D2FE",
        "card_bg": "#EEF2FF",
        "card_border": "#E0E7FF",
        "text": "#0F172A",
        "muted": "#475569",
        "cover_bg": "#111827",
        "cover_accent": "#4F46E5",
    },
    "sunset": {
        "label": "Sunset",
        "description": "Chaleureux et accueillant",
        "recommended": False,
        "accent": "#F97316",
        "header_bg": "#1F2937",
        "header_text": "#FFFFFF",
        "header_subtext": "#FED7AA",
        "card_bg": "#FFF7ED",
        "card_border": "#FFEDD5",
        "text": "#0F172A",
        "muted": "#7C2D12",
        "cover_bg": "#1F2937",
        "cover_accent": "#F97316",
    },
    "champagne": {
        "label": "Champagne",
        "description": "Luxe discret",
        "recommended": False,
        "accent": "#C8A97E",
        "header_bg": "#111827",
        "header_text": "#FFFFFF",
        "header_subtext": "#E5E7EB",
        "card_bg": "#FFFBF5",
        "card_border": "#F3E8D3",
        "text": "#0F172A",
        "muted": "#6B7280",
        "cover_bg": "#111827",
        "cover_accent": "#C8A97E",
    },
}

DEFAULT_TEMPLATE = "classic"


def get_theme(template_id: str):
    key = (template_id or "").strip().lower()
    return TEMPLATES.get(key, TEMPLATES[DEFAULT_TEMPLATE])


def list_templates():
    return [
        {
            "id": k,
            "label": v["label"],
            "description": v["description"],
            "recommended": bool(v.get("recommended")),
            "accent": v["accent"],
            "header_bg": v["header_bg"],
            "text": v["text"],
            "muted": v["muted"],
            "card_bg": v["card_bg"],
            "card_border": v["card_border"],
        }
        for k, v in TEMPLATES.items()
    ]
