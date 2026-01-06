// frontend/src/pages/Dashboard.jsx
// Deployed backend: https://inventory-tool-plage.onrender.com
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Skeleton from "../ui/Skeleton";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import AIAssistantPanel from "../components/AIAssistantPanel";
import AlertsPanel from "../components/AlertsPanel";
import PwaInstallCard from "../components/PwaInstallCard";
import { getWording, getUxCopy } from "../lib/labels";
import { formatCurrency } from "../lib/currency";

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

const ACTION_LABELS = {
  MEMBER_ADDED: "Membre ajouté",
  MEMBER_UPDATED: "Membre modifié",
  MEMBER_REMOVED: "Membre supprimé",
  EXPORT_SENT: "Export envoyé",
  INVITE_SENT: "Invitation envoyée",
  INVITE_ACCEPTED: "Invitation acceptée",
  LOGIN: "Connexion",
};

const OBJECT_LABELS = {
  Membership: "Membre",
  ExportEvent: "Export",
  Invitation: "Invitation",
  User: "Utilisateur",
};

const formatActionLabel = (action) => ACTION_LABELS[action] || action || "Action";
const formatObjectLabel = (type, id) => {
  if (!type) return "";
  const base = OBJECT_LABELS[type] || type;
  return id ? `${base} #${id}` : base;
};

// ✅ Traductions "safe" (anti-anglicismes) pour raisons de pertes
const normalizeLossReason = (reason) => {
  const r = String(reason || "").trim();
  const key = r.toLowerCase();
  const map = {
    breakage: "Casse",
    damaged: "Casse",
    damage: "Casse",
    expired: "Péremption",
    expiry: "Péremption",
    theft: "Vol",
    missing: "Manquant",
    shrinkage: "Démarque",
    wastage: "Gaspillage",
  };
  return map[key] || r || "—";
};

// ✅ Libellés inclusifs : "service" peut être rayon / zone / unité…
function getUnitLabels(serviceType, tenantDomain) {
  const t = String(serviceType || "").toLowerCase();
  const d = String(tenantDomain || "").toLowerCase();

  const isRetail = d === "general" || t === "retail_general" || t === "pharmacy_parapharmacy";
  const isFoodMulti = d === "food" && (t === "bar" || t === "restaurant_dining" || t === "kitchen" || t === "bakery");

  if (isRetail) return { one: "Rayon", all: "Tous les rayons", plural: "rayons" };
  if (isFoodMulti) return { one: "Zone", all: "Toutes les zones", plural: "zones" };
  return { one: "Service", all: "Tous les services", plural: "services" };
}

