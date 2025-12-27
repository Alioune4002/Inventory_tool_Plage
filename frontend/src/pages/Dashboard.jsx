// frontend/src/pages/Dashboard.jsx
// Deployed backend: https://inventory-tool-plage.onrender.com
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Skeleton from "../ui/Skeleton";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import AIAssistantPanel from "../components/AIAssistantPanel";
import AlertsPanel from "../components/AlertsPanel";
import { getWording, getUxCopy } from "../lib/labels";

const fmtCurrency = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—";
const fmtNumber = (n) => (typeof n === "number" ? n.toLocaleString("fr-FR") : "—");
const safeArray = (v) => (Array.isArray(v) ? v : []);
const fmtDateTime = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("fr-FR");
  } catch {
    return String(v);
  }
};

function getDashboardCopy(serviceType, tenantDomain, isAll, itemTypeEnabled, wording) {
  const isGeneral = tenantDomain === "general" || serviceType === "retail_general";
  const isPharma = serviceType === "pharmacy_parapharmacy";
  const isBar = serviceType === "bar";
  const isBakery = serviceType === "bakery";
  const isKitchen = serviceType === "kitchen";
  const isDining = serviceType === "restaurant_dining";
  const itemPlural = (wording?.itemPlural || "Produits").toLowerCase();

  const title = isAll ? "Dashboard (multi-services)" : "Dashboard";
  const subtitle = isAll
    ? "Vue consolidée : valeurs, catégories et pertes sur tous les services."
    : "Valeur de stock, catégories, pertes et comptage du mois.";

  const stockLabel = isPharma ? "Valeur stock (achat)" : isGeneral ? "Valeur stock (achat)" : "Valeur stock (achat)";
  const sellingLabel = itemTypeEnabled ? "Valeur stock (vente potentielle)" : "Valeur stock (vente)";
  const marginHelper =
    isKitchen || isDining || isBakery
      ? "Marge estimée selon prix d'achat/vente saisis (hors ventes réelles)."
      : "Basé sur le stock actuel (hors ventes réelles)";

  const lossHelper = isPharma
    ? "Pertes : casse / péremption / erreurs (déclaré)"
    : isBakery
      ? "Pertes : invendus / 24h / casse (déclaré)"
      : isBar || isDining
        ? "Pertes : casse / offerts / erreurs (déclaré)"
        : "Pertes : casse / DLC / vol (déclaré)";

  const productsHelper = isAll
    ? "Total des comptages sur tous les services (mois sélectionné)"
    : "Comptages du mois et service sélectionnés";

  return {
    title,
    subtitle,
    stockLabel,
    sellingLabel,
    marginHelper,
    lossHelper,
    productsHelper,
    categoryTitle: isAll ? "Répartition par catégorie (global)" : "Répartition par catégorie",
    productsTitle: isAll ? `Comptages (${itemPlural})` : `Comptages ${itemPlural}`,
    inventoryCountLabel: `Comptages ${itemPlural}`,
  };
}

