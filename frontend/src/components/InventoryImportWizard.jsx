import React, { useMemo, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Card from "../ui/Card";
import { api } from "../lib/api";

const FIELD_ORDER = [
  "name",
  "quantity",
  "unit",
  "purchase_price",
  "selling_price",
  "tva",
  "barcode",
  "internal_sku",
  "category",
];

const FIELD_LABELS = {
  name: "Désignation du produit",
  quantity: "Quantité",
  unit: "Unité",
  purchase_price: "Prix d’achat",
  selling_price: "Prix de vente",
  tva: "TVA",
  barcode: "Code-barres",
  internal_sku: "SKU interne",
  category: "Catégorie",
};

const QTY_OPTIONS = [
  { value: "zero", label: "Produits seulement (quantité = 0)" },
  { value: "set", label: "Conserver les quantités du fichier" },
  { value: "selective", label: "Choisir les lignes avec quantités" },
];

const UPDATE_STRATEGIES = [
  { value: "create_only", label: "Créer uniquement" },
  { value: "update_existing", label: "Mettre à jour si le produit existe" },
];

function buildFieldOptions(columns) {
  return [
    { value: "", label: "Ignorer" },
    ...(columns || []).map((col) => ({ value: col, label: col })),
  ];
}

function buildErrorsCsv(rows) {
  const header = ["ligne", "designation", "warnings"].join(";");
  const lines = (rows || [])
    .filter((row) => Array.isArray(row.warnings) && row.warnings.length)
    .map((row) => {
      const warn = row.warnings.join(",");
      return [row.row_id, row.name || "", warn].join(";");
    });
  return [header, ...lines].join("\n");
}

export default function InventoryImportWizard({
  serviceId,
  serviceLabel,
  disabled,
  onImported,
  pushToast,
  mode = "inventory",
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [qtyMode, setQtyMode] = useState("zero");
  const [keepQtyRowIds, setKeepQtyRowIds] = useState([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rowOverrides, setRowOverrides] = useState({});
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [updateStrategy, setUpdateStrategy] = useState("create_only");

  const columns = preview?.columns || [];
  const fieldOptions = useMemo(() => buildFieldOptions(columns), [columns]);
  const hasRequiredMapping = Boolean(mapping?.name);
  const isInventoryMode = mode === "inventory";

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setQtyMode("zero");
    setKeepQtyRowIds([]);
    setRowOverrides({});
    setSummary(null);
    setError("");
    setStep(1);
    setUpdateStrategy("create_only");
  };

  const openDrawer = () => {
    reset();
    setOpen(true);
  };

  const closeDrawer = () => {
    setOpen(false);
  };

  const toggleQtyRow = (rowId) => {
    setKeepQtyRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return Array.from(next);
    });
  };

  const updateOverride = (rowId, field, value) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [field]: value },
    }));
  };

  const analyzeFile = async (overrideMapping) => {
    if (!file) {
      setError("Sélectionnez un fichier CSV ou XLSX.");
      return;
    }
    setLoading(true);
    setError("");
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (overrideMapping) {
        formData.append("mapping", JSON.stringify(overrideMapping));
      }
      formData.append("mode", mode);
      const res = await api.post(
        `/api/imports/inventory/preview/?service=${serviceId}&mode=${mode}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const data = res?.data;
      setPreview(data);
      setMapping(data?.mapping || {});
      pushToast?.({ message: "Analyse terminée. Vérifiez le mapping.", type: "success" });
      return true;
    } catch (e) {
      setError(e?.response?.data?.detail || "Analyse impossible.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!preview?.preview_id) return;
    if (!hasRequiredMapping) {
      setError("La désignation est obligatoire pour importer.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        preview_id: preview.preview_id,
        qty_mode: isInventoryMode ? qtyMode : "zero",
        keep_qty_row_ids: keepQtyRowIds,
        month,
        row_overrides: rowOverrides,
        mode,
        update_strategy: updateStrategy,
      };
      const res = await api.post(`/api/imports/inventory/commit/?service=${serviceId}&mode=${mode}`, payload);
      setSummary(res?.data || null);
      onImported?.();
      pushToast?.({ message: "Import terminé.", type: "success" });
    } catch (e) {
      setError(e?.response?.data?.detail || "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!preview?.rows?.length) return;
    const csv = buildErrorsCsv(preview.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import_erreurs.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleAnalyze = async () => {
    const ok = await analyzeFile();
    if (ok) setStep(2);
  };

  const handleApplyMapping = async () => {
    if (!hasRequiredMapping) return;
    const ok = await analyzeFile(mapping);
    if (ok) setStep(3);
  };

  return (
    <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">
            {isInventoryMode ? "Importer un inventaire (CSV/XLSX)" : "Importer des produits (CSV/XLSX)"}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {isInventoryMode
              ? "Préparez vos quantités et votre base produits à partir d’un fichier existant."
              : "Créez ou mettez à jour votre catalogue à partir d’un fichier existant."}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Colonnes possibles : désignation, quantité, unité, prix achat/vente, TVA, code-barres, SKU, catégorie.
          </div>
        </div>
        <Button size="sm" onClick={openDrawer} disabled={disabled}>
          Démarrer l’import
        </Button>
      </div>

      <Drawer
        open={open}
        onClose={closeDrawer}
        title={isInventoryMode ? "Importer un inventaire" : "Importer des produits"}
        footer={
          <div className="flex flex-wrap items-center gap-2 justify-between w-full">
            <Button variant="secondary" type="button" onClick={closeDrawer}>
              Fermer
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="secondary" type="button" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Retour
                </Button>
              )}
              {step === 1 && (
                <Button type="button" onClick={handleAnalyze} loading={loading}>
                  Analyser le fichier
                </Button>
              )}
              {step === 2 && (
                <Button type="button" onClick={handleApplyMapping} loading={loading} disabled={!hasRequiredMapping}>
                  Mettre à jour l’aperçu
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={commitImport} loading={loading} disabled={!hasRequiredMapping}>
                  Importer maintenant
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="text-xs text-[var(--muted)]">
            Service sélectionné : <span className="font-semibold text-[var(--text)]">{serviceLabel}</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Fichier CSV ou XLSX"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                helper="Taille max 10MB. CSV UTF-8 recommandé."
              />
              {preview && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">
                  ✔ Fichier analysé · {preview.stats?.total} lignes · {columns.length} colonnes détectées
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-[var(--text)]">Associer les colonnes du fichier</div>
              <div className="text-xs text-[var(--muted)]">
                Associez chaque champ StockScan à une colonne de votre fichier. La désignation est obligatoire pour importer.
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {FIELD_ORDER.map((field) => (
                  <Select
                    key={field}
                    label={FIELD_LABELS[field]}
                    value={mapping?.[field] || ""}
                    onChange={(value) => setMapping((prev) => ({ ...(prev || {}), [field]: value }))}
                    options={fieldOptions}
                    helper={field === "name" ? "Obligatoire" : undefined}
                    placeholder="Ignorer"
                  />
                ))}
              </div>
              {!hasRequiredMapping && (
                <div className="text-xs text-amber-500">La désignation est obligatoire pour continuer.</div>
              )}
              <Button size="sm" variant="secondary" onClick={handleApplyMapping} loading={loading} disabled={!hasRequiredMapping}>
                Mettre à jour l’aperçu
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-[var(--text)]">Aperçu des données importées</div>
              <div className="text-xs text-[var(--muted)]">
                {preview.stats?.total} lignes analysées · {preview.stats?.valid} valides · {preview.stats?.invalid} incomplètes
                {preview.stats?.invalid_quantity ? ` · ${preview.stats.invalid_quantity} quantités invalides` : ""}
              </div>

              {isInventoryMode && (
                <Input
                  label="Mois d’inventaire"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  helper="Choisissez le mois cible pour la création des produits."
                />
              )}

              {!isInventoryMode && (
                <Select
                  label="Si le produit existe déjà"
                  value={updateStrategy}
                  onChange={setUpdateStrategy}
                  options={UPDATE_STRATEGIES}
                />
              )}

              {isInventoryMode && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Gestion des quantités</div>
                  <Select value={qtyMode} onChange={setQtyMode} options={QTY_OPTIONS} />
                </div>
              )}

              <div className="space-y-3">
                <div className="max-h-80 overflow-auto rounded-2xl border border-[var(--border)]">
                  <table className="min-w-full text-xs">
                    <thead className="bg-[var(--accent)]/10 text-[var(--muted)]">
                      <tr>
                        {isInventoryMode && qtyMode === "selective" && <th className="px-2 py-2 text-left">Qty</th>}
                        <th className="px-2 py-2 text-left">Désignation</th>
                        <th className="px-2 py-2 text-left">Quantité</th>
                        <th className="px-2 py-2 text-left">Prix vente</th>
                        <th className="px-2 py-2 text-left">TVA</th>
                        <th className="px-2 py-2 text-left">Code-barres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.rows || []).slice(0, 20).map((row) => {
                        const rowId = String(row.row_id);
                        const overrides = rowOverrides[rowId] || {};
                        const display = { ...row, ...overrides };
                        const hasWarnings = Array.isArray(row.warnings) && row.warnings.length;
                        return (
                          <tr key={rowId} className="border-t border-[var(--border)]">
                            {isInventoryMode && qtyMode === "selective" && (
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={keepQtyRowIds.includes(rowId)}
                                  onChange={() => toggleQtyRow(rowId)}
                                />
                              </td>
                            )}
                            <td className="px-2 py-2 min-w-[180px]">
                              <input
                                className="w-full bg-transparent text-[var(--text)] outline-none"
                                value={display.name || ""}
                                onChange={(e) => updateOverride(rowId, "name", e.target.value)}
                              />
                              {hasWarnings ? (
                                <div className="text-[10px] text-amber-500 mt-1">
                                  ⚠ {row.warnings.join(", ")}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-20 bg-transparent text-[var(--text)] outline-none"
                                value={display.quantity || ""}
                                onChange={(e) => updateOverride(rowId, "quantity", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-24 bg-transparent text-[var(--text)] outline-none"
                                value={display.selling_price || ""}
                                onChange={(e) => updateOverride(rowId, "selling_price", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-16 bg-transparent text-[var(--text)] outline-none"
                                value={display.tva || ""}
                                onChange={(e) => updateOverride(rowId, "tva", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-28 bg-transparent text-[var(--text)] outline-none"
                                value={display.barcode || ""}
                                onChange={(e) => updateOverride(rowId, "barcode", e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Prévisualisation limitée à 20 lignes. L’import complet utilise l’ensemble du fichier.
                </div>
                {preview.stats?.invalid ? (
                  <Button variant="secondary" size="sm" onClick={downloadErrorReport}>
                    Télécharger le rapport d’erreurs
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {summary && (
            <Card className="p-4 border-[var(--border)] bg-[var(--surface)] shadow-soft">
              <div className="text-sm font-semibold text-[var(--text)]">Import terminé</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                Créés : {summary.created_count} · Mis à jour : {summary.updated_count} · Doublons possibles :{" "}
                {summary.duplicates_candidates_count}
              </div>
            </Card>
          )}

          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>
      </Drawer>
    </Card>
  );
}
