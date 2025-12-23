import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Legal() {
  return (
    <div className="min-h-full mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Mentions légales | StockScan</title>
        <meta
          name="description"
          content="Mentions légales du service StockScan."
        />
      </Helmet>

      <div className="rounded-[28px] bg-white border border-slate-200 shadow-soft p-6 space-y-6">
        <div className="text-3xl font-black tracking-tight">
          Mentions légales
        </div>

        <div className="space-y-4 text-slate-600 text-sm">
          {/* Éditeur */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Éditeur du site
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Nom : SECK Alioune</li>
              <li>Nom commercial : StockScan</li>
              <li>Statut : Entrepreneur individuel (micro-entrepreneur)</li>
              <li>SIREN : 995 288 438</li>
              <li>Code APE : 6201Z – Programmation informatique</li>
              <li>Adresse : 1 Place Guy Ropartz, 29000 Quimper, France</li>
              <li>
                Email :{" "}
                <a
                  href="mailto:alioune.seck@stockscan.app"
                  className="font-semibold text-slate-900"
                >
                  alioune.seck@stockscan.app
                </a>
              </li>
            </ul>
          </section>

          {/* Directeur de publication */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Directeur de la publication
            </h2>
            <p>
              Le directeur de la publication est SECK Alioune, en qualité
              d’éditeur du site.
            </p>
          </section>

          {/* Hébergement */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Hébergement
            </h2>
            <p>Le site et l’application StockScan sont hébergés par :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-slate-900">Vercel Inc.</span>
                <br />
                440 N Barranca Ave #4133<br />
                Covina, CA 91723<br />
                États-Unis
              </li>
              <li>
                <span className="font-semibold text-slate-900">Render Services, Inc.</span>
                <br />
                525 Brannan Street, Suite 300<br />
                San Francisco, CA 94107<br />
                États-Unis
              </li>
            </ul>
          </section>

          {/* Responsabilité */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Responsabilité
            </h2>
            <p>
              L’éditeur met tout en œuvre pour assurer l’exactitude et la mise à
              jour des informations diffusées sur StockScan. Toutefois, il ne
              saurait être tenu responsable des erreurs, omissions ou des
              conséquences liées à l’utilisation du service.
            </p>
            <p>
              Le service est fourni à titre informatif et opérationnel, sans
              garantie d’exhaustivité ou d’absence d’erreurs. L’utilisateur
              demeure seul responsable de l’usage qu’il fait du service et des
              décisions prises à partir des informations fournies.
            </p>
          </section>

          {/* Propriété intellectuelle */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Propriété intellectuelle
            </h2>
            <p>
              L’ensemble du site, de l’application, des fonctionnalités, du code
              source, de l’interface, des textes, logos et éléments graphiques
              constituant StockScan est protégé par le droit de la propriété
              intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification ou exploitation,
              totale ou partielle, sans autorisation préalable, est interdite.
            </p>
          </section>

          {/* Données personnelles */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Données personnelles
            </h2>
            <p>
              Les modalités de collecte et de traitement des données personnelles
              sont détaillées dans la{" "}
              <Link
                to="/privacy"
                className="font-semibold text-slate-900 underline"
              >
                Politique de confidentialité
              </Link>
              .
            </p>
          </section>

          {/* Droit applicable */}
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Droit applicable
            </h2>
            <p>
              Les présentes mentions légales sont soumises au droit français. En
              cas de litige, et à défaut de résolution amiable, les tribunaux
              compétents seront déterminés conformément aux règles de droit
              commun.
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