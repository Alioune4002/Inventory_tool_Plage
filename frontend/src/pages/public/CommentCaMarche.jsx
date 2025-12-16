import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function CommentCaMarche() {
  return (
    <div className="public-shell">
      <Helmet>
        <title>Comment ça marche | StockScan</title>
        <meta
          name="description"
          content="Comprenez le parcours en 5 étapes : choisir votre métier, adapter l'outil, ajouter vos produits, réaliser l'inventaire mensuel, analyser et exporter."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-12 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Parcours</p>
          <h1 className="text-3xl md:text-4xl font-bold">Comment StockScan fonctionne en 5 étapes</h1>
          <p className="text-lg text-slate-200">
            Un chemin clair pour tous les métiers : restaurant, bar, boulangerie, épicerie, pharmacie, boutique ou
            structure multi-services.
          </p>
        </header>
        <ol className="space-y-8">
          {[
            {
              title: "1) Choisissez votre type de commerce",
              desc: "Ce choix pilote toute l’expérience : champs visibles, unités, DLC, pertes, scan code-barres ou SKU.",
            },
            {
              title: "2) StockScan adapte automatiquement l’interface",
              desc: "Les champs inutiles disparaissent, les unités et règles métier s’activent (entamé, pesée, lots, etc.).",
            },
            {
              title: "3) Ajoutez vos produits (scan ou manuel)",
              desc: "Scan rapide sur mobile ou saisie manuelle avec SKU interne générable et catégories guidées.",
            },
            {
              title: "4) Faites votre inventaire mensuel",
              desc: "Sélectionnez un mois et un service, comptez vos stocks, déclarez les pertes si nécessaire.",
            },
            {
              title: "5) Analysez, exportez, partagez",
              desc: "Stats par service/métier, exports CSV/XLSX, envoi par email pour vos équipes ou expert-comptable.",
            },
          ].map((step, idx) => (
            <li key={step.title} className="public-card p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-500/15 text-blue-200 border border-blue-400/30 flex items-center justify-center font-semibold">
                  {idx + 1}
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">{step.title}</h2>
                  <p className="text-slate-200">{step.desc}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <section className="public-card p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-white">Liens métiers et ressources</h2>
          <p className="text-slate-200">
            Besoin de voir un exemple concret ? Parcourez les pages métiers ou les fonctionnalités complètes.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <Link to="/metiers" className="font-semibold hover:underline">
              Tous les métiers
            </Link>
            <Link to="/pour-restaurant-cuisine" className="font-semibold hover:underline">
              Mode Restaurant / Cuisine
            </Link>
            <Link to="/pour-bar" className="font-semibold hover:underline">
              Mode Bar
            </Link>
            <Link to="/pour-boulangerie-patisserie" className="font-semibold hover:underline">
              Mode Boulangerie / Pâtisserie
            </Link>
            <Link to="/pour-epicerie" className="font-semibold hover:underline">
              Mode Épicerie
            </Link>
            <Link to="/pour-boutique" className="font-semibold hover:underline">
              Mode Boutique
            </Link>
            <Link to="/pour-pharmacie" className="font-semibold hover:underline">
              Mode Pharmacie
            </Link>
            <Link to="/pour-hotel-camping" className="font-semibold hover:underline">
              Mode Hôtel / Camping
            </Link>
            <Link to="/fonctionnalites" className="font-semibold hover:underline">
              Fonctionnalités
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
