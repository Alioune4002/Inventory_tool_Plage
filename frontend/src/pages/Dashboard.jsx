import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import AIAssistantPanel from "../components/AIAssistantPanel";
import BillingBanners from "../components/BillingBanners";
import useEntitlements from "../app/useEntitlements";

const fmtCurrency = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—";
const fmtNumber = (n) => (typeof n === "number" ? n.toLocaleString("fr-FR") : "—");
const safeArray = (v) => (Array.isArray(v) ? v : []);

function getDashboardCopy(serviceType, tenantDomain, isAll) {
  const isGeneral = tenantDomain === "general" || serviceType === "retail_general";
  const isPharma = serviceType === "pharmacy_parapharmacy";
  const isBar = serviceType === "bar";
  const isBakery = serviceType === "bakery";
  const isKitchen = serviceType === "kitchen";
  const isDining = serviceType === "restaurant_dining";

  const title = isAll ? "Dashboard (multi-services)" : "Dashboard";
  const subtitle = isAll
    ? "Vue consolidée : valeurs, catégories et pertes sur tous les services."
    : "Valeur de stock, catégories, pertes et aperçu des produits.";

  const stockLabel = isPharma
    ? "Valeur stock (achat)"
    : isGeneral
    ? "Valeur stock (achat)"
    : "Valeur stock (achat)";

  const sellingLabel = isGeneral ? "Valeur stock (vente)" : "Valeur stock (vente)";
  const marginHelper = isKitchen
    ? "Cuisine : marge non prioritaire (prix souvent désactivés)"
    : "Basé sur le stock actuel (hors ventes réelles)";

  const lossHelper = isPharma
    ? "Pertes : casse / péremption / erreurs (déclaré)"
    : isBakery
    ? "Pertes : invendus / 24h / casse (déclaré)"
    : isBar || isDining
    ? "Pertes : casse / offerts / erreurs (déclaré)"
    : "Pertes : casse / DLC / vol (déclaré)";

  const productsHelper = isAll ? "Total sur tous les services (mois sélectionné)" : "Mois et service sélectionnés";

  return {
    title,
    subtitle,
    stockLabel,
    sellingLabel,
    marginHelper,
    lossHelper,
    productsHelper,
    categoryTitle: isAll ? "Répartition par catégorie (global)" : "Répartition par catégorie",
    productsTitle: isAll ? "Produits (aperçu global)" : "Produits suivis",
  };
}

