import React from "react";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import { MODULES } from "../../lib/famillesConfig";

const FEATURE_BLOCKS = [
  {
    title: "Catalogue ultra‑propre",
    desc: "Un référentiel unique : identifiants, catégories métier, unités, marques et fournisseurs.",
  },
  {
    title: "Inventaire à date",
    desc: "Comptage mensuel/hebdo + pertes. Export direct en Excel ou CSV.",
  },
  {
    title: "Modules activables",
    desc: "Chaque équipe choisit ce qu’elle veut afficher : TVA, DLC, lot, variantes, entamés…",
  },
  {
    title: "Coach IA",
    desc: "Conseils sur la qualité des données, alertes et actions suggérées (selon plan).",
  },
];

export default function Fonctionnalites() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 text-white space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Fonctionnalités</p>
          <h1 className="text-3xl md:text-4xl font-bold">Tout ce qu’il faut, sans le superflu</h1>
          <p className="text-slate-200 max-w-2xl">
            StockScan s’adapte au métier : chaque module active des champs, des exports et des analyses utiles.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          {FEATURE_BLOCKS.map((block) => (
            <Card key={block.title} className="p-6 border-white/10 bg-white/5 space-y-2">
              <h2 className="text-xl font-semibold">{block.title}</h2>
              <p className="text-slate-200 text-sm">{block.desc}</p>
            </Card>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Modules disponibles</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => (
              <Card key={mod.id} className="p-5 border-white/10 bg-white/5 space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{mod.name}</div>
                <p className="text-sm text-slate-200">{mod.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
