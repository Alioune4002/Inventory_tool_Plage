import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { getWording, getUxCopy, getPlaceholders, getFieldHelpers } from "../lib/labels";

export default function Products() {
  const { serviceId, services, selectService, serviceFeatures, countingMode, tenant, serviceProfile } = useAuth();
  const pushToast = useToast();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    category: "",
    quantity: 1,
    barcode: "",
    internal_sku: "",
    purchase_price: "",
    selling_price: "",
    dlc: "",
    unit: "pcs",
  });

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const isAllServices = services?.length > 1 && String(serviceId) === "all";
  const currentService = services?.find((s) => String(s.id) === String(serviceId));

  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;

  const wording = getWording(serviceType, serviceDomain);
  const ux = getUxCopy(serviceType, serviceDomain);
  const placeholders = getPlaceholders(serviceType, serviceDomain);
  const helpers = getFieldHelpers(serviceType, serviceDomain);

  const isGeneral = serviceDomain === "general";
  const isFood = !isGeneral && serviceType !== "pharmacy_parapharmacy";

  const priceCfg = serviceFeatures?.prices || {};
  const barcodeCfg = serviceFeatures?.barcode || {};
  const skuCfg = serviceFeatures?.sku || {};
  const dlcCfg = serviceFeatures?.dlc || {};

  const purchaseEnabled = priceCfg.purchase_enabled !== false;
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const priceRecommended = !!priceCfg.recommended;

  const barcodeEnabled = barcodeCfg.enabled !== false;
  const skuEnabled = skuCfg.enabled !== false;

  // DLC seulement si domaine food et service != pharmacie (déjà géré côté pages, on garde cohérent)
  const dlcEnabled = isFood ? dlcCfg.enabled !== false : false;
  const dlcRecommended = !!dlcCfg.recommended;

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);

  const readableServiceName = (id) => services?.find((s) => String(s.id) === String(id))?.name || id;

  const load = async () => {
    if (!serviceId) return;
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
      setErr("Impossible de charger la liste. Vérifiez votre connexion et vos droits.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month]);

  useEffect(() => {
    const loadCats = async () => {
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
    loadCats();
  }, [serviceId, isAllServices]);

  // adapter unité par défaut
  useEffect(() => {
    setForm((prev) => ({ ...prev, unit: unitOptions[0] }));
  }, [unitOptions]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "",
      quantity: 1,
      barcode: "",
      internal_sku: "",
      purchase_price: "",
      selling_price: "",
      dlc: "",
      unit: unitOptions[0],
    });
    setEditId(null);
    setErr("");
  };

  const submit = async (e) => {
    e.preventDefault();

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
        quantity: Number(form.quantity) || 0,
        inventory_month: month,
        service: serviceId,
        unit: form.unit || "pcs",
      };

      // identifiants
      const cleanedBarcode = (form.barcode || "").trim();
      const cleanedSku = (form.internal_sku || "").trim();

      if (barcodeEnabled) payload.barcode = cleanedBarcode;
      else payload.barcode = "";

      if (skuEnabled) {
        // SKU si fourni, sinon fallback léger (si pas de code-barres)
        payload.internal_sku = cleanedSku || (cleanedBarcode ? "" : form.name.slice(0, 3).toLowerCase());
      } else {
        payload.internal_sku = "";
      }

      payload.no_barcode = !cleanedBarcode;

      if (purchaseEnabled) payload.purchase_price = form.purchase_price || null;
      if (sellingEnabled) payload.selling_price = form.selling_price || null;
      if (dlcEnabled) payload.dlc = form.dlc || null;

      let res;
      if (editId) res = await api.put(`/api/products/${editId}/`, payload);
      else res = await api.post("/api/products/", payload);

      const warnings = res?.data?.warnings || [];
      if (warnings.length) {
        pushToast?.({ message: warnings.join(" "), type: "warn" });
      } else {
        pushToast?.({ message: editId ? "Produit mis à jour." : "Produit ajouté.", type: "success" });
      }

      resetForm();
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

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.internal_sku?.toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <PageTransition>
      <Helmet>
        <title>{wording.itemPlural} | StockScan</title>
        <meta name="description" content={ux.productsIntro} />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">{wording.itemPlural}</div>
          <h1 className="text-2xl font-black">{ux.productsTitle}</h1>
          <p className="text-slate-600 text-sm">{ux.productsIntro}</p>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {services?.length > 0 && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Service</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  value={serviceId || ""}
                  onChange={(e) => selectService(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {services.length > 1 && <option value="all">Tous les services (lecture)</option>}
                </select>
              </label>
            )}

            <Input
              label="Recherche"
              placeholder={ux.searchHint}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex gap-2">
              <Button onClick={load} loading={loading}>
                Rafraîchir
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setSearch("");
                  pushToast?.({ message: "Recherche réinitialisée.", type: "info" });
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>

          {isAllServices && (
            <div className="text-sm text-slate-600">
              Mode lecture multi-services : sélectionnez un service précis pour ajouter ou modifier.
            </div>
          )}

          <form onSubmit={submit}>
            <fieldset disabled={isAllServices || loading} className="grid md:grid-cols-4 gap-3">
              <Input
                label={wording.itemLabel}
                placeholder={placeholders.name}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />

              {categories.length > 0 ? (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">{wording.categoryLabel}</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  >
                    <option value="">Aucune</option>
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Catégories du service sélectionné.</p>
                </label>
              ) : (
                <Input
                  label={wording.categoryLabel}
                  placeholder={placeholders.category}
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  helper={helpers.category}
                />
              )}

              <Input
                label="Quantité"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
              />

              {(countingMode === "weight" || countingMode === "volume" || countingMode === "mixed") && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Unité</span>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  >
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {barcodeEnabled && (
                <Input
                  label={wording.barcodeLabel}
                  placeholder="Scannez ou saisissez"
                  value={form.barcode}
                  onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                  helper={helpers.barcode}
                />
              )}

              {skuEnabled && (
                <Input
                  label={wording.skuLabel}
                  placeholder={placeholders.sku}
                  value={form.internal_sku}
                  onChange={(e) => setForm((p) => ({ ...p, internal_sku: e.target.value }))}
                  helper={!form.barcode && !form.internal_sku ? helpers.sku : "Optionnel"}
                />
              )}

              {purchaseEnabled && (
                <Input
                  label="Prix d’achat (€)"
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
                  label="Prix de vente (€)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                  helper={priceRecommended && !form.selling_price ? "Recommandé pour exports et pilotage." : "Optionnel"}
                />
              )}

              {dlcEnabled && (
                <Input
                  label="DLC"
                  type="date"
                  value={form.dlc}
                  onChange={(e) => setForm((p) => ({ ...p, dlc: e.target.value }))}
                  helper={dlcRecommended && !form.dlc ? "Recommandée pour limiter pertes et oublis." : "Optionnel"}
                />
              )}

              <div className="md:col-span-4 flex gap-3 flex-wrap">
                <Button type="submit" loading={loading} disabled={isAllServices}>
                  {editId ? "Mettre à jour" : "Ajouter"}
                </Button>

                <Button variant="secondary" type="button" onClick={resetForm} disabled={isAllServices || loading}>
                  Réinitialiser
                </Button>
              </div>
            </fieldset>
          </form>

          {err && <div className="text-sm text-red-600">{err}</div>}
        </Card>

        <Card className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-slate-500">{ux.emptyProducts}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-slate-600">
                    <th className="text-left px-4 py-3">{wording.itemLabel}</th>
                    <th className="text-left px-4 py-3">{wording.categoryLabel}</th>
                    {isAllServices && <th className="text-left px-4 py-3">Service</th>}
                    <th className="text-left px-4 py-3">Quantité</th>
                    <th className="text-left px-4 py-3">
                      {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                    </th>
                    {!isAllServices && <th className="text-left px-4 py-3">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-700">{p.category || "—"}</td>

                      {isAllServices && (
                        <td className="px-4 py-3 text-slate-700">{p.__service_name || readableServiceName(p.service)}</td>
                      )}

                      <td className="px-4 py-3 text-slate-700">{p.quantity}</td>

                      <td className="px-4 py-3 text-slate-700">
                        {p.barcode || p.internal_sku || "—"}
                      </td>

                      {!isAllServices && (
                        <td className="px-4 py-3 text-slate-700">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditId(p.id);
                              setForm({
                                name: p.name || "",
                                category: p.category || "",
                                quantity: p.quantity || 1,
                                barcode: p.barcode || "",
                                internal_sku: p.internal_sku || "",
                                purchase_price: p.purchase_price || "",
                                selling_price: p.selling_price || "",
                                dlc: p.dlc || "",
                                unit: p.unit || unitOptions[0],
                              });
                              pushToast?.({ message: "Produit pré-rempli : modifiez puis validez.", type: "info" });
                            }}
                          >
                            Pré-remplir
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}