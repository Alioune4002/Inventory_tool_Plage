import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourBoutique() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire pour boutique non-alimentaire | StockScan</title>
        <meta
          name="description"
          content="SKU conseillé, tailles/couleurs, pas de DLC : StockScan s’adapte aux boutiques non-alimentaires."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Boutique non-alimentaire</p>
          <h1 className="text-3xl md:text-4xl font-bold">Inventaire pour boutiques et retail non-food</h1>
          <p className="text-lg text-slate-600">
            Sans DLC : focus sur SKU, variantes (tailles/couleurs), catégories simples et exports rapides.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants en boutique</h2>
          <p className="text-slate-700">
            Une boutique non-alimentaire (prêt-à-porter, accessoires, souvenirs) n’a pas besoin de DLC ni de champs alimentaires. Les
            produits sans code-barres sont fréquents, les variantes tailles/couleurs doivent être claires, et les exports comptables doivent
            rester simples.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Pas de code-barres sur certains produits (souvenirs, artisanat).</li>
            <li>Gestion des variantes (taille, couleur) peu claire.</li>
            <li>Exports propres exigés pour la comptabilité.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte</h2>
          <p className="text-slate-700">
            Le profil “Boutique” désactive les champs DLC, met en avant le SKU interne et les variantes, et garde le code-barres facultatif.
            Les exports sont épurés (CSV/XLSX) par service ou consolidés. Le vocabulaire peut être ajusté (“Articles” au lieu de “Produits”).
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Champs simplifiés</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>SKU interne conseillé, code-barres facultatif</li>
                <li>Variantes tailles/couleurs (ex: T38, bleu)</li>
                <li>Catégories libres (vêtements, accessoires, souvenirs)</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Exports et vocabulaire</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Exports CSV/XLSX par service ou consolidés</li>
                <li>Champs alimentaires masqués</li>
                <li>Terminologie boutique : “Articles” au lieu de “Produits”</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (boutique)</h2>
          <p className="text-slate-700">
            Démo publique : ajout d’un article sans code-barres avec SKU généré, gestion d’une variante taille/couleur, export rapide.
          </p>
          <AutoDemoBlock variant="boutique" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">
            Boutiques de vêtements, accessoires, concept stores, souvenirs, corners retail dans un camping ou un hôtel.
          </p>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode boutique ?</h3>
          <p>Activez le profil boutique : champs alimentaires masqués, SKU et variantes mis en avant.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/pour-epicerie" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Voir mode épicerie
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
