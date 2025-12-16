import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import PageTransition from "../components/PageTransition";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";
import { useToast } from "../app/ToastContext";
import { ScanLine } from "lucide-react";
import { getWording, getUxCopy, getPlaceholders, getFieldHelpers } from "../lib/labels";

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
  const [loading, setLoading] = useState(false);
  const [lastFound, setLastFound] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [quick, setQuick] = useState({
    name: "",
    category: "",
    quantity: 1,
    barcode: "",
    internal_sku: "",
    purchase_price: "",
    selling_price: "",
    dlc: "",
    unit: "pcs",
    container_status: "SEALED",
    pack_size: "",
    pack_uom: "",
    remaining_qty: "",
    remaining_fraction: "",
  });

  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;

  const wording = getWording(serviceType, serviceDomain);
  const ux = getUxCopy(serviceType, serviceDomain);
  const placeholders = getPlaceholders(serviceType, serviceDomain);
  const helpers = getFieldHelpers(serviceType, serviceDomain);

  const isGeneral = serviceDomain === "general";
  const isFood = !isGeneral && serviceType !== "pharmacy_parapharmacy";

  const isAllServices = services.length > 1 && String(serviceId) === "all";

  // features dérivées
  const priceCfg = serviceFeatures?.prices || {};
  const barcodeCfg = serviceFeatures?.barcode || {};
  const skuCfg = serviceFeatures?.sku || {};
  const dlcCfg = serviceFeatures?.dlc || {};
  const openCfg = serviceFeatures?.open_container_tracking || { enabled: false };

  const purchaseEnabled = priceCfg.purchase_enabled !== false;
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const priceRecommended = !!priceCfg.recommended;

  const barcodeEnabled = barcodeCfg.enabled !== false;
  const skuEnabled = skuCfg.enabled !== false;

  // DLC : seulement food (et pas general) + pas pharmacie (pharma a sa logique mais ici on garde cohérence UI)
  const dlcEnabled = isFood ? dlcCfg.enabled !== false : false;
  const dlcRecommended = !!dlcCfg.recommended;

  // “Entamé” uniquement si feature activée + domaine food
  const showOpenFields = openCfg.enabled === true && isFood;

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

  const showIdentifierWarning = barcodeEnabled && !quick.barcode && (!skuEnabled || !quick.internal_sku);
  const showPurchaseWarning = purchaseEnabled && priceRecommended && !quick.purchase_price;
  const showSellingWarning = sellingEnabled && priceRecommended && !quick.selling_price;
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

  const resetQuick = () => {
    setQuick({
      name: "",
      category: "",
      quantity: 1,
      barcode: "",
      internal_sku: "",
      purchase_price: "",
      selling_price: "",
      dlc: "",
      unit: unitOptions[0],
      container_status: "SEALED",
      pack_size: "",
      pack_uom: "",
      remaining_qty: "",
      remaining_fraction: "",
    });
    setLastFound(null);
  };

  const addQuick = async (e) => {
    e.preventDefault();

    if (isAllServices) {
      pushToast?.({ message: "Sélectionnez un service pour ajouter un produit.", type: "warn" });
      return;
    }
    if (!serviceId || !quick.name.trim()) {
      pushToast?.({ message: "Nom et service requis.", type: "error" });
      return;
    }

    const cleanedBarcode = (quick.barcode || "").trim();
    const cleanedSku = (quick.internal_sku || "").trim();

    const payload = {
      name: quick.name.trim(),
      category: quick.category || "",
      quantity: Number(quick.quantity) || 0,
      inventory_month: month,
      service: serviceId,
      unit: quick.unit || "pcs",
    };

    if (barcodeEnabled) payload.barcode = cleanedBarcode;
    else payload.barcode = "";

    if (skuEnabled) payload.internal_sku = cleanedSku || (cleanedBarcode ? "" : quick.name.slice(0, 3).toLowerCase());
    else payload.internal_sku = "";

    payload.no_barcode = !cleanedBarcode;

    if (purchaseEnabled) payload.purchase_price = quick.purchase_price || null;
    if (sellingEnabled) payload.selling_price = quick.selling_price || null;
    if (dlcEnabled) payload.dlc = quick.dlc || null;

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

      if (warnings.length) pushToast?.({ message: warnings.join(" "), type: "warn" });
      else pushToast?.({ message: "Ajout enregistré.", type: "success" });

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
      pushToast?.({ message: "Scannez ou saisissez un code-barres d’abord.", type: "warn" });
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
          quantity: p.quantity || prev.quantity,
          internal_sku: p.internal_sku || prev.internal_sku,
          purchase_price: p.purchase_price ?? prev.purchase_price,
          selling_price: p.selling_price ?? prev.selling_price,
          dlc: p.dlc || prev.dlc,
          unit: p.unit || prev.unit,
        }));
        setLastFound({
          type: "local",
          product: res.data.product,
          recent: res.data.recent || [],
          history: res.data.history || [],
        });
        pushToast?.({ message: "Produit trouvé : champs pré-remplis.", type: "success" });
      } else if (res?.data?.suggestion) {
        setLastFound({ type: "external", suggestion: res.data.suggestion });
        pushToast?.({ message: "Suggestion trouvée : vérifiez puis complétez.", type: "info" });
      } else {
        setLastFound(null);
        pushToast?.({ message: "Aucune correspondance trouvée.", type: "info" });
      }
    } catch (e) {
      setLastFound(null);
      pushToast?.({ message: "Aucun produit trouvé pour ce code.", type: "info" });
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
              onChange={(e) => setSearch(e.target.value)}
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
                      placeholder={placeholders.category}
                      value={quick.category}
                      onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
                      helper={helpers.category}
                    />
                  )}

                  <Input
                    label="Quantité"
                    type="number"
                    min={0}
                    value={quick.quantity}
                    onChange={(e) => setQuick((p) => ({ ...p, quantity: e.target.value }))}
                  />

                  {barcodeEnabled && (
                    <Input
                      label={wording.barcodeLabel}
                      placeholder="Scannez ou saisissez"
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
                      <span className="text-sm font-medium text-[var(--text)]">Unité</span>
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

                  {purchaseEnabled && (
                    <Input
                      label="Prix d'achat (€)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={quick.purchase_price}
                      onChange={(e) => setQuick((p) => ({ ...p, purchase_price: e.target.value }))}
                      helper={showPurchaseWarning ? "Recommandé pour des stats fiables." : "Optionnel"}
                    />
                  )}

                  {sellingEnabled && (
                    <Input
                      label="Prix de vente (€)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={quick.selling_price}
                      onChange={(e) => setQuick((p) => ({ ...p, selling_price: e.target.value }))}
                      helper={showSellingWarning ? "Recommandé pour exports et pilotage." : "Optionnel"}
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

                  <div className="md:col-span-3 flex flex-wrap gap-3 items-center">
                    {showIdentifierWarning && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                        Conseil : ajoutez un identifiant (EAN/SKU) pour éviter les doublons.
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
              {lastFound.type === "local" ? "Produit existant" : "Suggestion"}
            </div>

            {lastFound.type === "local" ? (
              <div className="text-sm text-slate-700">
                <div>
                  <span className="font-semibold">{lastFound.product?.name}</span> —{" "}
                  {wording.categoryLabel.toLowerCase()} {lastFound.product?.category || "—"} — quantité{" "}
                  {lastFound.product?.quantity}
                </div>

                {lastFound.recent?.length ? (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div className="font-semibold">Derniers produits saisis :</div>
                    {lastFound.recent.map((r) => (
                      <div key={r.id}>
                        • {r.name} ({r.inventory_month})
                      </div>
                    ))}
                  </div>
                ) : null}

                {lastFound.history?.length ? (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div className="font-semibold">Historique de ce code :</div>
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

        <Card className="p-0 overflow-hidden">
          {authLoading || loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
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
                    <th className="text-left px-4 py-3">Quantité</th>
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
                                  quantity: 1,
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
                    filtered.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        {isAllServices && (
                          <td className="px-4 py-3 text-slate-700">{p.__service_name || p.service_name || "—"}</td>
                        )}
                        <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                        <td className="px-4 py-3 text-slate-700">{p.category || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{p.inventory_month}</td>
                        <td className="px-4 py-3 text-slate-700">{p.quantity}</td>
                        <td className="px-4 py-3 text-slate-700">{p.barcode || p.internal_sku || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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