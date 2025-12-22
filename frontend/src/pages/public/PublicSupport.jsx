import React from "react";
import { Helmet } from "react-helmet-async";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";

export default function PublicSupport() {
  return (
    <PublicShell>
      <Helmet>
        <title>Support public | StockScan</title>
        <meta
          name="description"
          content="FAQ et contact StockScan. Comprendre l’outil avant inscription, métiers couverts et exports."
        />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-8 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Support</p>
          <h1 className="text-3xl md:text-4xl font-bold">FAQ & Contact</h1>
          <p className="text-lg text-slate-200 max-w-2xl">
            Réponses rapides avant inscription : familles métiers, scan/SKU, exports, multi‑services.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">FAQ express</h2>
            <ul className="space-y-3 text-slate-200 text-sm">
              <li>• StockScan couvre : retail alimentaire, mode, bar & boissons, restauration, boulangerie, pharmacie.</li>
              <li>• Inventaire sans code‑barres ? Oui, le SKU interne suffit.</li>
              <li>• Exports CSV/XLSX ? Oui, par service ou consolidé, avec partage email.</li>
            </ul>
          </Card>
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">Exemples avant inscription</h2>
            <ul className="space-y-3 text-slate-200 text-sm">
              <li>• Restauration : matières premières + pertes, champs entamé/DLC si activés.</li>
              <li>• Mode : SKU + variantes tailles/couleurs, aucun champ alimentaire.</li>
              <li>• Pharmacie : lots + péremption, traçabilité renforcée.</li>
              <li>• Bar : suivi des bouteilles entamées, unités adaptées (cl, L).</li>
            </ul>
          </Card>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">Guides rapides</h2>
            <ul className="space-y-3 text-slate-200 text-sm">
              <li>• Démarrer : allez sur /metiers puis /comment-ca-marche.</li>
              <li>• Pas de scan : utilisez le SKU interne pour éviter les doublons.</li>
              <li>• Pertes : casse/DLC/vol/offerts sont optionnelles mais utiles en stats.</li>
              <li>• Exports : sélectionnez champs + catégories, puis CSV/XLSX.</li>
            </ul>
          </Card>
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">Nous contacter</h2>
            <p className="text-slate-200 text-sm">Support : support@stockscan.app</p>
            <p className="text-slate-200 text-sm">Réponse sous 24h ouvrées.</p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
