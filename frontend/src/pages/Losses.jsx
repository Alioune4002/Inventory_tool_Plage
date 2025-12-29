import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import Select from "../ui/Select";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { formatApiError } from "../lib/errorUtils";
import { getWording, getUxCopy, getLossReasons } from "../lib/labels";

function nowLocalDatetimeValue() {
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
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDisplayDatetime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Losses() {
  const { serviceId, services, selectService, tenant, currentService, serviceProfile, serviceFeatures } =
    useAuth();

  const pushToast = useToast();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Live search produit ---
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // {id, name}
  const searchTimer = useRef(null);

  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    product: "", // id
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

  // ✅ Unité imposée à pcs uniquement (comme demandé)
  const unitOptions = useMemo(() => ["pcs"], []);

  useEffect(() => {
    setForm((prev) => ({ ...prev, unit: "pcs" }));
  }, []);

  const sortedItems = useMemo(() => {
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
      const lossesRes = await api.get(`/api/losses/?month=${month}&service=${serviceId}`);
      setItems(Array.isArray(lossesRes.data) ? lossesRes.data : []);
    } catch (e) {
      setItems([]);
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

  const fetchProducts = async (q) => {
    if (!serviceId) return;
    const query = (q || "").trim();
    if (!query) {
      setProductResults([]);
      return;
    }
    try {
      const res = await api.get(
        `/api/search-products/?q=${encodeURIComponent(query)}&service=${serviceId}`
      );
      setProductResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProductResults([]);
    }
  };

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => fetchProducts(productQuery), 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery, serviceId]);

  const pickProduct = (p) => {
    setSelectedProduct(p ? { id: p.id, name: p.name } : null);
    setForm((prev) => ({ ...prev, product: p ? String(p.id) : "" }));
    setProductQuery(p ? p.name : "");
    setProductOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!serviceId) {
      pushToast?.({ message: "Choisis d’abord un service.", type: "error" });
      return;
    }

    // ✅ Produit obligatoire (front)
    if (!form.product) {
      pushToast?.({ message: "Choisis un produit (obligatoire).", type: "error" });
      return;
    }

    const quantityValue = Number(form.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      pushToast?.({ message: "Indique une quantité supérieure à zéro.", type: "error" });
      return;
    }

    const occurredAtIso = localDatetimeToUtcIso(form.occurred_at);
    if (!occurredAtIso) {
      pushToast?.({ message: "Date/heure invalide. Réessaie.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        product: form.product, // obligatoire
        quantity: quantityValue,
        unit: "pcs",
        reason: form.reason,
        occurred_at: occurredAtIso,
        note: (form.note || "").trim(),
      };

      const res = await api.post("/api/losses/", payload);

      const warnings = res?.data?.warnings || [];
      if (warnings.length) pushToast?.({ message: warnings.join(" "), type: "warn" });
      else pushToast?.({ message: "Perte enregistrée.", type: "success" });

      setForm((prev) => ({ ...prev, quantity: 1, note: "" }));
      await load();
    } catch (err) {
      const msg = formatApiError(err);
      pushToast?.({ message: msg, type: "error" });
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
        <meta name="description" content="Déclare et consulte les pertes (casse, péremption, vol...)."
        />
      </Helmet>

      <div className="grid gap-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm text-[var(--muted)]">Suivi des écarts</div>
          <div className="text-2xl font-black tracking-tight text-[var(--text)]">Pertes du mois</div>

          <div className="text-sm text-[var(--muted)]">
            Ici, tu déclares les pertes (casse, péremption, vol, erreur…). Cela aide à expliquer les écarts entre le stock attendu et le stock compté.
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
              <Select
                label="Service"
                value={serviceId || ""}
                onChange={(value) => selectService(value)}
                options={services.map((s) => ({ value: s.id, label: s.name }))}
                helper="Les pertes sont séparées par service."
              />
            )}

            <Button onClick={load} loading={loading} className="w-full">
              Actualiser
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-[var(--text)]">Déclarer une perte</div>

          <form className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 items-end" onSubmit={submit}>
            {/* ✅ Produit obligatoire + recherche live */}
            <div className="relative">
              <Input
                label={`${itemLabel} (obligatoire)`}
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setProductOpen(true);
                  setSelectedProduct(null);
                  setForm((p) => ({ ...p, product: "" }));
                }}
                onFocus={() => setProductOpen(true)}
                placeholder="Tape pour rechercher…"
                helper="Recherche live dans ce service."
              />

              {productOpen && productQuery.trim() && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                  {productResults.length ? (
                    <div className="max-h-64 overflow-auto">
                      {productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <div className="font-semibold text-[var(--text)]">{p.name}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {p.barcode ? `EAN: ${p.barcode}` : p.internal_sku ? `SKU: ${p.internal_sku}` : "—"}
                            {p.category ? ` · ${p.category}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-sm text-[var(--muted)]">Aucun produit trouvé.</div>
                  )}
                </div>
              )}

              {selectedProduct?.id && (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Sélectionné : <span className="font-semibold text-[var(--text)]">{selectedProduct.name}</span>
                </div>
              )}
            </div>

            <Input
              label="Quantité perdue"
              type="number"
              min={0}
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              helper="Ex : 2, 0.5, 10…"
            />

            {/* ✅ Unité fixée à pcs */}
            <Select
              label="Unité"
              value={form.unit}
              onChange={(value) => setForm((p) => ({ ...p, unit: value }))}
              options={unitOptions.map((u) => ({ value: u, label: u }))}
              helper="Unité unique pour les pertes."
            />

            <Select
              label="Motif"
              value={form.reason}
              onChange={(value) => setForm((p) => ({ ...p, reason: value }))}
              options={reasons.map((r) => ({ value: r.value, label: r.label }))}
              helper="Choisis le motif le plus proche."
            />

            <Input
              label="Date et heure"
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => setForm((p) => ({ ...p, occurred_at: e.target.value }))}
              helper="Heure locale (convertie automatiquement en UTC)."
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
            <div className="text-sm font-semibold text-[var(--text)]">Historique</div>
            <div className="text-xs text-[var(--muted)]">{sortedItems.length} ligne(s)</div>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedItems.length ? (
            <>
              <div className="space-y-2 sm:hidden">
                {paginatedItems.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-[var(--text)] break-anywhere">
                        {l.product_name || l.product?.name || "—"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {l.quantity} {l.unit}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {reasons.find((r) => r.value === l.reason)?.label || l.reason} ·{" "}
                      {formatDisplayDatetime(l.occurred_at)}
                    </div>
                    <div className="text-xs text-[var(--muted)] break-anywhere">{l.note || "—"}</div>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                      Supprimer
                    </Button>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-auto">
                <table className="min-w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-left text-[var(--muted)] border-b">
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
                        <td className="py-2 pr-3 break-anywhere">
                          {l.product_name || l.product?.name || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {l.quantity} {l.unit}
                        </td>
                        <td className="py-2 pr-3">
                          {reasons.find((r) => r.value === l.reason)?.label || l.reason}
                        </td>
                        <td className="py-2 pr-3">{formatDisplayDatetime(l.occurred_at)}</td>
                        <td className="py-2 pr-3 text-[var(--muted)] break-anywhere">{l.note || "—"}</td>
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
            </>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Aucune perte enregistrée sur ce mois.
            </div>
          )}

          {!loading && sortedItems.length > 0 && (
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
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