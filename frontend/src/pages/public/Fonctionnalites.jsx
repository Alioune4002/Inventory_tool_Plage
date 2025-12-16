import React from "react";
import { Helmet } from "react-helmet-async";

export default function Fonctionnalites() {
  const features = [
    {
      title: "Interface adaptée au métier",
      desc: "Champs dynamiques : unités, DLC, pertes, scan ou SKU, selon votre activité. Un restaurant voit le mode entamé, une boutique voit les variantes taille/couleur.",
    },
    {
      title: "Scan ou saisie manuelle",
      desc: "Sur mobile ou desktop : code-barres si disponible, sinon SKU interne générable. Lookup local + OpenFoodFacts (alimentaire) pour préremplir.",
    },
    {
      title: "Pertes & traçabilité",
      desc: "Déclarez les pertes (casse, DLC, invendus, offerts, vol) et suivez-les dans les stats mensuelles. Option entamé désactivable pour retail/pharma.",
    },
    {
      title: "Exports CSV/XLSX + email",
      desc: "Exports par service ou globaux, mode scellé/entamé, partage email direct pour votre comptable ou vos équipes.",
    },
    {
      title: "Multi-services / multi-métier",
      desc: "Camping, hôtel, retail : chaque service active ses propres règles. Vue consolidée ou vue par service, sans casser la donnée.",
    },
    {
      title: "Assistant IA (optionnel)",
      desc: "Analyse de vos stocks et recommandations d’usage si activé (lecture seule, actions whitelistées, JSON validé).",
    },
  ];

  const examples = [
    {
      title: "Restaurant / Cuisine",
      bullets: ["Unités kg/g/ml + entamé", "Pertes cuisine : casse, surplus, offerts", "Exports par service (cuisine/bar)"],
      link: "/pour-restaurant-cuisine",
    },
    {
      title: "Bar",
      bullets: ["Volume + pièces", "Reste bouteille en dixièmes/ml", "Exports bar dédiés"],
      link: "/pour-bar",
    },
    {
      title: "Boulangerie / Pâtisserie",
      bullets: ["Matières premières + production jour", "Invendus/retours", "Exports pertes journalières"],
      link: "/pour-boulangerie-patisserie",
    },
    {
      title: "Pharmacie",
      bullets: ["Lot + péremption", "Emplacements (frigo/rayon/coffre)", "Registre sécurisé"],
      link: "/pour-pharmacie",
    },
    {
      title: "Boutique / Retail",
      bullets: ["SKU + variantes", "Champs alimentaires masqués", "Exports retail épurés"],
      link: "/pour-boutique",
    },
    {
      title: "Hôtel / Camping",
      bullets: ["Multi-services : bar, épicerie, boutique", "Exports consolidés", "Pertes par service"],
      link: "/pour-hotel-camping",
    },
  ];

  return (
    <div className="public-shell">
      <Helmet>
        <title>Fonctionnalités | StockScan</title>
        <meta
          name="description"
          content="Découvrez les fonctionnalités clés : interface métier, scan, pertes, exports, multi-services et assistant IA optionnel."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Fonctionnalités</p>
          <h1 className="text-3xl md:text-4xl font-bold">Tout ce dont vous avez besoin pour un inventaire clair</h1>
          <p className="text-lg text-slate-200">
            StockScan n’est pas un inventaire générique : chaque fonctionnalité s’active ou se masque selon votre métier.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="public-card p-6">
              <h2 className="text-xl font-semibold text-white">{f.title}</h2>
              <p className="text-slate-200 mt-2">{f.desc}</p>
            </div>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Exemples métiers (adaptation automatique)</h2>
          <p className="text-slate-200">
            Le vocabulaire, les unités, les champs et les exports changent selon votre métier. Vous choisissez votre vertical, StockScan fait
            le reste.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {examples.map((ex) => (
              <div key={ex.title} className="public-card p-5 space-y-2">
                <h3 className="font-semibold text-white">{ex.title}</h3>
                <ul className="list-disc pl-5 text-slate-200 space-y-1">
                  {ex.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <a href={ex.link} className="text-blue-300 font-semibold text-sm">
                  Découvrir le mode {ex.title.toLowerCase()}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Assistant IA (optionnel, sécurisé)</h2>
          <p className="text-slate-200">
            L’assistant IA lit un contexte limité (stocks, pertes, mouvements) et renvoie des insights et actions whitelistées. Les réponses
            sont validées en JSON, aucune action n’est lancée sans votre confirmation.
          </p>
          <ul className="list-disc pl-5 text-slate-200 space-y-2">
            <li>Mode lecture seule par défaut</li>
            <li>Actions possibles uniquement via une whitelist (ex: exporter, rafraîchir stats)</li>
            <li>Fallback clair si la réponse IA est invalide</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Besoin d’un résumé rapide ?</h3>
          <p>Choisissez votre métier, activez les fonctionnalités adaptées, exportez en un clic, et partagez par email.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/metiers" className="px-4 py-2 rounded-full bg-white text-blue-700 font-semibold">
              Voir les métiers
            </a>
            <a href="/comment-ca-marche" className="px-4 py-2 rounded-full border border-white/40 text-white">
              Voir le parcours
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
