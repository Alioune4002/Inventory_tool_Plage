import React, { useState } from "react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { useDemo } from "../context/DemoProvider";

export default function DemoExports() {
  const { services, serviceId, selectService, pushToast } = useDemo();
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [cat, setCat] = useState("");
  const [mode, setMode] = useState("all");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const doExport = (format = "xlsx") => {
    // Démo => on ne télécharge rien, on simule juste
    const emailMsg = email ? ` + envoi à ${email}` : "";
    pushToast(`Export ${format.toUpperCase()} simulé${emailMsg}`, email ? "success" : "info");
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-3">
        <div className="text-sm text-slate-500">Exports</div>
        <div className="text-2xl font-black tracking-tight">Exports CSV / Excel</div>
        <div className="text-sm text-slate-600">Filtres + partage email (démo).</div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Période (début)" type="month" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <Input label="Période (fin)" type="month" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Service</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
              value={serviceId}
              onChange={(e) => selectService(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">Démo : service sélectionnable.</span>
          </label>

          <Input label="Catégorie (optionnel)" placeholder="Ex. Boissons" value={cat} onChange={(e) => setCat(e.target.value)} />

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
            <span className="text-xs text-slate-500">Filtrer entamé / non entamé si besoin.</span>
          </label>

          <Input
            label="Partage email (optionnel)"
            type="email"
            placeholder="destinataire@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helper="Démo : on simule l’envoi email."
          />

          <Input
            label="Message (optionnel)"
            placeholder="Contexte de l’inventaire…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => doExport("xlsx")}>Export Excel</Button>
          <Button variant="secondary" onClick={() => doExport("csv")}>
            Export CSV
          </Button>
        </div>

        <div className="text-xs text-slate-500">
          Astuce : dans le vrai produit, l’export télécharge le fichier + l’envoie par email si renseigné.
        </div>
      </Card>
    </div>
  );
}