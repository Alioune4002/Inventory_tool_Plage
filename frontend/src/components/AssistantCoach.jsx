import React, { useState } from "react";
import { BadgeCheck, MessageCircle } from "lucide-react";

export default function AssistantCoach({ familyName, modules, identifierLabel = "code-barres ou SKU" }) {
  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const proRequired = !modules.includes("pricing") || !modules.includes("identifier");

  const cannedSuggestions = [
    "Active le module Pricing & TVA pour voir les marges approximatives.",
    `Ajoute un identifiant (${identifierLabel}) pour éviter les doublons.`,
    "Besoin d’un suivi de lots ? Active le module Lot / Batch dans Paramètres.",
  ];

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 w-72 rounded-3xl border border-white/20 bg-slate-950/90 text-white shadow-[0_30px_60px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm font-semibold">Assistant IA</p>
            <p className="text-xs text-slate-400">{familyName}</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-white">
          Fermer
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm text-slate-300">Pose-moi une question ou choisis une suggestion.</div>
        <div className="space-y-2">
          {cannedSuggestions.map((tip) => (
            <button
              key={tip}
              type="button"
              className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-100 hover:border-blue-400"
              onClick={() => setPrompt(tip)}
            >
              <MessageCircle className="inline-block w-4 h-4 mr-2 text-blue-300" />
              {tip}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Votre question</label>
          <textarea
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Que veux-tu savoir ? (ex : modules, marges, exports)"
          />
        </div>
        <div>
          {proRequired ? (
            <div className="rounded-2xl bg-[var(--warn-bg)] border border-[var(--warn-border)] px-3 py-2 text-xs text-[var(--warn-text)]">
              L’assistant IA complet est disponible en plan Multi. En plan Duo, vous avez un mode “analyses light”.
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 px-3 py-2 text-xs text-emerald-200">
              Prêt à t’aider ! Envoie-moi un message, je t’explique comment aller plus vite.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
