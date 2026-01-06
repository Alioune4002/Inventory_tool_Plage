import re
import unicodedata
from decimal import Decimal, InvalidOperation
from datetime import date

from reportlab.lib import colors


def safe_text(value, default=""):
    if value is None:
        return default
    return str(value).strip()


def currency_symbol(code: str) -> str:
    code = (code or "EUR").upper()
    symbols = {
        "EUR": "€",
        "USD": "$",
        "GBP": "£",
        "CHF": "CHF",
        "CAD": "CA$",
        "AUD": "A$",
        "JPY": "¥",
        "CNY": "¥",
        "BRL": "R$",
        "MAD": "MAD",
        "XOF": "F CFA",
        "XAF": "F CFA",
    }
    return symbols.get(code, code)


def format_price(value, currency_code="EUR"):
    if value is None:
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    symbol = currency_symbol(currency_code)
    return f"{amount:.2f} {symbol}"


def format_date(value):
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return None


def clamp_text(text: str, max_len: int) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def normalize_name(value: str) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip()


def hex_to_color(value: str):
    try:
        return colors.HexColor(value)
    except Exception:
        return colors.HexColor("#0F172A")
