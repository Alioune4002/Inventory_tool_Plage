// frontend/src/pages/public/CommentCaMarche.jsx
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
    desc: "Vous activez des options seulement si vous en avez besoin (prix & TVA, lots, dates, variantes…). Sinon, StockScan reste minimal.",
  },
  {
    title: "3) Créez votre base produits",
    desc: "Vous ajoutez vos produits une seule fois : nom, catégorie, unité… (et code-barres si vous en avez).",
  },
  {
    title: "4) Faites votre inventaire",
    desc: "Chaque mois (ou quand vous voulez), vous comptez les quantités. Optionnel : pertes, commentaires et détails spécifiques à votre activité.",
  },
  {
    title: "5) Exportez et partagez",
    desc: "Export CSV ou Excel : lisible, propre, prêt pour votre comptable ou vos équipes.",
  },
];

export default function CommentCaMarche() {
  const siteUrl = "https://stockscan.app";
  const canonicalUrl = `${siteUrl}/comment-ca-marche`;
  const ogImage = `${siteUrl}/og-image.png`;

  const seoTitle = "Comment ça marche — StockScan (base produits + inventaires + exports)";
  const seoDescription =
    "Découvrez comment StockScan fonctionne : base produits, inventaire mensuel, options utiles et exports CSV/Excel. Une méthode simple et adaptée à votre commerce.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Comment ça marche — StockScan",
    description: seoDescription,
    step: STEPS.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.title,
      text: s.desc,
    })),
  };

  return (
    <PublicShell>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:site_name" content="StockScan" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={ogImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={ogImage} />

        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="w-full bg-transparent text-white">
        {/* Container large (1480) + padding latéral minimal */}
        <div className="mx-auto w-full max-w-[1480px] px-2 sm:px-3 lg:px-4 py-10">
          {/* ✅ Bloc central arrondi (celui qui “contient tout”) */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10 space-y-10">
            <header className="space-y-4">
              <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Comment ça marche</p>

              <h1 className="text-3xl md:text-4xl font-bold">Une méthode claire, pensée pour votre commerce</h1>

              <p className="text-slate-200 max-w-2xl">
                StockScan sépare volontairement deux choses :{" "}
                <span className="font-semibold text-white">votre base produits</span> (ce qui ne change pas souvent) et{" "}
                <span className="font-semibold text-white">votre inventaire</span> (le comptage à une date précise).
                Résultat : moins d’erreurs, plus de clarté.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button as={Link} to="/metiers" className="w-full sm:w-auto rounded-full">
                  Choisir mon métier
                </Button>
                <Button as={Link} to="/register" variant="secondary" className="w-full sm:w-auto rounded-full">
                  Créer mon espace
                </Button>
              </div>
            </header>

            <section className="grid md:grid-cols-2 gap-4">
              {STEPS.map((step) => (
                <Card key={step.title} className="p-6 border-white/10 bg-white/5 space-y-2 rounded-2xl" hover>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Méthode StockScan</div>
                  <div className="text-lg font-semibold text-white">{step.title}</div>
                  <p className="text-slate-200 text-sm">{step.desc}</p>
                </Card>
              ))}
            </section>

            <section className="grid md:grid-cols-2 gap-4">
              <Card className="p-6 border-white/10 bg-white/5 space-y-2 rounded-2xl" hover>
                <h2 className="text-xl font-semibold text-white">Produits = votre base</h2>
                <p className="text-slate-200 text-sm">
                  Une base stable et propre : nom, catégorie, unité, marque (si utile), fournisseur (si utile), prix (si
                  activé) et code-barres si vous en avez.
                </p>
                <p className="text-slate-200 text-sm">
                  Pas de comptage ici : c’est simplement la liste “propre” de ce que vous gérez.
                </p>
              </Card>

              <Card className="p-6 border-white/10 bg-white/5 space-y-2 rounded-2xl" hover>
                <h2 className="text-xl font-semibold text-white">Inventaire = le comptage</h2>
                <p className="text-slate-200 text-sm">
                  À une date donnée, vous comptez les quantités. Vous pouvez aussi déclarer des pertes (casse, DLC/DDM,
                  erreurs…) et ajouter un commentaire si besoin.
                </p>
                <p className="text-slate-200 text-sm">
                  Certaines activités peuvent activer des détails supplémentaires (lots, dates, variantes…), mais
                  seulement si vous en avez besoin.
                </p>
              </Card>
            </section>

            <section className="rounded-2xl bg-white/5 border border-white/10 p-6 md:p-8 space-y-3">
              <h2 className="text-2xl font-bold">Vous voulez voir si ça colle à votre activité ?</h2>
              <p className="text-slate-200 text-sm">
                Commencez par choisir votre métier. StockScan vous affiche une interface adaptée dès le départ.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button as={Link} to="/metiers" className="rounded-full">
                  Explorer les métiers
                </Button>
                <Button as={Link} to="/tarifs" variant="secondary" className="rounded-full">
                  Voir les offres
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}