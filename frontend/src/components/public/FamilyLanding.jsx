import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import LazyAutoDemoShowcase from "./LazyAutoDemoShowcase";
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
  if (barcode && sku) return "Code-barres + référence interne";
  if (barcode) return "Code-barres";
  return "Référence interne";
};

export default function FamilyLanding({ familyId, seoTitle, seoDescription }) {
  const family = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const moduleMap = useMemo(() => MODULES.reduce((acc, mod) => ({ ...acc, [mod.id]: mod }), {}), []);

  const landing = family.copy?.landing || {};
  const landingTitle = seoTitle || `${landing.title || family.name} | StockScan`;
  const landingDesc =
    seoDescription ||
    landing.description ||
    `${family.name} : une interface claire, adaptée à votre activité, pour des inventaires plus rapides et des exports propres.`;

  const options = (family.modules || [])
    .map((id) => moduleMap[id])
    .filter(Boolean)
    .slice(0, 6);

  const examples = family.examples || {};
  const categories = examples.categories || [];
  const products = examples.products || [];

  const problem =
    landing.problem ||
    "Les inventaires deviennent vite pénibles : on perd du temps, on se trompe, et le stock réel n’est jamais clair.";
  const solution =
    landing.solution ||
    "StockScan vous apporte une méthode simple : une base produits propre + un inventaire à une date, avec des options activables si besoin.";
  const outcomes =
    Array.isArray(landing.outcomes) && landing.outcomes.length
      ? landing.outcomes.slice(0, 4)
      : ["Inventaire plus rapide", "Moins d’erreurs", "Exports propres et exploitables"];

  return (
    <PublicShell>
      <Helmet>
        <title>{landingTitle}</title>
        <meta name="description" content={landingDesc} />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        {/* HERO */}
        <header className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
              {family.name}
            </p>

            <h1 className="text-3xl md:text-4xl font-black leading-tight">
              {family.copy?.headline || family.name}
            </h1>

            <p className="text-lg text-slate-200">
              {family.copy?.subline || landing.description || "Une interface claire, pensée pour votre activité."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button as={Link} to="/register" className="w-full sm:w-auto">
                Commencer gratuitement
              </Button>
              <Button as={Link} to="/tarifs" variant="secondary" className="w-full sm:w-auto">
                Voir les offres
              </Button>
            </div>

            <div className="text-xs text-white/60">
              Vous pouvez démarrer en mode simple et activer des options plus tard.
            </div>
          </div>

          {/* Carte “Adaptation automatique” */}
          <Card className="p-6 space-y-3 border-white/10 bg-white/5" hover>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Adaptation automatique
            </div>

            <div className="text-lg font-semibold text-white">
              Identifiant : {formatIdentifier(family)}
            </div>

            <ul className="text-sm text-slate-200 space-y-2">
              <li>Organisation : {family.labels?.categoryLabel || "Catégorie"}</li>
              <li>Unité par défaut : {family.defaults?.unitLabel || "Unité"}</li>
              <li>Options recommandées : {(family.modules || []).length}</li>
            </ul>

            <div className="text-xs text-slate-400">
              Ajustable après inscription dans les paramètres.
            </div>
          </Card>
        </header>

        {/* Problème -> Solution -> Gains */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-2" hover>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Problème</div>
            <div className="text-lg font-semibold text-white">Ce qui vous freine</div>
            <p className="text-sm text-slate-200">{problem}</p>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-2" hover>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Solution</div>
            <div className="text-lg font-semibold text-white">La méthode StockScan</div>
            <p className="text-sm text-slate-200">{solution}</p>
            <div className="text-xs text-slate-400">
              Base produits = stable · Inventaire = comptage à une date
            </div>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-3" hover>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Résultats</div>
            <div className="text-lg font-semibold text-white">Ce que vous gagnez</div>
            <ul className="text-sm text-slate-200 space-y-2">
              {outcomes.map((o) => (
                <li key={o} className="flex gap-2 items-start">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-400" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Exemples */}
        <section className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-3 border-white/10 bg-white/5" hover>
            <h2 className="text-xl font-semibold text-white">Exemples concrets</h2>

            <div className="text-sm text-slate-200">
              <div className="font-semibold text-white">Catégories</div>
              <div>{categories.length ? categories.join(" · ") : "Disponibles après inscription."}</div>
            </div>

            <div className="text-sm text-slate-200">
              <div className="font-semibold text-white">Produits</div>
              <div>{products.length ? products.join(" · ") : "Ajoutez vos produits clés en quelques minutes."}</div>
            </div>

            <div className="pt-2">
              <Button as={Link} to="/comment-ca-marche" variant="secondary" className="w-full sm:w-auto">
                Voir le fonctionnement
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-3 border-white/10 bg-white/5" hover>
            <h2 className="text-xl font-semibold text-white">Options recommandées</h2>
            <p className="text-sm text-slate-200">
              Vous gardez une interface simple, puis vous activez des options si votre activité l’exige.
            </p>

            <div className="grid gap-3">
              {options.map((mod) => (
                <div key={mod.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">{mod.name}</div>
                  <div className="text-sm text-slate-200 mt-1">{mod.description}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Démo */}
        <section className="space-y-4">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-black">Démo</h2>
              <p className="text-slate-200 text-sm max-w-2xl mt-1">
                Un aperçu léger et réaliste, sans création de compte. Données fictives, interface identique.
              </p>
            </div>
            <Link to="/register" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
              Tester avec mon compte →
            </Link>
          </div>
          <LazyAutoDemoShowcase />
        </section>

        {/* FAQ */}
        {family.copy?.faq?.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-black">Questions fréquentes</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {family.copy.faq.map((item) => (
                <Card key={item.q} className="p-5 border-white/10 bg-white/5 space-y-2" hover>
                  <div className="font-semibold text-white">{item.q}</div>
                  <div className="text-sm text-slate-200">{item.a}</div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* CTA final */}
        <section className="rounded-3xl bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
          <h3 className="text-2xl font-black">Prêt à démarrer ?</h3>
          <p className="text-blue-100 text-sm">
            Choisissez votre métier, ajoutez quelques produits, puis lancez votre premier inventaire.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button as={Link} to="/register" className="bg-white text-slate-900 w-full sm:w-auto">
              Créer mon espace
            </Button>
            <Button as={Link} to="/metiers" variant="secondary" className="bg-white/10 text-white border-white/30 w-full sm:w-auto">
              Voir les métiers
            </Button>
          </div>
        </section>

        <div className="text-center text-xs text-white/50">
          <Link to="/" className="hover:text-white">Retour à l’accueil</Link>
          <span className="mx-2">·</span>
          <Link to="/support" className="hover:text-white">Support</Link>
        </div>
      </main>
    </PublicShell>
  );
}
