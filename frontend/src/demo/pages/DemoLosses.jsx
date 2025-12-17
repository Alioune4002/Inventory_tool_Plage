import React, { useMemo, useState } from "react";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { useDemo } from "../context/DemoProvider";

const REASONS = [
  { value: "breakage", label: "Casse" },
  { value: "expired", label: "DLC dépassée" },
  { value: "theft", label: "Vol" },
  { value: "free", label: "Offert" },
  { value: "mistake", label: "Erreur" },
  { value: "other", label: "Autre" },
];

export default function DemoLosses() {
  const { month, setMonth, services, serviceId, selectService, items, losses, setLosses, pushToast } = useDemo();

  const products = useMemo(() => {
    // on utilise les items inventaire comme "catalogue" rapide
    return (items || []).map((p) => ({ id: p.id, name: p.name }));
  }, [items]);

  const [form, setForm] = useState({
    product: "",
    quantity: 1,
    unit: "pcs",
    reason: "breakage",
    occurred_at: new Date().toISOString().slice(0, 16),
    note: "",
  });

  const submit = (e) => {
    e.preventDefault();
    const prod = products.find((p) => String(p.id) === String(form.product));
    const row = {
      id: Date.now(),
      product_name: prod?.name || "—",
      quantity: Number(form.quantity) || 0,
      unit: form.unit || "pcs",
      reason: form.reason,
      occurred_at: form.occurred_at,
      note: form.note || "",
    };
    setLosses((prev) => [row, ...(prev || [])]);
    pushToast("Perte enregistrée (démo).", "warn");
    setForm((p) => ({ ...p, quantity: 1, note: "" }));
  };

  const remove = (id) => {
    setLosses((prev) => (prev || []).filter((x) => x.id !== id));
    pushToast("Perte supprimée (démo).", "info");
  };

  return (
    <div className="grid gap-4">
      <Card className="p-6 space-y-3">
        <div className="text-sm text-slate-500">Pertes</div>
        <div className="text-2xl font-black tracking-tight">Pertes du mois</div>

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

          <Button className="w-full" onClick={() => pushToast("Rechargement simulé.", "info")}>
            Rafraîchir (démo)
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Déclarer une perte</div>
        <form className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 items-end" onSubmit={submit}>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Produit (optionnel)</span>
            <select
              value={form.product}
              onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
            >
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Quantité"
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
          />

          <Input label="Unité" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Raison</span>
            <select
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Date/heure"
            type="datetime-local"
            value={form.occurred_at}
            onChange={(e) => setForm((p) => ({ ...p, occurred_at: e.target.value }))}
          />

          <Input
            label="Note"
            placeholder="Optionnel (ex: bouteille cassée)"
            value={form.note}
            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
          />

          <Button type="submit" className="md:col-span-2 lg:col-span-3">
            Déclarer
          </Button>
        </form>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Historique</div>
          <div className="text-xs text-slate-500">{(losses || []).length} lignes</div>
        </div>

        {(losses || []).length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Produit</th>
                  <th className="py-2 pr-3">Quantité</th>
                  <th className="py-2 pr-3">Raison</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(losses || []).map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{l.product_name || "—"}</td>
                    <td className="py-2 pr-3">
                      {l.quantity} {l.unit}
                    </td>
                    <td className="py-2 pr-3">{REASONS.find((r) => r.value === l.reason)?.label || l.reason}</td>
                    <td className="py-2 pr-3">{String(l.occurred_at || "").slice(0, 16) || "—"}</td>
                    <td className="py-2 pr-3 text-slate-500">{l.note || "—"}</td>
                    <td className="py-2 pr-3">
                      <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Aucune perte.</div>
        )}
      </Card>
    </div>
  );
}