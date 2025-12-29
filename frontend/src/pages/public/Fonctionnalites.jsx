// frontend/src/pages/public/Fonctionnalites.jsx
import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { MODULES } from "../../lib/famillesConfig";

const PROBLEM_SOLUTION = [
  {
    problem: "Les inventaires sont longs, confus… et on s’y perd.",
    solution:
      "StockScan sépare clairement la base produits (ce qui change peu) et l’inventaire (le comptage à une date).",
    benefit: "Résultat : plus de clarté, moins d’erreurs et un comptage plus rapide.",
  },
  {
    problem: "Chaque établissement a ses habitudes (rayons, zones, services…).",
    solution:
      "Vous organisez votre établissement comme vous le vivez sur le terrain : un ou plusieurs espaces de travail (rayons / zones / services).",
    benefit: "Résultat : une vue globale fiable, et des détails quand il faut.",
  },
  {
    problem: "On veut du simple, pas une usine à gaz.",
    solution:
      "Vous activez seulement les options utiles : prix/TVA, dates (DLC/DDM), lots, variantes, produits entamés…",
    benefit: "Résultat : une interface légère au départ, mais vraiment évolutive.",
  },
  {
    problem: "Il faut un fichier propre pour l’équipe, un associé ou le comptable.",
    solution: "Exports CSV/Excel/PDF : lisibles, exploitables et faciles à partager.",
    benefit: "Résultat : vous gagnez du temps et évitez les retouches à la main.",
  },
];

const CORE_FEATURES = [
  {
    title: "Base produits solide (catalogue)",
    desc:
      "Créez et gardez une base propre : catégories, unités, code-barres ou référence interne. Idéal pour éviter les doublons et les erreurs de saisie.",
    bullets: [
      "Catégories et unités adaptées à votre activité",
      "Recherche rapide + tri, pour aller droit au bon produit",
      "Prévu pour évoluer : options activables au besoin",
    ],
  },
  {
    title: "Inventaires (progressif + chrono)",
    desc:
      "Deux façons de compter : en mode progressif (confort) ou en mode chrono (rapide). StockScan structure, calcule et historise.",
    bullets: [
      "Historique clair par mois/période",
      "Moins d’allers-retours : tout est guidé",
      "Chiffres exploitables dès les premiers inventaires",
    ],
  },
  {
    title: "Tableau de bord (vue globale)",
    desc:
      "Une vraie vue d’ensemble : valeur du stock, pertes, catégories, et synthèse par unité quand vous avez plusieurs espaces (rayons/zones/services).",
    bullets: [
      "Vue consolidée multi-unités",
      "Répartition par catégorie",
      "Pertes par raison, avec libellés propres en français",
    ],
  },
  {
    title: "Pertes & traçabilité",
    desc:
      "Déclarez la casse, la péremption, les erreurs… et comprenez ce qui pèse vraiment. Parfait pour ajuster commandes et routines.",
    bullets: [
      "Pertes par raison + total période",
      "Lecture rapide sans jargon",
      "Meilleure visibilité sur la rentabilité",
    ],
  },
  {
    title: "Doublons & nettoyage du catalogue",
    desc:
      "Fusionnez et nettoyez (sans douleur) les doublons qui apparaissent après plusieurs imports ou saisies. Un catalogue clean = inventaires plus rapides.",
    bullets: [
      "Détection des doublons",
      "Fusion guidée",
      "Moins d’erreurs sur le long terme",
    ],
  },
  {
    title: "Réceptions & étiquettes",
    desc:
      "Réception fournisseur pour mettre à jour plus vite, et génération d’étiquettes pour organiser vos rayons/stock (si module actif).",
    bullets: [
      "Réception simple et structurée",
      "Étiquettes prêtes à imprimer (selon options)",
      "Moins d’oublis, plus de cohérence",
    ],
  },
];

