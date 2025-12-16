import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { api } from "../lib/api";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";

export default function Exports() {
  const { serviceId, services } = useAuth();
  const pushToast = useToast();
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("all");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");

  const doExport = async (format = "xlsx") => {
    if (!serviceId) {
      setToast("Choisissez un service d’abord.");
      return;
    }
    setLoading(true);
    setToast("");
    try {
      const params = new URLSearchParams();
      if (periodFrom) params.append("from", periodFrom);
      if (periodTo) params.append("to", periodTo);
      params.append("service", serviceId);
      params.append("format", format);
      params.append("mode", mode);
      if (cat) params.append("category", cat);
      if (email) params.append("email", email);
      if (message) params.append("message", message);
      const res = await api.get(`/api/exports/?${params.toString()}`, { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      const emailMsg = email ? " & envoi email demandé" : "";
      setToast(`Export lancé${emailMsg}.`);
      pushToast?.({ message: `Export lancé${emailMsg}`, type: "success" });
    } catch (e) {
      setToast("Échec de l’export (auth ou filtres).");
      pushToast?.({ message: "Échec de l’export", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Exports | StockScan</title>
        <meta name="description" content="Exports avancés CSV/XLSX avec filtres." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm text-slate-500">Exports</div>
          <div className="text-2xl font-black tracking-tight">Exports CSV / Excel</div>
          <div className="text-sm text-slate-600">Choisissez les filtres, puis lancez un export.</div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Période (début)" type="month" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            <Input label="Période (fin)" type="month" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            {services?.length > 0 && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Service</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  value={serviceId || ""}
                  onChange={(e) => setToast("Change le service dans la topbar.")}
                  disabled
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">Service sélectionné dans la topbar.</span>
              </label>
            )}
            <Input
              label="Catégorie (optionnel)"
              placeholder="Ex. Boissons"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            />
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Mode</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="all">Tout</option>
                <option value="SEALED">Non entamé</option>
                <option value="OPENED">Entamé</option>
              </select>
              <span className="text-xs text-slate-500">Sélectionne entamé/non entamé si besoin.</span>
            </label>
            <Input
              label="Partage email (optionnel)"
              type="email"
              placeholder="destinataire@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              helper="Le fichier est téléchargé et envoyé par email si renseigné."
            />
            <Input
              label="Message (optionnel)"
              placeholder="Contexte de l’inventaire…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => doExport("xlsx")} loading={loading}>Export Excel</Button>
            <Button variant="secondary" onClick={() => doExport("csv")} loading={loading}>Export CSV</Button>
          </div>

          {toast && (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
              {toast}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
