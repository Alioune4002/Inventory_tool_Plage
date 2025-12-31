import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ScanLine, Sparkles, Info } from "lucide-react";
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
import { currencyLabel } from "../lib/currency";

const BarcodeScannerModal = React.lazy(() => import("../components/BarcodeScannerModal"));

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
  const currencyText = currencyLabel(tenant?.currency_code || "EUR");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [fields, setFields] = useState(["price", "price_unit"]);
  const [companyName, setCompanyName] = useState(tenant?.name || "");
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoType, setPromoType] = useState("percent");
  const [promoValue, setPromoValue] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);

  // ✅ inline price edit
  const [priceEdits, setPriceEdits] = useState({}); // { [id]: "2.90" }
  const [savingPrice, setSavingPrice] = useState({}); // { [id]: true }

  const searchRef = useRef(0);
  const searchTimeoutRef = useRef(null);

  const canUse = Boolean(entitlements?.entitlements?.labels_pdf);
  const limit = entitlements?.limits?.labels_pdf_monthly_limit ?? null;
  const totalLabels = useMemo(() => selected.reduce((sum, p) => sum + (p.count || 1), 0), [selected]);

  const serviceOptions = useMemo(() => {
    const base = (services || []).map((s) => ({ value: s.id, label: s.name }));
    if (services?.length > 1) base.push({ value: "all", label: "Tous les services" });
    return base;
  }, [services]);

  useEffect(() => {
    if (promoEnabled && !fields.includes("price")) {
      setFields((prev) => [...prev, "price"]);
    }
  }, [promoEnabled, fields]);

  const toggleField = (key) => {
    setFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const searchProducts = async (value) => {
    const searchValue = (value ?? query).trim();
    if (!searchValue) {
      setResults([]);
      return;
    }
    const seq = ++searchRef.current;
    setSearchLoading(true);
    try {
      if (serviceId === "all") {
        const responses = await Promise.all(
          (services || []).map((s) =>
            api.get(`/api/products/search/?service=${s.id}&q=${encodeURIComponent(searchValue)}`)
          )
        );
        if (seq !== searchRef.current) return;
        const merged = responses.flatMap((res) => res.data || []);
        setResults(merged);
      } else {
        const res = await api.get(`/api/products/search/?service=${serviceId}&q=${encodeURIComponent(searchValue)}`);
        if (seq !== searchRef.current) return;
        setResults(res.data || []);
      }
    } catch {
      if (seq !== searchRef.current) return;
      setResults([]);
      pushToast?.({ message: "Recherche impossible.", type: "error" });
    } finally {
      if (seq === searchRef.current) setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchLoading(false);
      return;
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      searchProducts(trimmed);
    }, 80);
    return () => clearTimeout(searchTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, serviceId]);

  useEffect(() => {
    if (!lastAddedId) return;
    const timer = window.setTimeout(() => setLastAddedId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [lastAddedId]);

  const addSelected = (product) => {
    setSelected((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, count: Math.min((p.count || 1) + 1, 50) } : p));
      }
      return [...prev, { ...product, count: 1 }];
    });
    setLastAddedId(product.id);
    pushToast?.({ message: `Ajouté : ${product.name}`, type: "success" });
  };

  const removeSelected = (id) => setSelected((prev) => prev.filter((p) => p.id !== id));

  const updateCount = (id, nextCount) => {
    const parsed = Number(nextCount);
    if (!Number.isFinite(parsed)) return;
    if (parsed <= 0) {
      removeSelected(id);
      return;
    }
    setSelected((prev) => prev.map((p) => (p.id === id ? { ...p, count: Math.min(parsed, 50) } : p)));
  };

  const getPriceValue = (p) => {
    const v = p?.selling_price ?? p?.price ?? p?.sellingPrice ?? p?.sale_price ?? p?.unit_price ?? null;
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const requiresPrice = useMemo(() => {
    return fields.includes("price") || fields.includes("price_unit") || promoEnabled;
  }, [fields, promoEnabled]);

  const missingPriceProducts = useMemo(() => {
    if (!requiresPrice) return [];
    return selected.filter((p) => {
      const val = getPriceValue(p);
      return val === null || val <= 0;
    });
  }, [selected, requiresPrice]);

  const saveProductPrice = async (p) => {
    // on évite les mauvais contextes (multi-services)
    if (!serviceId || serviceId === "all") {
      pushToast?.({ type: "warn", message: "Sélectionnez un service précis pour modifier un prix." });
      return;
    }

    const raw = String(priceEdits[p.id] ?? "").replace(",", ".").trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      pushToast?.({ type: "error", message: "Prix invalide. Exemple : 2.90" });
      return;
    }

    setSavingPrice((prev) => ({ ...prev, [p.id]: true }));
    try {
      await api.patch(`/api/products/${p.id}/`, { selling_price: n });

      // update selected + results
      setSelected((prev) => prev.map((x) => (x.id === p.id ? { ...x, selling_price: n } : x)));
      setResults((prev) => prev.map((x) => (x.id === p.id ? { ...x, selling_price: n } : x)));

      pushToast?.({ type: "success", message: `Prix enregistré : ${p.name}` });
    } catch (e) {
      const apiMsg =
        e?.friendlyMessage ||
        e?.response?.data?.detail ||
        e?.response?.data?.non_field_errors?.[0] ||
        "Impossible d’enregistrer le prix.";
      pushToast?.({ type: "error", message: apiMsg });
    } finally {
      setSavingPrice((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const generateLabels = async () => {
    if (!selected.length) {
      pushToast?.({ message: "Sélectionnez au moins un produit.", type: "warn" });
      return;
    }

    if (missingPriceProducts.length) {
      const names = missingPriceProducts
        .slice(0, 4)
        .map((p) => p.name)
        .filter(Boolean)
        .join(", ");
      const more = missingPriceProducts.length > 4 ? ` (+${missingPriceProducts.length - 4})` : "";
      pushToast?.({
        type: "error",
        message: `Prix obligatoire pour imprimer des étiquettes prix. Complétez : ${names}${more}.`,
      });
      setDrawerOpen(true);
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
      const counts = selected.map((p) => `${p.id}:${p.count || 1}`).join(",");
      params.set("counts", counts);
      if (promoEnabled) {
        params.set("promo_type", promoType);
        params.set("promo_value", promoValue);
      }

      const res = await api.get(`/api/labels/pdf/?${params.toString()}`, { responseType: "blob" });
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
          <p className="text-sm text-[var(--muted)]">Génération A4 paginée avec codes-barres et infos utiles.</p>
        </Card>

        {!canUse ? (
          <Card className="p-6">
            <div className="text-sm text-[var(--muted)]">Étiquettes PDF non incluses dans votre plan.</div>
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

            {selected.length === 0 && !query.trim() && (
              <Card className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Sparkles className="h-5 w-5 text-[var(--text)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Comment ça marche</div>
                    <div className="text-sm text-[var(--muted)]">
                      Sélectionnez des produits puis StockScan génère un PDF prêt à imprimer (A4).
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { title: "1) Rechercher", desc: "Tape un nom / EAN / SKU… ou scanne directement.", icon: <Info className="h-4 w-4" /> },
                    { title: "2) Ajouter", desc: "Ajoute 1 ou plusieurs fois (quantité d’étiquettes).", icon: <Info className="h-4 w-4" /> },
                    { title: "3) Générer", desc: "PDF paginé + code-barres + prix + infos utiles.", icon: <Info className="h-4 w-4" /> },
                  ].map((b) => (
                    <div key={b.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        {b.icon}
                        {b.title}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{b.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                    Ouvrir la sélection
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Sélection actuelle</div>
                {selected.length > 0 && (
                  <Badge variant="info">
                    {selected.length} produit{selected.length > 1 ? "s" : ""} · {totalLabels} étiquette{totalLabels > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {selected.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun produit sélectionné.</div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  {totalLabels} étiquette{totalLabels > 1 ? "s" : ""} prête{totalLabels > 1 ? "s" : ""} pour le PDF.
                </div>
              )}
            </Card>

            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              title="Sélection & options"
              footer={
                <div className="flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
                  <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
                    Fermer
                  </Button>
                  <Button onClick={generateLabels} loading={loading} disabled={loading || !selected.length}>
                    Générer le PDF
                  </Button>
                </div>
              }
            >
              <div className="space-y-5 pb-24">
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
                      rightSlot={
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] p-2 text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/10"
                          onClick={() => setScannerOpen(true)}
                          title="Scanner un code-barres"
                          aria-label="Scanner un code-barres"
                        >
                          <ScanLine className="h-4 w-4" />
                        </button>
                      }
                    />

                    <Button onClick={() => searchProducts()} loading={searchLoading}>
                      Rechercher
                    </Button>
                  </div>
                  <div className="text-xs text-[var(--muted)]">Les suggestions apparaissent dès que vous tapez.</div>
                </div>

                {results.length > 0 && (
                  <div className="space-y-2" aria-live="polite">
                    {results.map((p) => (
                      <div
                        key={p.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition ${
                          lastAddedId === p.id
                            ? "border-emerald-400/60 bg-emerald-500/10 ring-2 ring-emerald-400/30 animate-floatSoft"
                            : "border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">{p.name}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {p.barcode || p.internal_sku || "—"} · {p.inventory_month}
                          </div>
                          {lastAddedId === p.id && <div className="text-xs text-emerald-600">Ajouté à la sélection</div>}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => addSelected(p)}>
                          {selected.some((item) => item.id === p.id) ? "Ajouter +1" : "Ajouter"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {query.trim() && !searchLoading && results.length === 0 && (
                  <div className="text-sm text-[var(--muted)]">Aucun résultat pour cette recherche.</div>
                )}

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Produits sélectionnés</div>

                  {selected.length === 0 ? (
                    <div className="text-sm text-[var(--muted)]">Aucun produit sélectionné.</div>
                  ) : (
                    <div className="space-y-2">
                      {selected.map((p) => {
                        const missing = requiresPrice && (getPriceValue(p) === null || getPriceValue(p) <= 0);
                        return (
                          <div
                            key={p.id}
                            className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 ${
                              lastAddedId === p.id ? "ring-2 ring-emerald-400/40" : ""
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-sm text-[var(--text)] font-semibold">{p.name}</div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => updateCount(p.id, (p.count || 1) - 1)}>
                                  −
                                </Button>
                                <input
                                  type="number"
                                  min="1"
                                  max="50"
                                  value={p.count || 1}
                                  onChange={(e) => updateCount(p.id, Number(e.target.value || 1))}
                                  className="w-14 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-center text-sm text-[var(--text)]"
                                  aria-label={`Nombre d'étiquettes pour ${p.name}`}
                                />
                                <Button size="sm" variant="secondary" onClick={() => updateCount(p.id, (p.count || 1) + 1)}>
                                  +
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => removeSelected(p.id)}>
                                  Retirer
                                </Button>
                              </div>
                            </div>

                            {/* ✅ inline price editor (only useful if price is required) */}
                            {requiresPrice && (
                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <div className="flex-1 min-w-[180px]">
                                  <Input
                                    label={`Prix de vente (${currencyText})`}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={priceEdits[p.id] ?? (getPriceValue(p) ?? "")}
                                    onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    helper={missing ? "Prix requis pour imprimer." : "Optionnel selon les champs."}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  variant={missing ? "danger" : "secondary"}
                                  onClick={() => saveProductPrice(p)}
                                  loading={Boolean(savingPrice[p.id])}
                                >
                                  Enregistrer
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Identité</div>
                  <Input label="Raison sociale" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  <div className="text-xs text-[var(--muted)]">Le nom de l’entreprise est obligatoire sur les étiquettes.</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Champs à inclure</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { key: "price", label: `Prix (${currencyText})` },
                      { key: "price_unit", label: `Prix / kg ou L (${currencyText})` },
                      { key: "tva", label: "TVA" },
                      { key: "supplier", label: "Fournisseur" },
                      { key: "brand", label: "Marque" },
                      { key: "unit", label: "Unité" },
                      { key: "dlc", label: "DLC / DDM" },
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

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Étiquettes promo</div>
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={promoEnabled}
                      onChange={(e) => setPromoEnabled(e.target.checked)}
                    />
                    <span>Afficher l’ancien prix + le prix remisé</span>
                  </label>
                  {promoEnabled && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Select
                        label="Type de remise"
                        value={promoType}
                        onChange={(value) => setPromoType(value)}
                        options={[
                          { value: "percent", label: "Pourcentage" },
                          { value: "amount", label: `Montant (${currencyText})` },
                        ]}
                      />
                      <Input
                        label={promoType === "percent" ? "Remise (%)" : `Remise (${currencyText})`}
                        type="number"
                        min={promoType === "percent" ? 1 : 0.01}
                        max={promoType === "percent" ? 100 : undefined}
                        step={promoType === "percent" ? "1" : "0.01"}
                        value={promoValue}
                        onChange={(e) => setPromoValue(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="text-xs text-[var(--muted)]">
                    Les remises s’appliquent sur le prix de vente (ou le prix d’achat si absent).
                  </div>
                </div>
              </div>
            </Drawer>
          </>
        )}
      </div>

      <Suspense fallback={null}>
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => {
            setScannerOpen(false);
            setQuery(code);
            searchProducts(code);
          }}
        />
      </Suspense>
    </PageTransition>
  );
}