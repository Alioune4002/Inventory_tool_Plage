import csv
import io
import json
import re
import unicodedata
import uuid
from decimal import Decimal, InvalidOperation

from django.core.cache import cache
from django.utils import timezone
from rest_framework import permissions, exceptions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from accounts.permissions import ManagerPermission
from accounts.utils import get_tenant_for_request, get_service_from_request
from .models import Product

INVENTORY_IMPORT_MAX_ROWS = 500
INVENTORY_IMPORT_CACHE_TTL = 60 * 60  # 1h
INVENTORY_IMPORT_MAX_FILE_MB = 10
INVENTORY_IMPORT_MODES = {"inventory", "products"}
INVENTORY_IMPORT_UPDATE_STRATEGIES = {"create_only", "update_existing"}

FIELD_ALIASES = {
    "name": ["designation", "désignation", "nom", "libelle", "libellé", "produit", "article", "item", "product"],
    "quantity": ["quantite", "quantité", "quantity", "qty", "qte", "stock", "quantite_stock"],
    "unit": ["unite", "unité", "uom", "unit"],
    "purchase_price": ["prix_achat", "prix achat", "cost", "cost_price", "purchase", "purchase_price"],
    "selling_price": ["prix_vente", "prix vente", "price", "prix", "selling", "selling_price"],
    "tva": ["tva", "vat", "tax", "taux_tva"],
    "barcode": ["barcode", "code_barres", "code-barres", "ean", "gtin"],
    "internal_sku": ["sku", "ref", "reference", "référence", "reference_interne"],
    "category": ["categorie", "catégorie", "category", "rayon", "famille"],
}

FIELD_LABELS = {
    "name": "Désignation",
    "quantity": "Quantité",
    "unit": "Unité",
    "purchase_price": "Prix achat",
    "selling_price": "Prix vente",
    "tva": "TVA",
    "barcode": "Code-barres",
    "internal_sku": "SKU interne",
    "category": "Catégorie",
}


def _normalize_header(value: str) -> str:
    if not value:
        return ""
    clean = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    clean = re.sub(r"[^a-zA-Z0-9]+", " ", clean).strip().lower()
    return clean


def _detect_mapping(columns):
    normalized_cols = {col: _normalize_header(col) for col in columns}
    mapping = {}
    for field, aliases in FIELD_ALIASES.items():
        for col, normalized in normalized_cols.items():
            if not normalized:
                continue
            if normalized in aliases or any(normalized == _normalize_header(a) for a in aliases):
                mapping[field] = col
                break
    return mapping


def _parse_decimal(value):
    if value in ("", None):
        return None
    try:
        raw = str(value).strip()
        if not raw:
            return None
        raw = raw.replace(" ", "").replace(",", ".")
        match = re.search(r"-?\d+(?:\.\d+)?", raw)
        if not match:
            return None
        return Decimal(match.group(0))
    except (InvalidOperation, ValueError):
        return None


