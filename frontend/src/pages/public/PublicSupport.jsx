import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PublicShell from "../../components/public/PublicShell";
import Card from "../../ui/Card";
import Button from "../../ui/Button";

export default function PublicSupport() {
  const emailSupport = "support@stockscan.app";
  const emailSubject = encodeURIComponent("Question avant inscription — StockScan");
  const emailBody = encodeURIComponent(
    `Bonjour,\n\nJ’ai une question avant de m’inscrire sur StockScan.\n\n• Mon activité : \n• Ce que je veux gérer (produits / inventaire / pertes / exports) : \n• Ma question : \n\nMerci !\n`
  );
  const mailto = `mailto:${emailSupport}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <PublicShell>
      <Helmet>
        <title>Support | StockScan</title>
        <meta
          name="description"
          content="Support StockScan : questions fréquentes, métiers couverts, exports CSV/Excel, fonctionnement et contact avant inscription."
        />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-8 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
            Support
          </p>
          <h1 className="text-3xl md:text-4xl font-black">
            Questions fréquentes & contact
          </h1>
          <p className="text-lg text-slate-200 max-w-2xl">
            Vous voulez comprendre StockScan avant de vous inscrire ? Voici l’essentiel : métiers couverts,
            gestion des produits, inventaires, exports — et comment nous joindre.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button as={Link} to="/comment-ca-marche" className="w-full sm:w-auto">
              Voir comment ça marche
            </Button>
            <Button
              as="a"
              href={mailto}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Poser une question par email
            </Button>
          </div>
        </header>

        {/* FAQ PRINCIPALE */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">
              StockScan, c’est pour qui ?
            </h2>
            <ul className="space-y-3 text-slate-200 text-sm">
              <li>
                • Restaurants & cuisines : matières premières, pertes, suivi simple.
              </li>
              <li>
                • Bars : bouteilles, unités adaptées (cl, L), suivi des entamés (optionnel).
              </li>
              <li>
                • Boulangeries : ingrédients, productions, pertes (optionnel).
              </li>
              <li>
                • Épiceries & boutiques : produits, catégories, inventaires mensuels.
              </li>
              <li>
                • Pharmacies : lots & dates (optionnel), traçabilité renforcée selon besoins.
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">
              Est-ce que je dois avoir des codes-barres ?
            </h2>
            <p className="text-slate-200 text-sm">
              Non. Vous pouvez gérer vos produits sans code-barres.
              StockScan permet d’utiliser une <span className="font-semibold text-white">référence interne</span> (facultative)
              pour éviter les doublons et garder un catalogue propre.
            </p>
            <p className="text-slate-200 text-sm">
              Si vous avez des codes-barres, vous pouvez les utiliser. Sinon, vous faites simple.
            </p>
          </Card>
        </section>

        {/* EXEMPLES */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">
              Exemples concrets (avant inscription)
            </h2>
            <ul className="space-y-3 text-slate-200 text-sm">
              <li>
                • Restaurant : inventaire mensuel + pertes (casse / DLC) si vous l’activez.
              </li>
              <li>
                • Boutique : produits + variantes (si besoin), inventaire simple.
              </li>
              <li>
                • Bar : suivi des bouteilles, unités cl/L, pertes optionnelles.
              </li>
              <li>
                • Pharmacie : lots & dates de péremption (optionnel), structure propre.
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">
              Exports (CSV / Excel)
            </h2>
            <p className="text-slate-200 text-sm">
              Oui : export CSV ou Excel, par service ou global. Vous pouvez ensuite transmettre à votre comptable ou à vos équipes.
            </p>
            <ul className="space-y-2 text-slate-200 text-sm">
              <li>• Export par mois</li>
              <li>• Export par service (ex : bar / cuisine)</li>
              <li>• Fichiers lisibles et exploitables</li>
            </ul>
          </Card>
        </section>

        {/* GUIDES + CONTACT */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">Démarrer en 2 minutes</h2>
            <ol className="space-y-3 text-slate-200 text-sm list-decimal list-inside">
              <li>
                Choisissez votre métier sur{" "}
                <Link className="font-semibold text-blue-300 hover:text-blue-200" to="/metiers">
                  /metiers
                </Link>
                .
              </li>
              <li>
                Comprenez le fonctionnement sur{" "}
                <Link className="font-semibold text-blue-300 hover:text-blue-200" to="/comment-ca-marche">
                  /comment-ca-marche
                </Link>
                .
              </li>
              <li>
                Créez votre espace sur{" "}
                <Link className="font-semibold text-blue-300 hover:text-blue-200" to="/register">
                  /register
                </Link>
                .
              </li>
            </ol>
          </Card>

          <Card className="p-6 border-white/10 bg-white/5 space-y-3">
            <h2 className="text-xl font-semibold text-white">Nous contacter</h2>
            <p className="text-slate-200 text-sm">
              Email support :{" "}
              <a className="font-semibold text-blue-300 hover:text-blue-200" href={`mailto:${emailSupport}`}>
                {emailSupport}
              </a>
            </p>
            <p className="text-slate-200 text-sm">Réponse sous 24h ouvrées.</p>

            <div className="pt-2">
              <Button as="a" href={mailto} variant="secondary" className="w-full sm:w-auto">
                Écrire au support
              </Button>
            </div>

            <div className="text-xs text-white/60">
              Astuce : indiquez votre activité + ce que vous voulez gérer (produits, inventaires, exports).
            </div>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}