export default function Dashboard() {
  const {
    services,
    serviceId,
    selectService,
    tenant,
    currentService,
    isAllServices,
    serviceProfile,
    serviceFeatures,
  } = useAuth();
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

  // ✅ Admin panel (owner)
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [membersSummary, setMembersSummary] = useState({ members: [], recent_activity: [] });

  const tenantDomain = tenant?.domain || "food";
  const serviceType = serviceProfile?.service_type || currentService?.service_type || "other";
  const serviceDomain = serviceType === "retail_general" ? "general" : tenantDomain;

  const wording = useMemo(() => getWording(serviceType, serviceDomain), [serviceType, serviceDomain]);
  const ux = useMemo(() => getUxCopy(serviceType, serviceDomain), [serviceType, serviceDomain]);

  const priceCfg = serviceFeatures?.prices || {};
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const itemTypeEnabled = serviceFeatures?.item_type?.enabled === true;

  const copy = useMemo(
    () => getDashboardCopy(serviceType, tenantDomain, isAllServices, itemTypeEnabled, wording),
    [serviceType, tenantDomain, isAllServices, itemTypeEnabled, wording]
  );

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
        const calls = (services || []).map((s) =>
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
        message:
          "Oups… impossible de charger le dashboard. Vérifie le service sélectionné et reconnecte-toi si besoin.",
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

  const loadMembersSummary = async () => {
    setMembersLoading(true);
    try {
      const res = await api.get("/api/auth/members/summary/");
      const data = res?.data || { members: [], recent_activity: [] };
      setMembersSummary({
        members: safeArray(data.members),
        recent_activity: safeArray(data.recent_activity),
      });
      setMembersVisible(true);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        setMembersVisible(false);
        setMembersSummary({ members: [], recent_activity: [] });
      } else {
        setMembersVisible(false);
        pushToast?.({
          message: "Impossible de charger la section équipe pour l’instant. Réessaie dans quelques secondes.",
          type: "error",
        });
      }
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month, isAllServices]);

  useEffect(() => {
    loadMembersSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchaseValue = stats.service_totals?.purchase_value ?? stats.total_value ?? 0;
  const sellingValue = stats.service_totals?.selling_value ?? stats.total_selling_value ?? 0;
  const marginValue = sellingEnabled ? (sellingValue || 0) - (purchaseValue || 0) : null;

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
      value: sellingEnabled ? fmtCurrency(sellingValue) : "—",
      helper: itemTypeEnabled
        ? "Peut exclure les matières premières si le type d’article est activé."
        : "Projection basée sur vos prix de vente (si renseignés).",
    },
    {
      label: "Marge potentielle",
      value: sellingEnabled ? fmtCurrency(marginValue) : "—",
      helper: sellingEnabled
        ? copy.marginHelper
        : "Astuce : activez “Prix de vente” dans Settings → Modules pour estimer la marge.",
    },
    {
      label: copy.inventoryCountLabel,
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

  const members = safeArray(membersSummary.members);
  const recentActivity = safeArray(membersSummary.recent_activity);

  const maxCategoryPurchase = useMemo(() => {
    const vals = categories.map((x) => x.total_purchase_value || 0);
    const max = Math.max(...vals, 1);
    return max || 1;
  }, [categories]);

  const maxLossCost = useMemo(() => {
    const vals = lossesByReason.map((x) => x.total_cost || 0);
    const max = Math.max(...vals, 1);
    return max || 1;
  }, [lossesByReason]);

  const showServiceSelect = (services || []).length > 0;

  return (
    <PageTransition>
      <Helmet>
        <title>{copy.title} | StockScan</title>
        <meta name="description" content={ux.inventoryIntro || "Dashboard inventaire : valeur, catégories, pertes."} />
      </Helmet>

      <div className="grid gap-4 min-w-0">
        {/* Admin principal: équipe + traçabilité */}
        {membersVisible ? (
          <Card className="p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap min-w-0">
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src="/icon.svg"
                  alt="StockScan"
                  className="h-10 w-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shrink-0"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <div className="text-sm text-[var(--muted)]">Espace admin</div>
                  <div className="text-2xl font-black tracking-tight text-[var(--text)]">Équipe & activité</div>
                  <div className="text-sm text-[var(--muted)]">
                    Visualisez les accès par service et gardez un œil sur ce qui bouge.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Button variant="secondary" onClick={loadMembersSummary} loading={membersLoading}>
                  Rafraîchir
                </Button>
                <Badge variant="neutral">{membersLoading ? "Chargement…" : `${members.length} membre(s)`}</Badge>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 min-w-0">
              <Card className="p-4 space-y-3 min-w-0" hover>
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] min-w-0">Membres & rôles</div>
                  <Badge variant="info">Admin</Badge>
                </div>

                {membersLoading ? (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : members.length ? (
                  <div className="space-y-2 min-w-0">
                    {members.map((m) => {
                      const scope = m?.service_scope?.name ? `Service : ${m.service_scope.name}` : "Accès : multi-services";
                      const last = m?.last_action?.action
                        ? `${m.last_action.action} · ${fmtDateTime(m.last_action.at)}`
                        : "—";
                      const role = (m?.role || "operator").toUpperCase();
                      const user = m?.user || {};
                      return (
                        <Card key={m.id} className="p-4 min-w-0" hover>
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="min-w-0">
                              {/*  plus de truncate ici => wrap + break-anywhere */}
                              <div className="text-sm font-semibold text-[var(--text)] break-anywhere">
                                <span>{user.username || "Utilisateur"}</span>{" "}
                                <span className="text-[var(--muted)] font-normal">·</span>{" "}
                                <span className="text-[var(--muted)] font-semibold break-anywhere">
                                  {user.email || "—"}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--muted)] mt-1 break-anywhere">
                                {scope} · Dernière activité : {last}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <Badge variant={role === "OWNER" ? "info" : "neutral"}>{role}</Badge>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">Aucun membre à afficher pour l’instant.</div>
                )}
              </Card>

              <Card className="p-4 space-y-3 min-w-0" hover>
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] min-w-0">Activité récente</div>
                  <Badge variant="neutral">{recentActivity.length} évènement(s)</Badge>
                </div>

                {membersLoading ? (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : recentActivity.length ? (
                  <div className="space-y-2 min-w-0">
                    {recentActivity.slice(0, 12).map((a, idx) => {
                      const who = a?.user?.username || "system";
                      const action = a?.action || "—";
                      const when = fmtDateTime(a?.at);
                      const obj = a?.object_type
                        ? `${a.object_type}${a.object_id ? `#${a.object_id}` : ""}`
                        : "";

                      return (
                        <div
                          key={`${action}-${idx}`}
                          className="flex items-start justify-between gap-3 min-w-0"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)] break-anywhere">
                              {action} <span className="text-[var(--muted)] font-normal">·</span>{" "}
                              <span className="text-[var(--muted)]">{who}</span>
                              {obj ? <span className="text-[var(--muted)] font-normal"> · {obj}</span> : null}
                            </div>
                            <div className="text-xs text-[var(--muted)]">{when}</div>
                          </div>
                          <div className="shrink-0">
                            <Badge variant="neutral">{action}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">
                    Rien à afficher ici pour le moment — dès qu’un membre agit, l’activité apparaîtra.
                  </div>
                )}
              </Card>
            </div>

            <div className="text-xs text-[var(--muted)]">
              Astuce : gérez les rôles et le scope service depuis{" "}
              <span className="font-semibold text-[var(--text)]">Settings → Équipe</span>.
            </div>
          </Card>
        ) : null}

        {/* Dashboard header */}
        <Card className="p-6 space-y-3 min-w-0">
          <div className="flex flex-wrap gap-3 items-center justify-between min-w-0">
            <div className="flex items-start gap-3 min-w-0">
              <img src="/logo_dark.svg" alt="StockScan" className="h-10 hidden sm:block" loading="lazy" />
              <div className="min-w-0">
                <div className="text-sm text-[var(--muted)]">{copy.subtitle}</div>
                <div className="text-2xl font-black tracking-tight text-[var(--text)]">{copy.title}</div>
              </div>
            </div>
            <Badge variant="info">{badgeText}</Badge>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 items-end min-w-0">
            <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

            {showServiceSelect && (
              <label className="space-y-1.5 min-w-0">
                <span className="text-sm font-medium text-[var(--text)]">Service</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                  value={isAllServices ? "all" : serviceId || ""}
                  onChange={(e) => selectService(e.target.value)}
                  aria-label="Sélection du service"
                >
                  {(services || []).length > 1 && <option value="all">Tous les services</option>}
                  {(services || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex gap-2 min-w-0">
              <Button onClick={loadData} loading={loading} className="w-full">
                Rafraîchir
              </Button>
            </div>
          </div>

          <div className="text-xs text-[var(--muted)]">
            Conseil : démarrez avec un comptage simple (10–20 lignes). Le dashboard devient très parlant dès les premiers cycles.
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-4 min-w-0">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5 min-w-0" hover>
              <div className="text-xs text-[var(--muted)]">{k.label}</div>
              <div className="mt-2 text-3xl font-black text-[var(--text)]">{loading ? "…" : k.value ?? "—"}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{k.helper}</div>
            </Card>
          ))}
        </div>

        {/* Categories */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] min-w-0">{copy.categoryTitle}</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${categories.length || 0} catégories`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : categories.length ? (
            <div className="grid sm:grid-cols-2 gap-3 min-w-0">
              {categories.map((c) => {
                const width = Math.max(((c.total_purchase_value || 0) / maxCategoryPurchase) * 100, 6);

                return (
                  <Card key={c.category || "aucune"} className="p-4 space-y-2 min-w-0" hover>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)] min-w-0 break-anywhere">
                        {c.category || "Non catégorisé"}
                      </div>
                      <Badge variant="neutral">{fmtNumber(c.total_quantity || 0)} u.</Badge>
                    </div>

                    <div className="h-2.5 rounded-full bg-[var(--accent)]/25 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="text-xs text-[var(--muted)] break-anywhere">
                      Achat : {fmtCurrency(c.total_purchase_value || 0)} · Vente : {fmtCurrency(c.total_selling_value || 0)}
                    </div>

                    <div className="text-xs text-rose-500 dark:text-rose-300">
                      Pertes : {fmtNumber(c.losses_qty || 0)} u.
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Pas encore de données sur cette période. Lancez un comptage, ou changez de mois/service ✨
            </div>
          )}
        </Card>

        {/* Losses */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] min-w-0">Pertes par raison</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${lossesByReason.length || 0} raisons`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : lossesByReason.length ? (
            <div className="space-y-2 min-w-0">
              {lossesByReason.map((l) => {
                const width = Math.max(((l.total_cost || 0) / maxLossCost) * 100, 8);
                return (
                  <div key={l.reason} className="space-y-1 min-w-0">
                    <div className="flex justify-between gap-3 text-xs font-semibold text-[var(--muted)] min-w-0">
                      <span className="min-w-0 break-anywhere">{l.reason}</span>
                      <span className="shrink-0">
                        {fmtCurrency(l.total_cost || 0)} — {fmtNumber(l.total_qty || 0)} u.
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[var(--accent)]/25 overflow-hidden">
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
            <div className="text-sm text-[var(--muted)]">
              Aucune perte déclarée sur cette période. (Et ça, c’est une bonne nouvelle 😄)
            </div>
          )}
        </Card>

        {/* Products preview */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] min-w-0">{copy.productsTitle}</div>
            <Badge variant="neutral">{loading ? "Chargement" : `${products.length || 0} lignes`}</Badge>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products.length ? (
            <div className="grid sm:grid-cols-2 gap-3 min-w-0">
              {products.slice(0, 10).map((p, idx) => (
                <Card key={`${p.name}-${idx}`} className="p-4 space-y-1 min-w-0" hover>
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] min-w-0 break-anywhere">
                      {p.name}
                    </div>
                    <div className="flex gap-2 items-center flex-wrap justify-end">
                      {isAllServices && <Badge variant="neutral">{p.__service_name || "Service"}</Badge>}
                      <Badge variant="neutral">{p.category || "—"}</Badge>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--muted)]">
                    Stock : {fmtNumber(p.stock_final || 0)} {p.unit || ""}
                  </div>

                  <div className="text-xs text-[var(--muted)]">Valeur achat : {fmtCurrency(p.purchase_value_current || 0)}</div>
                  <div className="text-xs text-[var(--muted)]">Valeur vente : {fmtCurrency(p.selling_value_current || 0)}</div>

                  <div className="text-xs text-rose-500 dark:text-rose-300">Pertes : {fmtNumber(p.losses_qty || 0)} u.</div>

                  {p.notes?.length ? (
                    <div className="text-xs text-amber-700 dark:text-amber-200 break-anywhere">
                      {p.notes.join(" ")}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--muted)]">
                      Astuce : ajoutez vos prix d’achat/vente pour des stats ultra précises.
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Ajoutez des comptages pour voir les valeurs et pertes. Le dashboard devient vraiment parlant dès 10–20 lignes.
            </div>
          )}
        </Card>

        <AlertsPanel />
        <AIAssistantPanel month={month} serviceId={isAllServices ? "all" : serviceId} />
      </div>
    </PageTransition>
  );
}
