import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourPharmacie() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire pharmacie / parapharmacie | StockScan</title>
        <meta
          name="description"
          content="Lots, péremption, emplacements, registre : StockScan apporte traçabilité et conformité pour pharmacie et parapharmacie."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Pharmacie / Parapharmacie</p>
          <h1 className="text-3xl md:text-4xl font-bold">Inventaire traçable pour pharmacie</h1>
          <p className="text-lg text-slate-600">
            Lots + date de péremption, emplacements (réserve, rayon, frigo), registre des mouvements sensibles.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants</h2>
          <p className="text-slate-700">
            Une pharmacie doit gérer la traçabilité par lot, les dates de péremption, les mouvements sensibles (stupéfiants), et des
            emplacements multiples (réserve, rayon, frigo, coffre). Les outils génériques ne gèrent ni les registres verrouillés ni les
            alertes péremption, et mélangent les produits non alimentaires sans distinction.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Traçabilité par lot + péremption complexe.</li>
            <li>Mouvements sensibles (stupéfiants) difficiles à auditer.</li>
            <li>Multiples emplacements : rayon, frigo, coffre.</li>
            <li>Exports non conformes pour le registre ou le contrôle.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte</h2>
          <p className="text-slate-700">
            StockScan active le profil pharmacie : champs lot + péremption, alertes 30/90 jours, emplacements séparés, mouvements (entrée,
            sortie, transfert, perte, destruction), registre exportable. Le mode “stupéfiants” verrouille les mouvements après validation.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Traçabilité</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Lot + péremption + chaîne du froid</li>
                <li>Alertes péremption (30/90 jours)</li>
                <li>Registre stupéfiants (mouvements verrouillés)</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Emplacements & exports</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Réserve, rayon, frigo, coffre</li>
                <li>Exports lot/péremption, registre PDF/CSV</li>
                <li>Historique complet des mouvements</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (pharmacie)</h2>
          <p className="text-slate-700">Ajout d’un lot, alerte péremption, export registre : démo publique sans inscription.</p>
          <AutoDemoBlock variant="pharmacie" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">Pharmacies, parapharmacies, officines avec rayon parapharmacie, corners santé en camping/hôtel.</p>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode pharmacie ?</h3>
          <p>Activez le profil pharmacie : traçabilité lot + péremption, emplacements, registre sécurisé.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/pour-boutique" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Voir le mode boutique
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
