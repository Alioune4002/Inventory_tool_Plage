import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourBoulangeriePatisserie() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire boulangerie / pâtisserie | StockScan</title>
        <meta
          name="description"
          content="Production du jour, invendus, matières premières : StockScan s’adapte aux boulangeries et pâtisseries."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Boulangerie / Pâtisserie</p>
          <h1 className="text-3xl md:text-4xl font-bold">Inventaire pour boulangeries et pâtisseries</h1>
          <p className="text-lg text-slate-600">
            Matières premières, production quotidienne, invendus et pertes : StockScan suit vos produits finis et vos bases, sans colonnes
            inutiles. Mode “Boulangerie” activé automatiquement.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants en boulangerie/pâtisserie</h2>
          <p className="text-slate-700">
            Une boulangerie doit suivre ses matières premières (farine, beurre, œufs), sa production du jour, et ses invendus de fin de
            journée. Les DLC/DDM et les produits “24h” rendent l’inventaire délicat. Un outil générique oblige à saisir un code-barres ou
            des prix systématiques, ce qui ralentit la production et ne mesure pas le gaspillage.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Suivi matières premières + produits finis sur Excel, peu fiable.</li>
            <li>Invendus et pertes non tracés, gaspillage invisible.</li>
            <li>DLC/DDM, produits 24h difficiles à surveiller.</li>
            <li>Exports imprécis pour le comptable ou le gérant.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte</h2>
          <p className="text-slate-700">
            StockScan active le profil “Boulangerie” : types produit (matière première, produit fini), dates (24h, DLC, DDM), unités
            cohérentes (kg/g/l/ml/pcs), écran invendus/pertes, et exports pertes + stock matières. Le scan est optionnel; vous pouvez
            générer un SKU interne pour vos préparations maison.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Production & dates</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Produits 24h, DLC, DDM</li>
                <li>Préparations maison avec durée interne</li>
                <li>Unités adaptées : kg/g/l/ml/pcs</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Invendus & pertes</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Écran dédié invendus/pertes de fin de journée</li>
                <li>Alertes dates proches pour limiter le gaspillage</li>
                <li>Exports : pertes par jour, stock matières, production</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (boulangerie)</h2>
          <p className="text-slate-700">
            Démo guidée : ajout d’une matière première, production du jour, invendus, pertes, et impact sur les stats. Pas de compte requis.
          </p>
          <AutoDemoBlock variant="boulangerie" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">
            Boulangeries artisanales, pâtisseries, sandwicheries, chaînes avec labo central : StockScan s’adapte au volume et aux services
            multiples (boutique, snacking, laboratoire).
          </p>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode boulangerie ?</h3>
          <p>Activez le profil boulangerie/pâtisserie : invendus, pertes, production du jour, exports clairs.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/metiers" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Choisir un autre métier
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
