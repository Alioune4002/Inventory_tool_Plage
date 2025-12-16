import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";

const REASONS = [
  { value: "breakage", label: "Casse" },
  { value: "expired", label: "DLC dépassée" },
  { value: "theft", label: "Vol" },
  { value: "free", label: "Offert" },
  { value: "mistake", label: "Erreur" },
  { value: "other", label: "Autre" },
];

export default function Losses() {
  const { serviceId, services, selectService, countingMode } = useAuth();
  const pushToast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    product: "",
    quantity: 1,
    unit: "pcs",
    reason: "breakage",
    occurred_at: new Date().toISOString().slice(0, 16),
    note: "",
  });

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, unit: unitOptions[0] }));
  }, [unitOptions]);

  const load = async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/losses/?month=${month}&service=${serviceId}`);
      setItems(Array.isArray(res.data) ? res.data : []);
      const prods = await api.get(`/api/products/?service=${serviceId}`);
      setProducts(Array.isArray(prods.data) ? prods.data : []);
    } catch (e) {
      setItems([]);
      pushToast?.({ message: "Impossible de charger les pertes (auth/service ?)", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month]);

  const submit = async (e) => {
    e.preventDefault();
    if (!serviceId) {
      pushToast?.({ message: "Sélectionne un service.", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        product: form.product || null,
        quantity: Number(form.quantity) || 0,
        unit: form.unit || "pcs",
        reason: form.reason,
        occurred_at: form.occurred_at || new Date().toISOString(),
        note: form.note,
      };
      const res = await api.post("/api/losses/", payload);
      const warnings = res?.data?.warnings || [];
      if (warnings.length) pushToast?.({ message: warnings.join(" "), type: "warn" });
      else pushToast?.({ message: "Perte enregistrée.", type: "success" });
      setForm((prev) => ({ ...prev, quantity: 1, note: "" }));
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Déclaration impossible.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/api/losses/${id}/`);
      pushToast?.({ message: "Perte supprimée.", type: "success" });
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      pushToast?.({ message: "Suppression impossible.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Pertes | StockScan</title>
        <meta name="description" content="Suivre les pertes (casse, DLC, vol...)." />
      </Helmet>

      <div className="grid gap-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm text-slate-500">Optionnel</div>
          <div className="text-2xl font-black tracking-tight">Pertes du mois</div>
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
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={load} loading={loading} className="w-full">
              Rafraîchir
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
            <Button type="submit" loading={loading} className="md:col-span-2 lg:col-span-3">
              Déclarer
            </Button>
          </form>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Historique des pertes</div>
            <div className="text-xs text-slate-500">{items.length} lignes</div>
          </div>
          {items.length ? (
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
                  {items.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{l.product_name || l.product?.name || "—"}</td>
                      <td className="py-2 pr-3">
                        {l.quantity} {l.unit}
                      </td>
                      <td className="py-2 pr-3">
                        {REASONS.find((r) => r.value === l.reason)?.label || l.reason}
                      </td>
                      <td className="py-2 pr-3">{l.occurred_at?.slice(0, 16) || "—"}</td>
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
            <div className="text-sm text-slate-500">Aucune perte déclarée pour ce mois. Optionnel mais utile pour suivre la casse/DLC.</div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
