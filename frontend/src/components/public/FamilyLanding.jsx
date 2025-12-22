import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import AutoDemoShowcase from "../../demo/AutoDemoShowcase";
import PublicShell from "./PublicShell";
import { FAMILLES, MODULES } from "../../lib/famillesConfig";

const ROUTES = {
  retail: "/pour-epicerie",
  mode: "/pour-boutique",
  bar: "/pour-bar",
  restauration: "/pour-restaurant-cuisine",
  boulangerie: "/pour-boulangerie-patisserie",
  pharmacie: "/pour-pharmacie",
};

const formatIdentifier = (family) => {
  const barcode = family.identifiers?.barcode;
  const sku = family.identifiers?.sku;
  if (barcode && sku) return "Code-barres + SKU";
  if (barcode) return "Code-barres";
  return "SKU interne";
};

export default function FamilyLanding({ familyId, seoTitle, seoDescription }) {
  const family = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const moduleMap = useMemo(() => MODULES.reduce((acc, mod) => ({ ...acc, [mod.id]: mod }), {}), []);

  const landingTitle = seoTitle || `${family.copy?.landing?.title || family.name} | StockScan`;
  const landingDesc =
    seoDescription ||
    family.copy?.landing?.description ||
    `${family.name} : interface, champs et unités adaptés à votre activité.`;

  const modules = (family.modules || [])
    .map((id) => moduleMap[id])
    .filter(Boolean)
    .slice(0, 6);

  const examples = family.examples || {};
  const categories = examples.categories || [];
  const products = examples.products || [];

  return (
    <PublicShell>
      <Helmet>
        <title>{landingTitle}</title>
        <meta name="description" content={landingDesc} />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <header className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
              {family.name}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">{family.copy?.headline || family.name}</h1>
            <p className="text-lg text-slate-200">{family.copy?.subline}</p>
            <div className="flex flex-wrap gap-3">
              <Button as={Link} to="/register">
                Démarrer l’onboarding
              </Button>
              <Button as={Link} to="/metiers" variant="secondary">
                Voir les autres familles
              </Button>
            </div>
          </div>
          <Card className="p-6 space-y-3 border-white/10 bg-white/5">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Réglages auto</div>
            <div className="text-lg font-semibold">{formatIdentifier(family)}</div>
            <ul className="text-sm text-slate-200 space-y-2">
              <li>Catégorie : {family.labels?.categoryLabel}</li>
              <li>Unité par défaut : {family.defaults?.unitLabel}</li>
              <li>Modules activés : {(family.modules || []).length}</li>
            </ul>
            <div className="text-xs text-slate-400">
              Ces réglages peuvent être ajustés dans Paramètres → Modules.
            </div>
          </Card>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-3 border-white/10 bg-white/5">
            <h2 className="text-xl font-semibold">Ce qui change pour votre métier</h2>
            <p className="text-slate-200">
              {family.copy?.landing?.description ||
                "StockScan active uniquement les champs utiles et masque le reste."}
            </p>
            <div className="text-sm text-slate-300">
              Inventaire = comptage du mois. Catalogue = référentiel produit.
            </div>
          </Card>
          <Card className="p-6 space-y-3 border-white/10 bg-white/5">
            <h2 className="text-xl font-semibold">Exemples concrets</h2>
            <div className="text-sm text-slate-200">
              <div className="font-semibold">Catégories</div>
              <div>{categories.length ? categories.join(" · ") : "Exemples disponibles après inscription."}</div>
            </div>
            <div className="text-sm text-slate-200">
              <div className="font-semibold">Produits</div>
              <div>{products.length ? products.join(" · ") : "Ajoutez vos références clés en quelques minutes."}</div>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Modules recommandés</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <Card key={mod.id} className="p-5 border-white/10 bg-white/5 space-y-2">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-400">{mod.name}</div>
                <div className="text-sm text-slate-200">{mod.description}</div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto‑démo</h2>
          <p className="text-slate-200">
            Un aperçu léger et réaliste, sans création de compte. Données fictives, interface identique.
          </p>
          <AutoDemoShowcase />
        </section>

        {family.copy?.faq?.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">FAQ rapide</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {family.copy.faq.map((item) => (
                <Card key={item.q} className="p-5 border-white/10 bg-white/5 space-y-2">
                  <div className="font-semibold">{item.q}</div>
                  <div className="text-sm text-slate-200">{item.a}</div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à démarrer ?</h3>
          <p>Activez les modules adaptés, puis lancez votre premier comptage.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button as={Link} to="/register" className="bg-white text-slate-900">
              Créer mon espace
            </Button>
            <Button as={Link} to={ROUTES[family.id] || "/metiers"} variant="secondary">
              Revoir cette famille
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
