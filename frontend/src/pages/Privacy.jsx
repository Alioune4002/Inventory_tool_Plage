import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Privacy() {
  const lastUpdated = "22 décembre 2025";

  return (
    <div className="min-h-full mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Politique de confidentialité | StockScan</title>
        <meta
          name="description"
          content="Politique de confidentialité StockScan : données personnelles, sécurité, droits RGPD."
        />
      </Helmet>

      <div className="rounded-[28px] bg-white border border-slate-200 shadow-soft p-6 space-y-6">
        <div className="space-y-2">
          <div className="text-3xl font-black tracking-tight">
            Politique de confidentialité
          </div>
          <p className="text-sm text-slate-500">
            Dernière mise à jour : {lastUpdated}
          </p>
        </div>

        <p className="text-slate-600">
          La présente politique de confidentialité a pour objet d’informer les
          utilisateurs de StockScan sur la manière dont leurs données
          personnelles sont collectées, utilisées, protégées et sur les droits
          dont ils disposent conformément au Règlement Général sur la Protection
          des Données (RGPD).
        </p>

        <div className="space-y-4 text-slate-600 text-sm">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              1. Responsable du traitement
            </h2>
            <p>
              Le responsable du traitement est :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nom : SECK Alioune</li>
              <li>Nom commercial : StockScan</li>
              <li>Statut : Entrepreneur individuel</li>
              <li>Email :{" "}
                <a
                  href="mailto:contact@stockscan.app"
                  className="font-semibold text-slate-900"
                >
                  contact@stockscan.app
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              2. Données personnelles collectées
            </h2>
            <p>
              Nous collectons uniquement les données strictement nécessaires au
              fonctionnement du service :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Données de compte : adresse email, identifiant, mot de passe chiffré.</li>
              <li>Données professionnelles : nom du commerce, services, produits, inventaires.</li>
              <li>Données techniques : adresse IP, logs de connexion, navigateur, appareil.</li>
              <li>Données de support : échanges avec le support client.</li>
            </ul>
            <p>
              StockScan ne collecte aucune donnée sensible au sens du RGPD
              (origine ethnique, opinions, santé, etc.).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              3. Finalités du traitement
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Fourniture et fonctionnement du service de gestion d’inventaire.</li>
              <li>Authentification et sécurisation des comptes.</li>
              <li>Support utilisateur et assistance technique.</li>
              <li>Amélioration continue du service et de l’expérience utilisateur.</li>
              <li>Respect des obligations légales et réglementaires.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              4. Base légale du traitement
            </h2>
            <p>
              Les traitements sont fondés sur :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>L’exécution du contrat (fourniture du service).</li>
              <li>L’intérêt légitime de l’éditeur (sécurité, amélioration du service).</li>
              <li>Le respect d’obligations légales.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              5. Conservation des données
            </h2>
            <p>
              Les données sont conservées :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tant que le compte utilisateur est actif.</li>
              <li>Après suppression du compte, uniquement pour la durée requise par la loi.</li>
              <li>Les sauvegardes peuvent subsister temporairement sans être accessibles.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              6. Destinataires des données
            </h2>
            <p>
              Les données sont accessibles uniquement :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>À l’éditeur de StockScan.</li>
              <li>Aux prestataires techniques nécessaires (hébergement, emailing, paiement).</li>
            </ul>
            <p>
              Aucune donnée n’est vendue ni cédée à des tiers à des fins commerciales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              7. Sécurité des données
            </h2>
            <p>
              Des mesures techniques et organisationnelles raisonnables sont mises
              en œuvre pour protéger les données contre l’accès non autorisé, la
              perte, l’altération ou la divulgation.
            </p>
            <p>
              Toutefois, aucun système n’étant totalement sécurisé, l’éditeur ne
              peut garantir une sécurité absolue.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              8. Droits des utilisateurs
            </h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Droit d’accès à vos données.</li>
              <li>Droit de rectification.</li>
              <li>Droit à l’effacement (« droit à l’oubli »).</li>
              <li>Droit à la limitation du traitement.</li>
              <li>Droit d’opposition pour motifs légitimes.</li>
            </ul>
            <p>
              Pour exercer vos droits, contactez :
              {" "}
              <a
                href="mailto:support@stockscan.app"
                className="font-semibold text-slate-900"
              >
                support@stockscan.app
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              9. Cookies et traceurs
            </h2>
            <p>
              StockScan utilise uniquement des cookies strictement nécessaires au
              fonctionnement du service (authentification, sécurité). Aucun cookie
              publicitaire n’est utilisé à ce jour.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              10. Modification de la politique
            </h2>
            <p>
              La présente politique peut être modifiée à tout moment pour tenir
              compte d’évolutions légales, techniques ou fonctionnelles. La date
              de mise à jour sera indiquée.
            </p>
          </section>
        </div>

        <div className="mt-2 text-sm">
          <Link className="text-slate-600 hover:text-slate-900" to="/">
            ← Retour
          </Link>
        </div>
      </div>
    </div>
  );
}
