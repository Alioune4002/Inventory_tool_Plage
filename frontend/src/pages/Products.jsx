import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import CatalogPdfSection from "../components/products/CatalogPdfSection";
import Select from "../ui/Select";
import Drawer from "../ui/Drawer";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { getWording, getUxCopy, getPlaceholders, getFieldHelpers } from "../lib/labels";
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";
import { currencyLabel, formatCurrency } from "../lib/currency";
import { ScanLine, X } from "lucide-react";
import { useEntitlements } from "../app/useEntitlements";

function isBarcodeDetectorSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

function normalizeScannedCode(raw) {
  const v = String(raw || "").trim();
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length >= 8) return digits;
  return v;
}

function parseFilenameFromContentDisposition(contentDisposition, fallback) {
  try {
    if (!contentDisposition) return fallback;
    const match = String(contentDisposition).match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
    const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "");
    return raw ? raw.replace(/[/\\]/g, "_") : fallback;
  } catch {
    return fallback;
  }
}

async function blobToJsonSafe(payload) {
  try {
    if (!payload) return null;
    if (typeof payload === "string") return JSON.parse(payload);
    if (payload instanceof Blob) {
      const text = await payload.text();
      return JSON.parse(text);
    }
    if (typeof payload === "object") {
      if (typeof payload.text === "function") {
        const text = await payload.text();
        return JSON.parse(text);
      }
      if ("code" in payload || "detail" in payload) return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function downloadBlob({ blob, filename, keepUrl = false }) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "catalogue.pdf";
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (!keepUrl) window.setTimeout(() => window.URL.revokeObjectURL(url), 800);
  return url;
}

function getPdfErrorMessage(error) {
  const code = error?.code || error?.data?.code;
  if (code === "LIMIT_PDF_CATALOG_MONTH") {
    return "Limite mensuelle du catalogue PDF atteinte. Passez au plan supérieur pour générer davantage.";
  }
  if (code === "FEATURE_NOT_INCLUDED") {
    return "Catalogue PDF non inclus dans votre plan. Passez au plan Duo ou Multi.";
  }
  if (error?.detail) return error.detail;
  return error?.message || "Impossible de générer le catalogue PDF. Réessaie dans un instant.";
}

function ScannerButton({ onClick, label = "Scanner" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-[var(--border)] p-2 text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/10"
      title={label}
      aria-label={label}
    >
      <ScanLine className="h-4 w-4" />
    </button>
  );
}

export default function Products() {
  const { serviceId, services, selectService, serviceFeatures, countingMode, tenant, serviceProfile } = useAuth();
  const currencyCode = tenant?.currency_code || "EUR";
  const currencyText = currencyLabel(currencyCode);
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();

  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  const [editId, setEditId] = useState(null);
  const [editMonth, setEditMonth] = useState(null);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [form, setForm] = useState({
    name: "",
    category: "",
    barcode: "",
    internal_sku: "",
    variant_name: "",
    variant_value: "",
    min_qty: "",
    conversion_unit: "",
    conversion_factor: "",
    brand: "",
    supplier: "",
    notes: "",
    product_role: "",
    purchase_price: "",
    selling_price: "",
    tva: "20",
    unit: "pcs",
    dlc: "",
    lot_number: "",
    container_status: "SEALED",
    pack_size: "",
    pack_uom: "",
    remaining_qty: "",
    remaining_fraction: "",
  });
  const barcodeInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Scanner modal state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanManual, setScanManual] = useState("");

  // 👇 Nouveau : où injecter le scan
  const [scanTarget, setScanTarget] = useState("search"); // "search" | "pdfQuery" | "barcode" | "sku"

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfErrorCode, setPdfErrorCode] = useState("");
  const [pdfQuery, setPdfQuery] = useState("");
  const [pdfCategory, setPdfCategory] = useState("");
  const [pdfService, setPdfService] = useState("");
  const [pdfFields, setPdfFields] = useState(["barcode", "sku", "unit"]);
  const [pdfBranding, setPdfBranding] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
  });
  const [pdfTemplate, setPdfTemplate] = useState("classic");
  const [pdfLogo, setPdfLogo] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);

  const resultsRef = useRef(null);

  const isAllServices = services?.length > 1 && String(serviceId) === "all";
  const currentService = services?.find((s) => String(s.id) === String(serviceId));

  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;

  const familyId = useMemo(() => resolveFamilyId(serviceType, serviceDomain), [serviceType, serviceDomain]);
  const familyMeta = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const familyIdentifiers = familyMeta?.identifiers ?? {};
  const familyModules = familyMeta?.modules ?? [];

  const brandLabelByFamily = {
    pharmacie: "Laboratoire / marque",
    bar: "Marque / distillerie",
    restauration: "Marque / origine",
    boulangerie: "Marque / moulin",
  };
  const supplierLabelByFamily = {
    pharmacie: "Grossiste / centrale",
    bar: "Grossiste boissons",
  };
  const brandLabel = brandLabelByFamily[familyId] || "Marque";
  const supplierLabel = supplierLabelByFamily[familyId] || "Fournisseur";

  const getFeatureFlag = (key, fallback = false) => {
    const cfg = serviceFeatures?.[key];
    if (cfg && typeof cfg.enabled === "boolean") return cfg.enabled;
    return fallback;
  };

  const wording = getWording(serviceType, serviceDomain);
  const itemLabel = wording.itemLabel || "Élément";
  const itemLabelLower = itemLabel.toLowerCase();
  const ux = getUxCopy(serviceType, serviceDomain);
  const placeholders = getPlaceholders(serviceType, serviceDomain);
  const helpers = getFieldHelpers(serviceType, serviceDomain);
  const categoryPlaceholder = placeholders.category || `Ex. ${familyMeta.defaults?.categoryLabel || "Catégorie"}`;
  const unitLabel = familyMeta.defaults?.unitLabel ? `Unité (${familyMeta.defaults.unitLabel})` : "Unité";
  const catalogueNote =
    ux.catalogueNote ||
    "Catalogue (référentiel) : aucune quantité ici. Le comptage et les pertes se font dans Inventaire.";

  const priceCfg = serviceFeatures?.prices || {};
  const purchaseEnabled = priceCfg.purchase_enabled !== false;
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const priceRecommended = priceCfg.recommended === true;
  const tvaEnabled = serviceFeatures?.tva?.enabled !== false;

  const barcodeEnabled = getFeatureFlag("barcode", familyIdentifiers.barcode ?? true);
  const skuEnabled = getFeatureFlag("sku", familyIdentifiers.sku ?? true);
  const variantsEnabled = getFeatureFlag("variants", familyModules.includes("variants"));
  const multiUnitEnabled = getFeatureFlag("multi_unit", familyModules.includes("multiUnit"));
  const itemTypeEnabled = getFeatureFlag("item_type", familyModules.includes("itemType"));
  const lotEnabled = getFeatureFlag("lot", familyModules.includes("lot"));
  const dlcEnabled = getFeatureFlag("dlc", familyModules.includes("expiry"));
  const openEnabled = getFeatureFlag("open_container_tracking", familyModules.includes("opened"));
  const canStockAlerts = Boolean(entitlements?.entitlements?.alerts_stock);
  const canPdfCatalog = Boolean(entitlements?.entitlements?.pdf_catalog);
  const pdfLimit = entitlements?.limits?.pdf_catalog_monthly_limit ?? null;

  const productRoleOptions = [
    { value: "", label: "Non précisé" },
    { value: "raw_material", label: "Matière première" },
    { value: "finished_product", label: "Produit fini" },
    { value: "homemade_prep", label: "Préparation maison" },
  ];
  const productRoleLabels = productRoleOptions.reduce((acc, option) => {
    if (option.value) acc[option.value] = option.label;
    return acc;
  }, {});

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);
  const conversionUnitOptions = ["pcs", "kg", "g", "l", "ml"];

  const vatOptions = ["0", "5.5", "10", "20"];
  const showUnit = multiUnitEnabled || countingMode !== "unit";
  const readableServiceName = (id) => services?.find((s) => String(s.id) === String(id))?.name || id;
  const isEditing = Boolean(editId);
  const serviceOptions = useMemo(
    () => (services || []).map((s) => ({ value: s.id, label: s.name })),
    [services]
  );
  const pdfServiceOptions = useMemo(() => {
    const base = (services || []).map((s) => ({ value: s.id, label: s.name }));
    if (services?.length > 1) base.push({ value: "all", label: "Tous les services" });
    return base;
  }, [services]);
  const categoryOptions = useMemo(() => {
    if (!categories.length) return [];
    return [{ value: "", label: "Aucune" }, ...categories.map((c) => ({ value: c.name, label: c.name }))];
  }, [categories]);
  const unitSelectOptions = useMemo(() => unitOptions.map((u) => ({ value: u, label: u })), [unitOptions]);
  const conversionSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...conversionUnitOptions.map((u) => ({ value: u, label: u }))],
    [conversionUnitOptions]
  );
  const productRoleSelectOptions = useMemo(
    () => productRoleOptions.map((r) => ({ value: r.value, label: r.label })),
    [productRoleOptions]
  );
  const tvaSelectOptions = useMemo(() => vatOptions.map((rate) => ({ value: rate, label: `${rate}%` })), [vatOptions]);
  const containerStatusOptions = [
    { value: "SEALED", label: "Non entamé" },
    { value: "OPENED", label: "Entamé" },
  ];

  const pdfFieldOptions = useMemo(() => {
    const options = [];
    if (barcodeEnabled) options.push({ key: "barcode", label: "Code-barres" });
    if (skuEnabled) options.push({ key: "sku", label: "SKU" });
    options.push({ key: "unit", label: "Unité" });
    if (variantsEnabled) options.push({ key: "variants", label: "Variantes" });
    if (purchaseEnabled) options.push({ key: "purchase_price", label: `Prix d’achat (${currencyText})` });
    if (sellingEnabled) options.push({ key: "selling_price", label: `Prix de vente (${currencyText})` });
    if (tvaEnabled && (purchaseEnabled || sellingEnabled)) options.push({ key: "tva", label: "TVA" });
    if (dlcEnabled) options.push({ key: "dlc", label: "DLC / DDM" });
    if (lotEnabled) options.push({ key: "lot", label: "Lot" });
    if (canStockAlerts) options.push({ key: "min_qty", label: "Stock minimum" });
    options.push({ key: "brand", label: brandLabel });
    options.push({ key: "supplier", label: supplierLabel });
    options.push({ key: "notes", label: "Notes internes" });
    return options;
  }, [
    barcodeEnabled,
    skuEnabled,
    variantsEnabled,
    purchaseEnabled,
    sellingEnabled,
    tvaEnabled,
    dlcEnabled,
    lotEnabled,
    canStockAlerts,
    brandLabel,
    supplierLabel,
    currencyText,
  ]);

  const pdfDefaultFields = useMemo(() => {
    const base = [];
    if (barcodeEnabled) base.push("barcode");
    if (skuEnabled) base.push("sku");
    base.push("unit");
    return base;
  }, [barcodeEnabled, skuEnabled]);

  const templateOptions = useMemo(
    () => [
      { value: "classic", label: "Classique" },
      { value: "midnight", label: "Minuit" },
      { value: "emerald", label: "Émeraude" },
    ],
    []
  );

  const load = async () => {
    if (!serviceId) return;
    setLoading(true);
    setErr("");
    try {
      if (isAllServices) {
        const calls = services.map((s) =>
          api.get(`/api/products/?service=${s.id}`).then((res) => ({
            service: s,
            items: Array.isArray(res.data) ? res.data : [],
          }))
        );
        const results = await Promise.all(calls);
        const merged = results.flatMap((r) => r.items.map((it) => ({ ...it, __service_name: r.service.name })));
        setItems(merged);
      } else {
        const res = await api.get(`/api/products/?service=${serviceId}`);
        setItems(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setErr("Impossible de charger la liste. Vérifiez votre connexion et vos droits.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, services]);

  useEffect(() => {
    const loadCats = async () => {
      if (!serviceId || isAllServices) {
        setCategories([]);
        return;
      }
      try {
        const res = await api.get(`/api/categories/?service=${serviceId}`);
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCategories([]);
      }
    };
    loadCats();
  }, [serviceId, isAllServices]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, unit: unitOptions[0] }));
  }, [unitOptions]);

  useEffect(() => {
    if (!pdfServiceOptions.length) return;
    const values = new Set(pdfServiceOptions.map((opt) => String(opt.value)));
    setPdfService((prev) => {
      if (prev && values.has(String(prev))) return prev;
      if (serviceId && values.has(String(serviceId))) return serviceId;
      return pdfServiceOptions[0]?.value ?? "";
    });
  }, [pdfServiceOptions, serviceId]);

  useEffect(() => {
    if (!pdfBranding.company_name && tenant?.name) {
      setPdfBranding((prev) => ({ ...prev, company_name: tenant.name }));
    }
  }, [pdfBranding.company_name, tenant?.name]);

  useEffect(() => {
    setPdfFields((prev) => {
      const allowed = new Set(pdfFieldOptions.map((opt) => opt.key));
      const filtered = prev.filter((key) => allowed.has(key));
      if (filtered.length) return filtered;
      return pdfDefaultFields.filter((key) => allowed.has(key));
    });
  }, [pdfFieldOptions, pdfDefaultFields]);

  // --- ✅ IMPORTANT : Live sync par défaut (si tu utilises la recherche produits, on pré-remplit le filtre PDF)
  useEffect(() => {
    if (!pdfQuery && search) setPdfQuery(search);
  }, [search, pdfQuery]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "",
      barcode: "",
      internal_sku: "",
      variant_name: "",
      variant_value: "",
      min_qty: "",
      conversion_unit: "",
      conversion_factor: "",
      brand: "",
      supplier: "",
      notes: "",
      product_role: "",
      purchase_price: "",
      selling_price: "",
      tva: "20",
      unit: unitOptions[0],
      dlc: "",
      lot_number: "",
      container_status: "SEALED",
      pack_size: "",
      pack_uom: "",
      remaining_qty: "",
      remaining_fraction: "",
    });
    setEditId(null);
    setEditMonth(null);
    setErr("");
  };

  const openNewProduct = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditProduct = (p) => {
    setEditId(p.id);
    setEditMonth(p.inventory_month || currentMonth);
    setForm({
      name: p.name || "",
      category: p.category || "",
      barcode: p.barcode || "",
      internal_sku: p.internal_sku || "",
      variant_name: p.variant_name || "",
      variant_value: p.variant_value || "",
      min_qty: p.min_qty ?? "",
      conversion_unit: p.conversion_unit || "",
      conversion_factor: p.conversion_factor ?? "",
      brand: p.brand || "",
      supplier: p.supplier || "",
      notes: p.notes || "",
      product_role: p.product_role || "",
      purchase_price: p.purchase_price || "",
      selling_price: p.selling_price || "",
      tva: p.tva === null || p.tva === undefined ? "20" : String(p.tva),
      unit: p.unit || unitOptions[0],
      dlc: p.dlc || "",
      lot_number: p.lot_number || "",
      container_status: p.container_status || "SEALED",
      pack_size: p.pack_size ?? "",
      pack_uom: p.pack_uom || "",
      remaining_qty: p.remaining_qty ?? "",
      remaining_fraction: p.remaining_fraction ?? "",
    });
    setDrawerOpen(true);
    pushToast?.({
      message: `Fiche ${itemLabelLower} pré-remplie : modifiez puis validez.`,
      type: "info",
    });
    window.setTimeout(() => barcodeInputRef.current?.focus?.(), 80);
  };

  const submit = async (e, { keepOpen = false } = {}) => {
    e?.preventDefault?.();

    if (!serviceId || isAllServices) {
      pushToast?.({ message: "Sélectionnez un service précis pour ajouter ou modifier.", type: "warn" });
      return;
    }

    if (!form.name.trim()) {
      pushToast?.({ message: "Le nom est requis.", type: "error" });
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category || "",
        inventory_month: editMonth || currentMonth,
        service: serviceId,
        unit: form.unit || "pcs",
        brand: form.brand.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || "",
      };

      if (variantsEnabled) {
        payload.variant_name = form.variant_name || null;
        payload.variant_value = form.variant_value || null;
      }
      if (canStockAlerts && form.min_qty !== "") payload.min_qty = form.min_qty;
      if (multiUnitEnabled) {
        payload.conversion_unit = form.conversion_unit || null;
        payload.conversion_factor = form.conversion_factor || null;
      }
      if (lotEnabled) payload.lot_number = form.lot_number || null;
      if (dlcEnabled) payload.dlc = form.dlc || null;

      if (openEnabled) {
        payload.container_status = form.container_status || "SEALED";
        payload.pack_size = form.pack_size || null;
        payload.pack_uom = form.pack_uom || null;
        payload.remaining_qty = form.remaining_qty || null;
        payload.remaining_fraction = form.remaining_fraction || null;
      } else {
        payload.container_status = "SEALED";
        payload.pack_size = null;
        payload.pack_uom = null;
        payload.remaining_qty = null;
        payload.remaining_fraction = null;
      }

      const cleanedBarcode = (form.barcode || "").trim();
      const cleanedSku = (form.internal_sku || "").trim();

      if (barcodeEnabled) payload.barcode = cleanedBarcode;
      else payload.barcode = "";

      if (skuEnabled) payload.internal_sku = cleanedSku;
      else payload.internal_sku = "";

      if (purchaseEnabled) payload.purchase_price = form.purchase_price || null;
      if (sellingEnabled) payload.selling_price = form.selling_price || null;
      if (tvaEnabled && (purchaseEnabled || sellingEnabled)) payload.tva = form.tva === "" ? null : Number(form.tva);
      if (itemTypeEnabled) payload.product_role = form.product_role || null;

      let res;
      if (editId) res = await api.put(`/api/products/${editId}/`, payload);
      else res = await api.post("/api/products/", payload);

      const warnings = res?.data?.warnings || [];
      const generatedSku = !editId && skuEnabled && !cleanedSku && res?.data?.internal_sku ? res.data.internal_sku : "";
      if (warnings.length) pushToast?.({ message: warnings.join(" "), type: "warn" });
      else {
        pushToast?.({ message: editId ? `${itemLabel} mis à jour.` : `${itemLabel} ajouté.`, type: "success" });
      }
      if (generatedSku) pushToast?.({ message: `SKU généré : ${generatedSku} (modifiable).`, type: "info" });

      resetForm();
      if (keepOpen && !editId) setDrawerOpen(true);
      else setDrawerOpen(false);

      await load();
    } catch (e2) {
      const apiMsg =
        e2?.friendlyMessage ||
        e2?.response?.data?.detail ||
        e2?.response?.data?.non_field_errors?.[0] ||
        "Action impossible. Vérifiez les champs, les doublons et vos droits.";
      setErr(apiMsg);
      pushToast?.({ message: apiMsg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async () => {
    if (!editId) return;
    const confirmDelete = window.confirm("Supprimer ce produit ? Il sera archivé et pourra être restauré par support si besoin.");
    if (!confirmDelete) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/api/products/${editId}/`);
      pushToast?.({ message: `${itemLabel} archivé.`, type: "success" });
      setDrawerOpen(false);
      resetForm();
      await load();
    } catch {
      pushToast?.({ message: "Suppression impossible. Vérifiez vos droits.", type: "error" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const togglePdfField = (key) => {
    setPdfFields((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const generateCatalogPdf = async () => {
    setPdfError("");
    setPdfErrorCode("");

    if (!canPdfCatalog) {
      setPdfError("Catalogue PDF non inclus dans votre plan.");
      setPdfErrorCode("FEATURE_NOT_INCLUDED");
      return;
    }

    const effectiveService = pdfService || serviceId;
    if (!effectiveService) {
      setPdfError("Sélectionnez un service avant de générer le PDF.");
      return;
    }
    if (!pdfFields.length) {
      setPdfError("Sélectionnez au moins un champ à inclure.");
      return;
    }

    if (pdfLogo && pdfLogo.size > 2 * 1024 * 1024) {
      setPdfError("Logo trop lourd. Limitez à 2 Mo.");
      setPdfErrorCode("LOGO_TOO_LARGE");
      return;
    }

    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("service", effectiveService);
      if (pdfQuery.trim()) params.set("q", pdfQuery.trim());
      if (pdfCategory) params.set("category", pdfCategory);
      if (pdfFields.length) params.set("fields", pdfFields.join(","));
      if (pdfBranding.company_name) params.set("company_name", pdfBranding.company_name);
      if (pdfBranding.company_email) params.set("company_email", pdfBranding.company_email);
      if (pdfBranding.company_phone) params.set("company_phone", pdfBranding.company_phone);
      if (pdfBranding.company_address) params.set("company_address", pdfBranding.company_address);
      if (pdfTemplate) params.set("template", pdfTemplate);

      let res;
      if (pdfLogo) {
        const formData = new FormData();
        formData.append("logo", pdfLogo);
        for (const [key, value] of params.entries()) formData.append(key, value);
        res = await api.post("/api/catalog/pdf/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          responseType: "blob",
        });
      } else {
        res = await api.get(`/api/catalog/pdf/?${params.toString()}`, { responseType: "blob" });
      }

      const filename = parseFilenameFromContentDisposition(res?.headers?.["content-disposition"], "stockscan_catalogue.pdf");
      downloadBlob({ blob: res.data, filename });
      pushToast?.({ message: "Catalogue PDF généré.", type: "success" });
    } catch (e) {
      const payload = await blobToJsonSafe(e?.response?.data);
      const code = payload?.code || e?.response?.data?.code;
      const detail = payload?.detail || e?.response?.data?.detail;
      const msg = getPdfErrorMessage({ code, detail, message: e?.message });
      setPdfError(msg);
      setPdfErrorCode(code || "");
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setPdfLoading(false);
    }
  };

  const catalogItems = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key =
        item.internal_sku?.toLowerCase() ||
        item.barcode?.toLowerCase() ||
        item.name?.trim().toLowerCase() ||
        String(item.id);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        return;
      }
      const monthA = item.inventory_month || "";
      const monthB = existing.inventory_month || "";
      if (monthA > monthB) {
        map.set(key, item);
        return;
      }
      if (monthA === monthB) {
        const dateA = item.created_at ? new Date(item.created_at).getTime() : 0;
        const dateB = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        if (dateA > dateB) map.set(key, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [items]);

  const pdfEffectiveService = pdfService || serviceId;

  // ✅ Preview live (client-side) : ça rend la recherche “catalogue” instantanée
  const pdfPreviewItems = useMemo(() => {
    const q = (pdfQuery || "").trim().toLowerCase();
    const cat = (pdfCategory || "").trim().toLowerCase();

    return catalogItems
      .filter((p) => {
        if (pdfEffectiveService && String(pdfEffectiveService) !== "all") {
          if (String(p.service) !== String(pdfEffectiveService)) return false;
        }

        if (cat) {
          const pc = String(p.category || "").toLowerCase();
          if (categories.length > 0 && pdfEffectiveService !== "all") {
            if (pc !== cat) return false;
          } else {
            if (!pc.includes(cat)) return false;
          }
        }

        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.internal_sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.supplier?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [catalogItems, pdfQuery, pdfCategory, pdfEffectiveService, categories.length]);

  const pdfPreviewCount = useMemo(() => {
    const q = (pdfQuery || "").trim().toLowerCase();
    const cat = (pdfCategory || "").trim().toLowerCase();

    return catalogItems.filter((p) => {
      if (pdfEffectiveService && String(pdfEffectiveService) !== "all") {
        if (String(p.service) !== String(pdfEffectiveService)) return false;
      }
      if (cat) {
        const pc = String(p.category || "").toLowerCase();
        if (categories.length > 0 && pdfEffectiveService !== "all") {
          if (pc !== cat) return false;
        } else {
          if (!pc.includes(cat)) return false;
        }
      }
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.internal_sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }).length;
  }, [catalogItems, pdfQuery, pdfCategory, pdfEffectiveService, categories.length]);

  const filteredItems = useMemo(() => {
    if (!search) return catalogItems;
    const q = search.toLowerCase();
    return catalogItems.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.internal_sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
    );
  }, [catalogItems, search]);

  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!err) return undefined;
    const timer = window.setTimeout(() => setErr(""), 7000);
    return () => window.clearTimeout(timer);
  }, [err]);

  useEffect(() => setPage(1), [search, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  // ---------------------------------------
  // Scanner camera (BarcodeDetector)
  // ---------------------------------------

  const stopScanner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const stream = streamRef.current;
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    streamRef.current = null;

    detectorRef.current = null;
    setScanLoading(false);
  };

  const applyScannedCode = (raw) => {
    const code = normalizeScannedCode(raw);
    if (!code) return;

    // ✅ injection selon target
    if (scanTarget === "pdfQuery") {
      setPdfQuery(code);
      pushToast?.({ message: `Scan → filtre catalogue : ${code}`, type: "success" });
    } else if (scanTarget === "barcode") {
      setForm((p) => ({ ...p, barcode: code }));
      pushToast?.({ message: `Scan → code-barres : ${code}`, type: "success" });
      window.setTimeout(() => barcodeInputRef.current?.focus?.(), 50);
    } else if (scanTarget === "sku") {
      setForm((p) => ({ ...p, internal_sku: code }));
      pushToast?.({ message: `Scan → SKU : ${code}`, type: "success" });
    } else {
      setSearch(code);
      pushToast?.({ message: `Scan → recherche : ${code}`, type: "success" });
      window.setTimeout(() => searchInputRef.current?.focus?.(), 50);
    }

    window.setTimeout(() => {
      try {
        resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } catch (_) {}
    }, 50);

    setScanOpen(false);
  };

  const tickScan = async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) return;

    try {
      const codes = await detector.detect(video);
      if (Array.isArray(codes) && codes.length) {
        const val = codes[0]?.rawValue || "";
        if (val) {
          stopScanner();
          applyScannedCode(val);
          return;
        }
      }
    } catch {
      // ignore
    }

    rafRef.current = requestAnimationFrame(tickScan);
  };

  const startScanner = async () => {
    setScanErr("");
    setScanLoading(true);
    setScanManual("");

    if (!isBarcodeDetectorSupported()) {
      setScanLoading(false);
      setScanErr("Scan caméra non supporté sur ce navigateur. Utilisez la saisie manuelle ci-dessous.");
      return;
    }

    try {
      // eslint-disable-next-line no-undef
      detectorRef.current = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("video_ref_missing");

      video.srcObject = stream;
      await video.play();

      setScanLoading(false);
      rafRef.current = requestAnimationFrame(tickScan);
    } catch (e) {
      stopScanner();
      setScanLoading(false);

      const name = e?.name || "";
      if (name === "NotAllowedError") setScanErr("Permission caméra refusée. Autorisez la caméra puis réessayez.");
      else if (name === "NotFoundError") setScanErr("Aucune caméra détectée sur cet appareil.");
      else setScanErr("Impossible de démarrer la caméra. Réessayez ou utilisez la saisie manuelle.");
    }
  };

  useEffect(() => {
    if (!scanOpen) {
      stopScanner();
      return;
    }
    startScanner();
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  const openScannerFor = (target) => {
    setScanTarget(target);
    setScanOpen(true);
  };

  // ---------------------------------------

  return (
    <PageTransition>
      <Helmet>
        <title>{wording.itemPlural} | StockScan</title>
        <meta name="description" content={ux.productsIntro} />
      </Helmet>

      {/* Modal scanner */}
      {scanOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] shadow-xl overflow-hidden border border-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="font-semibold text-[var(--text)] flex items-center gap-2">
                <ScanLine className="w-5 h-5" />
                Scanner un code-barres
              </div>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-[var(--accent)]/10"
                onClick={() => setScanOpen(false)}
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-[var(--muted)]" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-2xl overflow-hidden bg-black relative">
                <video ref={videoRef} className="w-full h-[320px] object-cover" playsInline muted />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 border-2 border-emerald-400/70 rounded-xl h-40" />
                  <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400/80" />
                </div>
                {scanLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                    Démarrage caméra…
                  </div>
                )}
              </div>

              {scanErr ? (
                <div className="text-sm text-red-700 dark:text-red-200 bg-red-50/70 dark:bg-red-500/10 border border-red-200/70 dark:border-red-400/25 rounded-xl px-3 py-2">
                  {scanErr}
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)]">
                  Place le code-barres dans le cadre. Le scan se fait automatiquement.
                </div>
              )}

              <div className="grid gap-2">
                <Input
                  label="Ou saisir le code manuellement"
                  placeholder="Ex. 3268840001008"
                  value={scanManual}
                  onChange={(e) => setScanManual(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="justify-center"
                    onClick={() => {
                      const v = normalizeScannedCode(scanManual);
                      if (!v) return setScanErr("Veuillez saisir un code valide.");
                      stopScanner();
                      applyScannedCode(v);
                    }}
                  >
                    Utiliser ce code
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setScanOpen(false)}>
                    Annuler
                  </Button>
                </div>
              </div>

              {!isBarcodeDetectorSupported() && (
                <div className="text-xs text-[var(--muted)]">
                  Note : sur iPhone Safari, le scan caméra peut ne pas être supporté.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Intro claire */}
        <Card className="p-6 space-y-2">
          <div className="text-sm text-[var(--muted)]">{wording.itemPlural}</div>
          <h1 className="text-2xl font-black text-[var(--text)]">{ux.productsTitle}</h1>
          <p className="text-[var(--muted)] text-sm">{ux.productsIntro}</p>
          <div className="text-xs text-[var(--muted)]">{catalogueNote}</div>
        </Card>

        {/* ✅ PRODUITS : recherche + liste + CRUD */}
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Produits</div>
              <div className="text-xs text-[var(--muted)]">
                Recherche / modification / création. (Le Catalogue PDF est plus bas)
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={load} loading={loading}>Rafraîchir</Button>
              <Button onClick={openNewProduct} disabled={isAllServices}>Nouveau produit</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[220px] flex-1">
              {services?.length > 0 && (
                <Select
                  label="Service"
                  value={serviceId || ""}
                  onChange={(value) => selectService(value)}
                  options={[
                    ...serviceOptions,
                    ...(services.length > 1 ? [{ value: "all", label: "Tous les services (lecture)" }] : []),
                  ]}
                />
              )}
            </div>

            <div className="min-w-[220px] flex-[2]">
              <Input
                label="Recherche produit"
                placeholder={ux.searchHint}
                value={search}
                inputRef={searchInputRef}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (err) setErr("");
                }}
                rightSlot={
                  barcodeEnabled ? <ScannerButton onClick={() => openScannerFor("search")} label="Scanner (recherche)" /> : null
                }
              />
            </div>

            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setSearch("");
                pushToast?.({ message: "Recherche réinitialisée.", type: "info" });
                window.setTimeout(() => searchInputRef.current?.focus?.(), 50);
              }}
              disabled={loading}
            >
              Réinitialiser
            </Button>
          </div>

          {isAllServices && (
            <div className="text-sm text-[var(--muted)]">
              Mode lecture multi-services : sélectionnez un service précis pour ajouter ou modifier.
            </div>
          )}
          {err && <div className="text-sm text-red-700 dark:text-red-200">{err}</div>}
        </Card>

        <Card className="p-6 space-y-4" ref={resultsRef}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-[var(--muted)]">Résultats</div>
              <div className="text-lg font-semibold text-[var(--text)]">{filteredItems.length} élément(s)</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span>Page {page} / {totalPages}</span>
              <span>Affichage {paginatedItems.length} / {filteredItems.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-[var(--muted)]">{ux.emptyProducts}</div>
          ) : (
            <>
              <div className="sm:hidden space-y-2">
                {paginatedItems.map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)] truncate">{p.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {p.category || "—"} {isAllServices ? `· ${p.__service_name || readableServiceName(p.service)}` : ""}
                        </div>
                      </div>
                      {!isAllServices && (
                        <Button size="sm" variant="secondary" onClick={() => openEditProduct(p)}>
                          Modifier
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Identifiant</div>
                        <div className="font-semibold text-[var(--text)] break-anywhere">
                          {p.barcode || p.internal_sku || "—"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Unité</div>
                        <div className="font-semibold text-[var(--text)]">{p.unit || "—"}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface)] sticky top-0">
                    <tr className="text-[var(--muted)]">
                      <th className="text-left px-4 py-3">{wording.itemLabel}</th>
                      <th className="text-left px-4 py-3">{wording.categoryLabel}</th>
                      {isAllServices && <th className="text-left px-4 py-3">Service</th>}
                      <th className="text-left px-4 py-3">
                        {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                      </th>
                      {(purchaseEnabled || sellingEnabled) && (
                        <th className="text-left px-4 py-3">{tvaEnabled ? "Prix & TVA" : "Prix"}</th>
                      )}
                      {showUnit && <th className="text-left px-4 py-3">Unité</th>}
                      {!isAllServices && <th className="text-left px-4 py-3">Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedItems.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--accent)]/10"}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--text)]">{p.name}</div>
                          {p.product_role && (
                            <div className="text-xs text-[var(--muted)]">
                              Type : {productRoleLabels[p.product_role] || p.product_role}
                            </div>
                          )}
                          {(p.variant_name || p.variant_value) && (
                            <div className="text-xs text-[var(--muted)]">
                              Variante : {[p.variant_name, p.variant_value].filter(Boolean).join(" ")}
                            </div>
                          )}
                          {p.min_qty !== null && p.min_qty !== undefined && p.min_qty !== "" && (
                            <div className="text-xs text-[var(--muted)]">Stock min : {p.min_qty}</div>
                          )}
                          {(p.brand || p.supplier) && (
                            <div className="text-xs text-[var(--muted)]">
                              {[p.brand, p.supplier].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-[var(--muted)]">{p.category || "—"}</td>

                        {isAllServices && (
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {p.__service_name || readableServiceName(p.service)}
                          </td>
                        )}

                        <td className="px-4 py-3 text-[var(--muted)]">
                          <div className="space-y-1">
                            <div>{p.barcode || "—"}</div>
                            {skuEnabled && <div className="text-xs text-[var(--muted)]">{p.internal_sku || "SKU —"}</div>}
                          </div>
                        </td>

                        {(purchaseEnabled || sellingEnabled) && (
                          <td className="px-4 py-3 text-[var(--muted)]">
                            <div className="space-y-1">
                              {purchaseEnabled && <div>Achat: {formatCurrency(p.purchase_price, currencyCode)}</div>}
                              {sellingEnabled && (
                                <div className="text-xs text-[var(--muted)]">
                                  Vente: {formatCurrency(p.selling_price, currencyCode)}
                                  {tvaEnabled ? ` · TVA ${p.tva ?? "—"}%` : ""}
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {showUnit && <td className="px-4 py-3 text-[var(--muted)]">{p.unit || "—"}</td>}

                        {!isAllServices && (
                          <td className="px-4 py-3 text-[var(--muted)]">
                            <Button size="sm" variant="secondary" onClick={() => openEditProduct(p)}>
                              Modifier
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {filteredItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                ← Précédent
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                Suivant →
              </Button>
            </div>
          )}
        </Card>

        {/* ✅ CATALOGUE PDF : section claire + live preview */}
        <CatalogPdfSection
          canPdfCatalog={canPdfCatalog}
          pdfLimit={pdfLimit}
          services={services}
          pdfService={pdfService}
          setPdfService={setPdfService}
          pdfServiceOptions={pdfServiceOptions}
          pdfQuery={pdfQuery}
          setPdfQuery={setPdfQuery}
          pdfPreviewItems={pdfPreviewItems}
          pdfPreviewCount={pdfPreviewCount}
          categories={categories}
          pdfCategory={pdfCategory}
          setPdfCategory={setPdfCategory}
          categoryOptions={categoryOptions}
          wording={wording}
          pdfFieldOptions={pdfFieldOptions}
          pdfFields={pdfFields}
          togglePdfField={togglePdfField}
          pdfBranding={pdfBranding}
          setPdfBranding={setPdfBranding}
          pdfTemplate={pdfTemplate}
          setPdfTemplate={setPdfTemplate}
          pdfLogo={pdfLogo}
          setPdfLogo={setPdfLogo}
          templateOptions={templateOptions}
          generateCatalogPdf={generateCatalogPdf}
          pdfLoading={pdfLoading}
          pdfError={pdfError}
          pdfErrorCode={pdfErrorCode}
          clearPdfError={() => {
            setPdfError("");
            setPdfErrorCode("");
          }}
          // ✅ bouton scanner "vrai icon"
          onOpenScanner={() => openScannerFor("pdfQuery")}
          barcodeEnabled={barcodeEnabled}
        />

        {/* Drawer ajout/modif produit */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={isEditing ? `Modifier ${itemLabelLower}` : `Nouveau ${itemLabelLower}`}
          footer={
            <div className="flex flex-wrap gap-2 justify-between w-full">
              {isEditing ? (
                <Button variant="danger" type="button" onClick={deleteProduct} loading={deleteLoading}>
                  Supprimer
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
                  Annuler
                </Button>
                {!isEditing && (
                  <Button variant="secondary" type="button" onClick={() => submit(null, { keepOpen: true })} disabled={isAllServices}>
                    Enregistrer + nouveau
                  </Button>
                )}
                <Button type="button" onClick={() => submit(null)} loading={loading} disabled={isAllServices}>
                  Enregistrer
                </Button>
              </div>
            </div>
          }
        >
          <form className="space-y-4" onSubmit={submit}>
            {isAllServices && (
              <div className="text-sm text-[var(--muted)]">
                Sélectionnez un service précis pour ajouter ou modifier un produit.
              </div>
            )}

            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Essentiel</div>
            <div className="grid gap-3">
              <Input
                label={wording.itemLabel}
                placeholder={placeholders.name}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />

              {categories.length > 0 ? (
                <Select
                  label={wording.categoryLabel}
                  value={form.category}
                  onChange={(value) => setForm((p) => ({ ...p, category: value }))}
                  options={categoryOptions}
                  helper="Catégories du service sélectionné."
                />
              ) : (
                <Input
                  label={wording.categoryLabel}
                  placeholder={categoryPlaceholder}
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  helper={helpers.category}
                />
              )}

              {barcodeEnabled && (
                <Input
                  label={wording.barcodeLabel}
                  placeholder={`Scannez ou saisissez ${wording.barcodeLabel || "le code-barres"}`}
                  value={form.barcode}
                  inputRef={barcodeInputRef}
                  onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                  helper={helpers.barcode}
                  rightSlot={<ScannerButton onClick={() => openScannerFor("barcode")} label="Scanner (code-barres)" />}
                />
              )}

              {skuEnabled && (
                <Input
                  label={wording.skuLabel}
                  placeholder={placeholders.sku}
                  value={form.internal_sku}
                  onChange={(e) => setForm((p) => ({ ...p, internal_sku: e.target.value }))}
                  helper={!form.barcode && !form.internal_sku ? helpers.sku : "Optionnel"}
                  rightSlot={
                    barcodeEnabled ? <ScannerButton onClick={() => openScannerFor("sku")} label="Scanner (SKU)" /> : null
                  }
                />
              )}

              {showUnit && (
                <Select
                  label={unitLabel}
                  value={form.unit}
                  onChange={(value) => setForm((p) => ({ ...p, unit: value }))}
                  options={unitSelectOptions}
                />
              )}

              {itemTypeEnabled && (
                <Select
                  label="Type d’article"
                  value={form.product_role}
                  onChange={(value) => setForm((p) => ({ ...p, product_role: value }))}
                  options={productRoleSelectOptions}
                  helper={helpers.productRole || "Matière première = coût, produit fini = vente."}
                />
              )}
            </div>

            {(variantsEnabled || lotEnabled || dlcEnabled || openEnabled || multiUnitEnabled) && (
              <details className="rounded-2xl border border-[var(--border)] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                  Options métier
                </summary>
                <div className="mt-3 grid gap-3">
                  {variantsEnabled && (
                    <>
                      <Input
                        label="Variante (libellé)"
                        placeholder="Ex. Taille ou Couleur"
                        value={form.variant_name}
                        onChange={(e) => setForm((p) => ({ ...p, variant_name: e.target.value }))}
                      />
                      <Input
                        label="Variante (valeur)"
                        placeholder="Ex. M, Bleu, 75cl"
                        value={form.variant_value}
                        onChange={(e) => setForm((p) => ({ ...p, variant_value: e.target.value }))}
                      />
                    </>
                  )}

                  {multiUnitEnabled && (
                    <>
                      <Input
                        label="Conversion (facteur)"
                        type="number"
                        min={0}
                        step="0.0001"
                        placeholder="Ex. 0.75"
                        value={form.conversion_factor}
                        onChange={(e) => setForm((p) => ({ ...p, conversion_factor: e.target.value }))}
                      />
                      <Select
                        label="Unité convertie"
                        value={form.conversion_unit}
                        onChange={(value) => setForm((p) => ({ ...p, conversion_unit: value }))}
                        options={conversionSelectOptions}
                      />
                    </>
                  )}

                  {lotEnabled && (
                    <Input
                      label="Lot / Batch"
                      placeholder="Ex. LOT-2025-12"
                      value={form.lot_number}
                      onChange={(e) => setForm((p) => ({ ...p, lot_number: e.target.value }))}
                    />
                  )}

                  {dlcEnabled && (
                    <Input
                      label="DLC"
                      type="date"
                      value={form.dlc}
                      onChange={(e) => setForm((p) => ({ ...p, dlc: e.target.value }))}
                    />
                  )}

                  {openEnabled && (
                    <>
                      <Select
                        label="Statut"
                        value={form.container_status}
                        onChange={(value) => setForm((p) => ({ ...p, container_status: value }))}
                        options={containerStatusOptions}
                      />
                      {form.container_status === "OPENED" && (
                        <>
                          <Input
                            label="Pack (taille)"
                            type="number"
                            step="0.01"
                            placeholder="Ex. 0.75"
                            value={form.pack_size}
                            onChange={(e) => setForm((p) => ({ ...p, pack_size: e.target.value }))}
                          />
                          <Input
                            label="Unité pack"
                            placeholder="Ex. l, kg"
                            value={form.pack_uom}
                            onChange={(e) => setForm((p) => ({ ...p, pack_uom: e.target.value }))}
                          />
                          <Input
                            label="Reste (quantité)"
                            type="number"
                            step="0.01"
                            value={form.remaining_qty}
                            onChange={(e) => setForm((p) => ({ ...p, remaining_qty: e.target.value }))}
                          />
                          <Input
                            label="Reste (fraction 0-1)"
                            type="number"
                            step="0.1"
                            min={0}
                            max={1}
                            value={form.remaining_fraction}
                            onChange={(e) => setForm((p) => ({ ...p, remaining_fraction: e.target.value }))}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              </details>
            )}

            {(purchaseEnabled || sellingEnabled) && (
              <details className="rounded-2xl border border-[var(--border)] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                  Prix & TVA
                </summary>
                <div className="mt-3 grid gap-3">
                  {purchaseEnabled && (
                    <Input
                      label={`Prix d’achat HT (${currencyText})`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.purchase_price}
                      onChange={(e) => setForm((p) => ({ ...p, purchase_price: e.target.value }))}
                      helper={priceRecommended && !form.purchase_price ? "Recommandé pour des stats plus fiables." : "Optionnel"}
                    />
                  )}
                  {sellingEnabled && (
                    <Input
                      label={`Prix de vente HT (${currencyText})`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.selling_price}
                      onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                      helper={priceRecommended && !form.selling_price ? "Recommandé pour exports et pilotage." : "Optionnel"}
                    />
                  )}
                  {tvaEnabled && (purchaseEnabled || sellingEnabled) && (
                    <Select
                      label="TVA"
                      value={form.tva}
                      onChange={(value) => setForm((p) => ({ ...p, tva: value }))}
                      options={tvaSelectOptions}
                    />
                  )}
                </div>
              </details>
            )}

            <details className="rounded-2xl border border-[var(--border)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                Stock & informations
              </summary>
              <div className="mt-3 grid gap-3">
                {canStockAlerts && (
                  <Input
                    label="Stock minimum (alerte)"
                    type="number"
                    min={0}
                    value={form.min_qty}
                    onChange={(e) => setForm((p) => ({ ...p, min_qty: e.target.value }))}
                    helper="Optionnel : seuil pour alerte stock."
                  />
                )}
                <Input
                  label={brandLabel}
                  placeholder={placeholders.brand || "Ex. Marque X"}
                  value={form.brand}
                  onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                />
                <Input
                  label={supplierLabel}
                  placeholder={placeholders.supplier || "Ex. Fournisseur X"}
                  value={form.supplier}
                  onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                />
                <Input
                  label="Notes internes"
                  placeholder={placeholders.notes || "Ex. Rotation lente, saisonnier, fragile…"}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </details>
          </form>
        </Drawer>
      </div>
    </PageTransition>
  );
}
