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
  name: "Désignation",
  quantity: "Quantité",
  unit: "Unité",
  purchase_price: "Prix achat",
  selling_price: "Prix vente",
  tva: "TVA",
  barcode: "Code-barres",
  internal_sku: "SKU interne",
  category: "Catégorie",
};

const qtyOptions = [
  { value: "zero", label: "Produits seulement (quantité = 0)" },
  { value: "set", label: "Conserver les quantités du fichier" },
  { value: "selective", label: "Choisir les lignes avec quantités" },
];

function buildFieldOptions(columns) {
  return [
    { value: "", label: "Ignorer" },
    ...(columns || []).map((col) => ({ value: col, label: col })),
  ];
}

export default function InventoryImportWizard({ serviceId, serviceLabel, disabled, onImported, pushToast }) {
  const [open, setOpen] = useState(false);
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

  const columns = preview?.columns || [];
  const fieldOptions = useMemo(() => buildFieldOptions(columns), [columns]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setQtyMode("zero");
    setKeepQtyRowIds([]);
    setRowOverrides({});
    setSummary(null);
    setError("");
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
      const res = await api.post(`/api/imports/inventory/preview/?service=${serviceId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res?.data;
      setPreview(data);
      setMapping(data?.mapping || {});
      pushToast?.({ message: "Analyse terminée. Vérifiez le mapping.", type: "success" });
    } catch (e) {
      setError(e?.response?.data?.detail || "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!preview?.preview_id) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        preview_id: preview.preview_id,
        qty_mode: qtyMode,
        keep_qty_row_ids: keepQtyRowIds,
        month,
        row_overrides: rowOverrides,
      };
      const res = await api.post(`/api/imports/inventory/commit/?service=${serviceId}`, payload);
      setSummary(res?.data || null);
      onImported?.();
      pushToast?.({ message: "Import terminé.", type: "success" });
    } catch (e) {
      setError(e?.response?.data?.detail || "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">Importer un inventaire (CSV/XLSX)</div>
          <div className="text-xs text-[var(--muted)]">
            Importez un inventaire existant pour préparer la base produits et les quantités.
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Colonnes possibles : désignation, quantité, unité, prix achat/vente, TVA, code-barres, SKU.
          </div>
        </div>
        <Button size="sm" onClick={openDrawer} disabled={disabled}>
          Démarrer l’import
        </Button>
      </div>

      <Drawer
        open={open}
        onClose={closeDrawer}
        title="Import inventaire"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" type="button" onClick={closeDrawer}>
              Fermer
            </Button>
            {preview ? (
              <Button type="button" onClick={commitImport} loading={loading}>
                Importer
              </Button>
            ) : (
              <Button type="button" onClick={() => analyzeFile()} loading={loading}>
                Analyser le fichier
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-xs text-[var(--muted)]">
            Service sélectionné : <span className="font-semibold text-[var(--text)]">{serviceLabel}</span>
          </div>

          <Input
            label="Fichier CSV ou XLSX"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            helper="Taille max 10MB. CSV UTF-8 recommandé."
          />

          {preview && (
            <Input
              label="Mois d’inventaire"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              helper="Choisissez le mois cible pour la création des produits."
            />
          )}

          {preview && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Mapping des colonnes</div>
              <div className="grid md:grid-cols-2 gap-3">
                {FIELD_ORDER.map((field) => (
                  <Select
                    key={field}
                    label={FIELD_LABELS[field]}
                    value={mapping?.[field] || ""}
                    onChange={(value) => {
                      const next = { ...(mapping || {}), [field]: value };
                      setMapping(next);
                    }}
                    options={fieldOptions}
                    placeholder="Ignorer"
                  />
                ))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => analyzeFile(mapping)}
                loading={loading}
              >
                Mettre à jour l’aperçu
              </Button>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Gestion des quantités</div>
              <Select value={qtyMode} onChange={setQtyMode} options={qtyOptions} />
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Aperçu</div>
              <div className="text-xs text-[var(--muted)]">
                {preview.stats?.total} lignes · {preview.stats?.missing_required} lignes incomplètes
              </div>
              <div className="max-h-72 overflow-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--accent)]/10 text-[var(--muted)]">
                    <tr>
                      {qtyMode === "selective" && <th className="px-2 py-2 text-left">Qty</th>}
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
                      return (
                        <tr key={rowId} className="border-t border-[var(--border)]">
                          {qtyMode === "selective" && (
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
