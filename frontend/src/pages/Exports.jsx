import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api } from "../lib/api";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { useEntitlements } from "../app/useEntitlements";
import { FAMILLES, resolveFamilyId } from "../lib/famillesConfig";
import { getWording } from "../lib/labels";
import { currencyLabel } from "../lib/currency";

function parseFilenameFromContentDisposition(contentDisposition, fallback) {
  try {
    if (!contentDisposition) return fallback;
    const match = String(contentDisposition).match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
    const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "");
    return raw ? raw.replace(/[/\\]/g, "_") : fallback;
  } catch {
    return fallback;
  }
}

async function blobToJsonSafe(payload) {
  try {
    if (!payload) return null;
    if (typeof payload === "string") {
      return JSON.parse(payload);
    }
    if (typeof payload === "object") {
      if (typeof payload.text === "function") {
        const text = await payload.text();
        return JSON.parse(text);
      }
      if ("code" in payload || "detail" in payload || "message" in payload) {
        return payload;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function downloadBlob({ blob, filename, keepUrl = false }) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "export.xlsx";
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (!keepUrl) window.setTimeout(() => window.URL.revokeObjectURL(url), 800);
  return url;
}

export default function Exports() {
  const { serviceId, services, serviceFeatures, tenant, serviceProfile } = useAuth();
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();
  const currencyText = currencyLabel(tenant?.currency_code || "EUR");

  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("all");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [toast, setToast] = useState("");
  const [exportService, setExportService] = useState(serviceId || "");
  const [downloadLink, setDownloadLink] = useState(null);

  const pricingCfg = serviceFeatures?.prices || {};
  const purchaseEnabled = pricingCfg.purchase_enabled !== false;
  const sellingEnabled = pricingCfg.selling_enabled !== false;
  const tvaEnabled = serviceFeatures?.tva?.enabled !== false;
  const showOpenFilter = serviceFeatures?.open_container_tracking?.enabled === true;

  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;

  const familyId = resolveFamilyId(serviceType, serviceDomain);
  const familyMeta = FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0];
  const familyIdentifiers = familyMeta?.identifiers ?? {};

  const wording = getWording(serviceType, serviceDomain);
  const itemLabelLower = (wording.itemLabel || "élément").toLowerCase();
  const categoryLabelLower = (wording.categoryLabel || "catégorie").toLowerCase();
  const canAdvancedReports = Boolean(entitlements?.entitlements?.reports_advanced);
  const canEmailExport = Boolean(entitlements?.entitlements?.exports_email);

  const getFeatureFlag = (key, fallback = false) => {
    const cfg = serviceFeatures?.[key];
    if (cfg && typeof cfg.enabled === "boolean") return cfg.enabled;
    return fallback;
  };

  const barcodeEnabled = getFeatureFlag("barcode", familyIdentifiers.barcode ?? true);
  const skuEnabled = getFeatureFlag("sku", familyIdentifiers.sku ?? true);
  const identifierEnabled = barcodeEnabled || skuEnabled;
  const itemTypeEnabled = getFeatureFlag("item_type", familyMeta?.modules?.includes("itemType"));
  const variantsEnabled = getFeatureFlag("variants", familyMeta?.modules?.includes("variants"));
  const multiUnitEnabled = getFeatureFlag("multi_unit", familyMeta?.modules?.includes("multiUnit"));
  const lotEnabled = getFeatureFlag("lot", familyMeta?.modules?.includes("lot"));

  const fieldOptions = useMemo(() => {
    const fields = [
      { key: "name", label: `Nom ${itemLabelLower}`, helper: `Nom du ${itemLabelLower} catalogue.` },
      { key: "category", label: wording.categoryLabel, helper: `${wording.categoryLabel} métier.` },
      { key: "quantity", label: "Quantité comptée", helper: "Comptage du mois." },
      { key: "unit", label: "Unité", helper: "Unité de comptage." },
      { key: "inventory_month", label: "Mois", helper: "Mois d’inventaire." },
      { key: "service", label: "Service", helper: "Service concerné." },
      { key: "min_qty", label: "Stock min", helper: "Seuil d’alerte stock." },
      { key: "purchase_price", label: `Prix achat (${currencyText})`, helper: "Prix d’achat HT." },
      { key: "selling_price", label: `Prix vente (${currencyText})`, helper: "Prix de vente HT." },
      { key: "tva", label: "TVA (%)", helper: "Taux de TVA." },
      { key: "dlc", label: "DLC / DDM", helper: "Dates limites." },
      { key: "brand", label: "Marque", helper: "Marque optionnelle." },
      { key: "supplier", label: "Fournisseur", helper: "Fournisseur optionnel." },
      ...(itemTypeEnabled
        ? [{ key: "product_role", label: `Type ${itemLabelLower}`, helper: "Matière première / produit fini." }]
        : []),
      { key: "notes", label: "Notes", helper: "Notes internes." },
    ];

    if (identifierEnabled) {
      fields.splice(4, 0, {
        key: "identifier",
        label: `Identifiant (${wording.identifierLabel || "code-barres / SKU"})`,
        helper: "Identifiant principal catalogue.",
      });
    }
    if (variantsEnabled) {
      fields.push(
        { key: "variant", label: "Variante", helper: "Libellé + valeur de variante." },
        { key: "variant_name", label: "Variante (libellé)", helper: "Ex. Taille, Couleur." },
        { key: "variant_value", label: "Variante (valeur)", helper: "Ex. M, Bleu, 75cl." }
      );
    }
    if (lotEnabled) {
      fields.push({ key: "lot_number", label: "Lot / Batch", helper: "Numéro de lot (si activé)." });
    }
    if (showOpenFilter) {
      fields.push(
        { key: "container_status", label: "Statut (entamé)", helper: "Statut du contenant." },
        { key: "remaining_fraction", label: "Reste (fraction)", helper: "Reste pour les contenants ouverts." }
      );
    }
    if (multiUnitEnabled) {
      fields.push(
        { key: "conversion_factor", label: "Conversion (facteur)", helper: "Ex. 1 unité = 0.75 L." },
        { key: "conversion_unit", label: "Conversion (unité)", helper: "Unité convertie." },
        { key: "converted_quantity", label: "Quantité convertie", helper: "Quantité après conversion." },
        { key: "converted_unit", label: "Unité convertie (résultat)", helper: "Unité de la quantité convertie." }
      );
    }
    return fields;
  }, [
    identifierEnabled,
    itemTypeEnabled,
    variantsEnabled,
    lotEnabled,
    showOpenFilter,
    multiUnitEnabled,
    wording.identifierLabel,
    wording.categoryLabel,
    itemLabelLower,
  ]);

  const defaultFields = useMemo(() => {
    const base = ["name", "category", "quantity", "unit"];
    if (identifierEnabled) base.push("identifier");
    base.push("inventory_month", "service");
    if (purchaseEnabled) base.push("purchase_price");
    if (sellingEnabled) base.push("selling_price");
    if (tvaEnabled && (purchaseEnabled || sellingEnabled)) base.push("tva");
    return base;
  }, [identifierEnabled, purchaseEnabled, sellingEnabled, tvaEnabled]);

  const [selectedFields, setSelectedFields] = useState(defaultFields);

  const essentialFields = identifierEnabled
    ? ["name", "category", "quantity", "unit", "identifier", "inventory_month", "service"]
    : ["name", "category", "quantity", "unit", "inventory_month", "service"];

  const allFieldKeys = useMemo(() => fieldOptions.map((field) => field.key), [fieldOptions]);

  useEffect(() => {
    setSelectedFields(defaultFields);
  }, [serviceId, defaultFields]);

  useEffect(() => {
    if (!showOpenFilter) setMode("all");
  }, [showOpenFilter]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!serviceId) return;
    if (exportService !== "all") setExportService(serviceId);
  }, [serviceId, exportService]);

  useEffect(() => {
    if (!canAdvancedReports) {
      setIncludeSummary(false);
      setIncludeCharts(false);
    }
  }, [canAdvancedReports]);

  useEffect(() => {
    if (!canEmailExport && email) setEmail("");
  }, [canEmailExport, email]);

  useEffect(() => {
    return () => {
      if (downloadLink?.url) window.URL.revokeObjectURL(downloadLink.url);
    };
  }, [downloadLink]);

  useEffect(() => {
    if (exportService === "all") {
      setSelectedCategories([]);
      setAvailableCategories([]);
    }
  }, [exportService]);

  const toggleField = (key) => {
    setSelectedFields((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((field) => field !== key);
        return next.length > 0 ? next : prev;
      }
      return [...prev, key];
    });
  };

  const includeTVA = selectedFields.includes("tva");
  const includeDLC = selectedFields.includes("dlc");
  const includeIdentifier = selectedFields.includes("identifier");

  const resolveExportError = async (error, format) => {
    const response = error?.response;
    const status = response?.status;
    let payload = response?.data;

    if (payload && typeof payload === "object" && typeof payload.text === "function") {
      payload = await blobToJsonSafe(payload);
    } else if (typeof payload === "string" || (payload && typeof payload === "object")) {
      payload = await blobToJsonSafe(payload);
    }

    const code = payload?.code || error?.code;
    const detail = payload?.detail || payload?.message;

    if (code === "LIMIT_EXPORT_CSV_MONTH") {
      return "Limite mensuelle CSV atteinte. Passez au plan Duo ou Multi pour exporter sans limite.";
    }
    if (code === "LIMIT_EXPORT_XLSX_MONTH") {
      return "Limite mensuelle Excel atteinte. Passez au plan Duo ou Multi pour exporter davantage.";
    }
    if (code === "FEATURE_NOT_INCLUDED") {
      return "Synthèse & graphiques disponibles en plan Multi. Désactivez-les ou passez au plan supérieur.";
    }
    if (status === 403 && detail) {
      const lower = String(detail).toLowerCase();
      if (lower.includes("limite d'export mensuelle") || lower.includes("limite d’export mensuelle")) {
        return format === "csv"
          ? "Limite mensuelle CSV atteinte. Passez au plan Duo ou Multi pour exporter sans limite."
          : "Limite mensuelle Excel atteinte. Passez au plan Duo ou Multi pour exporter davantage.";
      }
      return String(detail);
    }
    if (status === 403 && format) {
      return format === "csv"
        ? "Limite mensuelle CSV atteinte. Passez au plan Duo ou Multi pour exporter sans limite."
        : "Limite mensuelle Excel atteinte. Passez au plan Duo ou Multi pour exporter davantage.";
    }
    if (detail) return String(detail);
    return error?.message || "Échec de l’export. Vérifie les filtres / droits / plan.";
  };

  const doExport = async (format = "xlsx") => {
    const effectiveService = exportService || serviceId;
    if (!effectiveService) {
      setToast("Choisissez un service d’abord.");
      return;
    }
    if (!selectedFields.length) {
      setToast("Sélectionnez au moins un champ à exporter.");
      return;
    }
    if (format !== "csv" && !canAdvancedReports && (includeSummary || includeCharts)) {
      setToast("Synthèse & graphiques disponibles en plan Multi. Désactivez-les pour exporter.");
      return;
    }

    setLoading(true);
    setToast("");

    try {
      const chartsAllowed = format !== "csv" && includeCharts && canAdvancedReports;
      const summaryAllowed = format !== "csv" && includeSummary && canAdvancedReports;

      if (format === "csv" && (includeCharts || includeSummary)) {
        pushToast?.({ message: "CSV : graphiques et synthèse ignorés.", type: "info" });
      }

      const payload = {
        mode,
        include_tva: includeTVA,
        include_dlc: includeDLC,
        include_sku: includeIdentifier,
        include_charts: chartsAllowed,
        include_summary: summaryAllowed,
        categories: selectedCategories,
        from_month: periodFrom,
        to_month: periodTo,
        format,
        email,
        message,
        fields: selectedFields,
      };
      if (effectiveService === "all") {
        payload.services = (services || []).map((s) => s.id);
      } else {
        payload.service = effectiveService;
      }

      const res = await api.post("/api/export-advanced/", payload, {
        responseType: "blob",
        headers: {
          Accept: format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      const contentType = res?.headers?.["content-type"] || "";
      const maybeJson = contentType.includes("application/json") || contentType.includes("text/json");

      if (maybeJson) {
        const data = await blobToJsonSafe(res.data);
        const msg = data?.detail || data?.error || data?.message || "Export refusé / impossible.";
        const extra = data?.code ? ` (${data.code})` : "";
        throw new Error(`${msg}${extra}`);
      }

      const fallbackName = `export.${format}`;
      const filename = parseFilenameFromContentDisposition(res?.headers?.["content-disposition"], fallbackName);

      const blob = new Blob([res.data], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = downloadBlob({ blob, filename, keepUrl: true });
      setDownloadLink((prev) => {
        if (prev?.url) window.URL.revokeObjectURL(prev.url);
        return { url, filename, format };
      });

      const emailMsg = email ? " & envoi email demandé" : "";
      setToast(`Export prêt${emailMsg}.`);
      pushToast?.({ message: `Export prêt${emailMsg}`, type: "success" });
    } catch (e) {
      const msg = await resolveExportError(e, format);
      setToast(msg);
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!serviceId || exportService === "all") return;
    api
      .get("/api/categories/", { params: { service: exportService || serviceId } })
      .then((res) => setAvailableCategories(res.data || []))
      .catch(() => setAvailableCategories([]));
  }, [serviceId, exportService]);

  const toggleCategory = (slug) => {
    setSelectedCategories((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  // ✅ styles helpers
  const chipBase =
    "rounded-full border px-3 py-1 text-xs font-semibold transition";
  const chipOff =
    "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:opacity-95";
  const chipOn =
    "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--text)]";

  return (
    <PageTransition>
      <Helmet>
        <title>Exports | StockScan</title>
        <meta name="description" content="Exports avancés CSV/XLSX avec filtres." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm text-[var(--muted)]">Exports</div>
          <div className="text-2xl font-black tracking-tight text-[var(--text)]">Exports CSV / Excel</div>
          <div className="text-sm text-[var(--muted)]">Choisissez les filtres, puis lancez un export.</div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Période (début)" type="month" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            <Input label="Période (fin)" type="month" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />

            {services?.length > 0 && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[var(--text)]">Service</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                  value={exportService || serviceId || ""}
                  onChange={(e) => setExportService(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {services.length > 1 && <option value="all">Tous les services</option>}
                </select>
                <span className="text-xs text-[var(--muted)]">
                  {exportService === "all"
                    ? "Export global (tous services). Les catégories sont désactivées."
                    : "Vous pouvez exporter un service précis ou tout regrouper."}
                </span>
              </label>
            )}

            {showOpenFilter && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[var(--text)]">Mode</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="all">Tout</option>
                  <option value="SEALED">Non entamé</option>
                  <option value="OPENED">Entamé</option>
                </select>
                <span className="text-xs text-[var(--muted)]">Sélectionne entamé/non entamé si besoin.</span>
              </label>
            )}

            <Input
              label="Partage email (optionnel)"
              type="email"
              placeholder="destinataire@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEmailExport}
              helper={
                canEmailExport
                  ? "Le fichier est téléchargé et envoyé par email si renseigné."
                  : "Partage e-mail disponible en plan Multi."
              }
            />

            <Input
              label="Message (optionnel)"
              placeholder="Contexte de l’inventaire…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--text)]">{wording.categoryLabel}</span>
              <div className="flex flex-wrap gap-2">
                {exportService === "all" ? (
                  <span className="text-xs text-[var(--muted)]">Catégories désactivées en export global.</span>
                ) : availableCategories.length === 0 ? (
                  <span className="text-xs text-[var(--muted)]">Chargement des catégories…</span>
                ) : (
                  availableCategories.map((category) => {
                    const value = category.name || category.title || category.slug || category.id;
                    const label = category.name || category.title || value;
                    const active = selectedCategories.includes(value);
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => toggleCategory(value)}
                        className={`${chipBase} ${active ? chipOn : chipOff}`}
                      >
                        {label}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Sélectionne les {categoryLabelLower} à intégrer. Sans sélection, l’export prend tout.
              </p>
              {selectedCategories.length > 0 && (
                <p className="text-xs" style={{ color: "var(--success)" }}>
                  Catégories choisies : {selectedCategories.join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium text-[var(--text)]">Champs exportés</span>
              <div className="flex items-center gap-2">
                <button type="button" className={`${chipBase} ${chipOff}`} onClick={() => setSelectedFields(essentialFields)}>
                  Base
                </button>
                <button type="button" className={`${chipBase} ${chipOff}`} onClick={() => setSelectedFields(allFieldKeys)}>
                  Complet
                </button>
                <button type="button" className={`${chipBase} ${chipOff}`} onClick={() => setSelectedFields(defaultFields)}>
                  Réinitialiser
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {fieldOptions.map((field) => {
                const active = selectedFields.includes(field.key);
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => toggleField(field.key)}
                    className={`${chipBase} ${active ? chipOn : chipOff}`}
                  >
                    {field.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[var(--muted)]">Sélectionne exactement ce que tu veux récupérer dans le fichier.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text)]">Extras graphiques</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-2xl px-3 py-1 text-xs font-semibold border",
                    includeCharts
                      ? "border-[var(--success)] bg-[var(--success)]/15 text-[var(--text)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                    !canAdvancedReports && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => setIncludeCharts((prev) => !prev)}
                  disabled={!canAdvancedReports}
                >
                  {includeCharts ? "Graphiques ON" : "Graphiques OFF"}
                </button>

                <button
                  type="button"
                  className={cn(
                    "rounded-2xl px-3 py-1 text-xs font-semibold border",
                    includeSummary
                      ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--text)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                    !canAdvancedReports && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => setIncludeSummary((prev) => !prev)}
                  disabled={!canAdvancedReports}
                >
                  {includeSummary ? "Synthèse ON" : "Synthèse OFF"}
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Les graphiques & la synthèse sont inclus dans un onglet Excel dédié (non disponibles en CSV).
              {!canAdvancedReports && " (Disponible en plan Multi.)"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => doExport("xlsx")} loading={loading}>Export Excel</Button>
            <Button variant="secondary" onClick={() => doExport("csv")} loading={loading}>Export CSV</Button>
          </div>

          {downloadLink ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
              Si le téléchargement ne démarre pas,{" "}
              <a className="underline text-[var(--text)]" href={downloadLink.url} download={downloadLink.filename}>
                cliquez ici pour télécharger l’export.
              </a>
            </div>
          ) : null}

          {toast && (
            <div className="text-sm text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3 py-2">
              {toast}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}


function cn(...a) {
  return a.filter(Boolean).join(" ");
}
