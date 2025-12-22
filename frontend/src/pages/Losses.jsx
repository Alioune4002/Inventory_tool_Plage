import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { formatApiError } from "../lib/errorUtils";
import { getWording, getUxCopy, getLossReasons } from "../lib/labels";

export default function Losses() {
  const {
    serviceId,
    services,
    selectService,
    countingMode,
    tenant,
    currentService,
    serviceProfile,
    serviceFeatures,
  } = useAuth();
  const pushToast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
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

  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;
  const wording = getWording(serviceType, serviceDomain);
  const ux = getUxCopy(serviceType, serviceDomain);
  const reasons = useMemo(
    () => getLossReasons(serviceType, serviceDomain, serviceFeatures),
    [serviceType, serviceDomain, serviceFeatures]
  );

  const unitOptions = useMemo(() => {
    if (countingMode === "weight") return ["kg", "g"];
    if (countingMode === "volume") return ["l", "ml"];
    if (countingMode === "mixed") return ["pcs", "kg", "g", "l", "ml"];
    return ["pcs"];
  }, [countingMode]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, unit: unitOptions[0] }));
  }, [unitOptions]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
      const quantityValue = Number(form.quantity) || 0;
      if (quantityValue <= 0) {
        pushToast?.({ message: "Indiquez une quantité supérieure à zéro.", type: "error" });
        setLoading(false);
        return;
      }

      const payload = {
        product: form.product || null,
        quantity: quantityValue,
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
      const msg = formatApiError(err);
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
          <div className="text-sm text-slate-600">
            Inventaire = comptage. Les pertes servent a qualifier les ecarts du mois.
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
              <span className="text-sm font-medium text-slate-700">
                {wording.itemLabel} (optionnel)
              </span>
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
                {reasons.map((r) => (
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
              placeholder="Optionnel (ex: casse, erreur de comptage)"
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
          {loading ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">{wording.itemLabel}</th>
                    <th className="py-2 pr-3">Quantité</th>
                    <th className="py-2 pr-3">Raison</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Note</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{l.product_name || l.product?.name || "—"}</td>
                      <td className="py-2 pr-3">
                        {l.quantity} {l.unit}
                      </td>
                      <td className="py-2 pr-3">
                        {reasons.find((r) => r.value === l.reason)?.label || l.reason}
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
            <div className="text-sm text-slate-500">
              Aucune perte déclarée pour ce mois. Optionnel mais utile pour suivre les ecarts.
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} / {totalPages} · {items.length} pertes
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