function getDashboardCopy(serviceType, tenantDomain, isAll, itemTypeEnabled, wording, unitLabels) {
  const isGeneral = tenantDomain === "general" || serviceType === "retail_general";
  const isPharma = serviceType === "pharmacy_parapharmacy";
  const isBar = serviceType === "bar";
  const isBakery = serviceType === "bakery";
  const isKitchen = serviceType === "kitchen";
  const isDining = serviceType === "restaurant_dining";
  const itemPlural = (wording?.itemPlural || "Produits").toLowerCase();

  const title = isAll ? "Dashboard (multi-unités)" : "Dashboard";
  const subtitle = isAll
    ? "Vue consolidée : valeurs, catégories et pertes sur l’ensemble de l’établissement."
    : "Vue générale : valeurs, catégories et pertes sur la période sélectionnée.";

  const stockLabel = isPharma ? "Valeur stock (achat)" : isGeneral ? "Valeur stock (achat)" : "Valeur stock (achat)";
  const sellingLabel = itemTypeEnabled ? "Valeur stock (vente potentielle)" : "Valeur stock (vente)";
  const marginHelper =
    isKitchen || isDining || isBakery
      ? "Marge estimée selon prix d'achat/vente saisis (hors ventes réelles)."
      : "Basé sur le stock actuel (hors ventes réelles).";

  const lossHelper = isPharma
    ? "Pertes : casse / péremption / erreurs (déclaré)."
    : isBakery
      ? "Pertes : invendus / casse / erreurs (déclaré)."
      : isBar || isDining
        ? "Pertes : casse / offerts / erreurs (déclaré)."
        : "Pertes : casse / péremption / vol (déclaré).";

  return {
    title,
    subtitle,
    stockLabel,
    sellingLabel,
    marginHelper,
    lossHelper,
    categoryTitle: isAll ? "Répartition par catégorie (global)" : "Répartition par catégorie",
    catalogTitle: isAll ? `Catalogue (${itemPlural})` : `Catalogue ${itemPlural}`,
    unitLabel: unitLabels?.one || "Service",
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
  const currencyCode = tenant?.currency_code || "EUR";

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    total_value: 0,
    total_selling_value: 0,
    losses_total_cost: 0,
    losses_total_qty: 0,
    service_totals: {},
    by_category: [],
    losses_by_reason: [],
  });

  // ✅ "Catalogue" (compte de produits suivis)
  const [catalogCount, setCatalogCount] = useState(0);

  // ✅ Synthèse par unité (uniquement en mode "all")
  const [unitSummary, setUnitSummary] = useState([]);

  // ✅ Assistant IA "boîte" compacte
  const [aiOpen, setAiOpen] = useState(false);

  // ✅ Admin panel (owner)
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [membersSummary, setMembersSummary] = useState({ members: [], recent_activity: [] });
  const [activityPage, setActivityPage] = useState(1);
  const [membersExpanded, setMembersExpanded] = useState(false);

  const tenantDomain = tenant?.domain || "food";
  const serviceType = serviceProfile?.service_type || currentService?.service_type || "other";
  const serviceDomain = serviceType === "retail_general" ? "general" : tenantDomain;

  const wording = useMemo(() => getWording(serviceType, serviceDomain), [serviceType, serviceDomain]);
  const ux = useMemo(() => getUxCopy(serviceType, serviceDomain), [serviceType, serviceDomain]);

  const unitLabels = useMemo(() => getUnitLabels(serviceType, tenantDomain), [serviceType, tenantDomain]);

  const priceCfg = serviceFeatures?.prices || {};
  const sellingEnabled = priceCfg.selling_enabled !== false;
  const itemTypeEnabled = serviceFeatures?.item_type?.enabled === true;

  const copy = useMemo(
    () => getDashboardCopy(serviceType, tenantDomain, isAllServices, itemTypeEnabled, wording, unitLabels),
    [serviceType, tenantDomain, isAllServices, itemTypeEnabled, wording, unitLabels]
  );

  const badgeText = useMemo(() => {
    if (isAllServices) return `${unitLabels.all} — ${month}`;
    const label = currentService?.name || copy.unitLabel;
    return `${label} — ${month}`;
  }, [isAllServices, currentService, month, unitLabels, copy.unitLabel]);

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

        // ✅ Synthèse par unité (top par valeur achat)
        const units = results
          .map((r) => {
            const purchase = r.stats?.service_totals?.purchase_value ?? r.stats?.total_value ?? 0;
            const selling = r.stats?.service_totals?.selling_value ?? r.stats?.total_selling_value ?? 0;
            const lossesCost = r.stats?.losses_total_cost ?? 0;
            const lossesQty = r.stats?.losses_total_qty ?? 0;
            const margin = sellingEnabled ? (selling || 0) - (purchase || 0) : null;

            return {
              id: r.service?.id,
              name: r.service?.name || copy.unitLabel,
              purchase_value: purchase || 0,
              selling_value: selling || 0,
              margin_value: margin,
              losses_cost: lossesCost || 0,
              losses_qty: lossesQty || 0,
              catalog_count: (r.products || []).length,
            };
          })
          .sort((a, b) => (b.purchase_value || 0) - (a.purchase_value || 0));

        setUnitSummary(units);

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

            safeArray(r.stats.losses_by_reason).forEach((lr) => {
              const reason = normalizeLossReason(lr.reason);
              const existing = acc.losses_by_reason.find((x) => x.reason === reason);
              if (existing) {
                existing.total_qty = (existing.total_qty || 0) + (lr.total_qty || 0);
                existing.total_cost = (existing.total_cost || 0) + (lr.total_cost || 0);
              } else {
                acc.losses_by_reason.push({ ...lr, reason });
              }
            });

            acc.catalogCount += r.products.length;
            return acc;
          },
          {
            total_value: 0,
            total_selling_value: 0,
            losses_total_cost: 0,
            losses_total_qty: 0,
            by_category: [],
            losses_by_reason: [],
            service_totals: {},
            catalogCount: 0,
          }
        );

        aggregated.service_totals = {
          purchase_value: aggregated.total_value,
          selling_value: aggregated.total_selling_value,
          losses_qty: aggregated.losses_total_qty,
          losses_cost: aggregated.losses_total_cost,
        };

        setStats({
          total_value: aggregated.total_value,
          total_selling_value: aggregated.total_selling_value,
          losses_total_cost: aggregated.losses_total_cost,
          losses_total_qty: aggregated.losses_total_qty,
          by_category: aggregated.by_category,
          losses_by_reason: aggregated.losses_by_reason,
          service_totals: aggregated.service_totals,
        });

        setCatalogCount(aggregated.catalogCount);
      } else {
        const [statsRes, listRes] = await Promise.all([
          api.get(`/api/inventory-stats/?month=${month}&service=${serviceId}`),
          api.get(`/api/products/?month=${month}&service=${serviceId}`),
        ]);

        const s = statsRes.data || {
          total_value: 0,
          total_selling_value: 0,
          losses_total_cost: 0,
          losses_total_qty: 0,
          by_category: [],
          losses_by_reason: [],
          service_totals: {},
        };

        setStats({
          ...s,
          losses_by_reason: safeArray(s.losses_by_reason).map((lr) => ({
            ...lr,
            reason: normalizeLossReason(lr.reason),
          })),
        });

        const list = Array.isArray(listRes.data) ? listRes.data : [];
        setCatalogCount(list.length);

        // ✅ mode mono : pas de synthèse multi
        setUnitSummary([]);
      }
    } catch (e) {
      pushToast?.({
        message:
          "Oups… impossible de charger le dashboard. Vérifie l’unité sélectionnée et reconnecte-toi si besoin.",
        type: "error",
      });
      setStats({
        total_value: 0,
        total_selling_value: 0,
        losses_total_cost: 0,
        losses_total_qty: 0,
        by_category: [],
        losses_by_reason: [],
        service_totals: {},
      });
      setCatalogCount(0);
      setUnitSummary([]);
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

  const itemPluralLabel = (wording?.itemPlural || "Produits").toLowerCase();

  // ✅ KPIs orientés "tableau de bord global"
  const kpis = [
    {
      label: copy.stockLabel,
      value: formatCurrency(purchaseValue, currencyCode),
      helper: isAllServices ? "Somme sur l’ensemble de l’établissement" : "Période et unité sélectionnées",
    },
    {
      label: copy.sellingLabel,
      value: sellingEnabled ? formatCurrency(sellingValue, currencyCode) : "—",
      helper: itemTypeEnabled
        ? "Peut exclure les matières premières si le type d’article est activé."
        : "Projection basée sur vos prix de vente (si renseignés).",
    },
    {
      label: "Marge potentielle",
      value: sellingEnabled ? formatCurrency(marginValue, currencyCode) : "—",
      helper: sellingEnabled
        ? copy.marginHelper
        : "Astuce : activez “Prix de vente” dans Settings → Modules pour estimer la marge.",
    },
    {
      label: copy.catalogTitle,
      value: catalogCount,
      helper: isAllServices
        ? `Total des ${itemPluralLabel} suivis sur toutes les unités.`
        : `Nombre de ${itemPluralLabel} suivis sur l’unité sélectionnée.`,
    },
    {
      label: "Pertes du mois",
      value: lossesCost > 0 ? formatCurrency(lossesCost, currencyCode) : `${fmtNumber(lossesQty)} u.`,
      helper: copy.lossHelper,
    },
  ];

  const categories = safeArray(stats.by_category);
  const lossesByReason = safeArray(stats.losses_by_reason);

  const members = safeArray(membersSummary.members);
  const recentActivity = safeArray(membersSummary.recent_activity);
  const ACTIVITY_PAGE_SIZE = 6;
  const totalActivityPages = Math.max(1, Math.ceil(recentActivity.length / ACTIVITY_PAGE_SIZE));
  const activityPageSafe = Math.min(Math.max(activityPage, 1), totalActivityPages);
  const activitySliceStart = (activityPageSafe - 1) * ACTIVITY_PAGE_SIZE;
  const pagedActivity = recentActivity.slice(activitySliceStart, activitySliceStart + ACTIVITY_PAGE_SIZE);

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

  const showUnitSelect = (services || []).length > 0;

  useEffect(() => {
    setActivityPage(1);
  }, [recentActivity.length]);

  return (
    <PageTransition>
      <Helmet>
        <title>{copy.title} | StockScan</title>
        <meta
          name="description"
          content={ux.inventoryIntro || "Dashboard : vue générale de l’établissement (valeur, catégories, pertes)."}
        />
      </Helmet>

      <div className="grid gap-4 min-w-0">
        {/* Header */}
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

            {showUnitSelect && (
              <Select
                label={copy.unitLabel}
                value={isAllServices ? "all" : serviceId || ""}
                onChange={(value) => selectService(value)}
                ariaLabel={`Sélection ${copy.unitLabel.toLowerCase()}`}
                options={[
                  ...(services || []).map((s) => ({ value: s.id, label: s.name })),
                  ...(services || []).length > 1 ? [{ value: "all", label: unitLabels.all }] : [],
                ]}
              />
            )}

            <div className="flex gap-2 min-w-0">
              <Button onClick={loadData} loading={loading} className="w-full">
                Rafraîchir
              </Button>
            </div>
          </div>

          <div className="text-xs text-[var(--muted)]">
            Astuce : le dashboard devient très parlant dès que vous avez des prix d’achat/vente et quelques pertes déclarées.
          </div>
        </Card>

        <PwaInstallCard />

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

        {/* ✅ Synthèse par unité (uniquement en mode all) */}
        {isAllServices ? (
          <Card className="p-5 space-y-3 min-w-0" hover>
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">Synthèse par {unitLabels.plural}</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Comparaison rapide des unités : valeur de stock, pertes et catalogue.
                </div>
              </div>
              <Badge variant="neutral">{loading ? "Chargement" : `${unitSummary.length || 0} ${unitLabels.plural}`}</Badge>
            </div>

            {loading ? (
              <div className="grid gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : unitSummary.length ? (
              <div className="grid md:grid-cols-2 gap-3 min-w-0">
                {unitSummary.slice(0, 6).map((u) => (
                  <Card key={u.id || u.name} className="p-4 min-w-0" hover>
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)] break-anywhere">{u.name}</div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          Catalogue : {fmtNumber(u.catalog_count)} · Pertes :{" "}
                          {u.losses_cost > 0 ? formatCurrency(u.losses_cost, currencyCode) : `${fmtNumber(u.losses_qty)} u.`}
                        </div>
                      </div>
                      <Badge variant="info">{formatCurrency(u.purchase_value || 0, currencyCode)}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs min-w-0">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Achat</div>
                        <div className="font-semibold text-[var(--text)]">{formatCurrency(u.purchase_value || 0, currencyCode)}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Vente</div>
                        <div className="font-semibold text-[var(--text)]">
                          {sellingEnabled ? formatCurrency(u.selling_value || 0, currencyCode) : "—"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Marge</div>
                        <div className="font-semibold text-[var(--text)]">
                          {sellingEnabled ? formatCurrency(u.margin_value || 0, currencyCode) : "—"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <div className="text-[var(--muted)]">Pertes</div>
                        <div className="font-semibold text-[var(--text)]">
                          {u.losses_cost > 0 ? formatCurrency(u.losses_cost || 0, currencyCode) : `${fmtNumber(u.losses_qty)} u.`}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)]">
                Pas encore de données multi-unités sur cette période. Lance un inventaire sur au moins une unité ✨
              </div>
            )}

            {unitSummary.length > 6 ? (
              <div className="text-xs text-[var(--muted)]">
                Affichage limité aux 6 premières unités (triées par valeur achat). On peut ajouter un mode “voir tout” si tu veux.
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* Alerts + AI compact box */}
        <div className="grid lg:grid-cols-2 gap-4 min-w-0">
          <AlertsPanel />

          <Card className="p-5 min-w-0" hover>
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">Assistant IA</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Besoin d’un résumé, d’une explication ou d’une action rapide ? Ouvre l’assistant quand tu veux.
                </div>
              </div>
              <Button variant="secondary" onClick={() => setAiOpen((v) => !v)}>
                {aiOpen ? "Fermer" : "Ouvrir"}
              </Button>
            </div>

            {aiOpen ? (
              <div className="mt-4">
                <AIAssistantPanel month={month} serviceId={isAllServices ? "all" : serviceId} />
              </div>
            ) : (
              <div className="mt-4 text-xs text-[var(--muted)]">
                💡 Astuce : demande “résume la situation du mois” ou “quelles catégories pèsent le plus ?”.
              </div>
            )}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 min-w-0">
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
                        Achat : {formatCurrency(c.total_purchase_value || 0, currencyCode)} · Vente :{" "}
                        {formatCurrency(c.total_selling_value || 0, currencyCode)}
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
                Pas encore de données sur cette période. Lance un inventaire, ou change de mois / unité ✨
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
                        <span className="min-w-0 break-anywhere">{normalizeLossReason(l.reason)}</span>
                        <span className="shrink-0">
                          {formatCurrency(l.total_cost || 0, currencyCode)} — {fmtNumber(l.total_qty || 0)} u.
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
                Aucune perte déclarée sur cette période. (Et ça, c’est une très bonne nouvelle 😄)
              </div>
            )}
          </Card>
        </div>

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
                    Visualise les accès par unité et garde un œil sur ce qui bouge.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Button variant="secondary" onClick={loadMembersSummary} loading={membersLoading}>
                  Rafraîchir
                </Button>
                <Button variant="secondary" onClick={() => setMembersExpanded((v) => !v)} disabled={membersLoading}>
                  {membersExpanded ? "Masquer" : "Afficher"}
                </Button>
                <Badge variant="neutral">{membersLoading ? "Chargement…" : `${members.length} membre(s)`}</Badge>
              </div>
            </div>

            {membersExpanded ? (
              <>
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
                          const scope = m?.service_scope?.name
                            ? `${copy.unitLabel} : ${m.service_scope.name}`
                            : "Accès : multi-unités";
                          const last = m?.last_action?.action
                            ? `${formatActionLabel(m.last_action.action)} · ${fmtDateTime(m.last_action.at)}`
                            : "—";
                          const role = (m?.role || "operator").toUpperCase();
                          const user = m?.user || {};
                          return (
                            <Card key={m.id} className="p-4 min-w-0" hover>
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
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
                    ) : pagedActivity.length ? (
                      <div className="space-y-2 min-w-0">
                        {pagedActivity.map((a, idx) => {
                          const who = a?.user?.username || "système";
                          const action = formatActionLabel(a?.action);
                          const when = fmtDateTime(a?.at);
                          const obj = formatObjectLabel(a?.object_type, a?.object_id);

                          return (
                            <div key={`${action}-${idx}`} className="flex items-start justify-between gap-3 min-w-0">
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
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                            disabled={activityPageSafe <= 1}
                          >
                            Précédent
                          </Button>
                          <div className="text-xs text-[var(--muted)]">
                            Page {activityPageSafe} / {totalActivityPages}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                            disabled={activityPageSafe >= totalActivityPages}
                          >
                            Suivant
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--muted)]">
                        Rien à afficher ici pour le moment — dès qu’un membre agit, l’activité apparaîtra.
                      </div>
                    )}
                  </Card>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  Astuce : gère les rôles et les accès par unité depuis{" "}
                  <span className="font-semibold text-[var(--text)]">Settings → Équipe</span>.
                </div>
              </>
            ) : (
              <div className="text-xs text-[var(--muted)]">
                Section repliée pour garder le focus sur la vue générale. Clique sur “Afficher” si besoin.
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </PageTransition>
  );
}
