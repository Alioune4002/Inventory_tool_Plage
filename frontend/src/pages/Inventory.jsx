// frontend/src/pages/Inventory.jsx
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { loadOfflineCache, saveOfflineCache } from "../lib/offlineCache";
import PageTransition from "../components/PageTransition";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";
import Skeleton from "../ui/Skeleton";
import Select from "../ui/Select";
import Drawer from "../ui/Drawer";
import { useToast } from "../app/ToastContext";
import { ScanLine } from "lucide-react";
const BarcodeScannerModal = React.lazy(() => import("../components/BarcodeScannerModal"));
import { getWording, getUxCopy, getPlaceholders, getFieldHelpers, getLossReasons } from "../lib/labels";
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";
import { useEntitlements } from "../app/useEntitlements";
import { currencyLabel } from "../lib/currency";

export default function Inventory() {
  const {
    serviceId,
    services,
    selectService,
    loading: authLoading,
    serviceFeatures,
    countingMode,
    tenant,
    serviceProfile,
  } = useAuth();

  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();
  const currencyText = currencyLabel(tenant?.currency_code || "EUR");

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [offlineData, setOfflineData] = useState(false);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastFound, setLastFound] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chronoEnabled, setChronoEnabled] = useState(false);
  const [chronoRunning, setChronoRunning] = useState(false);
  const [chronoSeconds, setChronoSeconds] = useState(0);
  const [chronoTarget, setChronoTarget] = useState(50);

  const [highlightCode, setHighlightCode] = useState("");
  const highlightTimeoutRef = useRef(null);
  const rowRefs = useRef(new Map());
  const tableWrapRef = useRef(null);

  const nameInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [qtyEdits, setQtyEdits] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef(null);

  const [quick, setQuick] = useState({
    name: "",
    category: "",
    quantity: "",
    barcode: "",
    internal_sku: "",
    variant_name: "",
    variant_value: "",
    min_qty: "",
    conversion_unit: "",
    conversion_factor: "",
    product_role: "",
    purchase_price: "",
    selling_price: "",
    tva: "20",
    dlc: "",
    unit: "pcs",
    container_status: "SEALED",
    pack_size: "",
    pack_uom: "",
    remaining_qty: "",
    remaining_fraction: "",
    lotNumber: "",
    comment: "",
    loss_quantity: "",
    loss_reason: "breakage",
    loss_note: "",
  });
  const isEditing = Boolean(editItem);

  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;

  const familyId = useMemo(() => resolveFamilyId(serviceType, serviceDomain), [serviceType, serviceDomain]);
  const familyMeta = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const familyIdentifiers = familyMeta?.identifiers ?? {};
  const familyModules = familyMeta?.modules ?? [];

  const getFeatureFlag = (key, fallback = false) => {
    const cfg = serviceFeatures?.[key];
    if (cfg && typeof cfg.enabled === "boolean") return cfg.enabled;
    return fallback;
  };

  const wording = getWording(serviceType, serviceDomain);
  const itemLabel = wording.itemLabel || "Élément";
  const itemLabelLower = itemLabel.toLowerCase();
  const barcodeLabel = wording.barcodeLabel || "code-barres";
  const ux = getUxCopy(serviceType, serviceDomain);
  const placeholders = getPlaceholders(serviceType, serviceDomain);
  const helpers = getFieldHelpers(serviceType, serviceDomain);

  const lossReasons = useMemo(
    () => getLossReasons(serviceType, serviceDomain, serviceFeatures),
    [serviceType, serviceDomain, serviceFeatures]
  );

  const categoryPlaceholder = placeholders.category || `Ex. ${familyMeta.defaults?.categoryLabel || "Catégorie"}`;
  const unitLabel = familyMeta.defaults?.unitLabel ? `Unité (${familyMeta.defaults.unitLabel})` : "Unité";

  const isAllServices = services.length > 1 && String(serviceId) === "all";
  const serviceOptions = useMemo(() => {
    const base = services.map((s) => ({ value: s.id, label: s.name }));
    if (services.length > 1) {
      return [...base, { value: "all", label: "Tous les services (lecture)" }];
    }
    return base;
  }, [services]);
  const categoryOptions = useMemo(() => {
    if (!categories.length) return [];
    return [{ value: "", label: "Aucune" }, ...categories.map((c) => ({ value: c.name, label: c.name }))];
  }, [categories]);

  const dlcCfg = serviceFeatures?.dlc || {};
  const priceCfg = serviceFeatures?.prices || {};
  const purchaseEnabled = priceCfg.purchase_enabled !== false;
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const tvaEnabled = serviceFeatures?.tva?.enabled !== false;
  const barcodeEnabled = getFeatureFlag("barcode", familyIdentifiers.barcode ?? true);
  const skuEnabled = getFeatureFlag("sku", familyIdentifiers.sku ?? true);
  const lotEnabled = getFeatureFlag("lot", familyModules.includes("lot"));
  const dlcEnabled = getFeatureFlag("dlc", familyModules.includes("expiry"));
  const dlcRecommended = !!dlcCfg.recommended;
  const variantsEnabled = getFeatureFlag("variants", familyModules.includes("variants"));
  const multiUnitEnabled = getFeatureFlag("multi_unit", familyModules.includes("multiUnit"));

  const openEnabled = getFeatureFlag("open_container_tracking", familyModules.includes("opened"));
  const itemTypeEnabled = getFeatureFlag("item_type", familyModules.includes("itemType"));
  const showOpenFields = openEnabled;
  const canStockAlerts = Boolean(entitlements?.entitlements?.alerts_stock);
  const nextAvailable =
    categories.length > 0 ||
    dlcEnabled ||
    purchaseEnabled ||
    sellingEnabled ||
    (tvaEnabled && (purchaseEnabled || sellingEnabled));
  const advancedExtras = canStockAlerts || variantsEnabled || multiUnitEnabled || lotEnabled || openEnabled || itemTypeEnabled;
  const hasExtraSteps = nextAvailable || advancedExtras;
  const addCtaEssentialLabel = isEditing
    ? "Mettre à jour"
    : hasExtraSteps && !showNext && !showAdvanced
      ? "Ajouter / Suivant"
      : "Ajouter";
  const addCtaNextLabel = isEditing
    ? "Mettre à jour"
    : advancedExtras && !showAdvanced
      ? "Ajouter / Suivant"
      : "Ajouter";
  const addCtaAdvancedLabel = isEditing ? "Mettre à jour" : "Ajouter";
  const renderCta = (label) => (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <Button type="submit" loading={loading}>
        {label}
      </Button>
      {isEditing && (
        <Button variant="secondary" type="button" onClick={resetQuick}>
          Annuler l’édition
        </Button>
      )}
    </div>
  );

  const productRoleOptions = [
    { value: "", label: "Non précisé" },
    { value: "raw_material", label: "Matière première" },
    { value: "finished_product", label: "Produit fini" },
    { value: "homemade_prep", label: "Préparation maison" },
  ];
  const vatOptions = ["0", "5.5", "10", "20"];

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);
  const conversionUnitOptions = ["pcs", "kg", "g", "l", "ml"];
  const quantityStep = countingMode === "unit" ? 1 : 0.01;
  const unitSelectOptions = useMemo(
    () => unitOptions.map((u) => ({ value: u, label: u })),
    [unitOptions]
  );
  const conversionSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...conversionUnitOptions.map((u) => ({ value: u, label: u }))],
    [conversionUnitOptions]
  );
  const lossReasonOptions = useMemo(
    () => lossReasons.map((r) => ({ value: r.value, label: r.label })),
    [lossReasons]
  );
  const productRoleSelectOptions = useMemo(
    () => productRoleOptions.map((r) => ({ value: r.value, label: r.label })),
    [productRoleOptions]
  );
  const tvaOptions = useMemo(
    () => vatOptions.map((rate) => ({ value: rate, label: `${rate}%` })),
    [vatOptions]
  );
  const containerStatusOptions = [
    { value: "SEALED", label: "Non entamé" },
    { value: "OPENED", label: "Entamé" },
  ];

  useEffect(() => {
    setQuick((prev) => {
      const next = { ...prev };
      if (countingMode === "weight" && !["kg", "g"].includes(prev.unit)) next.unit = "kg";
      else if (countingMode === "volume" && !["l", "ml"].includes(prev.unit)) next.unit = "l";
      else if (countingMode === "unit") next.unit = "pcs";
      return next;
    });
  }, [countingMode]);

  useEffect(() => {
    if (!lossReasons.length) return;
    setQuick((prev) => {
      if (lossReasons.some((r) => r.value === prev.loss_reason)) return prev;
      return { ...prev, loss_reason: lossReasons[0].value };
    });
  }, [lossReasons]);

  useEffect(() => {
    if (!chronoRunning) return;
    const id = window.setInterval(() => {
      setChronoSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [chronoRunning]);

  useEffect(() => {
    const loadCategories = async () => {
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
    loadCategories();
  }, [serviceId, isAllServices]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!suggestionsRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!serviceId || isAllServices) {
      setSuggestions([]);
      return;
    }
    const query = (quick.name || "").trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.get(`/api/products/search/?q=${encodeURIComponent(query)}&service=${serviceId}`);
        const list = Array.isArray(res.data) ? res.data : [];
        setSuggestions(list);
        setSuggestionsOpen(Boolean(list.length));
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [quick.name, serviceId, isAllServices]);

  const load = async () => {
    if (!serviceId && !isAllServices) return;

    setLoading(true);
    setErr("");
    setOfflineData(false);

    const cacheKey = `inventory:${month}:${isAllServices ? "all" : serviceId || "none"}`;

    try {
      if (isAllServices) {
        const calls = services.map((s) =>
          api
            .get(`/api/products/?month=${month}&service=${s.id}`)
            .then((res) => ({ service: s, items: Array.isArray(res.data) ? res.data : [] }))
        );
        const results = await Promise.all(calls);
        const merged = results.flatMap((r) => r.items.map((it) => ({ ...it, __service_name: r.service.name })));
        setItems(merged);
        saveOfflineCache(cacheKey, merged);
      } else {
        const res = await api.get(`/api/products/?month=${month}&service=${serviceId}`);
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(list);
        saveOfflineCache(cacheKey, list);
      }
    } catch {
      if (!navigator.onLine) {
        const cached = loadOfflineCache(cacheKey);
        if (cached) {
          setItems(cached);
          setOfflineData(true);
          setErr("Mode hors ligne : données locales affichées.");
          return;
        }
      }
      setErr("Impossible de charger l’inventaire. Vérifiez votre connexion, votre token et le service sélectionné.");
      pushToast?.({ message: "Chargement inventaire impossible (auth ou service).", type: "error" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month]);

  const showIdentifierWarning = !quick.barcode && !quick.internal_sku && (barcodeEnabled || skuEnabled);
  const showDlcWarning = dlcEnabled && dlcRecommended && !quick.dlc;

  const isOpened = quick.container_status === "OPENED" && showOpenFields;

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.internal_sku?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!err) return undefined;
    const timer = window.setTimeout(() => setErr(""), 7000);
    return () => window.clearTimeout(timer);
  }, [err]);

  useEffect(() => {
    setPage(1);
  }, [search, totalPages]);

  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const resetQuick = () => {
    setQuick({
      name: "",
      category: "",
      quantity: "",
      barcode: "",
      internal_sku: "",
      variant_name: "",
      variant_value: "",
      min_qty: "",
      conversion_unit: "",
      conversion_factor: "",
      product_role: "",
      purchase_price: "",
      selling_price: "",
      tva: "20",
      dlc: "",
      unit: unitOptions[0],
      container_status: "SEALED",
      pack_size: "",
      pack_uom: "",
      remaining_qty: "",
      remaining_fraction: "",
      lotNumber: "",
      comment: "",
      loss_quantity: "",
      loss_reason: "breakage",
      loss_note: "",
    });
    setLastFound(null);
    setEditItem(null);
    setDrawerOpen(false);
    setShowNext(false);
    setShowAdvanced(false);
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  const bumpQuantity = (delta) => {
    setQuick((prev) => {
      const current = Number(prev.quantity || 0);
      const next = Math.max(0, current + delta);
      const rounded = Number.isFinite(next) ? Number(next.toFixed(3)) : 0;
      return { ...prev, quantity: String(rounded) };
    });
  };

  const focusQuantityInput = () => {
    window.setTimeout(() => {
      quantityInputRef.current?.focus?.();
    }, 120);
  };

  const fillQuickFromProduct = (product, { includeQuantity = false, focusQuantity = false } = {}) => {
    if (!product) return;
    setQuick((prev) => ({
      ...prev,
      name: product.name ?? prev.name,
      category: product.category ?? prev.category,
      quantity: includeQuantity ? String(product.quantity ?? "") : prev.quantity,
      barcode: product.barcode ?? prev.barcode,
      internal_sku: product.internal_sku ?? prev.internal_sku,
      variant_name: product.variant_name ?? prev.variant_name,
      variant_value: product.variant_value ?? prev.variant_value,
      min_qty: product.min_qty ?? prev.min_qty,
      conversion_unit: product.conversion_unit ?? prev.conversion_unit,
      conversion_factor: product.conversion_factor ?? prev.conversion_factor,
      product_role: product.product_role ?? prev.product_role,
      purchase_price: product.purchase_price ?? prev.purchase_price,
      selling_price: product.selling_price ?? prev.selling_price,
      tva: product.tva === null || product.tva === undefined ? prev.tva : String(product.tva),
      dlc: product.dlc ?? prev.dlc,
      unit: product.unit || prev.unit,
      container_status: product.container_status || prev.container_status,
      pack_size: product.pack_size ?? prev.pack_size,
      pack_uom: product.pack_uom ?? prev.pack_uom,
      remaining_qty: product.remaining_qty ?? prev.remaining_qty,
      remaining_fraction: product.remaining_fraction ?? prev.remaining_fraction,
      lotNumber: product.lot_number ?? prev.lotNumber,
      comment: product.notes ?? prev.comment,
      loss_quantity: "",
      loss_note: "",
    }));
    if (focusQuantity) focusQuantityInput();
  };

  const startEdit = (product) => {
    if (isAllServices) {
      pushToast?.({ message: "Sélectionnez un service pour modifier.", type: "warn" });
      return;
    }
    setEditItem(product);
    fillQuickFromProduct(product, { includeQuantity: true });
    setDrawerOpen(true);
  };

  const handleSuggestionSelect = (product) => {
    fillQuickFromProduct(product, { includeQuantity: true, focusQuantity: true });
    setSuggestionsOpen(false);
  };

  const addQuick = async (e) => {
    e.preventDefault();

    if (isAllServices) {
      pushToast?.({ message: `Sélectionnez un service pour ajouter un ${itemLabelLower}.`, type: "warn" });
      return;
    }
    if (!serviceId || !quick.name.trim()) {
      pushToast?.({ message: "Nom et service requis.", type: "error" });
      return;
    }
    if (quick.quantity === "" || Number.isNaN(Number(quick.quantity))) {
      pushToast?.({ message: "Veuillez renseigner une quantité comptée.", type: "error" });
      return;
    }

    const cleanedBarcode = (quick.barcode || "").trim();
    const cleanedSku = (quick.internal_sku || "").trim();
    const lossQuantity = Number(quick.loss_quantity);
    const shouldCreateLoss = Number.isFinite(lossQuantity) && lossQuantity > 0;
    const occurredAt = month ? `${month}-01T12:00:00Z` : undefined;
    const targetMonth = editItem?.inventory_month || month;
    const targetServiceId = editItem?.service || serviceId;

    const payload = {
      name: quick.name.trim(),
      category: quick.category || "",
      quantity: Number(quick.quantity),
      inventory_month: targetMonth,
      service: targetServiceId,
      unit: quick.unit || "pcs",
      notes: quick.comment || "",
    };

    if (variantsEnabled) {
      payload.variant_name = quick.variant_name || null;
      payload.variant_value = quick.variant_value || null;
    }
    if (quick.min_qty !== "") payload.min_qty = quick.min_qty;
    if (multiUnitEnabled) {
      payload.conversion_unit = quick.conversion_unit || null;
      payload.conversion_factor = quick.conversion_factor || null;
    }

    if (barcodeEnabled) payload.barcode = cleanedBarcode;
    else payload.barcode = "";

    if (skuEnabled) payload.internal_sku = cleanedSku || "";
    else payload.internal_sku = "";

    if (dlcEnabled) payload.dlc = quick.dlc || null;
    if (lotEnabled) payload.lot_number = quick.lotNumber || null;
    if (itemTypeEnabled) payload.product_role = quick.product_role || null;

    if (showOpenFields) {
      payload.container_status = quick.container_status || "SEALED";
      payload.pack_size = quick.pack_size || null;
      payload.pack_uom = quick.pack_uom || null;
      payload.remaining_qty = quick.remaining_qty || null;
      payload.remaining_fraction = quick.remaining_fraction || null;
    } else {
      payload.container_status = "SEALED";
      payload.pack_size = null;
      payload.pack_uom = null;
      payload.remaining_qty = null;
      payload.remaining_fraction = null;
    }

    if (purchaseEnabled) payload.purchase_price = quick.purchase_price || null;
    if (sellingEnabled) payload.selling_price = quick.selling_price || null;
    if (tvaEnabled && (purchaseEnabled || sellingEnabled)) {
      payload.tva = quick.tva === "" ? null : Number(quick.tva);
    }

    setLoading(true);
    try {
      const res = editItem
        ? await api.put(`/api/products/${editItem.id}/`, payload)
        : await api.post("/api/products/", payload);
      const warnings = res?.data?.warnings || [];
      const filteredWarnings = warnings.filter(
        (warning) =>
          !String(warning).toLowerCase().includes("prix d'achat") &&
          !String(warning).toLowerCase().includes("prix de vente")
      );
      const generatedSku =
        !editItem && skuEnabled && !cleanedSku && res?.data?.internal_sku ? res.data.internal_sku : "";

      if (filteredWarnings.length) pushToast?.({ message: filteredWarnings.join(" "), type: "warn" });
      else {
        pushToast?.({
          message: editItem ? "Comptage mis à jour." : "Comptage enregistré.",
          type: "success",
        });
      }
      if (generatedSku) {
        pushToast?.({ message: `SKU généré : ${generatedSku} (modifiable).`, type: "info" });
      }

      if (shouldCreateLoss && res?.data?.id) {
        try {
          await api.post("/api/losses/", {
            product: res.data.id,
            quantity: lossQuantity,
            reason: quick.loss_reason || "other",
            note: quick.loss_note || "",
            unit: quick.unit || "pcs",
            occurred_at: occurredAt,
          });
          pushToast?.({ message: "Perte enregistrée.", type: "info" });
        } catch {
          pushToast?.({ message: "Comptage OK, mais la perte n’a pas pu être enregistrée.", type: "warn" });
        }
      }

      resetQuick();
      await load();
    } catch (e2) {
      const apiMsg =
        e2?.friendlyMessage ||
        e2?.response?.data?.detail ||
        e2?.response?.data?.error ||
        "Ajout impossible (doublon, droits ou limite de plan).";
      pushToast?.({ message: apiMsg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const buildPayloadFromItem = (item, overrides = {}) => {
    return {
      name: item?.name || "",
      category: item?.category || "",
      quantity: overrides.quantity ?? item?.quantity ?? 0,
      inventory_month: item?.inventory_month || month,
      service: item?.service || serviceId,
      unit: overrides.unit ?? item?.unit ?? "pcs",
      notes: overrides.notes ?? item?.notes ?? "",
      barcode: barcodeEnabled ? item?.barcode || "" : "",
      internal_sku: skuEnabled ? item?.internal_sku || "" : "",
      variant_name: item?.variant_name || "",
      variant_value: item?.variant_value || "",
      min_qty: item?.min_qty ?? "",
      conversion_unit: item?.conversion_unit || "",
      conversion_factor: item?.conversion_factor ?? "",
      product_role: item?.product_role || "",
      dlc: item?.dlc || null,
      lot_number: item?.lot_number || null,
      container_status: item?.container_status || "SEALED",
      pack_size: item?.pack_size ?? null,
      pack_uom: item?.pack_uom ?? null,
      remaining_qty: item?.remaining_qty ?? null,
      remaining_fraction: item?.remaining_fraction ?? null,
      purchase_price: item?.purchase_price ?? null,
      selling_price: item?.selling_price ?? null,
      tva: item?.tva ?? null,
      brand: item?.brand ?? null,
      supplier: item?.supplier ?? null,
    };
  };

  const saveInlineQuantity = async (item, nextValue) => {
    if (!item || isAllServices) return;
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      pushToast?.({ message: "Quantité invalide.", type: "error" });
      return;
    }
    try {
      await api.put(`/api/products/${item.id}/`, buildPayloadFromItem(item, { quantity: parsed }));
      setQtyEdits((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      pushToast?.({ message: "Quantité mise à jour.", type: "success" });
      await load();
    } catch (e) {
      pushToast?.({
        message:
          e?.response?.data?.detail || e?.response?.data?.error || "Mise à jour impossible.",
        type: "error",
      });
    }
  };

  const submitQuickFromDrawer = () => {
    addQuick({ preventDefault: () => {} });
  };

  const lookupBarcode = async (overrideBarcode) => {
    const code = String(overrideBarcode ?? quick.barcode ?? "").trim();

    if (!code) {
      pushToast?.({ message: `Scannez ou saisissez un ${wording.barcodeLabel || "code-barres"} d’abord.`, type: "warn" });
      return { kind: "none" };
    }

    try {
      const res = await api.get(`/api/products/lookup/?barcode=${encodeURIComponent(code)}`);
      if (res?.data?.found && res.data.product) {
        const p = res.data.product;
        setQuick((prev) => ({
          ...prev,
          barcode: code,
          name: p.name || prev.name,
          category: p.category || prev.category,
          quantity: String(p.quantity ?? prev.quantity ?? ""),
          internal_sku: p.internal_sku || prev.internal_sku,
          variant_name: p.variant_name || prev.variant_name,
          variant_value: p.variant_value || prev.variant_value,
          min_qty: p.min_qty ?? prev.min_qty,
          conversion_unit: p.conversion_unit || prev.conversion_unit,
          conversion_factor: p.conversion_factor ?? prev.conversion_factor,
          product_role: p.product_role || prev.product_role,
          purchase_price: p.purchase_price ?? prev.purchase_price,
          selling_price: p.selling_price ?? prev.selling_price,
          tva: p.tva === null || p.tva === undefined ? prev.tva : String(p.tva),
          dlc: p.dlc || prev.dlc,
          unit: p.unit || prev.unit,
          lotNumber: p.lot_number || prev.lotNumber,
        }));
        focusQuantityInput();
        setLastFound({
          type: "local",
          product: res.data.product,
          recent: res.data.recent || [],
          history: res.data.history || [],
        });
        pushToast?.({ message: `Fiche ${itemLabelLower} pré-remplie.`, type: "success" });
        return { kind: "local", data: res.data.product };
      }

      if (res?.data?.suggestion) {
        setLastFound({ type: "external", suggestion: res.data.suggestion });
        pushToast?.({ message: "Suggestion trouvée : vérifiez puis complétez.", type: "info" });
        return { kind: "external", data: res.data.suggestion };
      }

      if (res?.data?.off_error) {
        pushToast?.({ message: res.data.off_error, type: "info" });
      }

      setLastFound(null);
      pushToast?.({ message: "Aucune correspondance trouvée.", type: "info" });
      return { kind: "none" };
    } catch {
      setLastFound(null);
      pushToast?.({ message: `Aucun ${itemLabelLower} trouvé pour ce ${barcodeLabel}.`, type: "info" });
      return { kind: "none" };
    }
  };

  const armHighlightClear = () => {
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightCode(""), 3000);
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!highlightCode) return;

    const code = highlightCode.toLowerCase();

    const indexInFiltered = filtered.findIndex(
      (p) =>
        String(p.barcode || "").toLowerCase() === code ||
        String(p.internal_sku || "").toLowerCase() === code
    );
    if (indexInFiltered >= 0) {
      const targetPage = Math.floor(indexInFiltered / PAGE_SIZE) + 1;
      if (targetPage !== page) {
        setPage(targetPage);
        return;
      }
    }

    const exact = paginatedInventory.find(
      (p) =>
        String(p.barcode || "").toLowerCase() === code ||
        String(p.internal_sku || "").toLowerCase() === code
    );
    if (!exact) return;

    const rowKey =
      (exact.barcode && String(exact.barcode).toLowerCase()) ||
      (exact.internal_sku && String(exact.internal_sku).toLowerCase()) ||
      String(exact.id);

    window.requestAnimationFrame(() => {
      const el = rowRefs.current.get(rowKey);
      if (el?.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      else tableWrapRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }, [highlightCode, filtered, paginatedInventory, page]);

  const onScannerDetected = async (code) => {
    const cleaned = String(code || "").trim();
    if (!cleaned) return;

    setScannerOpen(false);
    setQuick((p) => ({ ...p, barcode: cleaned }));

    setSearch(cleaned);
    setHighlightCode(cleaned);
    armHighlightClear();

    const result = await lookupBarcode(cleaned);

    if (result.kind === "none") {
      setQuick((prev) => ({
        ...prev,
        barcode: cleaned,
        name: "",
      }));

      pushToast?.({
        message: "Produit non trouvé. Code-barres renseigné : complète le nom puis ajoute.",
        type: "info",
      });

      window.setTimeout(() => {
        const el = nameInputRef.current;
        if (el?.focus) el.focus();
        else document.querySelector("input")?.focus?.();
      }, 150);
    }
  };

  const getRowKey = (p) =>
    (p.barcode && String(p.barcode).toLowerCase()) ||
    (p.internal_sku && String(p.internal_sku).toLowerCase()) ||
    String(p.id);

  const isRowHighlighted = (p) => {
    if (!highlightCode) return false;
    const code = highlightCode.toLowerCase();
    return (
      String(p.barcode || "").toLowerCase() === code ||
      String(p.internal_sku || "").toLowerCase() === code
    );
  };

  const renderIdentifier = (p) => p.barcode || p.internal_sku || "—";

  const chronoCount = items.length;
  const chronoRemaining = Math.max(0, chronoTarget - chronoCount);
  const chronoProgress = chronoTarget ? Math.min(1, chronoCount / chronoTarget) : 0;

  const formatChrono = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleChrono = () => {
    if (chronoEnabled) {
      setChronoRunning(false);
      setChronoSeconds(0);
    }
    setChronoEnabled((prev) => !prev);
  };

  const resetChrono = () => {
    setChronoRunning(false);
    setChronoSeconds(0);
  };

  return (
    <PageTransition>
      <Helmet>
        <title>{ux.inventoryTitle} | StockScan</title>
        <meta name="description" content={ux.inventoryIntro} />
      </Helmet>

      {scannerOpen && (
        <Suspense fallback={null}>
          <BarcodeScannerModal
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={onScannerDetected}
          />
        </Suspense>
      )}

      <div className="grid gap-4 min-w-0">
        <Card className="p-6 space-y-4 min-w-0">
          <div className="text-sm text-[var(--muted)]">Inventaire</div>
          <div className="text-2xl font-black tracking-tight text-[var(--text)]">{ux.inventoryTitle}</div>
          <p className="text-[var(--muted)] text-sm">{ux.inventoryIntro}</p>
          <p className="text-xs text-[var(--muted)]">
            Inventaire = comptage du mois. Le catalogue reste dans l’onglet Produits.
          </p>
          {offlineData && (
            <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-400/30 rounded-full px-3 py-1 w-fit">
              Mode hors ligne : données locales affichées
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3 items-center min-w-0">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {services?.length > 0 && (
              <Select
                label="Service"
                value={serviceId || ""}
                onChange={(value) => selectService(value)}
                options={serviceOptions}
                ariaLabel="Sélectionner un service"
              />
            )}

            <Input
              label="Recherche"
              placeholder={ux.searchHint}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (err) setErr("");
              }}
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-soft min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{ux.quickAddTitle}</div>
                <div className="text-xs text-[var(--muted)]">
                  Comptage rapide : faites l’essentiel, puis ajoutez les infos utiles si besoin.
                </div>
              </div>
              {isEditing && (
                <span className="text-xs rounded-full border border-blue-200/60 dark:border-blue-400/30 bg-blue-50/70 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 px-3 py-1">
                  Mode édition
                </span>
              )}
            </div>

            {isAllServices ? (
              <div className="mt-3 text-sm text-[var(--muted)]">
                Sélectionnez un service pour ajouter. En mode “Tous les services”, l’ajout est désactivé.
              </div>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={addQuick}>
                <fieldset disabled={loading || authLoading} className="space-y-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Essentiel</div>
                  <div className="grid gap-3 items-end md:grid-cols-2 lg:grid-cols-6">
                    {barcodeEnabled && (
                      <div className="lg:col-span-2">
                        <Input
                          label={wording.barcodeLabel}
                          placeholder={`Scannez ou saisissez ${wording.barcodeLabel || "le code-barres"}`}
                          value={quick.barcode}
                          onChange={(e) => setQuick((p) => ({ ...p, barcode: e.target.value }))}
                          helper={helpers.barcode}
                          rightSlot={
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="text-xs font-semibold text-[var(--text)] px-2 py-1 rounded-full border border-[var(--border)] hover:bg-[var(--accent)]/10 inline-flex items-center gap-1"
                                onClick={() => setScannerOpen(true)}
                                title="Scanner"
                              >
                                <ScanLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="text-xs font-semibold text-[var(--text)] px-2 py-1 rounded-full border border-[var(--border)] hover:bg-[var(--accent)]/10"
                                onClick={() => lookupBarcode()}
                                disabled={!String(quick.barcode || "").trim()}
                              >
                                Chercher
                              </button>
                            </div>
                          }
                        />
                      </div>
                    )}

                    {skuEnabled && (
                      <Input
                        label={wording.skuLabel}
                        placeholder={placeholders.sku}
                        value={quick.internal_sku}
                        onChange={(e) => setQuick((p) => ({ ...p, internal_sku: e.target.value }))}
                        helper={showIdentifierWarning ? helpers.sku : "Optionnel"}
                      />
                    )}

                    <div className="relative min-w-0 lg:col-span-2" ref={suggestionsRef}>
                      <Input
                        label={wording.itemLabel}
                        placeholder={placeholders.name}
                        value={quick.name}
                        onChange={(e) => {
                          setQuick((p) => ({ ...p, name: e.target.value }));
                          if (!suggestionsOpen && suggestions.length) setSuggestionsOpen(true);
                        }}
                        onFocus={() => suggestions.length && setSuggestionsOpen(true)}
                        required
                        inputRef={nameInputRef}
                      />
                      {suggestionsOpen && suggestions.length > 0 && (
                        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft">
                          {suggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--accent)]/15 transition"
                              onClick={() => handleSuggestionSelect(s)}
                            >
                              <div className="text-sm font-semibold text-[var(--text)]">{s.name}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {(s.category || "Sans catégorie") + " · " + (s.barcode || s.internal_sku || "—")}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">Quantité</span>
                      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--accent)]/15"
                          onClick={() => bumpQuantity(-quantityStep)}
                        >
                          −
                        </button>
                        <input
                          ref={quantityInputRef}
                          type="number"
                          min={0}
                          step={quantityStep}
                          value={quick.quantity}
                          onChange={(e) => setQuick((p) => ({ ...p, quantity: e.target.value }))}
                          className="w-full bg-transparent text-sm text-[var(--text)] outline-none text-center"
                          required
                        />
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--accent)]/15"
                          onClick={() => bumpQuantity(quantityStep)}
                        >
                          +
                        </button>
                      </div>
                      {lastFound?.type === "local" && lastFound?.product?.quantity !== undefined && (
                        <div className="text-xs text-[var(--muted)]">
                          Dernier comptage ({lastFound.product.inventory_month || "—"}) : {lastFound.product.quantity}{" "}
                          {lastFound.product.unit || ""}
                        </div>
                      )}
                    </div>

                    <Select
                      label={unitLabel}
                      value={quick.unit}
                      onChange={(value) => setQuick((p) => ({ ...p, unit: value }))}
                      options={unitSelectOptions}
                    />

                  </div>

                  <div className="flex flex-wrap gap-2 items-center text-xs text-[var(--muted)]">
                    {showIdentifierWarning && (
                      <span className="rounded-full border border-amber-200/70 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200 px-3 py-1">
                        Conseil : ajoutez un identifiant ({wording.identifierLabel || "code-barres ou SKU"}).
                      </span>
                    )}
                    {showDlcWarning && (
                      <span className="rounded-full border border-amber-200/70 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200 px-3 py-1">
                        DLC recommandée pour ce service.
                      </span>
                    )}
                  </div>

                  {nextAvailable && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setShowNext((prev) => !prev)}
                      >
                        {showNext ? "Masquer les infos utiles" : "Ajouter des infos utiles (+ prix, TVA, DLC…)"}
                      </Button>
                      <span>Optionnel mais recommandé pour des stats plus fiables.</span>
                    </div>
                  )}

                  {!showNext && !showAdvanced && renderCta(addCtaEssentialLabel)}

                  {showNext && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-3">
                      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Étape suivante</div>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {categories.length > 0 ? (
                          <Select
                            label={wording.categoryLabel}
                            value={quick.category}
                            onChange={(value) => setQuick((p) => ({ ...p, category: value }))}
                            options={categoryOptions}
                            helper="Catégories du service sélectionné."
                          />
                        ) : (
                          <Input
                            label={wording.categoryLabel}
                            placeholder={categoryPlaceholder}
                            value={quick.category}
                            onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
                            helper={helpers.category}
                          />
                        )}

                        {dlcEnabled && (
                          <Input
                            label="DLC"
                            type="date"
                            value={quick.dlc}
                            onChange={(e) => setQuick((p) => ({ ...p, dlc: e.target.value }))}
                            helper={showDlcWarning ? "Recommandée pour limiter les pertes." : "Optionnel"}
                          />
                        )}

                        {purchaseEnabled && (
                          <Input
                            label={`Prix d’achat HT (${currencyText})`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={quick.purchase_price}
                            onChange={(e) => setQuick((p) => ({ ...p, purchase_price: e.target.value }))}
                          />
                        )}

                        {sellingEnabled && (
                          <Input
                            label={`Prix de vente HT (${currencyText})`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={quick.selling_price}
                            onChange={(e) => setQuick((p) => ({ ...p, selling_price: e.target.value }))}
                          />
                        )}

                        {tvaEnabled && (purchaseEnabled || sellingEnabled) && (
                          <Select
                            label="TVA"
                            value={quick.tva}
                            onChange={(value) => setQuick((p) => ({ ...p, tva: value }))}
                            options={tvaOptions}
                          />
                        )}
                      </div>
                      {!showAdvanced && renderCta(addCtaNextLabel)}
                    </div>
                  )}

                  <details
                    className="rounded-2xl border border-[var(--border)] px-4 py-3"
                    open={showAdvanced}
                    onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                      Avancé (variantes, conversions, alertes, pertes…)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="md:col-span-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                          Modules & stock
                        </div>
                      {canStockAlerts && (
                        <Input
                          label="Stock minimum (alerte)"
                          type="number"
                          min={0}
                          value={quick.min_qty}
                          onChange={(e) => setQuick((p) => ({ ...p, min_qty: e.target.value }))}
                          helper="Optionnel : seuil pour alerte stock."
                        />
                      )}
                      {itemTypeEnabled && (
                        <Select
                          label="Type d’article"
                          value={quick.product_role}
                          onChange={(value) => setQuick((p) => ({ ...p, product_role: value }))}
                          options={productRoleSelectOptions}
                          helper={helpers.productRole || "Classez pour distinguer coûts matière et valeur de vente."}
                        />
                      )}
                      {variantsEnabled && (
                        <>
                          <Input
                            label="Variante (libellé)"
                            placeholder="Ex. Taille ou Couleur"
                            value={quick.variant_name}
                            onChange={(e) => setQuick((p) => ({ ...p, variant_name: e.target.value }))}
                          />
                          <Input
                            label="Variante (valeur)"
                            placeholder="Ex. M, Bleu, 75cl"
                            value={quick.variant_value}
                            onChange={(e) => setQuick((p) => ({ ...p, variant_value: e.target.value }))}
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
                            value={quick.conversion_factor}
                            onChange={(e) => setQuick((p) => ({ ...p, conversion_factor: e.target.value }))}
                          />
                          <Select
                            label="Unité convertie"
                            value={quick.conversion_unit}
                            onChange={(value) => setQuick((p) => ({ ...p, conversion_unit: value }))}
                            options={conversionSelectOptions}
                          />
                        </>
                      )}
                      {lotEnabled && (
                        <Input
                          label="Lot / Batch"
                          placeholder="Ex. LOT-2025-12"
                          value={quick.lotNumber}
                          onChange={(e) => setQuick((p) => ({ ...p, lotNumber: e.target.value }))}
                        />
                      )}
                      {showOpenFields && (
                        <>
                          <Select
                            label="Statut"
                            value={quick.container_status}
                            onChange={(value) => setQuick((p) => ({ ...p, container_status: value }))}
                            options={containerStatusOptions}
                          />
                          {quick.container_status === "OPENED" && (
                            <>
                              <Input
                                label="Pack (taille)"
                                type="number"
                                step="0.01"
                                placeholder="Ex. 0.75"
                                value={quick.pack_size}
                                onChange={(e) => setQuick((p) => ({ ...p, pack_size: e.target.value }))}
                              />
                              <Input
                                label="Unité pack"
                                placeholder="Ex. l, kg"
                                value={quick.pack_uom}
                                onChange={(e) => setQuick((p) => ({ ...p, pack_uom: e.target.value }))}
                              />
                              <Input
                                label="Reste (quantité)"
                                type="number"
                                step="0.01"
                                placeholder="Ex. 0.25"
                                value={quick.remaining_qty}
                                onChange={(e) => setQuick((p) => ({ ...p, remaining_qty: e.target.value }))}
                              />
                              <Input
                                label="Reste (fraction 0-1)"
                                type="number"
                                step="0.1"
                                min={0}
                                max={1}
                                placeholder="Ex. 0.5"
                                value={quick.remaining_fraction}
                                onChange={(e) => setQuick((p) => ({ ...p, remaining_fraction: e.target.value }))}
                              />
                            </>
                          )}
                        </>
                      )}

                      <div className="md:col-span-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                        Pertes & notes
                      </div>
                      <Input
                        label="Pertes (quantité)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={quick.loss_quantity}
                        onChange={(e) => setQuick((p) => ({ ...p, loss_quantity: e.target.value }))}
                      />
                      <Select
                        label="Raison"
                        value={quick.loss_reason}
                        onChange={(value) => setQuick((p) => ({ ...p, loss_reason: value }))}
                        options={lossReasonOptions}
                      />
                      <Input
                        label="Note perte"
                        placeholder="Ex. casse en livraison"
                        value={quick.loss_note}
                        onChange={(e) => setQuick((p) => ({ ...p, loss_note: e.target.value }))}
                      />
                      <Input
                        label="Commentaire (optionnel)"
                        placeholder={placeholders.notes}
                        value={quick.comment}
                        onChange={(e) => setQuick((p) => ({ ...p, comment: e.target.value }))}
                      />
                      </div>
                      {showAdvanced && renderCta(addCtaAdvancedLabel)}
                    </div>
                  </details>

                  {barcodeEnabled && <div className="text-xs text-[var(--muted)]">{ux.scanHint}</div>}
                </fieldset>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-soft min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Mode Chrono</div>
                <div className="text-xs text-[var(--muted)]">
                  Objectif, timer et progression pour un inventaire rapide.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={chronoEnabled ? "secondary" : "primary"} onClick={toggleChrono}>
                  {chronoEnabled ? "Désactiver" : "Activer"}
                </Button>
                {chronoEnabled && (
                  <Button size="sm" variant="ghost" onClick={resetChrono}>
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>

            {chronoEnabled && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-2">
                  <div className="text-xs text-[var(--muted)]">Timer</div>
                  <div className="text-2xl font-semibold text-[var(--text)]">
                    {formatChrono(chronoSeconds)}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setChronoRunning((prev) => !prev)}
                  >
                    {chronoRunning ? "Pause" : "Démarrer"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-2">
                  <div className="text-xs text-[var(--muted)]">Objectif</div>
                  <Input
                    label="Produits à compter"
                    type="number"
                    min={1}
                    value={chronoTarget}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setChronoTarget(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
                    }}
                  />
                  <div className="text-xs text-[var(--muted)]">Reste : {chronoRemaining} produit(s)</div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-2">
                  <div className="text-xs text-[var(--muted)]">Progression</div>
                  <div className="text-2xl font-semibold text-[var(--text)]">
                    {Math.round(chronoProgress * 100)}%
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--accent)]/20 overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] transition-all"
                      style={{ width: `${Math.round(chronoProgress * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {chronoCount} compté(s) / {chronoTarget}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {lastFound && (
          <Card className="p-4 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100/70 dark:border-blue-400/20 space-y-2 min-w-0">
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-200">
              {lastFound.type === "local" ? `Fiche ${itemLabelLower} existante` : "Suggestion"}
            </div>

            {lastFound.type === "local" ? (
              <div className="text-sm text-[var(--text)] break-anywhere">
                <div>
                  <span className="font-semibold">{lastFound.product?.name}</span> —{" "}
                  {wording.categoryLabel.toLowerCase()} {lastFound.product?.category || "—"} — dernier comptage (
                  {lastFound.product?.inventory_month || "—"})
                  <span className="text-xs text-[var(--muted)]"> · quantité pré-remplie, ajustez si besoin</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--text)] break-anywhere">
                {lastFound.suggestion?.name || "Sans nom"}{" "}
                {lastFound.suggestion?.brand ? `(${lastFound.suggestion.brand})` : ""}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-3 min-w-0">
            <div>
              <div className="text-sm text-[var(--muted)]">Inventaire</div>
              <div className="text-lg font-semibold text-[var(--text)]">{filtered.length} entrée(s)</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span>
                Page {page} / {totalPages}
              </span>
              <span>
                Affichage {paginatedInventory.length} / {filtered.length}
              </span>
            </div>
          </div>

          {authLoading || loading ? (
            <div className="grid gap-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : err ? (
            <div className="p-6 rounded-xl bg-red-50/70 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200/60 dark:border-red-400/25">
              {err}
            </div>
          ) : (
            <>
              {/* ✅ MOBILE: cards (no overflow) */}
              <div className="sm:hidden space-y-2 min-w-0">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8">
                    <div className="max-w-md mx-auto text-center space-y-3">
                      <div className="text-lg font-semibold text-[var(--text)]">{ux.emptyInventoryTitle}</div>
                      <div className="text-sm text-[var(--muted)]">{ux.emptyInventoryText}</div>
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => setSearch("")}>
                          Réinitialiser la recherche
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  paginatedInventory.map((p, idx) => {
                    const highlighted = isRowHighlighted(p);
                    const idValue = renderIdentifier(p);
                    const qtyValue = qtyEdits[p.id] ?? String(p.quantity ?? "");

                    return (
                      <Card
                        key={p.id}
                        className={[
                          "p-4 min-w-0",
                          highlighted ? "ring-2 ring-blue-500/70" : "",
                        ].join(" ")}
                        hover
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)] break-anywhere">
                              {p.name}
                            </div>
                            <div className="text-xs text-[var(--muted)] break-anywhere">
                              {p.category || "—"} · {p.inventory_month || "—"}
                            </div>
                          </div>
                          {isAllServices ? (
                            <div className="shrink-0">
                              <span className="text-xs rounded-full border border-[var(--border)] px-2 py-1 text-[var(--muted)]">
                                {p.__service_name || p.service_name || "—"}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs min-w-0">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                            <div className="text-[var(--muted)]">Comptage</div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step={quantityStep}
                                value={qtyValue}
                                onChange={(e) =>
                                  setQtyEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                onBlur={() => {
                                  if (qtyValue !== String(p.quantity ?? "")) {
                                    saveInlineQuantity(p, qtyValue);
                                  }
                                }}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
                                disabled={isAllServices}
                              />
                              <span className="text-[var(--muted)]">{p.unit || "pcs"}</span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-w-0">
                            <div className="text-[var(--muted)]">
                              {barcodeEnabled ? wording.barcodeLabel : "Identifiant"}
                              {skuEnabled ? ` / ${wording.skuLabel}` : ""}
                            </div>
                            <div className="font-semibold text-[var(--text)] break-anywhere">
                              {idValue}
                            </div>
                          </div>
                        </div>

                        {!isAllServices && (
                          <div className="mt-3 flex justify-end">
                            <Button size="sm" variant="secondary" onClick={() => startEdit(p)}>
                              Détails
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>

              {/* ✅ DESKTOP/TABLET: table */}
              <div className="hidden sm:block overflow-x-auto" ref={tableWrapRef}>
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-[var(--surface)] sticky top-0">
                    <tr className="text-[var(--muted)]">
                      {isAllServices && <th className="text-left px-4 py-3 w-40">Service</th>}
                      <th className="text-left px-4 py-3 w-[26%]">{wording.itemLabel}</th>
                      <th className="text-left px-4 py-3 w-[18%]">{wording.categoryLabel}</th>
                      <th className="text-left px-4 py-3 w-28">Mois</th>
                      <th className="text-left px-4 py-3 w-40">Comptage</th>
                      <th className="text-left px-4 py-3 w-[22%]">
                        {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                      </th>
                      {!isAllServices && <th className="text-left px-4 py-3 w-24">Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={isAllServices ? 6 : 5} className="px-4 py-10">
                          <div className="max-w-md mx-auto text-center space-y-3">
                            <div className="text-lg font-semibold text-[var(--text)]">{ux.emptyInventoryTitle}</div>
                            <div className="text-sm text-[var(--muted)]">{ux.emptyInventoryText}</div>
                            <div className="flex justify-center gap-2">
                              <Button size="sm" onClick={() => setSearch("")}>
                                Réinitialiser la recherche
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedInventory.map((p, idx) => {
                        const highlighted = isRowHighlighted(p);
                        const rowKey = getRowKey(p);
                        const qtyValue = qtyEdits[p.id] ?? String(p.quantity ?? "");

                        return (
                          <tr
                            key={p.id}
                            ref={(el) => {
                              if (!el) return;
                              rowRefs.current.set(rowKey, el);
                            }}
                            className={[
                              idx % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--accent)]/10",
                              highlighted ? "ring-2 ring-blue-500/70 bg-blue-500/10" : "",
                            ].join(" ")}
                          >
                            {isAllServices && (
                              <td className="px-4 py-3 text-[var(--muted)] break-anywhere">
                                {p.__service_name || p.service_name || "—"}
                              </td>
                            )}
                            <td className="px-4 py-3 font-semibold text-[var(--text)] break-anywhere">
                              {p.name}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)] break-anywhere">
                              {p.category || "—"}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)]">{p.inventory_month}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={quantityStep}
                                  value={qtyValue}
                                  onChange={(e) =>
                                    setQtyEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                                  }
                                  onBlur={() => {
                                    if (qtyValue !== String(p.quantity ?? "")) {
                                      saveInlineQuantity(p, qtyValue);
                                    }
                                  }}
                                  className="w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
                                  disabled={isAllServices}
                                />
                                <span>{p.unit || "pcs"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)] break-anywhere">
                              {renderIdentifier(p)}
                            </td>
                            {!isAllServices && (
                              <td className="px-4 py-3">
                                <Button size="sm" variant="secondary" onClick={() => startEdit(p)}>
                                  Détails
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                ← Précédent
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                Suivant →
              </Button>
            </div>
          )}

          <div className="p-4 flex justify-end gap-3 border-t border-[var(--border)]">
            <Button variant="secondary" size="sm" onClick={load} disabled={authLoading || loading}>
              Rafraîchir
            </Button>
            <Button size="sm" onClick={load} loading={authLoading || loading}>
              Recharger
            </Button>
          </div>
        </Card>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Détails du comptage"
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
              Fermer
            </Button>
            <Button type="button" onClick={submitQuickFromDrawer} loading={loading}>
              {isEditing ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={addQuick}>
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Essentiel</div>
            <div className="mt-3 grid gap-3">
              {categories.length > 0 ? (
                <Select
                  label={wording.categoryLabel}
                  value={quick.category}
                  onChange={(value) => setQuick((p) => ({ ...p, category: value }))}
                  options={categoryOptions}
                  helper="Catégories du service sélectionné."
                />
              ) : (
                <Input
                  label={wording.categoryLabel}
                  placeholder={categoryPlaceholder}
                  value={quick.category}
                  onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
                  helper={helpers.category}
                />
              )}

              {itemTypeEnabled && (
                <Select
                  label="Type d’article"
                  value={quick.product_role}
                  onChange={(value) => setQuick((p) => ({ ...p, product_role: value }))}
                  options={productRoleSelectOptions}
                  helper={helpers.productRole || "Classez pour distinguer coûts matière et valeur de vente."}
                />
              )}

              {(countingMode === "weight" || countingMode === "volume" || countingMode === "mixed") && (
                <Select
                  label={unitLabel}
                  value={quick.unit}
                  onChange={(value) => setQuick((p) => ({ ...p, unit: value }))}
                  options={unitSelectOptions}
                />
              )}

              {canStockAlerts && (
                <Input
                  label="Stock minimum (alerte)"
                  type="number"
                  min={0}
                  value={quick.min_qty}
                  onChange={(e) => setQuick((p) => ({ ...p, min_qty: e.target.value }))}
                  helper="Optionnel : seuil pour alerte stock."
                />
              )}
            </div>
          </div>

          {(barcodeEnabled || skuEnabled) && (
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Identifiants</div>
              <div className="mt-3 grid gap-3">
                {barcodeEnabled && (
                  <Input
                    label={wording.barcodeLabel}
                    placeholder={`Scannez ou saisissez ${wording.barcodeLabel || "le code-barres"}`}
                    value={quick.barcode}
                    onChange={(e) => setQuick((p) => ({ ...p, barcode: e.target.value }))}
                    helper={helpers.barcode}
                  />
                )}
                {skuEnabled && (
                  <Input
                    label={wording.skuLabel}
                    placeholder={placeholders.sku}
                    value={quick.internal_sku}
                    onChange={(e) => setQuick((p) => ({ ...p, internal_sku: e.target.value }))}
                    helper={showIdentifierWarning ? helpers.sku : "Optionnel"}
                  />
                )}
              </div>
            </div>
          )}

          {(variantsEnabled || multiUnitEnabled || lotEnabled || dlcEnabled || showOpenFields) && (
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Options métier</div>
              <div className="mt-3 grid gap-3">
                {variantsEnabled && (
                  <>
                    <Input
                      label="Variante (libellé)"
                      placeholder="Ex. Taille ou Couleur"
                      value={quick.variant_name}
                      onChange={(e) => setQuick((p) => ({ ...p, variant_name: e.target.value }))}
                    />
                    <Input
                      label="Variante (valeur)"
                      placeholder="Ex. M, Bleu, 75cl"
                      value={quick.variant_value}
                      onChange={(e) => setQuick((p) => ({ ...p, variant_value: e.target.value }))}
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
                      value={quick.conversion_factor}
                      onChange={(e) => setQuick((p) => ({ ...p, conversion_factor: e.target.value }))}
                    />
                    <Select
                      label="Unité convertie"
                      value={quick.conversion_unit}
                      onChange={(value) => setQuick((p) => ({ ...p, conversion_unit: value }))}
                      options={conversionSelectOptions}
                    />
                  </>
                )}

                {lotEnabled && (
                  <Input
                    label="Lot / Batch"
                    placeholder="Ex. LOT-2025-12"
                    value={quick.lotNumber}
                    onChange={(e) => setQuick((p) => ({ ...p, lotNumber: e.target.value }))}
                  />
                )}

                {dlcEnabled && (
                  <Input
                    label="DLC"
                    type="date"
                    value={quick.dlc}
                    onChange={(e) => setQuick((p) => ({ ...p, dlc: e.target.value }))}
                    helper={showDlcWarning ? "Recommandée pour limiter les pertes." : "Optionnel"}
                  />
                )}

                {showOpenFields && (
                  <>
                    <Select
                      label="Statut"
                      value={quick.container_status}
                      onChange={(value) => setQuick((p) => ({ ...p, container_status: value }))}
                      options={containerStatusOptions}
                    />
                    {quick.container_status === "OPENED" && (
                      <>
                        <Input
                          label="Pack (taille)"
                          type="number"
                          step="0.01"
                          placeholder="Ex. 0.75"
                          value={quick.pack_size}
                          onChange={(e) => setQuick((p) => ({ ...p, pack_size: e.target.value }))}
                        />
                        <Input
                          label="Unité pack"
                          placeholder="Ex. l, kg"
                          value={quick.pack_uom}
                          onChange={(e) => setQuick((p) => ({ ...p, pack_uom: e.target.value }))}
                        />
                        <Input
                          label="Reste (quantité)"
                          type="number"
                          step="0.01"
                          placeholder="Ex. 0.25"
                          value={quick.remaining_qty}
                          onChange={(e) => setQuick((p) => ({ ...p, remaining_qty: e.target.value }))}
                        />
                        <Input
                          label="Reste (fraction 0-1)"
                          type="number"
                          step="0.1"
                          min={0}
                          max={1}
                          placeholder="Ex. 0.5"
                          value={quick.remaining_fraction}
                          onChange={(e) => setQuick((p) => ({ ...p, remaining_fraction: e.target.value }))}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {(purchaseEnabled || sellingEnabled) && (
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Prix & TVA</div>
              <div className="mt-3 grid gap-3">
                {purchaseEnabled && (
                  <Input
                    label={`Prix d’achat HT (${currencyText})`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={quick.purchase_price}
                    onChange={(e) => setQuick((p) => ({ ...p, purchase_price: e.target.value }))}
                  />
                )}
                {sellingEnabled && (
                  <Input
                    label={`Prix de vente HT (${currencyText})`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={quick.selling_price}
                    onChange={(e) => setQuick((p) => ({ ...p, selling_price: e.target.value }))}
                  />
                )}
                {tvaEnabled && (purchaseEnabled || sellingEnabled) && (
                  <Select
                    label="TVA"
                    value={quick.tva}
                    onChange={(value) => setQuick((p) => ({ ...p, tva: value }))}
                    options={tvaOptions}
                  />
                )}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Pertes & notes</div>
            <div className="mt-3 grid gap-3">
              <Input
                label="Pertes (quantité)"
                type="number"
                min={0}
                step="0.01"
                value={quick.loss_quantity}
                onChange={(e) => setQuick((p) => ({ ...p, loss_quantity: e.target.value }))}
              />
              <Select
                label="Raison"
                value={quick.loss_reason}
                onChange={(value) => setQuick((p) => ({ ...p, loss_reason: value }))}
                options={lossReasonOptions}
              />
              <Input
                label="Note perte"
                placeholder="Ex. casse en livraison"
                value={quick.loss_note}
                onChange={(e) => setQuick((p) => ({ ...p, loss_note: e.target.value }))}
              />
              <Input
                label="Commentaire (optionnel)"
                placeholder={placeholders.notes}
                value={quick.comment}
                onChange={(e) => setQuick((p) => ({ ...p, comment: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Drawer>
    </PageTransition>
  );
}
