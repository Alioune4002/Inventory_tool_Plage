import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-full mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Politique de confidentialité | StockScan</title>
        <meta name="description" content="Confidentialité StockScan : données, cookies, sécurité." />
      </Helmet>

      <div className="rounded-[28px] bg-white border border-slate-200 shadow-soft p-6 space-y-4">
        <div className="text-3xl font-black tracking-tight">Politique de confidentialité</div>
        <p className="text-slate-600">
          Nous respectons vos données. Cette politique décrit quelles données sont collectées, pourquoi, et comment exercer vos droits.
        </p>
        <ol className="space-y-3 text-slate-600 text-sm list-decimal list-inside">
          <li>Données collectées : compte (email, commerce), inventaires/produits saisis, logs techniques (IP, user-agent).</li>
          <li>Finalités : fournir l’outil d’inventaire, améliorer le service, support client.</li>
          <li>Conservation : les données sont conservées tant que le compte est actif, puis supprimées sur demande.</li>
          <li>Droits : accès, rectification, suppression. Contactez support@stockscan.app.</li>
          <li>Sécurité : accès protégé par authentification, stockage sécurisé.</li>
        </ol>
        <div className="mt-2 text-sm">
          <Link className="text-slate-600 hover:text-slate-900" to="/">← Retour</Link>
        </div>
      </div>
    </div>
  );
}
