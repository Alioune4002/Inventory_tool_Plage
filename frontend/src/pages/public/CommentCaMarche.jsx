import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";

const STEPS = [
  {
    title: "1) Choisissez votre métier",
    desc: "Restaurant, bar, boulangerie, épicerie, boutique, pharmacie… StockScan s’adapte à votre activité (vocabulaire et informations utiles).",
  },
  {
    title: "2) Gardez une interface simple",
    desc: "Vous pouvez activer des options quand vous en avez besoin (prix & TVA, lots, dates, variantes…). Sinon, StockScan reste minimal.",
  },
  {
    title: "3) Créez votre base produits",
    desc: "Vous ajoutez vos produits une seule fois : nom, catégorie, unité… (et code-barres si vous en avez).",
  },
  {
    title: "4) Faites votre inventaire",
    desc: "Chaque mois (ou quand vous voulez), vous comptez les quantités. Optionnel : pertes, commentaires, détails spécifiques à votre activité.",
  },
  {
    title: "5) Exportez et partagez",
    desc: "Export CSV ou Excel : lisible, propre, prêt pour votre comptable ou vos équipes.",
  },
];

export default function CommentCaMarche() {
  return (
    <PublicShell>
      <Helmet>
        <title>Comment ça marche | StockScan</title>
        <meta
          name="description"
          content="Découvrez comment StockScan fonctionne : base produits, inventaire mensuel, options utiles et exports CSV/Excel. Une méthode simple et adaptée à votre commerce."
        />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 text-white space-y-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
            Comment ça marche
          </p>

          <h1 className="text-3xl md:text-4xl font-black">
            Une méthode claire, pensée pour votre commerce
          </h1>

          <p className="text-slate-200 max-w-2xl">
            StockScan sépare volontairement deux choses :{" "}
            <span className="font-semibold text-white">votre base produits</span> (ce qui ne change pas souvent) et{" "}
            <span className="font-semibold text-white">votre inventaire</span> (le comptage à une date précise).
            Résultat : moins d’erreurs, plus de clarté.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button as={Link} to="/metiers" className="w-full sm:w-auto">
              Choisir mon métier
            </Button>
            <Button as={Link} to="/register" variant="secondary" className="w-full sm:w-auto">
              Créer mon espace
            </Button>
          </div>
        </header>

        {/* Steps */}
        <section className="grid md:grid-cols-2 gap-4">
          {STEPS.map((step) => (
            <Card key={step.title} className="p-6 border-white/10 bg-white/5 space-y-2" hover>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Méthode StockScan
              </div>
              <div className="text-lg font-semibold text-white">{step.title}</div>
              <p className="text-slate-200 text-sm">{step.desc}</p>
            </Card>
          ))}
        </section>

        {/* Simple explanation */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-2" hover>
            <h2 className="text-xl font-semibold text-white">Produits = votre base</h2>
            <p className="text-slate-200 text-sm">
              Une base stable et propre : nom, catégorie, unité, marque (si utile), fournisseur (si utile), prix (si activé),
              et code-barres si vous en avez.
            </p>
            <p className="text-slate-200 text-sm">
              Pas de comptage ici : c’est juste la liste “propre” de ce que vous gérez.
            </p>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-2" hover>
            <h2 className="text-xl font-semibold text-white">Inventaire = le comptage</h2>
            <p className="text-slate-200 text-sm">
              À une date donnée, vous comptez les quantités. Vous pouvez aussi noter des pertes (casse, DLC, erreurs…)
              et ajouter un commentaire si besoin.
            </p>
            <p className="text-slate-200 text-sm">
              Certaines activités peuvent activer des détails supplémentaires (lots, dates, variantes…), mais seulement si
              vous en avez besoin.
            </p>
          </Card>
        </section>

        {/* Closing CTA */}
        <section className="rounded-3xl bg-white/5 border border-white/10 p-6 md:p-8 space-y-3">
          <h2 className="text-2xl font-black">Vous voulez voir si ça colle à votre activité ?</h2>
          <p className="text-slate-200 text-sm">
            Commencez par choisir votre métier. StockScan vous montre une interface adaptée dès le départ.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button as={Link} to="/metiers">
              Explorer les métiers
            </Button>
            <Button as={Link} to="/tarifs" variant="secondary">
              Voir les offres
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}