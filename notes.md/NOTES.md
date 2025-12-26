

	•	frontend/src/pages/Inventory.jsx:
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

  // ✅ scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);

  // ✅ highlight + scroll
  const [highlightCode, setHighlightCode] = useState("");
  const highlightTimeoutRef = useRef(null);
  const rowRefs = useRef(new Map());
  const tableWrapRef = useRef(null);

  // ✅ focus "Nom" after scan if not found
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
      } catch (e) {
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
    } catch (e) {
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
        } catch (lossErr) {
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

  // ✅ returns { kind: "local"|"external"|"none", data }
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
    } catch (e) {
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

  // ✅ ultra flow: if none found => keep barcode + focus Name
  const onScannerDetected = async (code) => {
    const cleaned = String(code || "").trim();
    if (!cleaned) return;

    setScannerOpen(false);

    // 1) always set barcode
    setQuick((p) => ({ ...p, barcode: cleaned }));

    // 2) search table + highlight
    setSearch(cleaned);
    setHighlightCode(cleaned);
    armHighlightClear();

    // 3) lookup
    const result = await lookupBarcode(cleaned);

    // 4) if not found locally, force focus on name and encourage filling
    if (result.kind === "none") {
      setQuick((prev) => ({
        ...prev,
        barcode: cleaned,
        // keep existing category if user had one, but clear name to force intent
        name: "",
      }));

      pushToast?.({
        message: "Produit non trouvé. Code-barres renseigné : complète le nom puis ajoute.",
        type: "info",
      });

      window.setTimeout(() => {
        // try focus inside Input (depends on your Input implementation)
        const el = nameInputRef.current;
        if (el?.focus) el.focus();
        // fallback: query by input[name] if needed
        else {
          const input = document.querySelector('input[autocomplete="off"][placeholder]') || document.querySelector("input");
          input?.focus?.();
        }
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

  return (
    <PageTransition>
      <Helmet>
        <title>{ux.inventoryTitle} | StockScan</title>
        <meta name="description" content={ux.inventoryIntro} />
      </Helmet>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={onScannerDetected}
      />

      <div className="grid gap-4">
        <Card className="p-6 space-y-4">
          <div className="text-sm text-slate-500">Inventaire</div>
          <div className="text-2xl font-black tracking-tight">{ux.inventoryTitle}</div>
          <p className="text-slate-600 text-sm">{ux.inventoryIntro}</p>
          <p className="text-xs text-slate-500">
            Inventaire = comptage du mois. Le catalogue reste dans l’onglet Produits.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {services?.length > 0 && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Service</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
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

          <div className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-soft">
            <div className="text-sm font-semibold text-[var(--text)] mb-2">{ux.quickAddTitle}</div>

            {isAllServices ? (
              <div className="text-sm text-[var(--muted)]">
                Sélectionnez un service pour ajouter. En mode “Tous les services”, l’ajout est désactivé.
              </div>
            ) : (
              <form className="grid md:grid-cols-3 gap-3 items-end" onSubmit={addQuick}>
                <fieldset disabled={loading || authLoading} className="contents">
                  {/* ✅ ref for focus after scan */}
                  <Input
                    label={wording.itemLabel}
                    placeholder={placeholders.name}
                    value={quick.name}
                    onChange={(e) => setQuick((p) => ({ ...p, name: e.target.value }))}
                    required
                    inputRef={nameInputRef}
                  />

                  {categories.length > 0 ? (
                    <label className="space-y-1.5">
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
                    <label className="space-y-1.5">
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
                    <div className="flex items-end gap-2">
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
                    <label className="space-y-1.5">
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
                    <label className="space-y-1.5">
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
                      <label className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Unité pack</span>
                        <select
                          value={quick.pack_uom}
                          onChange={(e) => setQuick((p) => ({ ...p, pack_uom: e.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
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

                  <div className="md:col-span-3 grid md:grid-cols-3 gap-3 items-end">
                    <Input
                      label="Pertes (quantité)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={quick.loss_quantity}
                      onChange={(e) => setQuick((p) => ({ ...p, loss_quantity: e.target.value }))}
                      helper="Optionnel : pertes ou casse."
                    />
                    <label className="space-y-1.5">
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

                  <div className="md:col-span-3 flex flex-wrap gap-3 items-center">
                    {showIdentifierWarning && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
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
                      <div className="text-xs text-slate-500">{ux.scanHint}</div>
                    </div>
                  )}
                </fieldset>
              </form>
            )}
          </div>
        </Card>

        {lastFound && (
          <Card className="p-4 bg-blue-50 border border-blue-100 space-y-2">
            <div className="text-sm font-semibold text-blue-700">
              {lastFound.type === "local" ? `Fiche ${itemLabelLower} existante` : "Suggestion"}
            </div>

            {lastFound.type === "local" ? (
              <div className="text-sm text-slate-700">
                <div>
                  <span className="font-semibold">{lastFound.product?.name}</span> —{" "}
                  {wording.categoryLabel.toLowerCase()} {lastFound.product?.category || "—"} — dernier comptage (
                  {lastFound.product?.inventory_month || "—"})
                  <span className="text-xs text-slate-500"> · info non reprise automatiquement</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-700">
                {lastFound.suggestion?.name || "Sans nom"}{" "}
                {lastFound.suggestion?.brand ? `(${lastFound.suggestion.brand})` : ""}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-slate-500">Inventaire</div>
              <div className="text-lg font-semibold">{filtered.length} entrée(s)</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
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
            <div className="p-6 rounded-xl bg-red-50 text-red-700">{err}</div>
          ) : (
            <div className="overflow-x-auto" ref={tableWrapRef}>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-slate-600">
                    {isAllServices && <th className="text-left px-4 py-3">Service</th>}
                    <th className="text-left px-4 py-3">{wording.itemLabel}</th>
                    <th className="text-left px-4 py-3">{wording.categoryLabel}</th>
                    <th className="text-left px-4 py-3">Mois</th>
                    <th className="text-left px-4 py-3">Comptage</th>
                    <th className="text-left px-4 py-3">
                      {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isAllServices ? 6 : 5} className="px-4 py-10">
                        <div className="max-w-md mx-auto text-center space-y-3">
                          <div className="text-lg font-semibold text-slate-800">{ux.emptyInventoryTitle}</div>
                          <div className="text-sm text-slate-600">{ux.emptyInventoryText}</div>
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
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                            highlighted ? "ring-2 ring-blue-500 bg-blue-50" : "",
                          ].join(" ")}
                        >
                          {isAllServices && (
                            <td className="px-4 py-3 text-slate-700">{p.__service_name || p.service_name || "—"}</td>
                          )}
                          <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                          <td className="px-4 py-3 text-slate-700">{p.category || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{p.inventory_month}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {p.quantity} {p.unit || "pcs"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{p.barcode || p.internal_sku || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                ← Précédent
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                Suivant →
              </Button>
            </div>
          )}

          <div className="p-4 flex justify-end gap-3 border-t border-slate-200">
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



	•	Le layout/wrapper global : je sais pas ce que c'est
  

}
	•	frontend/src/app/routes.jsx :

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "../pages/Landing.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";

import CommentCaMarche from "../pages/public/CommentCaMarche.jsx";
import Metiers from "../pages/public/Metiers.jsx";
import PourRestaurantCuisine from "../pages/public/PourRestaurantCuisine.jsx";
import PourBar from "../pages/public/PourBar.jsx";
import PourBoulangeriePatisserie from "../pages/public/PourBoulangeriePatisserie.jsx";
import PourEpicerie from "../pages/public/PourEpicerie.jsx";
import PourPharmacie from "../pages/public/PourPharmacie.jsx";
import PourBoutique from "../pages/public/PourBoutique.jsx";
import Fonctionnalites from "../pages/public/Fonctionnalites.jsx";
import Tarifs from "../pages/public/Tarifs.jsx";
import PublicSupport from "../pages/public/PublicSupport.jsx";

import Dashboard from "../pages/Dashboard.jsx";
import Inventory from "../pages/Inventory.jsx";
import Products from "../pages/Products.jsx";
import Categories from "../pages/Categories.jsx";
import Exports from "../pages/Exports.jsx";
import Losses from "../pages/Losses.jsx";
import Settings from "../pages/Settings.jsx";
import Support from "../pages/Support.jsx";

import Terms from "../pages/Terms.jsx";
import Privacy from "../pages/Privacy.jsx";
import Legal from "../pages/Legal.jsx";
import NotFound from "../pages/NotFound.jsx";

import InvitationAccept from "../pages/InvitationAccept.jsx";
import RequireAuth from "./RequireAuth.jsx";

import ForgotPassword from "../pages/ForgotPassword.jsx";
import CheckEmail from "../pages/CheckEmail.jsx";
import VerifyEmail from "../pages/VerifyEmail.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import ConfirmEmail from "../pages/ConfirmEmail.jsx";

const Protected = ({ children }) => <RequireAuth>{children}</RequireAuth>;

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/invitation/accept" element={<InvitationAccept />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/check-email" element={<CheckEmail />} />

      {/* Security callbacks */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />

      <Route path="/comment-ca-marche" element={<CommentCaMarche />} />
      <Route path="/metiers" element={<Metiers />} />
      <Route path="/pour-restaurant-cuisine" element={<PourRestaurantCuisine />} />
      <Route path="/pour-bar" element={<PourBar />} />
      <Route path="/pour-boulangerie-patisserie" element={<PourBoulangeriePatisserie />} />
      <Route path="/pour-epicerie" element={<PourEpicerie />} />
      <Route path="/pour-pharmacie" element={<PourPharmacie />} />
      <Route path="/pour-boutique" element={<PourBoutique />} />
      <Route path="/fonctionnalites" element={<Fonctionnalites />} />
      <Route path="/tarifs" element={<Tarifs />} />
      <Route path="/support" element={<PublicSupport />} />

      {/* SEO aliases */}
      <Route path="/cgu" element={<Navigate to="/terms" replace />} />
      <Route path="/confidentialite" element={<Navigate to="/privacy" replace />} />
      <Route path="/mentions-legales" element={<Navigate to="/legal" replace />} />

      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/legal" element={<Legal />} />

      {/* App (protected) */}
      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
      <Route
        path="/app/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/app/inventory"
        element={
          <Protected>
            <Inventory />
          </Protected>
        }
      />
      <Route
        path="/app/products"
        element={
          <Protected>
            <Products />
          </Protected>
        }
      />
      <Route
        path="/app/categories"
        element={
          <Protected>
            <Categories />
          </Protected>
        }
      />
      <Route
        path="/app/exports"
        element={
          <Protected>
            <Exports />
          </Protected>
        }
      />
      <Route
        path="/app/losses"
        element={
          <Protected>
            <Losses />
          </Protected>
        }
      />
      <Route
        path="/app/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />
      <Route
        path="/app/support"
        element={
          <Protected>
            <Support />
          </Protected>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
	•	frontend/src/index.css : 
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --bg: #0f172a;
  --surface: #0c1426;
  --text: #e5e7eb;
  --muted: #cbd5e1;
  --border: #1f2937;
  --primary: #3b82f6;
  --success: #22c55e;
  --accent: #1e293b;
  --radius-card: 24px;
  --radius-pill: 999px;
  --shadow-soft: 0 20px 60px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 0 1px rgba(59, 130, 246, 0.12), 0 25px 70px rgba(59, 130, 246, 0.35);
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f8fafc;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --border: #e2e8f0;
  --primary: #2563eb;
  --success: #16a34a;
  --accent: #e0e7ff;
  --shadow-soft: 0 20px 60px rgba(15, 23, 42, 0.08);
  --shadow-glow: 0 0 0 1px rgba(37, 99, 235, 0.08), 0 25px 70px rgba(37, 99, 235, 0.18);
}

/* ✅ anti overflow mobile */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  width: 100%;
  overflow-x: hidden; /* ✅ stop débordement à droite */
}

/* Sécurise médias (souvent responsables du overflow) */
img,
svg,
video,
canvas {
  max-width: 100%;
  height: auto;
}

body {
  @apply antialiased;
  background: radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.06), transparent 28%),
    radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.06), transparent 30%),
    var(--bg);
  color: var(--text);
}

.public-shell {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.05), transparent 32%),
    radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.18), transparent 38%),
    linear-gradient(180deg, #0b1220, #0f172a 45%, #0b1220 100%);
  color: #e2e8f0;
}

.public-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  color: #e2e8f0;
}

.public-shell a {
  color: #93c5fd;
}

.public-shell h1,
.public-shell h2,
.public-shell h3,
.public-shell h4 {
  color: #ffffff;
}

.public-shell p,
.public-shell li {
  color: #e2e8f0;
}

/* scrollbars */
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}

@layer base {
  :focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
  }

  [data-theme="dark"] body {
    background: radial-gradient(circle at 25% 20%, rgba(59, 130, 246, 0.12), transparent 32%),
      radial-gradient(circle at 80% 0%, rgba(34, 197, 94, 0.08), transparent 32%),
      var(--bg);
  }

  /* Harmonise les classes Tailwind les plus courantes en mode sombre */
  [data-theme="dark"] .text-slate-900,
  [data-theme="dark"] .text-slate-800,
  [data-theme="dark"] .text-slate-700 {
    color: var(--text) !important;
  }
  [data-theme="dark"] .text-slate-600,
  [data-theme="dark"] .text-slate-500,
  [data-theme="dark"] .text-slate-400 {
    color: var(--muted) !important;
  }
  [data-theme="dark"] .bg-white,
  [data-theme="dark"] .bg-slate-50,
  [data-theme="dark"] .bg-slate-100 {
    background-color: var(--surface) !important;
  }
  [data-theme="dark"] .border-slate-200,
  [data-theme="dark"] .border-slate-300 {
    border-color: var(--border) !important;
  }

  /* Inputs / selects en mode sombre : fond sombre, texte clair, placeholders lisibles */
  [data-theme="dark"] input,
  [data-theme="dark"] select,
  [data-theme="dark"] textarea {
    background-color: #111827 !important;
    color: #e5e7eb !important;
    border-color: #1f2937 !important;
  }
  [data-theme="dark"] input::placeholder,
  [data-theme="dark"] textarea::placeholder {
    color: #cbd5e1 !important;
    opacity: 0.9;
  }
}

@layer components {
  .surface-card {
    border-radius: var(--radius-card);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-soft);
  }

  .glass {
    border-radius: var(--radius-card);
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
  }

  .shadow-soft {
    box-shadow: var(--shadow-soft);
  }

  .shadow-glow {
    box-shadow: var(--shadow-glow);
  }

  .bg-grid {
    background-image: linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
    background-size: 32px 32px;
  }

  /* ✅ util: évite overflow dans flex/grid (min-width: auto => débordements) */
  .min-w-0-safe {
    min-width: 0;
  }
}

@keyframes floatSoft {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0px); }
}

.animate-floatSoft {
  animation: floatSoft 3.6s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-skeleton-shimmer {
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

	•	components/TopBar.jsx:// frontend/src/components/Topbar.jsx
import React, { useMemo } from "react";
import { LogOut, Moon, Sun, Menu } from "lucide-react";
import { useAuth } from "../app/AuthProvider";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

function useIsLightTheme() {
  return useMemo(() => {
    const t = document?.documentElement?.getAttribute("data-theme");
    return t === "light";
  }, [document?.documentElement?.getAttribute?.("data-theme")]);
}

export default function Topbar({ onLogout, onToggleTheme, onOpenMobileNav }) {
  const { me, tenant, services, serviceId, selectService, logout, loading } = useAuth();
  const isLight = useIsLightTheme();

  const isGeneral = tenant?.domain === "general";
  const showServiceSelect = !isGeneral && services?.length > 1;

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-[var(--surface)]/90 border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <div className="text-sm font-bold text-[var(--text)]">{tenant?.name || "StockScan"}</div>
            <div className="text-xs text-[var(--muted)]">
              {isGeneral ? "Commerce non-alimentaire" : "Commerce alimentaire"}
            </div>
          </div>

          {showServiceSelect && (
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2 shadow-soft">
              <div className="text-xs text-[var(--muted)]">Service</div>
              <select
                value={serviceId || ""}
                onChange={(e) => selectService(e.target.value)}
                className="text-sm font-semibold text-[var(--text)] bg-transparent outline-none"
                aria-label="Sélectionner un service"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="all">Tous les services</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="lg:hidden rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
              aria-label="Ouvrir la navigation"
            >
              <Menu size={18} />
            </button>
          )}

          {onToggleTheme && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              aria-label="Basculer thème"
              className="inline-flex"
              title={isLight ? "Passer en sombre" : "Passer en clair"}
            >
              {isLight ? <Moon size={16} className="text-slate-700" /> : <Sun size={16} className="text-slate-500" />}
              <span className="hidden sm:inline">
                {isLight ? "Sombre" : "Clair"}
              </span>
            </Button>
          )}

          <Badge variant="info" className="hidden sm:inline-flex">
            {loading ? "Chargement…" : me?.username || "Compte"}
          </Badge>

          <Button
            variant="secondary"
            size="sm"
            onClick={onLogout || logout}
            className="border-slate-300"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

E) Mode clair : éléments invisibles
	•	Le composant topbar: déja fournis
	•	frontend/src/ui/Button.jsx : déja fournis 
  
  
  , Card.jsx:
  import React from "react";
import { cn } from "../lib/cn";

export default function Card({ children, className = "", glass = false, hover = false }) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-soft transition duration-200",
        glass && "border-white/15 bg-white/10 backdrop-blur-xl text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
        hover && "hover:-translate-y-[2px]",
        className
      )}
    >
      {children}
    </div>
  );
}

  
  
  src/ui/Badge.jsx :
  import React from "react";
import { cn } from "../lib/cn";

export default function Badge({ children, variant = "default", className = "" }) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
}

	•	Le fichier thème/tokens CSS : je sais pas ce que c'est 


  backend/render_start.sh :
  #!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"

# Always run from the backend directory (Render "Root Directory" is often set to backend/)
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting gunicorn on :$PORT ..."
exec gunicorn inventory.wsgi:application --bind "0.0.0.0:${PORT}"

