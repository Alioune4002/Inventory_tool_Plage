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
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";

export default function Products() {
  const { serviceId, services, selectService, serviceFeatures, countingMode, tenant, serviceProfile } = useAuth();
  const pushToast = useToast();

  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editMonth, setEditMonth] = useState(null);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [form, setForm] = useState({
    name: "",
    category: "",
    barcode: "",
    internal_sku: "",
    brand: "",
    supplier: "",
    notes: "",
    product_role: "",
    purchase_price: "",
    selling_price: "",
    tva: "20",
    unit: "pcs",
  });

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const isAllServices = services?.length > 1 && String(serviceId) === "all";
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

  const barcodeEnabled = getFeatureFlag("barcode", familyIdentifiers.barcode ?? true);
  const skuEnabled = getFeatureFlag("sku", familyIdentifiers.sku ?? true);
  const multiUnitEnabled = getFeatureFlag("multi_unit", familyModules.includes("multiUnit"));
  const itemTypeEnabled = getFeatureFlag("item_type", familyModules.includes("itemType"));

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
  const vatOptions = ["0", "5.5", "10", "20"];
  const showUnit = multiUnitEnabled || countingMode !== "unit";

  const readableServiceName = (id) => services?.find((s) => String(s.id) === String(id))?.name || id;

  const load = async () => {
    if (!serviceId) return;
    setLoading(true);
    setErr("");

    try {
      if (isAllServices) {
        const calls = services.map((s) =>
          api
            .get(`/api/products/?service=${s.id}`)
            .then((res) => ({ service: s, items: Array.isArray(res.data) ? res.data : [] }))
        );

        const results = await Promise.all(calls);
        const merged = results.flatMap((r) => r.items.map((it) => ({ ...it, __service_name: r.service.name })));
        setItems(merged);
      } else {
        const res = await api.get(`/api/products/?service=${serviceId}`);
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
      barcode: "",
      internal_sku: "",
      brand: "",
      supplier: "",
      notes: "",
      product_role: "",
      purchase_price: "",
      selling_price: "",
      tva: "20",
      unit: unitOptions[0],
    });
    setEditId(null);
    setEditMonth(null);
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
        quantity: 0,
        inventory_month: editMonth || currentMonth,
        service: serviceId,
        unit: form.unit || "pcs",
        brand: form.brand.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || "",
      };

      // identifiants
      const cleanedBarcode = (form.barcode || "").trim();
      const cleanedSku = (form.internal_sku || "").trim();

      if (barcodeEnabled) payload.barcode = cleanedBarcode;
      else payload.barcode = "";

      if (skuEnabled) {
        payload.internal_sku = cleanedSku;
      } else {
        payload.internal_sku = "";
      }

      if (purchaseEnabled) payload.purchase_price = form.purchase_price || null;
      if (sellingEnabled) payload.selling_price = form.selling_price || null;
      if (purchaseEnabled || sellingEnabled) {
        payload.tva = form.tva === "" ? null : Number(form.tva);
      }
      if (itemTypeEnabled) payload.product_role = form.product_role || null;

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
        if (dateA > dateB) {
          map.set(key, item);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [items]);

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
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  useEffect(() => {
    setPage(1);
  }, [search, totalPages]);
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

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
          <div className="text-xs text-slate-500">{catalogueNote}</div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
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
                  placeholder={categoryPlaceholder}
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  helper={helpers.category}
                />
              )}

              {showUnit && (
                <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{unitLabel}</span>
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

              {itemTypeEnabled && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Type d’article</span>
                  <select
                    value={form.product_role}
                    onChange={(e) => setForm((p) => ({ ...p, product_role: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  >
                    {productRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    {helpers.productRole ||
                      "Matière première = coût, produit fini = vente. Utile pour la marge estimée."}
                  </p>
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

              <Input
                label="Marque / laboratoire"
                placeholder={placeholders.brand || "Ex. Sanofi, Nike, Brasserie X"}
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              />

              <Input
                label="Fournisseur"
                placeholder={placeholders.supplier || "Ex. Metro, Promocash, Centrale"}
                value={form.supplier}
                onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
              />

              {purchaseEnabled && (
                <Input
                  label="Prix d’achat HT (€)"
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
                  label="Prix de vente HT (€)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                  helper={priceRecommended && !form.selling_price ? "Recommandé pour exports et pilotage." : "Optionnel"}
                />
              )}

              {(purchaseEnabled || sellingEnabled) && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">TVA</span>
                  <select
                    value={form.tva}
                    onChange={(e) => setForm((p) => ({ ...p, tva: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  >
                    {vatOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Prix saisis en HT. La TVA sert aux exports et estimations.
                  </p>
                </label>
              )}

              <Input
                label="Notes internes"
                placeholder={placeholders.notes || "Ex. Rotation lente, saisonnier, fragile…"}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />

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

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-slate-500">Résultats</div>
              <div className="text-lg font-semibold">{filteredItems.length} élément(s)</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>
                Page {page} / {totalPages}
              </span>
              <span>
                Affichage {paginatedItems.length} / {filteredItems.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
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
                    <th className="text-left px-4 py-3">
                      {barcodeEnabled ? wording.barcodeLabel : "Identifiant"} {skuEnabled ? `/ ${wording.skuLabel}` : ""}
                    </th>
                    {(purchaseEnabled || sellingEnabled) && (
                      <th className="text-left px-4 py-3">Prix & TVA</th>
                    )}
                    {showUnit && <th className="text-left px-4 py-3">Unité</th>}
                    {!isAllServices && <th className="text-left px-4 py-3">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.product_role && (
                          <div className="text-xs text-slate-500">
                            Type : {productRoleLabels[p.product_role] || p.product_role}
                          </div>
                        )}
                        {(p.brand || p.supplier) && (
                          <div className="text-xs text-slate-500">
                            {[p.brand, p.supplier].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.category || "—"}</td>

                      {isAllServices && (
                        <td className="px-4 py-3 text-slate-700">{p.__service_name || readableServiceName(p.service)}</td>
                      )}

                      <td className="px-4 py-3 text-slate-700">
                        <div className="space-y-1">
                          <div>{p.barcode || "—"}</div>
                          {skuEnabled && <div className="text-xs text-slate-500">{p.internal_sku || "SKU —"}</div>}
                        </div>
                      </td>

                      {(purchaseEnabled || sellingEnabled) && (
                        <td className="px-4 py-3 text-slate-700">
                          <div className="space-y-1">
                            {purchaseEnabled && (
                              <div>Achat: {p.purchase_price ? `${p.purchase_price} €` : "—"}</div>
                            )}
                            {sellingEnabled && (
                              <div className="text-xs text-slate-500">
                                Vente: {p.selling_price ? `${p.selling_price} €` : "—"} · TVA {p.tva ?? "—"}%
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {showUnit && <td className="px-4 py-3 text-slate-700">{p.unit || "—"}</td>}

                      {!isAllServices && (
                        <td className="px-4 py-3 text-slate-700">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditId(p.id);
                              setEditMonth(p.inventory_month || currentMonth);
                              setForm({
                                name: p.name || "",
                                category: p.category || "",
                                barcode: p.barcode || "",
                                internal_sku: p.internal_sku || "",
                                brand: p.brand || "",
                                supplier: p.supplier || "",
                                notes: p.notes || "",
                                product_role: p.product_role || "",
                                purchase_price: p.purchase_price || "",
                                selling_price: p.selling_price || "",
                                tva: p.tva === null || p.tva === undefined ? "20" : String(p.tva),
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

          {filteredItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                ← Précédent
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                Suivant →
              </Button>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
