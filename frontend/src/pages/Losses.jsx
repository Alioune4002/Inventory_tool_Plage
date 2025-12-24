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

function nowLocalDatetimeValue() {
  // format attendu par <input type="datetime-local"> : YYYY-MM-DDTHH:mm
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localDatetimeToUtcIso(localValue) {
  // localValue = "YYYY-MM-DDTHH:mm" (heure locale)
  // On le transforme en Date locale, puis on envoie un ISO UTC (avec Z).
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // UTC ISO (Z)
}

function formatDisplayDatetime(value) {
  // value peut venir du backend en ISO (UTC). On affiche en heure locale.
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // fallback : si c’est déjà du "YYYY-MM-DDTHH:mm"
    return String(value).replace("T", " ").slice(0, 16);
  }
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [products, setProducts] = useState([]);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    product: "",
    quantity: 1,
    unit: "pcs",
    reason: "breakage",
    occurred_at: nowLocalDatetimeValue(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitOptions.join("|")]);

  const sortedItems = useMemo(() => {
    // tri par date décroissante
    const copy = Array.isArray(items) ? [...items] : [];
    copy.sort((a, b) => {
      const ta = a?.occurred_at ? new Date(a.occurred_at).getTime() : 0;
      const tb = b?.occurred_at ? new Date(b.occurred_at).getTime() : 0;
      return tb - ta;
    });
    return copy;
  }, [items]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const load = async () => {
    if (!serviceId) return;
    setLoading(true);

    try {
      // chargement en parallèle (plus rapide)
      const [lossesRes, productsRes] = await Promise.all([
        api.get(`/api/losses/?month=${month}&service=${serviceId}`),
        api.get(`/api/products/?service=${serviceId}`),
      ]);

      setItems(Array.isArray(lossesRes.data) ? lossesRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch (e) {
      setItems([]);
      setProducts([]);
      pushToast?.({
        message: "Impossible de charger les pertes. Vérifie la connexion, ton service, et tes droits.",
        type: "error",
      });
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
      pushToast?.({ message: "Choisis d’abord un service.", type: "error" });
      return;
    }

    const quantityValue = Number(form.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      pushToast?.({ message: "Indique une quantité supérieure à zéro.", type: "error" });
      return;
    }

    // ✅ FIX TIMEZONE : datetime-local (local) -> ISO UTC (Z)
    const occurredAtIso = localDatetimeToUtcIso(form.occurred_at);
    if (!occurredAtIso) {
      pushToast?.({ message: "Date/heure invalide. Réessaie.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        product: form.product || null,
        quantity: quantityValue,
        unit: form.unit || "pcs",
        reason: form.reason,
        occurred_at: occurredAtIso,
        note: (form.note || "").trim(),
      };

      const res = await api.post("/api/losses/", payload);

      const warnings = res?.data?.warnings || [];
      if (warnings.length) {
        pushToast?.({ message: warnings.join(" "), type: "warn" });
      } else {
        pushToast?.({ message: "Perte enregistrée.", type: "success" });
      }

      setForm((prev) => ({ ...prev, quantity: 1, note: "" }));
      await load();
    } catch (err) {
      const msg = formatApiError(err);

      // message plus “humain” sur les droits / entitlement
      if (
        String(msg || "").toLowerCase().includes("entitlement") ||
        String(msg || "").toLowerCase().includes("abonnement") ||
        String(msg || "").toLowerCase().includes("forbidden") ||
        String(msg || "").toLowerCase().includes("non autor")
      ) {
        pushToast?.({
          message:
            "Cette fonctionnalité n’est pas disponible pour ton offre ou ton rôle. Contacte l’administrateur du compte.",
          type: "error",
        });
      } else {
        pushToast?.({ message: msg, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!id) return;

    const ok = window.confirm("Supprimer cette perte ? Cette action est irréversible.");
    if (!ok) return;

    setLoading(true);
    try {
      await api.delete(`/api/losses/${id}/`);
      pushToast?.({ message: "Perte supprimée.", type: "success" });
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      pushToast?.({ message: "Suppression impossible. Vérifie tes droits.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const itemLabel = wording.itemLabel || "Produit";

  return (
    <PageTransition>
      <Helmet>
        <title>Pertes | StockScan</title>
        <meta
          name="description"
          content="Déclare et consulte les pertes (casse, péremption, vol...)."
        />
      </Helmet>

      <div className="grid gap-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm text-slate-500">Optionnel, mais très utile</div>
          <div className="text-2xl font-black tracking-tight">Pertes du mois</div>

          <div className="text-sm text-slate-600">
            Ici, tu déclares les pertes (casse, péremption, vol, erreur…). Cela aide à expliquer les écarts
            entre le stock attendu et le stock compté.
          </div>

          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <Input
              label="Mois"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              helper="Choisis le mois à consulter."
            />

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
                <span className="text-xs text-slate-500">Les pertes sont séparées par service.</span>
              </label>
            )}

            <Button onClick={load} loading={loading} className="w-full">
              Actualiser
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Déclarer une perte</div>
          <div className="text-xs text-slate-500">
            Astuce : tu peux laisser {itemLabel.toLowerCase()} vide si tu veux juste enregistrer une perte “globale”.
          </div>

          <form className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 items-end" onSubmit={submit}>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{itemLabel} (optionnel)</span>
              <select
                value={form.product}
                onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
              >
                <option value="">— Aucun —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                Si tu choisis un {itemLabel.toLowerCase()}, la perte sera liée à sa fiche.
              </span>
            </label>

            <Input
              label="Quantité perdue"
              type="number"
              min={0}
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              helper="Ex : 2, 0.5, 10…"
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
              <span className="text-xs text-slate-500">Adapté au mode de comptage du service.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Motif</span>
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
              <span className="text-xs text-slate-500">Choisis le motif le plus proche.</span>
            </label>

            <Input
              label="Date et heure"
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => setForm((p) => ({ ...p, occurred_at: e.target.value }))}
              helper="Heure locale (l’application convertit automatiquement en UTC)."
            />

            <Input
              label="Note (optionnel)"
              placeholder="Ex : Casse en cuisine, péremption, erreur de livraison…"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />

            <Button type="submit" loading={loading} className="md:col-span-2 lg:col-span-3">
              Enregistrer la perte
            </Button>
          </form>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Historique</div>
            <div className="text-xs text-slate-500">{sortedItems.length} ligne(s)</div>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedItems.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">{itemLabel}</th>
                    <th className="py-2 pr-3">Quantité</th>
                    <th className="py-2 pr-3">Motif</th>
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
                      <td className="py-2 pr-3">{formatDisplayDatetime(l.occurred_at)}</td>
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
              Aucune perte enregistrée sur ce mois. Tu peux en déclarer si tu veux expliquer des écarts.
            </div>
          )}

          {!loading && sortedItems.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} / {totalPages} · {sortedItems.length} perte(s)
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