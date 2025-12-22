import React, { useEffect, useMemo, useState } from "react";
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
    if (cfg && typeof cfg.enabled === "boolean") {
      return cfg.enabled;
    }
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

  // features dérivées
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

  // adapter l'unité par défaut selon countingMode
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

  // charger catégories du service sélectionné
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
    if (page > totalPages) {
      setPage(totalPages);
    }
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
          pushToast?.({
            message: "Comptage OK, mais la perte n’a pas pu être enregistrée.",
            type: "warn",
          });
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

  const lookupBarcode = async () => {
    if (!quick.barcode) {
      pushToast?.({ message: `Scannez ou saisissez un ${wording.barcodeLabel || "code-barres"} d’abord.`, type: "warn" });
      return;
    }
    try {
      const res = await api.get(`/api/products/lookup/?barcode=${encodeURIComponent(quick.barcode)}`);
      if (res?.data?.found && res.data.product) {
        const p = res.data.product;
          setQuick((prev) => ({
            ...prev,
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
      } else if (res?.data?.suggestion) {
        setLastFound({ type: "external", suggestion: res.data.suggestion });
        pushToast?.({ message: "Suggestion trouvée : vérifiez puis complétez.", type: "info" });
      } else {
        setLastFound(null);
        pushToast?.({ message: "Aucune correspondance trouvée.", type: "info" });
      }
    } catch (e) {
      setLastFound(null);
      pushToast?.({ message: `Aucun ${itemLabelLower} trouvé pour ce ${barcodeLabel}.`, type: "info" });
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>{ux.inventoryTitle} | StockScan</title>
        <meta name="description" content={ux.inventoryIntro} />
      </Helmet>

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
                  <Input
                    label={wording.itemLabel}
                    placeholder={placeholders.name}
                    value={quick.name}
                    onChange={(e) => setQuick((p) => ({ ...p, name: e.target.value }))}
                    required
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
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={lookupBarcode}
                        className="w-full flex gap-2 justify-center"
                      >
                        <ScanLine className="w-4 h-4" />
                        {ux.scanButton}
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
                      <p className="text-xs text-[var(--muted)]">
                        Unités adaptées :{" "}
                        {countingMode === "weight"
                          ? "kg / g"
                          : countingMode === "volume"
                          ? "l / ml"
                          : "pcs / kg / g / l / ml"}
                      </p>
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

                {lastFound.recent?.length ? (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div className="font-semibold">Dernières fiches {itemLabelLower} saisies :</div>
                    {lastFound.recent.map((r) => (
                      <div key={r.id}>
                        • {r.name} ({r.inventory_month})
                      </div>
                    ))}
                  </div>
                ) : null}

                {lastFound.history?.length ? (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div className="font-semibold">Historique (quantites non reprises) :</div>
                    {lastFound.history.slice(0, 5).map((h) => (
                      <div key={h.id}>
                        • {h.inventory_month} — {h.quantity} {h.unit || "pcs"}
                      </div>
                    ))}
                  </div>
                ) : null}
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
            <div className="overflow-x-auto">
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
                            <Button
                              size="sm"
                              onClick={() =>
                                setQuick((p) => ({
                                  ...p,
                                  name: placeholders.name,
                                }))
                              }
                            >
                              Pré-remplir
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                              Reset recherche
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedInventory.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
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
                    ))
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
