import React from "react";
import { Link } from "react-router-dom";
import PublicShell from "../../components/public/PublicShell";
import { FAMILLES } from "../../lib/famillesConfig";

const ROUTES = {
  retail: "/pour-epicerie",
  mode: "/pour-boutique",
  bar: "/pour-bar",
  restauration: "/pour-restaurant-cuisine",
  boulangerie: "/pour-boulangerie-patisserie",
  pharmacie: "/pour-pharmacie",
};

export default function Metiers() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 text-white space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Familles métiers</p>
          <h1 className="text-3xl md:text-4xl font-bold">Choisissez votre univers StockScan</h1>
          <p className="text-slate-200 max-w-2xl">
            Chaque famille active ses champs, ses unités et ses modules. Le but : vous reconnaître dès la première page.
          </p>
        </header>

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FAMILLES.map((family) => (
            <Link
              key={family.id}
              to={ROUTES[family.id] || "/metiers"}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 hover:-translate-y-1"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{family.name}</div>
              <h2 className="mt-2 text-lg font-semibold text-white group-hover:text-blue-200">
                {family.copy?.headline || family.name}
              </h2>
              <p className="mt-2 text-sm text-slate-200">{family.copy?.subline}</p>
              <span className="mt-3 inline-flex text-sm font-semibold text-blue-300">Découvrir →</span>
            </Link>
          ))}
        </section>
      </main>
    </PublicShell>
  );
}
