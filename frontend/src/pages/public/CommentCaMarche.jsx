import React from "react";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";

const STEPS = [
  {
    title: "1. Choisir votre famille métier",
    desc: "Retail, mode, bar, restauration, boulangerie ou pharmacie : StockScan adapte les champs et le vocabulaire.",
  },
  {
    title: "2. Activer vos modules",
    desc: "Pricing & TVA, DLC/DDM, lots, variantes, entamés… vous n’affichez que ce qui compte.",
  },
  {
    title: "3. Construire le catalogue",
    desc: "Ajoutez vos produits une seule fois (référentiel). Pas de stock ici.",
  },
  {
    title: "4. Lancer l’inventaire",
    desc: "Comptage mensuel/hebdo avec pertes. Simple, rapide, exportable.",
  },
  {
    title: "5. Exporter & partager",
    desc: "Export CSV/XLSX avec filtres, graphiques et synthèse (si activés).",
  },
];

export default function CommentCaMarche() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 text-white space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Comment ça marche</p>
          <h1 className="text-3xl md:text-4xl font-bold">Une méthode claire, pensée pour votre commerce</h1>
          <p className="text-slate-200 max-w-2xl">
            StockScan sépare strictement le catalogue (référentiel) et l’inventaire (comptage) pour éviter les erreurs
            et garder une lecture propre.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          {STEPS.map((step) => (
            <Card key={step.title} className="p-6 border-white/10 bg-white/5 space-y-2">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-400">{step.title}</div>
              <p className="text-slate-200 text-sm">{step.desc}</p>
            </Card>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-2">
            <h2 className="text-xl font-semibold">Produits = Catalogue</h2>
            <p className="text-slate-200 text-sm">
              Un référentiel stable : identifiant (code‑barres/SKU), catégorie métier, unité, marque, fournisseur, prix.
            </p>
          </Card>
          <Card className="p-6 border-white/10 bg-white/5 space-y-2">
            <h2 className="text-xl font-semibold">Inventaire = Comptage</h2>
            <p className="text-slate-200 text-sm">
              Un comptage à date : quantité, pertes, commentaires. Les modules ajoutent lot, DLC/DDM, entamé, variantes.
            </p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
