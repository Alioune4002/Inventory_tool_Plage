import React, { useMemo } from "react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { useDemo } from "../context/DemoProvider";

const fmtCurrency = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—";
const fmtNumber = (n) => (typeof n === "number" ? n.toLocaleString("fr-FR") : "—");

export default function DemoDashboard() {
  const { month, setMonth, services, serviceId, selectService, stats, items, losses } = useDemo();

  const purchaseValue = stats?.total_value ?? 0;
  const sellingValue = stats?.total_selling_value ?? 0;
  const marginValue = (sellingValue || 0) - (purchaseValue || 0);
  const lossesCost = stats?.losses_total_cost ?? 0;
  const lossesQty = stats?.losses_total_qty ?? 0;

  const categories = Array.isArray(stats?.by_category) ? stats.by_category : [];
  const lossesByReason = Array.isArray(stats?.losses_by_reason) ? stats.losses_by_reason : [];
  const products = Array.isArray(stats?.by_product) ? stats.by_product : [];

  const kpis = useMemo(
    () => [
      { label: "Valeur stock (achat)", value: fmtCurrency(purchaseValue), helper: "Données fictives (démo)" },
      { label: "Valeur stock (vente)", value: fmtCurrency(sellingValue), helper: "Projection (si prix saisis)" },
      { label: "Marge potentielle", value: fmtCurrency(marginValue), helper: "Achat vs vente (indicatif)" },
      { label: "Produits suivis", value: fmtNumber(items?.length || 0), helper: "Lignes inventaire (démo)" },
      {
        label: "Pertes",
        value: lossesCost > 0 ? fmtCurrency(lossesCost) : `${fmtNumber(lossesQty)} u.`,
        helper: "Casse / DLC / offerts…",
      },
    ],
    [purchaseValue, sellingValue, marginValue, lossesCost, lossesQty, items]
  );

  return (
    <div className="grid gap-4">
      <Card className="p-6 space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Dashboard</div>
            <div className="text-2xl font-black tracking-tight">Pilotage du stock</div>
            <div className="text-sm text-slate-600">Valeur, catégories, pertes, aperçu produits (démo).</div>
          </div>
          <Badge variant="info">Démo</Badge>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Service</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
              value={serviceId}
              onChange={(e) => selectService(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <Button className="w-full" onClick={() => {}}>
            Rafraîchir (démo)
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5" hover>
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className="mt-2 text-3xl font-black">{k.value}</div>
            <div className="mt-1 text-sm text-slate-500">{k.helper}</div>
          </Card>
        ))}
      </div>

      {/* Categories */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Répartition par catégorie</div>
          <Badge variant="neutral">{`${categories.length || 0} catégories`}</Badge>
        </div>

        {categories.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {categories.map((c) => {
              const maxPurchase = Math.max(...categories.map((x) => x.total_purchase_value || 0), 1);
              const width = Math.max(((c.total_purchase_value || 0) / maxPurchase) * 100, 6);
              return (
                <Card key={c.category || "none"} className="p-4 space-y-2" hover>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">{c.category || "Non catégorisé"}</div>
                    <Badge variant="neutral">{fmtNumber(c.total_quantity || 0)} u.</Badge>
                  </div>

                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${width}%` }} />
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
          <div className="text-sm text-slate-500">Aucune donnée.</div>
        )}
      </Card>

      {/* Losses by reason */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Pertes par raison</div>
          <Badge variant="neutral">{`${lossesByReason.length || 0} raisons`}</Badge>
        </div>

        {lossesByReason.length ? (
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
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Aucune perte.</div>
        )}

        {/* mini proof: last losses */}
        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500 mb-2">Dernières pertes (démo)</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {(losses || []).slice(0, 4).map((l) => (
              <Card key={l.id} className="p-3" hover>
                <div className="text-sm font-semibold text-slate-800">{l.product_name || "—"}</div>
                <div className="text-xs text-slate-500">
                  {l.quantity} {l.unit} · {l.reason} · {String(l.occurred_at || "").slice(0, 16)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      {/* Products */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Produits (aperçu)</div>
          <Badge variant="neutral">{`${products.length || 0} lignes`}</Badge>
        </div>

        {products.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {products.slice(0, 8).map((p, idx) => (
              <Card key={`${p.name}-${idx}`} className="p-4 space-y-1" hover>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                  <Badge variant="neutral">{p.category || "—"}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  Stock : {fmtNumber(p.stock_final || 0)} {p.unit || ""}
                </div>
                <div className="text-xs text-slate-500">Valeur achat : {fmtCurrency(p.purchase_value_current || 0)}</div>
                <div className="text-xs text-s结合">Valeur vente : {fmtCurrency(p.selling_value_current || 0)}</div>
                <div className="text-xs text-rose-500">Pertes : {fmtNumber(p.losses_qty || 0)} u.</div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Ajoutez des produits pour voir les stats.</div>
        )}
      </Card>
    </div>
  );
}