import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourHotelCamping() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire pour hôtel / camping | StockScan</title>
        <meta
          name="description"
          content="Multi-services : épicerie, bar, restauration, boutique. StockScan sépare les règles par service et agrège les exports."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Hôtel / Camping</p>
          <h1 className="text-3xl md:text-4xl font-bold">Inventaire multi-services pour hôtels et campings</h1>
          <p className="text-lg text-slate-600">
            Plusieurs services (épicerie, bar, restauration, boutique) avec règles propres : unités, DLC, pertes, exports par
            service et consolidés.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants</h2>
          <p className="text-slate-700">
            Un établissement multi-services (hôtel, camping, resort) gère une épicerie, un bar, un snack/resto, parfois une boutique.
            Chaque service a ses règles (DLC, entamé, SKU, variantes) et la direction veut des exports consolidés. Les outils génériques
            mélangent tout : champs inutiles pour certains services, exports incomplets, permissions floues.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Règles différentes selon les points de vente (food vs non-food).</li>
            <li>Exports difficiles à agréger pour la direction.</li>
            <li>Équipes multiples, besoins d’accès différenciés.</li>
            <li>Termes confus : on parle d’“établissement”, pas seulement de “commerce”.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte</h2>
          <p className="text-slate-700">
            StockScan active un service profile par point de vente : entamé et DLC pour la restauration, volume pour le bar, scan/SKU pour
            l’épicerie, SKU/variantes pour la boutique. Les exports sont disponibles par service et en consolidé pour l’établissement.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Services séparés</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Restauration/snack : entamé, DLC</li>
                <li>Bar : volume + pièces, pertes bar</li>
                <li>Épicerie : code-barres ou SKU interne</li>
                <li>Boutique : variantes, SKU, sans DLC</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold mb-2">Exports et direction</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Exports par service et consolidés établissement</li>
                <li>Partage par email pour la direction/comptable</li>
                <li>Permissions par service (owner/manager/viewer)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (multi-services)</h2>
          <p className="text-slate-700">
            La démo publique montre un switch de service (épicerie → bar → boutique), l’ajout rapide adapté, puis un export consolidé pour
            l’établissement. Pas de compte requis.
          </p>
          <AutoDemoBlock variant="camping" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">
            Hôtels, campings, villages vacances, resorts avec plusieurs points de vente (food + non-food). Vocabulaire adapté : “établissement”
            plutôt que “commerce”.
          </p>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode multi-services ?</h3>
          <p>Activez des services distincts, exports consolidés et vocabulaire adapté à votre établissement.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/metiers" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Explorer les métiers
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
