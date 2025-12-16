import React from "react";
import { Helmet } from "react-helmet-async";

export default function PublicSupport() {
  return (
    <div className="public-shell">
      <Helmet>
        <title>Support public | StockScan</title>
        <meta
          name="description"
          content="FAQ et contact StockScan. Comprendre l’outil avant inscription, obtenir de l’aide sur les métiers couverts et les exports."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-4xl px-4 py-12 space-y-8 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Support</p>
          <h1 className="text-3xl md:text-4xl font-bold">FAQ & Contact (public)</h1>
          <p className="text-lg text-slate-200">
            Obtenez des réponses rapides avant de créer un compte : métiers couverts, scan/sans code-barres, exports, multi-services.
          </p>
        </header>
        <section className="public-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">FAQ express</h2>
          <ul className="space-y-3 text-slate-200">
            <li>• Comment StockScan s’adapte aux restaurants, bars, boulangeries, pharmacies, boutiques ou campings ?</li>
            <li>• Peut-on faire un inventaire sans code-barres ? Oui, SKU interne conseillé.</li>
            <li>• Exports CSV/XLSX disponibles ? Oui, par service ou global, partage email.</li>
          </ul>
        </section>
        <section className="public-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Exemples concrets (avant inscription)</h2>
          <ul className="space-y-3 text-slate-200">
            <li>
              Restaurant : ajoutez un plat sans code-barres, pesez une préparation, déclarez une perte. Les champs entamé/DLC s’affichent
              automatiquement.
            </li>
            <li>
              Boutique : créez un article avec SKU + variante taille/couleur, sans champs alimentaires. L’export retail est épuré.
            </li>
            <li>Pharmacie : lot + péremption + emplacement; registre exportable. Les champs stupéfiants peuvent être verrouillés.</li>
            <li>Camping/hôtel : plusieurs services (bar, épicerie, boutique) avec règles adaptées et export consolidé.</li>
          </ul>
        </section>
        <section className="public-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Guides rapides</h2>
          <ul className="space-y-3 text-slate-200">
            <li>• Commencer : choisissez votre métier sur /metiers puis suivez /comment-ca-marche (5 étapes claires).</li>
            <li>• Scan absent : utilisez le SKU interne généré automatiquement pour éviter les doublons.</li>
            <li>• Pertes : casse/DLC/vol/offerts sont optionnelles mais visibles dans les stats si déclarées.</li>
            <li>• Exports : /exports → choisissez CSV ou XLSX, mode service ou consolidé; partage email possible.</li>
          </ul>
        </section>
        <section className="public-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Nous contacter</h2>
          <p className="text-slate-200">Email : support@stockscan.app — réponse sous 24h ouvrées.</p>
        </section>
      </main>
    </div>
  );
}