export default function Fonctionnalites() {
  const siteUrl = "https://stockscan.app";
  const canonicalUrl = `${siteUrl}/fonctionnalites`;
  const ogImage = `${siteUrl}/og-image.png`;

  const seoTitle =
    "Fonctionnalités StockScan — Catalogue produit, inventaires rapides, tableau de bord, exports et options activables";
  const seoDescription =
    "Découvrez StockScan : base produits propre, inventaires (progressif/chrono), tableau de bord (vue globale), pertes, doublons, réceptions, étiquettes et exports CSV/Excel/PDF. Une interface adaptée à votre métier, simple au départ, puissante si besoin.";

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Quelle est la différence entre base produits et inventaire ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "La base produits sert de catalogue (ce qui change peu). L’inventaire correspond au comptage à une date (par exemple le mois en cours). Cette séparation rend l’outil plus clair et réduit les erreurs.",
          },
        },
        {
          "@type": "Question",
          name: "StockScan convient-il aux établissements avec plusieurs espaces (rayons/zones/services) ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Oui. Vous pouvez organiser votre établissement avec une ou plusieurs unités (rayons, zones ou services). Le tableau de bord peut afficher une vue consolidée quand “Tous” est sélectionné.",
          },
        },
        {
          "@type": "Question",
          name: "Dois-je activer toutes les options dès le départ ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Non. StockScan est simple par défaut. Vous activez seulement les options utiles (prix/TVA, lots, dates, variantes, produits entamés…) quand vous en avez besoin.",
          },
        },
      ],
    }),
    []
  );

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
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={ogImage} />

        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <main className="w-full bg-transparent text-white">
        <div className="mx-auto w-full max-w-[1480px] px-2 sm:px-3 lg:px-4 py-10">
          {/* ✅ Bloc central arrondi (style landing) */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10 space-y-10">
            <header className="space-y-4">
              <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Fonctionnalités</p>

              <h1 className="text-3xl md:text-4xl font-black leading-tight">
                Tout ce qu’il faut pour un inventaire propre — sans complexité inutile
              </h1>

              <p className="text-slate-200 max-w-3xl">
                StockScan a une idée simple :{" "}
                <span className="font-semibold text-white">un catalogue propre</span> +{" "}
                <span className="font-semibold text-white">des inventaires clairs</span>. Et si votre établissement
                grandit, l’outil suit le rythme (options activables, multi-unités, exports, etc.).
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button as={Link} to="/metiers" className="w-full sm:w-auto rounded-full">
                  Choisir mon métier
                </Button>
                <Button as={Link} to="/register" variant="secondary" className="w-full sm:w-auto rounded-full">
                  Commencer gratuitement
                </Button>
              </div>
            </header>

            {/* Problème / solution */}
            <section className="grid md:grid-cols-2 gap-4">
              {PROBLEM_SOLUTION.map((b) => (
                <Card key={b.problem} className="p-6 border-white/10 bg-white/5 space-y-3 rounded-2xl" hover>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Problème</div>
                  <div className="text-lg font-semibold text-white">{b.problem}</div>

                  <div className="pt-1" />

                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Solution</div>
                  <div className="text-sm text-slate-200">{b.solution}</div>

                  <div className="pt-1" />

                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Bénéfice</div>
                  <div className="text-sm text-slate-200">{b.benefit}</div>
                </Card>
              ))}
            </section>

            {/* Fonctionnalités principales */}
            <section className="space-y-4">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black">Les essentiels (ce que vous utilisez au quotidien)</h2>
                  <p className="text-slate-200 text-sm max-w-3xl mt-1">
                    Pas une liste interminable : juste les fonctions qui font la différence sur le terrain.
                  </p>
                </div>
                <Link to="/comment-ca-marche" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
                  Voir comment ça marche →
                </Link>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CORE_FEATURES.map((f) => (
                  <Card key={f.title} className="p-5 border-white/10 bg-white/5 space-y-3 rounded-2xl" hover>
                    <div className="text-lg font-semibold text-white">{f.title}</div>
                    <p className="text-sm text-slate-200">{f.desc}</p>
                    <ul className="text-sm text-slate-200 list-disc pl-5 space-y-1">
                      {f.bullets.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>

            {/* Options */}
            <section className="space-y-4">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black">Options activables</h2>
                  <p className="text-slate-200 text-sm max-w-3xl mt-1">
                    Vous gardez l’interface simple. Et si vous voulez aller plus loin, vous activez une option. Rien
                    d’imposé.
                  </p>
                </div>

                <Link to="/tarifs" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
                  Voir les offres →
                </Link>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((mod) => (
                  <Card key={mod.id} className="p-5 border-white/10 bg-white/5 space-y-2 rounded-2xl" hover>
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Option</div>
                    <div className="text-lg font-semibold text-white">{mod.name}</div>
                    <p className="text-sm text-slate-200">{mod.description}</p>
                    <p className="text-xs text-slate-300">
                      Astuce : activez-la uniquement si elle vous sert vraiment — StockScan reste léger sinon.
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="rounded-2xl bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
              <h3 className="text-2xl font-black">Vous voulez voir si StockScan colle à votre établissement ?</h3>
              <p className="text-blue-100 text-sm">
                Choisissez votre métier, puis testez la logique “catalogue + inventaire” en quelques minutes.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button as={Link} to="/metiers" className="bg-white text-slate-900 rounded-full">
                  Explorer les métiers
                </Button>
                <Button
                  as={Link}
                  to="/register"
                  variant="secondary"
                  className="bg-white/10 text-white border-white/30 rounded-full"
                >
                  Commencer gratuitement
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}