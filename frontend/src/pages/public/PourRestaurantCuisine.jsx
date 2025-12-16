import React from "react";
import { Helmet } from "react-helmet-async";
import AutoDemoBlock from "../../components/public/AutoDemoBlock";

export default function PourRestaurantCuisine() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Logiciel d’inventaire restaurant / cuisine | StockScan</title>
        <meta
          name="description"
          content="Produits entamés, DLC, pesées, pertes cuisine : StockScan adapte les champs, les unités et les exports pour la restauration."
        />
      </Helmet>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Restaurant / Cuisine</p>
          <h1 className="text-3xl md:text-4xl font-bold">Logiciel d’inventaire pour restaurant et cuisine pro</h1>
          <p className="text-lg text-slate-600">
            Pas de code-barres obligatoire : pesées kg/g, produits entamés, DLC/DDM, pertes (casse, offerts, gaspi). StockScan applique
            automatiquement les réglages adaptés aux cuisines pros et élimine les champs inutiles.
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problèmes courants en cuisine</h2>
          <p className="text-slate-700">
            Dans une cuisine pro, l’inventaire ne ressemble jamais à celui d’un magasin : on parle de produits entamés, de matières
            premières, de préparations maison, de DLC/DDM, de pertes et de pesées. Un tableur ou un logiciel générique impose des colonnes
            inutiles (code-barres obligatoire, champs prix imposés) et ne gère pas les unités fines. Résultat : inventaires interminables,
            absence de traçabilité, marge floue, gaspillage non mesuré et aucun indicateur exploitable par le chef ou le gestionnaire.
          </p>
          <ul className="list-disc pl-5 text-slate-700 space-y-2">
            <li>Inventaires longs et imprécis sur Excel ou des apps non adaptées.</li>
            <li>Impossible de suivre les produits entamés et les dates limites de consommation.</li>
            <li>Pertes et gaspi non tracés : marge floue et achats mal calibrés.</li>
            <li>Unités incohérentes (cartons, kg, litres) sans conversions claires.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Comment StockScan s’adapte à la restauration</h2>
          <p className="text-slate-700">
            StockScan bascule automatiquement en mode “cuisine” : unités kg/g/l/ml, option “entamé”, champs prix optionnels, et pertes
            cuisine déjà prévues (casse, surplus, offerts). Si vous scannez les produits emballés, tant mieux; sinon vous utilisez un SKU
            interne généré en un clic. Les catégories et services sont propres à votre établissement (cuisine chaude, pâtisserie, bar…).
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Champs/Unités</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Unités : kg/g/l/ml + pièces</li>
                <li>Entamé : quantité restante (poids/volume)</li>
                <li>DLC/DDM : visibles uniquement si utile</li>
                <li>Prix achat/vente : optionnels, warnings doux</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Process cuisine</h3>
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                <li>Pertes cuisine (casse, surplus, offerts) intégrées aux stats</li>
                <li>Recherche rapide : scan ou saisie manuelle</li>
                <li>Catégories personnalisées : frais, sec, préparation maison</li>
                <li>Exports Excel/CSV filtrés par service/mois</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Auto-démo (aperçu en 30 secondes)</h2>
          <p className="text-slate-700">
            La démo publique montre un ajout produit cuisine (avec option entamé), la déclaration d’une perte, puis l’impact instantané sur
            les statistiques mensuelles. Vous voyez la différence entre un service “Cuisine” et un service “Bar” sans créer de compte.
          </p>
          <AutoDemoBlock variant="restaurant" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pour qui ?</h2>
          <p className="text-slate-700">
            Restaurants traditionnels, bistronomie, snacking, food trucks, dark kitchen, cuisine centrale, traiteurs : StockScan adapte les
            champs et les exports à votre façon de travailler. Les services multiples (Cuisine + Bar + Pâtisserie) sont gérés séparément,
            avec des catégories et unités propres.
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <p className="font-semibold text-slate-800">Cas d’usage</p>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Food truck : inventaire léger, pas de code-barres, produits entamés</li>
              <li>Cuisine centrale : services multiples, exports par site, suivi pertes</li>
              <li>Restaurant + Bar : services séparés, unités différentes, stats consolidées</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Pourquoi choisir StockScan maintenant</h2>
          <p className="text-slate-700">
            L’outil réduit le temps d’inventaire (scan ou saisie rapide), élimine les colonnes inutiles, et propose des exports propres pour
            vos fournisseurs, votre comptable ou vos associés. Vous pouvez démarrer avec un seul service et étendre ensuite vers le bar, la
            pâtisserie ou une boutique interne. Les alertes DLC/DDM et pertes cuisine vous donnent une vision nette sur le gaspillage.
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-slate-700">
            <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
              <p className="font-semibold">Gain de temps</p>
              <p>Inventaire mobile-first, scan rapide, SKU généré si besoin.</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
              <p className="font-semibold">Moins d’erreurs</p>
              <p>Unités cohérentes, champs cachés s’ils sont inutiles.</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
              <p className="font-semibold">Vision claire</p>
              <p>Stats mensuelles, pertes intégrées, exports par service.</p>
            </div>
          </div>
        </section>

        <div className="rounded-2xl bg-blue-600 text-white shadow-lg p-6 space-y-2">
          <h3 className="text-xl font-semibold">Prêt à tester ?</h3>
          <p>Essayez StockScan pour la restauration : interface adaptée dès la première connexion.</p>
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
