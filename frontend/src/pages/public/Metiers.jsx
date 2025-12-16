import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const cards = [
  { to: "/pour-restaurant-cuisine", title: "Restaurant / Cuisine", desc: "Produits entamés, pesées, DLC, pertes." },
  { to: "/pour-bar", title: "Bar", desc: "Unités + volume, bouteilles entamées, inventaire rapide." },
  { to: "/pour-boulangerie-patisserie", title: "Boulangerie / Pâtisserie", desc: "Production du jour, invendus, matières premières." },
  { to: "/pour-epicerie", title: "Épicerie", desc: "Code-barres, prix achat/vente, DLC/DDM." },
  { to: "/pour-pharmacie", title: "Pharmacie / Parapharmacie", desc: "Lots, péremptions, registre, emplacements sécurisés." },
  { to: "/pour-boutique", title: "Boutique non-alimentaire", desc: "SKU conseillé, tailles/couleurs, sans DLC." },
  { to: "/pour-hotel-camping", title: "Hôtel / Camping", desc: "Multi-services (épicerie, bar, snack), exports par service." },
];

export default function Metiers() {
  return (
    <div className="public-shell">
      <Helmet>
        <title>Métiers couverts | StockScan</title>
        <meta
          name="description"
          content="Découvrez comment StockScan s’adapte à votre métier : restaurant, bar, boulangerie, épicerie, pharmacie, boutique ou camping."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Métiers</p>
          <h1 className="text-3xl md:text-4xl font-bold">Un logiciel d’inventaire qui s’adapte à chaque métier</h1>
          <p className="text-lg text-slate-200">
            Chaque vertical a ses règles : unités, DLC, pertes, traçabilité ou SKU. StockScan active uniquement les
            champs utiles et masque le reste.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group public-card p-6 hover:-translate-y-1 hover:shadow-lg transition"
            >
              <h2 className="text-xl font-semibold group-hover:text-blue-300">{card.title}</h2>
              <p className="text-slate-200 mt-2">{card.desc}</p>
              <span className="mt-4 inline-block text-blue-300 font-semibold">Voir le détail →</span>
            </Link>
          ))}
        </div>
        <section className="public-card p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-white">Liens utiles</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Link to="/comment-ca-marche" className="font-semibold hover:underline">
              Comment ça marche
            </Link>
            <Link to="/fonctionnalites" className="font-semibold hover:underline">
              Fonctionnalités détaillées
            </Link>
            <Link to="/tarifs" className="font-semibold hover:underline">
              Tarifs (aperçu)
            </Link>
            <Link to="/support" className="font-semibold hover:underline">
              Support & FAQ
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
