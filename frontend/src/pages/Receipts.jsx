import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Drawer from "../ui/Drawer";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Skeleton from "../ui/Skeleton";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { useEntitlements } from "../app/useEntitlements";

function getReceiptErrorMessage(error) {
  const code = error?.code || error?.data?.code;
  if (code === "LIMIT_RECEIPTS_IMPORT_MONTH") {
    return "Limite mensuelle d’import fournisseur atteinte. Passez au plan supérieur.";
  }
  if (code === "FEATURE_NOT_INCLUDED") {
    return "Import fournisseur non inclus dans votre plan.";
  }
  return error?.detail || error?.message || "Impossible d’importer ce fichier.";
}

export default function Receipts() {
  const { serviceId, services, selectService } = useAuth();
  const { data: entitlements } = useEntitlements();
  const pushToast = useToast();

  const [supplierName, setSupplierName] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([]);
  const [receiptId, setReceiptId] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [lineOptions, setLineOptions] = useState({});
  const [loadingLine, setLoadingLine] = useState({});
  const [applyLoading, setApplyLoading] = useState(false);

  const canUse = Boolean(entitlements?.entitlements?.receipts_import);
  const limit = entitlements?.limits?.receipts_import_monthly_limit ?? null;

  const serviceOptions = useMemo(
    () => (services || []).map((s) => ({ value: s.id, label: s.name })),
    [services]
  );

  const onImport = async (e) => {
    e.preventDefault();
    if (!file) {
      pushToast?.({ message: "Sélectionnez un fichier CSV ou PDF.", type: "warn" });
      return;
    }
    if (!serviceId) {
      pushToast?.({ message: "Sélectionnez un service.", type: "warn" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplier_name", supplierName);
    formData.append("received_at", receivedAt);

    setLoading(true);
    try {
      const res = await api.post(`/api/receipts/import/?service=${serviceId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReceiptId(res.data?.receipt_id || null);
      const newLines = res.data?.lines || [];
      setLines(newLines);
      setDrawerOpen(false);
      const initial = {};
      newLines.forEach((line) => {
        initial[line.id] = {
          action: line.matched_product_id ? "match" : "create",
          product_id: line.matched_product_id || "",
        };
      });
      setDecisions(initial);
      pushToast?.({ message: "Fichier importé. Validez le mapping.", type: "success" });
    } catch (error) {
      pushToast?.({ message: getReceiptErrorMessage(error?.response?.data || error), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadLineOptions = async (line) => {
    if (!serviceId) return;
    setLoadingLine((prev) => ({ ...prev, [line.id]: true }));
    try {
      const res = await api.get(`/api/products/search/?service=${serviceId}&q=${encodeURIComponent(line.name)}`);
      const options = (res.data || []).map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.barcode || p.internal_sku || "—"}`,
      }));
      setLineOptions((prev) => ({ ...prev, [line.id]: options }));
    } catch {
      setLineOptions((prev) => ({ ...prev, [line.id]: [] }));
    } finally {
      setLoadingLine((prev) => ({ ...prev, [line.id]: false }));
    }
  };

  const updateDecision = (lineId, patch) => {
    setDecisions((prev) => ({
      ...prev,
      [lineId]: { ...(prev[lineId] || {}), ...patch },
    }));
  };

  const applyReceipt = async () => {
    if (!receiptId) return;
    setApplyLoading(true);
    try {
      const payload = {
        decisions: Object.entries(decisions).map(([lineId, value]) => ({
          line_id: Number(lineId),
          action: value.action,
          product_id: value.product_id || null,
        })),
      };
      const res = await api.post(`/api/receipts/${receiptId}/apply/`, payload);
      pushToast?.({ message: res?.data?.detail || "Réception appliquée.", type: "success" });
      setLines([]);
      setReceiptId(null);
    } catch {
      pushToast?.({ message: "Impossible d’appliquer la réception.", type: "error" });
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Réceptions | StockScan</title>
        <meta name="description" content="Import fournisseurs et réceptions." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-[var(--muted)]">Réceptions</div>
          <h1 className="text-2xl font-black text-[var(--text)]">Import fournisseur</h1>
          <p className="text-sm text-[var(--muted)]">
            Importez un CSV ou PDF structuré, puis mappez chaque ligne.
          </p>
        </Card>

        {!canUse ? (
          <Card className="p-6">
            <div className="text-sm text-[var(--muted)]">
              Import fournisseur non inclus dans votre plan.
            </div>
            <Button className="mt-3" onClick={() => (window.location.href = "/tarifs")}>
              Voir les plans
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--muted)]">
                  {limit === null ? "Limite mensuelle : illimitée" : `Limite mensuelle : ${limit} import(s)`}
                </div>
              </div>
              <Button onClick={() => setDrawerOpen(true)}>Importer une réception</Button>
            </Card>

            {loading && (
              <Card className="p-6">
                <Skeleton className="h-20 w-full" />
              </Card>
            )}

            {lines.length > 0 && (
              <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[var(--muted)]">Mapping ({lines.length} lignes)</div>
                  <Button onClick={applyReceipt} loading={applyLoading} disabled={applyLoading}>
                    Appliquer la réception
                  </Button>
                </div>

                <div className="space-y-3">
                  {lines.map((line) => {
                    const decision = decisions[line.id] || {};
                    const options = lineOptions[line.id] || [];
                    return (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">{line.name}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {line.quantity} {line.unit} · {line.barcode || line.internal_sku || "—"}
                            </div>
                          </div>
                          <Select
                            ariaLabel="Action"
                            value={decision.action || "create"}
                            onChange={(value) => updateDecision(line.id, { action: value })}
                            options={[
                              { value: "match", label: "Associer" },
                              { value: "create", label: "Créer produit" },
                              { value: "ignore", label: "Ignorer" },
                            ]}
                          />
                        </div>

                        {decision.action === "match" && (
                          <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
                            <Select
                              label="Produit existant"
                              value={decision.product_id || ""}
                              onChange={(value) => updateDecision(line.id, { product_id: value })}
                              options={options}
                              placeholder="Choisir un produit"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => loadLineOptions(line)}
                              loading={loadingLine[line.id]}
                            >
                              Rechercher
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              title="Nouvelle réception fournisseur"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" form="receipt-import-form" loading={loading} disabled={loading}>
                    Importer
                  </Button>
                </div>
              }
            >
              <form id="receipt-import-form" className="space-y-4" onSubmit={onImport}>
                {services?.length > 0 && (
                  <Select
                    label="Service"
                    value={serviceId || ""}
                    onChange={(value) => selectService(value)}
                    options={serviceOptions}
                  />
                )}
                <Input
                  label="Fournisseur"
                  placeholder="Ex. Metro"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
                <Input
                  label="Date de réception"
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">Fichier</label>
                  <input
                    type="file"
                    accept=".csv,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="mt-2 block w-full text-sm text-[var(--muted)] file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-white"
                  />
                  <div className="text-xs text-[var(--muted)] mt-2">
                    CSV structuré ou PDF fournisseur sans OCR.
                  </div>
                </div>
              </form>
            </Drawer>
          </>
        )}
      </div>
    </PageTransition>
  );
}
