// frontend/src/pages/public/Fonctionnalites.jsx
import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { MODULES } from "../../lib/famillesConfig";

const PROBLEM_SOLUTION = [
  {
    problem: "Les inventaires sont longs, confus… et on s’y perd.",
    solution: "StockScan sépare clairement la base produits (ce qui change peu) et l’inventaire (le comptage à une date).",
    benefit: "Résultat : plus de clarté, moins d’erreurs et un comptage plus rapide.",
  },
  {
    problem: "Chaque commerce a ses spécificités (bar, cuisine, boutique…).",
    solution: "Vous choisissez votre métier : l’outil s’adapte au vocabulaire et aux informations utiles à votre activité.",
    benefit: "Résultat : vous ne voyez pas d’infos inutiles.",
  },
  {
    problem: "On veut du simple, sans une usine à gaz.",
    solution: "Vous activez des options uniquement si vous en avez besoin (prix & TVA, lots, dates, variantes…).",
    benefit: "Résultat : une interface légère, mais évolutive.",
  },
  {
    problem: "Il faut envoyer un fichier propre à l’équipe ou au comptable.",
    solution: "Exports CSV ou Excel : lisibles, exploitables et faciles à partager.",
    benefit: "Résultat : vous gagnez du temps et évitez les retouches à la main.",
  },
];

export default function Fonctionnalites() {
  const siteUrl = "https://stockscan.app";
  const canonicalUrl = `${siteUrl}/fonctionnalites`;
  const ogImage = `${siteUrl}/og-image.png`;

  const seoTitle = "Fonctionnalités StockScan — Base produits, inventaires, exports CSV/Excel, options activables";
  const seoDescription =
    "Découvrez StockScan : base produits propre, inventaire mensuel, options activables (prix, TVA, dates, lots, variantes…), exports CSV/Excel, multi-services et interface adaptée à votre métier.";

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
      </Helmet>

      <main className="w-full bg-transparent text-white">
        <div className="mx-auto w-full max-w-[1480px] px-2 sm:px-3 lg:px-4 py-10">
          {/* ✅ Bloc central arrondi */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10 space-y-10">
            <header className="space-y-4">
              <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Fonctionnalités</p>

              <h1 className="text-3xl md:text-4xl font-bold">
                Tout ce qu’il faut pour un inventaire propre — sans complexité inutile
              </h1>

              <p className="text-slate-200 max-w-2xl">
                StockScan est conçu pour les commerces : vous allez droit au but, avec une interface claire. Et si vous
                avez des besoins plus avancés, vous activez des options au fur et à mesure.
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

            <section className="space-y-4">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Options disponibles</h2>
                  <p className="text-slate-200 text-sm max-w-2xl mt-1">
                    Vous gardez une interface simple. Et si vous voulez aller plus loin, vous activez des options.
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
                  </Card>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
              <h3 className="text-2xl font-bold">Vous voulez voir si StockScan colle à votre commerce ?</h3>
              <p className="text-blue-100 text-sm">
                Choisissez votre métier, puis testez la logique “base produits + inventaire” en quelques minutes.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button as={Link} to="/metiers" className="bg-white text-slate-900 rounded-full">
                  Explorer les métiers
                </Button>
                <Button as={Link} to="/register" variant="secondary" className="bg-white/10 text-white border-white/30 rounded-full">
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