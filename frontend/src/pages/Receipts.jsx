import React, { useEffect, useMemo, useRef, useState } from "react";
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
  if (code === "RECEIPT_DUPLICATE_INVOICE") {
    return "Cette facture a déjà été importée. Vérifiez l’historique des réceptions.";
  }
  if (code === "RECEIPT_EMPTY") {
    return "Aucune ligne exploitable n’a été trouvée dans ce fichier.";
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
  const [skippedLines, setSkippedLines] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [lineOptions, setLineOptions] = useState({});
  const [loadingLine, setLoadingLine] = useState({});
  const [applyLoading, setApplyLoading] = useState(false);
  const [receiptMeta, setReceiptMeta] = useState(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyService, setHistoryService] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyResults, setHistoryResults] = useState([]);

  const canUse = Boolean(entitlements?.entitlements?.receipts_import);
  const limit = entitlements?.limits?.receipts_import_monthly_limit ?? null;

  const serviceOptions = useMemo(() => {
    const base = (services || []).map((s) => ({ value: s.id, label: s.name }));
    if (services?.length > 1) base.push({ value: "all", label: "Tous les services" });
    return base;
  }, [services]);

  const matchesRef = useRef(null);

  useEffect(() => {
    if (!historyService) {
      setHistoryService(serviceId || "");
    }
  }, [historyService, serviceId]);

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
      setReceiptId(null);
      setLines([]);
      setReceiptMeta(null);
      try {
      const res = await api.post(`/api/receipts/import/?service=${serviceId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReceiptId(res.data?.receipt_id || null);
      const newLines = res.data?.lines || [];
      setSkippedLines(res.data?.skipped_lines || 0);
      setLines(newLines);
      setReceiptMeta({
        invoice_number: res.data?.invoice_number || "",
        invoice_date: res.data?.invoice_date || "",
        received_at: res.data?.received_at || "",
        supplier: res.data?.supplier || "",
      });
      setDrawerOpen(false);
      const initial = {};
      newLines.forEach((line) => {
        initial[line.id] = {
          action: line.matched_product_id ? "match" : "create",
          product_id: line.matched_product_id || "",
        };
      });
      setDecisions(initial);
      if (newLines.length) {
        pushToast?.({ message: "Fichier importé. Vérifiez les correspondances ci-dessous.", type: "success" });
        window.setTimeout(() => matchesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      } else {
        pushToast?.({ message: "Aucune ligne exploitable détectée.", type: "warn" });
      }
    } catch (error) {
      pushToast?.({ message: getReceiptErrorMessage(error?.response?.data || error), type: "error" });
      setReceiptId(null);
      setLines([]);
      setReceiptMeta(null);
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
      setReceiptMeta(null);
    } catch {
      pushToast?.({ message: "Impossible d’appliquer la réception.", type: "error" });
    } finally {
      setApplyLoading(false);
    }
  };

  const loadHistory = async () => {
    const serviceValue = historyService || serviceId;
    if (!serviceValue) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("service", serviceValue);
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      if (historyDate) params.set("date", historyDate);
      const res = await api.get(`/api/receipts/history/?${params.toString()}`);
      setHistoryResults(res.data?.results || []);
    } catch {
      setHistoryResults([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (historyQuery.trim() || historyDate) {
        loadHistory();
      } else {
        setHistoryResults([]);
      }
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery, historyDate, historyService, serviceId]);

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
            Importez un CSV ou PDF structuré, puis associez chaque ligne aux bons produits.
          </p>
          <div className="text-xs text-[var(--muted)]">
            Objectif : fiabiliser vos entrées stock sans ressaisie. StockScan conserve uniquement les données utiles
            (date, facture, lignes) et évite les doublons.
          </div>
          <div className="text-xs text-[var(--muted)]">
            Étapes : 1) Importer 2) Vérifier les correspondances 3) Appliquer la réception.
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <div className="text-sm font-semibold text-[var(--text)]">À quoi ça sert ?</div>
          <p className="text-sm text-[var(--muted)]">
            Les réceptions mettent à jour vos quantités sans ressaisie manuelle et conservent un historique clair
            (facture, date, fournisseur). C’est la base pour un stock fiable.
          </p>
          <ul className="text-xs text-[var(--muted)] space-y-1">
            <li>• Format attendu : désignation, quantité reçue, prix d’achat (si présent), TVA.</li>
            <li>• StockScan bloque les doublons de facture pour éviter les quantités faussées.</li>
            <li>• Après import, vous validez les correspondances produit avant d’appliquer.</li>
          </ul>
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
              <Card className="p-6 space-y-4" ref={matchesRef}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[var(--muted)]">
                    Correspondances à valider ({lines.length} ligne{lines.length > 1 ? "s" : ""})
                    {skippedLines ? ` · ${skippedLines} ignorée(s)` : ""}
                  </div>
                  <Button onClick={applyReceipt} loading={applyLoading} disabled={applyLoading}>
                    Appliquer la réception
                  </Button>
                </div>
                {receiptMeta && (
                  <div className="text-xs text-[var(--muted)]">
                    {receiptMeta.supplier ? `Fournisseur : ${receiptMeta.supplier} · ` : ""}
                    {receiptMeta.invoice_number ? `Facture : ${receiptMeta.invoice_number} · ` : ""}
                    {receiptMeta.invoice_date ? `Date facture : ${receiptMeta.invoice_date} · ` : ""}
                    {receiptMeta.received_at ? `Réception : ${receiptMeta.received_at}` : ""}
                  </div>
                )}

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

            {receiptId && lines.length === 0 && (
              <Card className="p-6 text-sm text-[var(--muted)]">
                Aucune ligne exploitable n’a été trouvée dans ce fichier. Vérifie le format (CSV/PDF structuré) et
                réessaie l’import.
              </Card>
            )}

            <Card className="p-6 space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Historique des réceptions</div>
              <div className="grid md:grid-cols-4 gap-3">
                {services?.length > 1 && (
                  <Select
                    label="Service"
                    value={historyService || serviceId || ""}
                    onChange={(value) => setHistoryService(value)}
                    options={serviceOptions}
                  />
                )}
                <Input
                  label="Numéro de facture / fournisseur"
                  placeholder="Ex. FACT-2025-0042"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                />
                <Input
                  label="Date"
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                />
                <div className="flex items-end">
                  <Button variant="secondary" onClick={loadHistory} loading={historyLoading}>
                    Rechercher
                  </Button>
                </div>
              </div>
              {historyLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : historyResults.length ? (
                <div className="space-y-2">
                  {historyResults.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <div className="font-semibold text-[var(--text)]">
                        {item.invoice_number || "Facture sans numéro"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {(item.service_name ? `${item.service_name} · ` : "") +
                          (item.supplier || "Fournisseur inconnu")}{" "}
                        · {item.invoice_date || "Date inconnue"} · {item.received_at || "—"} ·{" "}
                        {item.lines_count || 0} ligne(s)
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  Recherchez un numéro de facture ou une date pour retrouver une réception.
                </div>
              )}
            </Card>

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
