// frontend/src/pages/Inventory.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import PageTransition from "../components/PageTransition";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";
import Skeleton from "../ui/Skeleton";
import { useToast } from "../app/ToastContext";
import { ScanLine } from "lucide-react";
import BarcodeScannerModal from "../components/BarcodeScannerModal";
import { getWording, getUxCopy, getPlaceholders, getFieldHelpers, getLossReasons } from "../lib/labels";
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";

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

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastFound, setLastFound] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);

  const [highlightCode, setHighlightCode] = useState("");
  const highlightTimeoutRef = useRef(null);
  const rowRefs = useRef(new Map());
  const tableWrapRef = useRef(null);

  const nameInputRef = useRef(null);

  const [quick, setQuick] = useState({
    name: "",
    category: "",
    quantity: "",
    barcode: "",
    internal_sku: "",
    product_role: "",
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

  const dlcCfg = serviceFeatures?.dlc || {};
  const barcodeEnabled = getFeatureFlag("barcode", familyIdentifiers.barcode ?? true);
  const skuEnabled = getFeatureFlag("sku", familyIdentifiers.sku ?? true);
  const lotEnabled = getFeatureFlag("lot", familyModules.includes("lot"));
  const dlcEnabled = getFeatureFlag("dlc", familyModules.includes("expiry"));
  const dlcRecommended = !!dlcCfg.recommended;

  const openEnabled = getFeatureFlag("open_container_tracking", familyModules.includes("opened"));
  const itemTypeEnabled = getFeatureFlag("item_type", familyModules.includes("itemType"));
  const showOpenFields = openEnabled;

  const productRoleOptions = [
    { value: "", label: "Non précisé" },
    { value: "raw_material", label: "Matière première" },
    { value: "finished_product", label: "Produit fini" },
    { value: "homemade_prep", label: "Préparation maison" },
  ];

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);

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

  const load = async () => {
    if (!serviceId && !isAllServices) return;

    setLoading(true);
    setErr("");

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
      } else {
        const res = await api.get(`/api/products/?month=${month}&service=${serviceId}`);
        setItems(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
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
      product_role: "",
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

    const payload = {
      name: quick.name.trim(),
      category: quick.category || "",
      quantity: Number(quick.quantity),
      inventory_month: month,
      service: serviceId,
      unit: quick.unit || "pcs",
      notes: quick.comment || "",
    };

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

    setLoading(true);
    try {
      const res = await api.post("/api/products/", payload);
      const warnings = res?.data?.warnings || [];
      const filteredWarnings = warnings.filter(
        (warning) =>
          !String(warning).toLowerCase().includes("prix d'achat") &&
          !String(warning).toLowerCase().includes("prix de vente")
      );

      if (filteredWarnings.length) pushToast?.({ message: filteredWarnings.join(" "), type: "warn" });
      else pushToast?.({ message: "Comptage enregistré.", type: "success" });

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
          internal_sku: p.internal_sku || prev.internal_sku,
          product_role: p.product_role || prev.product_role,
          dlc: p.dlc || prev.dlc,
          unit: p.unit || prev.unit,
          lotNumber: p.lot_number || prev.lotNumber,
        }));
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

  return (
    <PageTransition>
      <Helmet>
        <title>{ux.inventoryTitle} | StockScan</title>
        <meta name="description" content={ux.inventoryIntro} />
      </Helmet>

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={onScannerDetected} />

      <div className="grid gap-4 min-w-0">
        <Card className="p-6 space-y-4 min-w-0">
          <div className="text-sm text-[var(--muted)]">Inventaire</div>
          <div className="text-2xl font-black tracking-tight text-[var(--text)]">{ux.inventoryTitle}</div>
          <p className="text-[var(--muted)] text-sm">{ux.inventoryIntro}</p>
          <p className="text-xs text-[var(--muted)]">
            Inventaire = comptage du mois. Le catalogue reste dans l’onglet Produits.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 items-center min-w-0">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {services?.length > 0 && (
              <label className="space-y-1.5 min-w-0">
                <span className="text-sm font-medium text-[var(--text)]">Service</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                  value={serviceId || ""}
                  onChange={(e) => selectService(e.target.value)}
                >
                  {services.length > 1 && <option value="all">Tous les services (lecture)</option>}
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
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
            <div className="text-sm font-semibold text-[var(--text)] mb-2">{ux.quickAddTitle}</div>

            {isAllServices ? (
              <div className="text-sm text-[var(--muted)]">
                Sélectionnez un service pour ajouter. En mode “Tous les services”, l’ajout est désactivé.
              </div>
            ) : (
              <form className="grid md:grid-cols-3 gap-3 items-end min-w-0" onSubmit={addQuick}>
                <fieldset disabled={loading || authLoading} className="contents">
                  <Input
                    label={wording.itemLabel}
                    placeholder={placeholders.name}
                    value={quick.name}
                    onChange={(e) => setQuick((p) => ({ ...p, name: e.target.value }))}
                    required
                    inputRef={nameInputRef}
                  />

                  {categories.length > 0 ? (
                    <label className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">{wording.categoryLabel}</span>
                      <select
                        value={quick.category}
                        onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                      >
                        <option value="">Aucune</option>
                        {categories.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--muted)]">Catégories du service sélectionné.</p>
                    </label>
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
                    <label className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">Type d’article</span>
                      <select
                        value={quick.product_role}
                        onChange={(e) => setQuick((p) => ({ ...p, product_role: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                      >
                        {productRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--muted)]">
                        {helpers.productRole || "Classez pour distinguer coûts matière et valeur de vente."}
                      </p>
                    </label>
                  )}

                  <Input
                    label="Comptage (quantité)"
                    type="number"
                    min={0}
                    required
                    value={quick.quantity}
                    onChange={(e) => setQuick((p) => ({ ...p, quantity: e.target.value }))}
                    helper="Quantité comptée pour ce mois."
                  />

                  {barcodeEnabled && (
                    <Input
                      label={wording.barcodeLabel}
                      placeholder={`Scannez ou saisissez ${wording.barcodeLabel || "le code-barres"}`}
                      value={quick.barcode}
                      onChange={(e) => setQuick((p) => ({ ...p, barcode: e.target.value }))}
                      helper={helpers.barcode}
                    />
                  )}

                  {barcodeEnabled && (
                    <div className="flex items-end gap-2 min-w-0">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setScannerOpen(true)}
                        className="w-full flex gap-2 justify-center"
                      >
                        <ScanLine className="w-4 h-4" />
                        Scanner caméra
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => lookupBarcode()}
                        className="w-full justify-center"
                        disabled={!String(quick.barcode || "").trim()}
                      >
                        Chercher
                      </Button>
                    </div>
                  )}

                  {showOpenFields && (
                    <label className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">Statut</span>
                      <select
                        value={quick.container_status}
                        onChange={(e) => setQuick((p) => ({ ...p, container_status: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                      >
                        <option value="SEALED">Non entamé</option>
                        <option value="OPENED">Entamé</option>
                      </select>
                    </label>
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

                  {(countingMode === "weight" || countingMode === "volume" || countingMode === "mixed") && (
                    <label className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">{unitLabel}</span>
                      <select
                        value={quick.unit}
                        onChange={(e) => setQuick((p) => ({ ...p, unit: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                      >
                        {unitOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {lotEnabled && (
                    <Input
                      label="Lot / Batch"
                      placeholder="Ex. LOT-2025-12"
                      value={quick.lotNumber}
                      onChange={(e) => setQuick((p) => ({ ...p, lotNumber: e.target.value }))}
                      helper="Optionnel : utile pour traçabilité et exports."
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

                  {isOpened && (
                    <>
                      <Input
                        label="Pack (taille)"
                        type="number"
                        step="0.01"
                        placeholder="Ex. 0.75"
                        value={quick.pack_size}
                        onChange={(e) => setQuick((p) => ({ ...p, pack_size: e.target.value }))}
                        helper="Optionnel (bouteilles/paquets)"
                      />
                      <label className="space-y-1.5 min-w-0">
                        <span className="text-sm font-medium text-[var(--text)]">Unité pack</span>
                        <select
                          value={quick.pack_uom}
                          onChange={(e) => setQuick((p) => ({ ...p, pack_uom: e.target.value }))}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                        >
                          <option value="">—</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </label>
                      <Input
                        label="Reste (quantité)"
                        type="number"
                        step="0.01"
                        placeholder="Ex. 0.25"
                        value={quick.remaining_qty}
                        onChange={(e) => setQuick((p) => ({ ...p, remaining_qty: e.target.value }))}
                        helper="Optionnel si vous préférez la fraction."
                      />
                      <Input
                        label="Reste (fraction 0-1)"
                        type="number"
                        step="0.1"
                        min={0}
                        max={1}
                        placeholder="Ex. 0.5 = moitié"
                        value={quick.remaining_fraction}
                        onChange={(e) => setQuick((p) => ({ ...p, remaining_fraction: e.target.value }))}
                        helper="Pratique : bouteille à moitié = 0.5"
                      />
                    </>
                  )}

                  <Input
                    label="Commentaire (optionnel)"
                    placeholder={placeholders.notes}
                    value={quick.comment}
                    onChange={(e) => setQuick((p) => ({ ...p, comment: e.target.value }))}
                    helper="Note interne liée au comptage du mois."
                  />

                  <div className="md:col-span-3 grid md:grid-cols-3 gap-3 items-end min-w-0">
                    <Input
                      label="Pertes (quantité)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={quick.loss_quantity}
                      onChange={(e) => setQuick((p) => ({ ...p, loss_quantity: e.target.value }))}
                      helper="Optionnel : pertes ou casse."
                    />
                    <label className="space-y-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)]">Raison</span>
                      <select
                        value={quick.loss_reason}
                        onChange={(e) => setQuick((p) => ({ ...p, loss_reason: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2.5 text-sm font-semibold"
                      >
                        {lossReasons.map((reason) => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Note perte"
                      placeholder="Ex. casse en livraison"
                      value={quick.loss_note}
                      onChange={(e) => setQuick((p) => ({ ...p, loss_note: e.target.value }))}
                      helper="Optionnel : détail utile pour les exports."
                    />
                  </div>

                  <div className="md:col-span-3 flex flex-wrap gap-3 items-center min-w-0">
                    {showIdentifierWarning && (
                      <div className="text-xs text-amber-700 dark:text-amber-200 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-400/25 rounded-full px-3 py-1">
                        Conseil : ajoutez un identifiant ({wording.identifierLabel || "code-barres ou SKU"}) pour éviter les doublons.
                      </div>
                    )}
                    <Button type="submit" loading={loading}>
                      Ajouter
                    </Button>
                    <Button variant="secondary" type="button" onClick={resetQuick} disabled={loading}>
                      Réinitialiser
                    </Button>
                  </div>

                  {barcodeEnabled && (
                    <div className="md:col-span-3">
                      <div className="text-xs text-[var(--muted)]">{ux.scanHint}</div>
                    </div>
                  )}
                </fieldset>
              </form>
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
                  <span className="text-xs text-[var(--muted)]"> · info non reprise automatiquement</span>
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
                          Reset recherche
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  paginatedInventory.map((p, idx) => {
                    const highlighted = isRowHighlighted(p);
                    const idValue = renderIdentifier(p);

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
                            <div className="font-semibold text-[var(--text)]">
                              {p.quantity} {p.unit || "pcs"}
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
                      <th className="text-left px-4 py-3 w-[28%]">{wording.itemLabel}</th>
                      <th className="text-left px-4 py-3 w-[20%]">{wording.categoryLabel}</th>
                      <th className="text-left px-4 py-3 w-28">Mois</th>
                      <th className="text-left px-4 py-3 w-32">Comptage</th>
                      <th className="text-left px-4 py-3 w-[24%]">
                        {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                      </th>
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
                                Reset recherche
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedInventory.map((p, idx) => {
                        const highlighted = isRowHighlighted(p);
                        const rowKey = getRowKey(p);

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
                              {p.quantity} {p.unit || "pcs"}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)] break-anywhere">
                              {renderIdentifier(p)}
                            </td>
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
    </PageTransition>
  );
}
