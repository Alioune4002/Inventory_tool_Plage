import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourEpicerie() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire pour épicerie | StockScan</title>
        <meta
          name="description"
          content="Code-barres, prix achat/vente, DLC/DDM : StockScan simplifie l’inventaire des épiceries et commerces alimentaires."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Épicerie</p>
          <h1 className="text-3xl md:text-4xl font-bold">Inventaire pour épiceries et commerces alimentaires</h1>
          <p className="text-lg text-slate-600">
            Scan code-barres, prix achat/vente recommandés, DLC/DDM visibles, exports prêts pour la comptabilité.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants en épicerie</h2>
          <p className="text-slate-700">
            Les épiceries doivent gérer des produits à code-barres, des références locales sans EAN, des prix achat/vente et des DLC/DDM.
            Les tableurs ne gèrent pas les dates, les pertes ou les unités, et un logiciel générique impose des champs inutiles pour les
            artisans et petites surfaces.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Relevés de prix et quantités fastidieux sur Excel.</li>
            <li>DLC/DDM difficiles à suivre manuellement.</li>
            <li>Code-barres absent sur les produits locaux, risque de doublons.</li>
            <li>Exports comptables chronophages, peu fiables.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte</h2>
          <p className="text-slate-700">
            Le profil “Épicerie” active le scan code-barres par défaut, propose un SKU interne pour les produits sans EAN, recommande les
            prix achat/vente pour des stats précises, et affiche DLC/DDM uniquement si pertinent. Les pertes et exports par mois/service sont
            intégrés.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Champs clés</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Code-barres prioritaire, SKU interne générable</li>
                <li>Prix achat/vente recommandés (stats/export)</li>
                <li>DLC/DDM visibles pour l’alimentaire</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Flux</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Pertes (DLC, casse) intégrées aux stats</li>
                <li>Exports CSV/XLSX par service ou consolidés</li>
                <li>Catégories adaptées (sec, frais, boissons) ou libres</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (épicerie)</h2>
          <p className="text-slate-700">
            La démo publique montre un scan code-barres, un ajout sans EAN avec SKU généré, une DLC renseignée, puis un export mensuel.
          </p>
          <AutoDemoBlock variant="epicerie" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">
            Épiceries fines, supérettes, commerces de proximité, vrac + épicerie locale, corners alimentaires en camping/hôtel.
          </p>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode épicerie ?</h3>
          <p>Activez le profil épicerie : scan prioritaire, SKU interne pour le local, DLC/DDM, exports propres.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/pour-boutique" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Voir mode boutique
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
