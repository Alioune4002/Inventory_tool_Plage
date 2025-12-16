import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourBar() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire pour bar | StockScan</title>
        <meta
          name="description"
          content="Bouteilles entamées, volume + unités, pertes : StockScan s’adapte aux bars et cave à boissons."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Bar</p>
          <h1 className="text-3xl md:text-4xl font-bold">Logiciel d’inventaire pour bar</h1>
          <p className="text-lg text-slate-600">
            Unités + volume, gestion des bouteilles entamées, pertes et exports simples pour bars et caves. StockScan active le mode bar
            automatiquement : volume + pièces, reste en dixièmes, pertes bar (offerts, casse, évaporation) et exports propres.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants côté bar</h2>
          <p className="text-slate-700">
            Le bar demande un inventaire précis mais rapide : mesurer une bouteille entamée, compter les fûts, suivre les pertes (verres
            offerts, casse, évaporation) et consolider en volume + pièces. Un tableur ou un logiciel retail ne sait pas gérer les dixièmes
            ou les unités mixtes; les exports deviennent inexacts et la marge bar reste floue.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Mesure imprécise des bouteilles entamées et des fûts.</li>
            <li>Inventaire manuel chronophage, souvent hors horaires d’ouverture.</li>
            <li>Pertes non tracées : verres offerts, casse, tests cocktail.</li>
            <li>Exports inutilisables : mélange volume/pièces sans conversion.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte au bar</h2>
          <p className="text-slate-700">
            StockScan active le profil bar : unités mixtes (pièces + ml/l), champ “entamé” avec reste en dixièmes ou ml, pertes bar
            intégrées aux stats et exports dédiés. Le scan est optionnel; vous pouvez aussi générer un SKU interne pour standardiser vos
            fiches produits (spiritueux, vins, bières, softs, sirops).
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Unités & entamé</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Unités pièces + volume (ml/l)</li>
                <li>Reste bouteille : curseur dixièmes ou quantité ml</li>
                <li>Catégories bar : vins, spiritueux, bières, softs, sirops</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Pertes et exports</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Pertes bar : offerts, casse, évaporation</li>
                <li>Exports par service/mois, CSV/XLSX, partage email</li>
                <li>Stats mensuelles : pertes, rotations, ruptures</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (bar)</h2>
          <p className="text-slate-700">
            Démo guidée : ajouter une bouteille, déclarer un reste (dixièmes), voir l’impact instantané sur les stats. Pas d’inscription
            requise.
          </p>
          <AutoDemoBlock variant="bar" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">Bars à cocktails, bars d’hôtels ou campings, caves à vins, bars de salle de concert.</p>
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-2">
            <p className="font-semibold">Cas concrets</p>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Cave à vins : gestion par volume + lot, reste bouteille</li>
              <li>Bar d’hôtel : services multiples (bar principal + pool bar)</li>
              <li>Bar événementiel : inventaire rapide mobile-first</li>
            </ul>
          </div>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester le mode bar ?</h3>
          <p>Essayez StockScan avec profil bar activé : unités mixtes, reste bouteille, pertes intégrées.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir comment ça marche
            </a>
            <a href="/pour-restaurant-cuisine" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Voir mode cuisine
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
