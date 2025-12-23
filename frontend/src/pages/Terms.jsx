import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Terms() {
  const lastUpdated = "22 décembre 2025";

  return (
    <div className="min-h-full mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Conditions générales d’utilisation | StockScan</title>
        <meta
          name="description"
          content="CGU StockScan : conditions générales d’utilisation du service de gestion d’inventaire."
        />
      </Helmet>

      <div className="rounded-[28px] bg-white border border-slate-200 shadow-soft p-6 space-y-6">
        <div className="space-y-2">
          <div className="text-3xl font-black tracking-tight">Conditions Générales d’Utilisation</div>
          <p className="text-sm text-slate-500">Dernière mise à jour : {lastUpdated}</p>
        </div>

        <p className="text-slate-600">
          Les présentes Conditions Générales d’Utilisation (les « CGU ») encadrent l’accès et l’utilisation de StockScan (le
          « Service »). En créant un compte, en accédant au Service ou en l’utilisant, vous reconnaissez avoir lu et accepté
          les CGU.
        </p>

        <div className="space-y-4 text-slate-600 text-sm">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Objet et description du Service</h2>
            <p>
              StockScan est un logiciel en ligne (SaaS) permettant notamment la gestion d’inventaires, de produits, de
              services/établissements, ainsi que l’export de données (CSV/XLSX) et des fonctionnalités associées. Le Service
              peut évoluer (ajout, modification, suppression de fonctionnalités) afin d’améliorer l’expérience ou la sécurité.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Accès au Service et compte utilisateur</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-slate-900">Création de compte :</span> l’accès nécessite un compte. Vous
                vous engagez à fournir des informations exactes et à jour.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Identifiants :</span> vous êtes responsable de la
                confidentialité de vos identifiants et de toute activité réalisée depuis votre compte.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Sécurité :</span> en cas de suspicion d’accès non autorisé,
                vous devez changer votre mot de passe et nous contacter sans délai.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Utilisation autorisée et restrictions</h2>
            <p>Vous vous engagez à utiliser StockScan de manière licite, loyale et conforme à sa finalité.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ne pas détourner le Service, tenter de contourner des limites techniques, ou perturber son fonctionnement.</li>
              <li>Ne pas utiliser le Service pour des activités illégales, frauduleuses, ou portant atteinte à des tiers.</li>
              <li>
                Ne pas tenter d’extraire le code source, de rétroconcevoir, de désassembler ou d’exploiter le Service en dehors
                de l’usage prévu, sauf droit légal impératif.
              </li>
              <li>
                Ne pas introduire de contenus malveillants (virus, scripts, attaques) ni tenter un accès non autorisé à des
                comptes ou données.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Données utilisateur et responsabilité des contenus</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-slate-900">Propriété :</span> vous restez propriétaire des données que vous
                saisissez (produits, inventaires, quantités, commentaires, etc.).
              </li>
              <li>
                <span className="font-semibold text-slate-900">Exactitude :</span> vous êtes seul responsable de l’exactitude,
                de la mise à jour, de la qualité et de la légalité des données saisies.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Traitement :</span> nous traitons vos données pour fournir le
                Service (stockage, calculs, exports, affichage). L’accès est limité à ce qui est nécessaire au fonctionnement,
                au support et à la sécurité.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Sauvegardes :</span> nous mettons en œuvre des mesures
                raisonnables de sauvegarde et de sécurité, sans garantie d’absence totale de perte. Nous vous recommandons
                d’exporter régulièrement vos données et de conserver vos propres sauvegardes.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">5. Disponibilité, maintenance et évolution</h2>
            <p>
              Le Service est fourni « en l’état » et peut être temporairement indisponible (maintenance, mises à jour, incident
              technique, contraintes d’hébergement, force majeure). Nous nous efforçons d’assurer une continuité raisonnable
              sans garantir une disponibilité ininterrompue.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">6. Support</h2>
            <p>
              Pour toute question, vous pouvez contacter :{" "}
              <a className="font-semibold text-slate-900" href="mailto:support@stockscan.app">
                support@stockscan.app
              </a>
              . Le support est fourni sur la base d’efforts raisonnables, sans engagement de délai ferme, notamment en période
              de forte demande.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">7. Offres, paiement et abonnements (si applicable)</h2>
            <p>
              Certaines fonctionnalités peuvent être gratuites, d’autres payantes (abonnements). Les conditions tarifaires et
              périmètres fonctionnels sont indiqués au moment de la souscription. Les paiements peuvent être traités par un
              prestataire (par ex. Stripe) : vous devez respecter ses conditions en plus des présentes CGU.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Les montants facturés, périodes, renouvellements et modalités d’annulation sont présentés avant paiement.</li>
              <li>En cas d’échec de paiement, l’accès à des fonctionnalités peut être limité jusqu’à régularisation.</li>
              <li>
                Sauf mention contraire, les sommes payées ne sont pas remboursables pour une période déjà commencée (notamment
                en cas de résiliation anticipée), dans les limites prévues par la loi.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">8. Propriété intellectuelle</h2>
            <p>
              Le Service, son code, son interface, ses éléments graphiques, sa marque, ses textes et ses bases de données sont
              protégés et demeurent la propriété exclusive de l’éditeur ou de ses concédants. Toute reproduction, extraction,
              adaptation ou exploitation non autorisée est interdite.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">9. Limitation de responsabilité</h2>
            <p className="font-semibold text-slate-900">
              Important : StockScan est un outil d’aide. Vous restez responsable de vos décisions, de vos stocks, de vos
              achats/ventes et de vos obligations légales/comptables.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Le Service est fourni sans garantie de résultat, de performance ou d’adéquation parfaite à un besoin
                particulier.
              </li>
              <li>
                L’éditeur ne pourra être tenu responsable des dommages indirects (perte d’exploitation, perte de chiffre
                d’affaires, perte de données, perte de chance, préjudice commercial, etc.).
              </li>
              <li>
                En tout état de cause, dans la mesure permise par la loi, la responsabilité totale de l’éditeur (toutes causes
                confondues) est limitée au montant effectivement payé par l’utilisateur au titre du Service au cours des douze
                (12) derniers mois, ou à défaut à 0 € pour une offre gratuite.
              </li>
            </ul>
            <p>
              Aucune clause des CGU ne limite la responsabilité en cas de dol, faute lourde, ou lorsque la loi l’interdit.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">10. Suspension, résiliation, suppression du compte</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-slate-900">Par l’utilisateur :</span> vous pouvez demander la suppression
                de votre compte. Certaines données peuvent être conservées si une obligation légale l’exige.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Par l’éditeur :</span> nous pouvons suspendre ou résilier un
                compte en cas de violation des CGU, risque de sécurité, fraude, ou atteinte à l’intégrité du Service.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Fermeture du Service :</span> en cas d’arrêt du Service, nous
                tenterons, dans la mesure du possible, d’en informer les utilisateurs et de permettre l’export des données
                avant fermeture, sans garantie absolue.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">11. Données personnelles</h2>
            <p>
              La gestion des données personnelles est détaillée dans la politique de confidentialité (si disponible). À défaut,
              les données nécessaires à la fourniture du Service (compte, authentification, support) sont traitées à cette
              seule fin, avec des mesures raisonnables de sécurité.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">12. Modifications des CGU</h2>
            <p>
              Nous pouvons modifier les CGU afin de tenir compte d’évolutions du Service, de la réglementation ou de la
              sécurité. En cas de changement important, nous tenterons de vous en informer. L’utilisation continue du Service
              après modification vaut acceptation des CGU mises à jour.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">13. Droit applicable et juridiction compétente</h2>
            <p>
              Les CGU sont soumises au droit français. En cas de litige et à défaut de résolution amiable, les tribunaux
              compétents seront déterminés selon les règles de droit commun.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">14. Contact</h2>
            <p>
              Pour toute question relative aux CGU :{" "}
              <a className="font-semibold text-slate-900" href="mailto:contact@stockscan.app">
                contact@stockscan.app
              </a>{" "}
              (ou{" "}
              <a className="font-semibold text-slate-900" href="mailto:support@stockscan.app">
                support@stockscan.app
              </a>
              ).
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