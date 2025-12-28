import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Drawer from "../ui/Drawer";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { useEntitlements } from "../app/useEntitlements";

function downloadBlob({ blob, filename }) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "stockscan_labels.pdf";
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 800);
}

async function blobToJsonSafe(payload) {
  try {
    if (!payload) return null;
    if (payload instanceof Blob) {
      const text = await payload.text();
      return JSON.parse(text);
    }
  } catch {
    return null;
  }
  return null;
}

function getLabelErrorMessage(error) {
  const code = error?.code || error?.data?.code;
  if (code === "LIMIT_LABELS_PDF_MONTH") {
    return "Limite mensuelle des étiquettes PDF atteinte. Passez au plan supérieur.";
  }
  if (code === "FEATURE_NOT_INCLUDED") {
    return "Étiquettes PDF non incluses dans votre plan.";
  }
  return error?.detail || error?.message || "Impossible de générer les étiquettes.";
}

export default function Labels() {
  const { serviceId, services, selectService, tenant } = useAuth();
  const { data: entitlements } = useEntitlements();
  const pushToast = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [fields, setFields] = useState(["price", "price_unit"]);
  const [companyName, setCompanyName] = useState(tenant?.name || "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const canUse = Boolean(entitlements?.entitlements?.labels_pdf);
  const limit = entitlements?.limits?.labels_pdf_monthly_limit ?? null;

  const serviceOptions = useMemo(() => {
    const base = (services || []).map((s) => ({ value: s.id, label: s.name }));
    if (services?.length > 1) base.push({ value: "all", label: "Tous les services" });
    return base;
  }, [services]);

  const toggleField = (key) => {
    setFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const searchProducts = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      if (serviceId === "all") {
        const responses = await Promise.all(
          (services || []).map((s) =>
            api.get(`/api/products/search/?service=${s.id}&q=${encodeURIComponent(query)}`)
          )
        );
        const merged = responses.flatMap((res) => res.data || []);
        setResults(merged);
      } else {
        const res = await api.get(`/api/products/search/?service=${serviceId}&q=${encodeURIComponent(query)}`);
        setResults(res.data || []);
      }
    } catch {
      setResults([]);
      pushToast?.({ message: "Recherche impossible.", type: "error" });
    } finally {
      setSearchLoading(false);
    }
  };

  const addSelected = (product) => {
    if (selected.some((p) => p.id === product.id)) return;
    setSelected((prev) => [...prev, product]);
  };

  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const generateLabels = async () => {
    if (!selected.length) {
      pushToast?.({ message: "Sélectionnez au moins un produit.", type: "warn" });
      return;
    }
    setLoading(true);
    try {
      const ids = selected.map((p) => p.id).join(",");
      const params = new URLSearchParams();
      params.set("ids", ids);
      params.set("service", serviceId || "");
      params.set("company_name", companyName || "");
      if (fields.length) params.set("fields", fields.join(","));

      const res = await api.get(`/api/labels/pdf/?${params.toString()}`, {
        responseType: "blob",
      });
      downloadBlob({ blob: res.data, filename: "stockscan_labels.pdf" });
      pushToast?.({ message: "Étiquettes générées.", type: "success" });
    } catch (error) {
      const data = await blobToJsonSafe(error?.response?.data);
      pushToast?.({ message: getLabelErrorMessage(data || error?.response?.data || error), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Étiquettes | StockScan</title>
        <meta name="description" content="Générateur d'étiquettes PDF." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-[var(--muted)]">PDF étiquettes</div>
          <h1 className="text-2xl font-black text-[var(--text)]">Étiquettes produits</h1>
          <p className="text-sm text-[var(--muted)]">
            Génération A4 paginée avec codes-barres et informations utiles.
          </p>
        </Card>

        {!canUse ? (
          <Card className="p-6">
            <div className="text-sm text-[var(--muted)]">
              Étiquettes PDF non incluses dans votre plan.
            </div>
            <Button className="mt-3" onClick={() => (window.location.href = "/tarifs")}>
              Voir les plans
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[var(--muted)]">
                {limit === null ? "Limite mensuelle : illimitée" : `Limite mensuelle : ${limit} PDF`}
              </div>
              <Button onClick={() => setDrawerOpen(true)}>Configurer les étiquettes</Button>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Sélection actuelle</div>
                {selected.length > 0 && <Badge variant="info">{selected.length} sélectionné(s)</Badge>}
              </div>
              {selected.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun produit sélectionné.</div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  {selected.length} produit{selected.length > 1 ? "s" : ""} prêt
                  {selected.length > 1 ? "s" : ""} pour le PDF.
                </div>
              )}
            </Card>

            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              title="Sélection & options"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
                    Fermer
                  </Button>
                  <Button onClick={generateLabels} loading={loading} disabled={loading || !selected.length}>
                    Générer le PDF
                  </Button>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Recherche produits</div>
                  <div className="grid gap-3 sm:grid-cols-3 items-end">
                    {services?.length > 0 && (
                      <Select
                        label="Service"
                        value={serviceId || ""}
                        onChange={(value) => selectService(value)}
                        options={serviceOptions}
                      />
                    )}
                    <Input
                      label="Recherche produit"
                      placeholder="Nom, code-barres, SKU…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Button onClick={searchProducts} loading={searchLoading}>
                      Rechercher
                    </Button>
                  </div>
                </div>

                {results.length > 0 && (
                  <div className="space-y-2">
                    {results.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">{p.name}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {p.barcode || p.internal_sku || "—"} · {p.inventory_month}
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => addSelected(p)}>
                          Ajouter
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Produits sélectionnés</div>
                  {selected.length === 0 ? (
                    <div className="text-sm text-[var(--muted)]">Aucun produit sélectionné.</div>
                  ) : (
                    <div className="space-y-2">
                      {selected.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                        >
                          <div className="text-sm text-[var(--text)]">{p.name}</div>
                          <Button size="sm" variant="secondary" onClick={() => removeSelected(p.id)}>
                            Retirer
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Branding</div>
                  <Input
                    label="Raison sociale"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <div className="text-xs text-[var(--muted)]">
                    Le nom de l’entreprise est obligatoire sur les étiquettes.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Champs à inclure</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { key: "price", label: "Prix" },
                      { key: "price_unit", label: "Prix / kg ou L" },
                      { key: "tva", label: "TVA" },
                      { key: "supplier", label: "Fournisseur" },
                      { key: "brand", label: "Marque" },
                      { key: "unit", label: "Unité" },
                    ].map((field) => (
                      <label
                        key={field.key}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--primary)]"
                          checked={fields.includes(field.key)}
                          onChange={() => toggleField(field.key)}
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Drawer>
          </>
        )}
      </div>
    </PageTransition>
  );
}