export default function Dashboard() {
  const { services, serviceId, selectService, tenant, currentService, isAllServices, serviceProfile } = useAuth();
  const { data: entitlements } = useEntitlements();
  const pushToast = useToast();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    total_value: 0,
    total_selling_value: 0,
    losses_total_cost: 0,
    losses_total_qty: 0,
    service_totals: {},
    by_category: [],
    by_product: [],
    losses_by_reason: [],
  });

  const [productsCount, setProductsCount] = useState(0);

  const tenantDomain = tenant?.domain || "food";
  const serviceType = serviceProfile?.service_type || currentService?.service_type || "other";

  const copy = useMemo(() => getDashboardCopy(serviceType, tenantDomain, isAllServices), [serviceType, tenantDomain, isAllServices]);

  const badgeText = useMemo(() => {
    if (isAllServices) return `Tous les services — ${month}`;
    const label = currentService?.name || "Service";
    return `${label} — ${month}`;
  }, [isAllServices, currentService, month]);

  const loadData = async () => {
    if (!serviceId && !isAllServices) return;
    setLoading(true);

    try {
      if (isAllServices) {
        const calls = services.map((s) =>
          Promise.all([
            api.get(`/api/inventory-stats/?month=${month}&service=${s.id}`),
            api.get(`/api/products/?month=${month}&service=${s.id}`),
          ]).then(([st, pr]) => ({
            service: s,
            stats: st.data || {},
            products: Array.isArray(pr.data) ? pr.data : [],
          }))
        );

        const results = await Promise.all(calls);

        const aggregated = results.reduce(
          (acc, r) => {
            acc.total_value += r.stats.total_value || 0;
            acc.total_selling_value += r.stats.total_selling_value || 0;
            acc.losses_total_cost += r.stats.losses_total_cost || 0;
            acc.losses_total_qty += r.stats.losses_total_qty || 0;

            safeArray(r.stats.by_category).forEach((c) => {
              const key = c.category || "Non catégorisé";
              const existing = acc.by_category.find((x) => x.category === key);
              if (existing) {
                existing.total_quantity += c.total_quantity || 0;
                existing.total_purchase_value += c.total_purchase_value || 0;
                existing.total_selling_value += c.total_selling_value || 0;
                existing.losses_qty += c.losses_qty || 0;
              } else {
                acc.by_category.push({
                  category: key,
                  total_quantity: c.total_quantity || 0,
                  total_purchase_value: c.total_purchase_value || 0,
                  total_selling_value: c.total_selling_value || 0,
                  losses_qty: c.losses_qty || 0,
                });
              }
            });

            acc.by_product.push(
              ...safeArray(r.stats.by_product).map((p) => ({ ...p, __service_name: r.service?.name }))
            );

            safeArray(r.stats.losses_by_reason).forEach((lr) => {
              const existing = acc.losses_by_reason.find((x) => x.reason === lr.reason);
              if (existing) {
                existing.total_qty = (existing.total_qty || 0) + (lr.total_qty || 0);
                existing.total_cost = (existing.total_cost || 0) + (lr.total_cost || 0);
              } else {
                acc.losses_by_reason.push({ ...lr });
              }
            });

            acc.productsCount += r.products.length;
            return acc;
          },
          {
            total_value: 0,
            total_selling_value: 0,
            losses_total_cost: 0,
            losses_total_qty: 0,
            by_category: [],
            by_product: [],
            losses_by_reason: [],
            service_totals: {},
            productsCount: 0,
          }
        );

        aggregated.service_totals = {
          purchase_value: aggregated.total_value,
          selling_value: aggregated.total_selling_value,
          losses_qty: aggregated.losses_total_qty,
          losses_cost: aggregated.losses_total_cost,
        };

        setStats(aggregated);
        setProductsCount(aggregated.productsCount);
      } else {
        const [statsRes, listRes] = await Promise.all([
          api.get(`/api/inventory-stats/?month=${month}&service=${serviceId}`),
          api.get(`/api/products/?month=${month}&service=${serviceId}`),
        ]);

        setStats(
          statsRes.data || {
            total_value: 0,
            total_selling_value: 0,
            losses_total_cost: 0,
            losses_total_qty: 0,
            by_category: [],
            by_product: [],
            losses_by_reason: [],
            service_totals: {},
          }
        );

        const list = Array.isArray(listRes.data) ? listRes.data : [];
        setProductsCount(list.length);
      }
    } catch (e) {
      pushToast?.({
        message: "Impossible de charger les données (auth/service ?)",
        type: "error",
      });
      setStats({
        total_value: 0,
        total_selling_value: 0,
        losses_total_cost: 0,
        losses_total_qty: 0,
        by_category: [],
        by_product: [],
        losses_by_reason: [],
        service_totals: {},
      });
      setProductsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month]);

  const purchaseValue = stats.service_totals?.purchase_value ?? stats.total_value ?? 0;
  const sellingValue = stats.service_totals?.selling_value ?? stats.total_selling_value ?? 0;
  const marginValue = (sellingValue || 0) - (purchaseValue || 0);

  const lossesCost = stats.losses_total_cost || 0;
  const lossesQty = stats.losses_total_qty || 0;

  const kpis = [
    {
      label: copy.stockLabel,
      value: fmtCurrency(purchaseValue),
      helper: isAllServices ? "Somme sur tous les services" : "Mois et service sélectionnés",
    },
    {
      label: copy.sellingLabel,
      value: fmtCurrency(sellingValue),
      helper: "Projection prix de vente (si renseigné)",
    },
    {
      label: "Marge potentielle",
      value: fmtCurrency(marginValue),
      helper: copy.marginHelper,
    },
    {
      label: "Produits suivis",
      value: productsCount,
      helper: copy.productsHelper,
    },
    {
      label: "Pertes du mois",
      value: lossesCost > 0 ? fmtCurrency(lossesCost) : `${fmtNumber(lossesQty)} u.`,
      helper: copy.lossHelper,
    },
  ];

  const categories = safeArray(stats.by_category);
  const lossesByReason = safeArray(stats.losses_by_reason);
  const products = safeArray(stats.by_product);

  return (
    <PageTransition>
      <Helmet>
        <title>{copy.title} | StockScan</title>
        <meta name="description" content="Dashboard inventaire : valeur de stock, catégories, pertes, aperçu produits." />
      </Helmet>

      <div className="grid gap-4">
        <BillingBanners entitlements={entitlements} />

        <Card className="p-6 space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{copy.subtitle}</div>
              <div className="text-2xl font-black tracking-tight">{copy.title}</div>
            </div>
            <Badge variant="info">{badgeText}</Badge>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {services?.length > 0 && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Service</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  value={serviceId || ""}
                  onChange={(e) => selectService(e.target.value)}
                >
                  {services.length > 1 && <option value="all">Tous les services</option>}
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex gap-2">
              <Button onClick={loadData} loading={loading} className="w-full">
                Rafraîchir
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5" hover>
              <div className="text-xs text-slate-500">{k.label}</div>
              <div className="mt-2 text-3xl font-black">{loading ? "…" : k.value ?? "—"}</div>
              <div className="mt-1 text-sm text-slate-500">{k.helper}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">{copy.categoryTitle}</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${categories.length || 0} catégories`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : categories.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {categories.map((c) => {
                const maxPurchase = Math.max(...categories.map((x) => x.total_purchase_value || 0), 1) || 1;
                const width = Math.max(((c.total_purchase_value || 0) / maxPurchase) * 100, 6);

                return (
                  <Card key={c.category || "aucune"} className="p-4 space-y-2" hover>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">{c.category || "Non catégorisé"}</div>
                      <Badge variant="neutral">{fmtNumber(c.total_quantity || 0)} u.</Badge>
                    </div>

                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      Achat : {fmtCurrency(c.total_purchase_value || 0)} · Vente : {fmtCurrency(c.total_selling_value || 0)}
                    </div>

                    <div className="text-xs text-rose-500">Pertes : {fmtNumber(c.losses_qty || 0)} u.</div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              Aucune donnée pour ce mois. Ajoutez des produits (ou changez de mois/service).
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Pertes par raison</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${lossesByReason.length || 0} raisons`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : lossesByReason.length ? (
            <div className="space-y-2">
              {lossesByReason.map((l) => {
                const maxCost = Math.max(...lossesByReason.map((x) => x.total_cost || 0), 1);
                const width = Math.max(((l.total_cost || 0) / maxCost) * 100, 8);
                return (
                  <div key={l.reason} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>{l.reason}</span>
                      <span>
                        {fmtCurrency(l.total_cost || 0)} — {fmtNumber(l.total_qty || 0)} u.
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Aucune perte déclarée sur cette période.</div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">{copy.productsTitle}</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${products.length || 0} lignes`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : products.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {products.slice(0, 10).map((p, idx) => (
                <Card key={`${p.name}-${idx}`} className="p-4 space-y-1" hover>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                    <div className="flex gap-2 items-center">
                      {isAllServices && (
                        <Badge variant="neutral">{p.__service_name || "Service"}</Badge>
                      )}
                      <Badge variant="neutral">{p.category || "—"}</Badge>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    Stock : {fmtNumber(p.stock_final || 0)} {p.unit || ""}
                  </div>

                  <div className="text-xs text-slate-500">Valeur achat : {fmtCurrency(p.purchase_value_current || 0)}</div>
                  <div className="text-xs text-slate-500">Valeur vente : {fmtCurrency(p.selling_value_current || 0)}</div>

                  <div className="text-xs text-rose-500">Pertes : {fmtNumber(p.losses_qty || 0)} u.</div>

                  {p.notes?.length ? (
                    <div className="text-xs text-amber-700">{p.notes.join(" ")}</div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Astuce : renseignez prix d’achat/vente pour des stats plus précises.
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              Ajoutez des produits pour voir les valeurs et pertes. Le dashboard devient utile dès 10–20 lignes.
            </div>
          )}
        </Card>

        <AIAssistantPanel month={month} serviceId={serviceId} />
      </div>
    </PageTransition>
  );
}