def _load_csv_rows(file_obj):
    raw_bytes = file_obj.read()
    if not raw_bytes:
        return [], []
    try:
        raw = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raw = raw_bytes.decode("latin-1")
    sample = raw[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";" if ";" in sample else ","
    reader = csv.DictReader(io.StringIO(raw), dialect=dialect)
    rows = list(reader)
    return rows, reader.fieldnames or []


def _load_xlsx_rows(file_obj):
    try:
        import openpyxl
    except Exception as exc:
        raise exceptions.ValidationError("XLSX non supporté sur ce déploiement.") from exc

    wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return [], []
    headers = [str(h or "").strip() for h in rows[0]]
    data_rows = []
    for row in rows[1:]:
        if not any(cell not in (None, "") for cell in row):
            continue
        data = {}
        for idx, header in enumerate(headers):
            data[header] = row[idx] if idx < len(row) else ""
        data_rows.append(data)
    return data_rows, headers


def _parse_inventory_file(file_obj, file_name):
    file_name = file_name or ""
    if file_name.lower().endswith(".csv"):
        rows, columns = _load_csv_rows(file_obj)
        return rows, columns, "csv"
    if file_name.lower().endswith(".xlsx"):
        rows, columns = _load_xlsx_rows(file_obj)
        return rows, columns, "xlsx"
    raise exceptions.ValidationError("Format non supporté (CSV ou XLSX).")


def _match_existing_product(tenant, service, month, row):
    barcode = (row.get("barcode") or "").strip()
    sku = (row.get("internal_sku") or "").strip()
    name = (row.get("name") or "").strip()
    if barcode:
        match = Product.objects.filter(
            tenant=tenant, service=service, inventory_month=month, barcode=barcode
        ).first()
        if match:
            return match, "barcode"
    if sku:
        match = Product.objects.filter(
            tenant=tenant, service=service, inventory_month=month, internal_sku=sku
        ).first()
        if match:
            return match, "sku"
    if name:
        match = Product.objects.filter(
            tenant=tenant, service=service, inventory_month=month, name__iexact=name
        ).first()
        if match:
            return match, "name"
    return None, ""


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
@parser_classes([MultiPartParser, FormParser])
def inventory_import_preview(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    mode = (request.query_params.get("mode") or request.data.get("mode") or "inventory").lower()
    if mode not in INVENTORY_IMPORT_MODES:
        return Response({"detail": "Mode d’import invalide."}, status=400)

    file_obj = request.FILES.get("file")
    if not file_obj:
        return Response({"detail": "Fichier requis."}, status=400)

    if getattr(file_obj, "size", 0) > INVENTORY_IMPORT_MAX_FILE_MB * 1024 * 1024:
        return Response({"detail": "Fichier trop volumineux (max 10MB)."}, status=400)

    mapping_raw = request.data.get("mapping")
    mapping_override = None
    if mapping_raw:
        try:
            mapping_override = json.loads(mapping_raw)
        except json.JSONDecodeError:
            return Response({"detail": "Mapping invalide."}, status=400)

    try:
        rows, columns, source = _parse_inventory_file(file_obj, file_obj.name)
    except exceptions.ValidationError as exc:
        return Response({"detail": str(exc.detail)}, status=400)

    rows = rows[:INVENTORY_IMPORT_MAX_ROWS]
    mapping = mapping_override or _detect_mapping(columns)

    normalized_rows = []
    invalid = 0
    missing_required = 0
    invalid_quantity = 0
    month = timezone.now().strftime("%Y-%m")
    for idx, row in enumerate(rows, start=1):
        normalized = {}
        for field in FIELD_ALIASES.keys():
            col = mapping.get(field)
            normalized[field] = row.get(col) if col else ""
        normalized["name"] = (normalized.get("name") or "").strip()
        warnings = []
        row_invalid = False
        if not normalized["name"]:
            warnings.append("designation_manquante")
            missing_required += 1
            row_invalid = True
        if mapping.get("quantity"):
            qty_value = normalized.get("quantity")
            if qty_value not in ("", None) and _parse_decimal(qty_value) is None:
                warnings.append("quantite_invalide")
                invalid_quantity += 1
                row_invalid = True
        if row_invalid:
            invalid += 1
        match, match_kind = _match_existing_product(tenant, service, month, normalized)
        candidate_duplicate = bool(match and match_kind == "name" and not normalized.get("barcode") and not normalized.get("internal_sku"))
        normalized_rows.append(
            {
                "row_id": idx,
                "source": source,
                "warnings": warnings,
                "candidate_duplicate": candidate_duplicate,
                "matched_product": {"id": match.id, "name": match.name} if match else None,
                **normalized,
            }
        )

    preview_id = uuid.uuid4().hex
    cache.set(
        f"inventory_import:{preview_id}",
        {
            "tenant_id": tenant.id,
            "service_id": service.id,
            "rows": normalized_rows,
            "mapping": mapping,
            "columns": columns,
        },
        INVENTORY_IMPORT_CACHE_TTL,
    )

    return Response(
        {
            "preview_id": preview_id,
            "columns": columns,
            "mapping": mapping,
            "rows": normalized_rows,
            "stats": {
                "total": len(rows),
                "valid": max(0, len(rows) - invalid),
                "invalid": invalid,
                "missing_required": missing_required,
                "invalid_quantity": invalid_quantity,
            },
            "field_labels": FIELD_LABELS,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, ManagerPermission])
def inventory_import_commit(request):
    tenant = get_tenant_for_request(request)
    service = get_service_from_request(request)

    mode = (request.query_params.get("mode") or request.data.get("mode") or "inventory").lower()
    if mode not in INVENTORY_IMPORT_MODES:
        return Response({"detail": "Mode d’import invalide."}, status=400)

    preview_id = request.data.get("preview_id")
    if not preview_id:
        return Response({"detail": "preview_id requis."}, status=400)

    payload = cache.get(f"inventory_import:{preview_id}")
    if not payload or payload.get("tenant_id") != tenant.id or payload.get("service_id") != service.id:
        return Response({"detail": "Preview introuvable ou expirée."}, status=404)

    rows = payload.get("rows") or []
    qty_mode = (request.data.get("qty_mode") or "zero").lower()
    update_strategy = (request.data.get("update_strategy") or "create_only").lower()
    if mode == "inventory":
        update_strategy = "update_existing"
    if update_strategy not in INVENTORY_IMPORT_UPDATE_STRATEGIES:
        return Response({"detail": "Stratégie de mise à jour invalide."}, status=400)
    keep_qty_raw = request.data.get("keep_qty_row_ids") or []
    if isinstance(keep_qty_raw, str):
        try:
            keep_qty_raw = json.loads(keep_qty_raw)
        except json.JSONDecodeError:
            keep_qty_raw = []
    keep_qty = {str(rid) for rid in keep_qty_raw}

    row_overrides_raw = request.data.get("row_overrides") or {}
    if isinstance(row_overrides_raw, str):
        try:
            row_overrides_raw = json.loads(row_overrides_raw)
        except json.JSONDecodeError:
            row_overrides_raw = {}
    row_overrides = row_overrides_raw if isinstance(row_overrides_raw, dict) else {}
    month = request.data.get("month") or timezone.now().strftime("%Y-%m")

    created = 0
    updated = 0
    skipped = 0
    duplicate_candidates = 0

    for row in rows:
        row_id = str(row.get("row_id") or "")
        override = row_overrides.get(row_id)
        if override is None and row_id.isdigit():
            override = row_overrides.get(int(row_id))
        if override:
            for key, value in override.items():
                row[key] = value

        name = (row.get("name") or "").strip()
        if not name:
            continue

        match, match_kind = _match_existing_product(tenant, service, month, row)
        if match_kind == "name" and not row.get("barcode") and not row.get("internal_sku"):
            duplicate_candidates += 1

        qty = _parse_decimal(row.get("quantity"))
        if qty is None:
            qty = Decimal("0")

        if qty_mode == "zero":
            final_qty = Decimal("0")
        elif qty_mode == "set":
            final_qty = qty
        elif qty_mode == "selective":
            final_qty = qty if str(row.get("row_id")) in keep_qty else Decimal("0")
        else:
            final_qty = Decimal("0")

        if match:
            if update_strategy == "create_only":
                skipped += 1
                continue
            updates = []
            if row.get("barcode") and not match.barcode:
                match.barcode = str(row.get("barcode")).strip()
                updates.append("barcode")
            if row.get("internal_sku") and not match.internal_sku:
                match.internal_sku = str(row.get("internal_sku")).strip()
                updates.append("internal_sku")
            if row.get("unit"):
                match.unit = str(row.get("unit")).strip()
                updates.append("unit")
            purchase_price = _parse_decimal(row.get("purchase_price"))
            if purchase_price is not None:
                match.purchase_price = purchase_price
                updates.append("purchase_price")
            selling_price = _parse_decimal(row.get("selling_price"))
            if selling_price is not None:
                match.selling_price = selling_price
                updates.append("selling_price")
            tva = _parse_decimal(row.get("tva"))
            if tva is not None:
                match.tva = tva
                updates.append("tva")
            if row.get("category"):
                match.category = str(row.get("category")).strip()
                updates.append("category")
            should_update_qty = mode == "inventory" or qty_mode in ("set", "selective")
            if should_update_qty:
                match.quantity = final_qty
                updates.append("quantity")
            if updates:
                match.save(update_fields=sorted(set(updates)))
            updated += 1
            continue

        Product.objects.create(
            tenant=tenant,
            service=service,
            name=name,
            inventory_month=month,
            quantity=final_qty if (mode == "inventory" or qty_mode in ("set", "selective")) else Decimal("0"),
            unit=(row.get("unit") or "pcs").strip() if row.get("unit") is not None else "pcs",
            purchase_price=_parse_decimal(row.get("purchase_price")),
            selling_price=_parse_decimal(row.get("selling_price")),
            tva=_parse_decimal(row.get("tva")),
            barcode=(row.get("barcode") or "").strip(),
            internal_sku=(row.get("internal_sku") or "").strip(),
            category=(row.get("category") or "").strip(),
        )
        created += 1

    return Response(
        {
            "created_count": created,
            "updated_count": updated,
            "skipped_count": skipped,
            "duplicates_candidates_count": duplicate_candidates,
        }
    )
