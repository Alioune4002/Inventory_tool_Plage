import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-full mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Conditions générales d’utilisation | StockScan</title>
        <meta name="description" content="CGU StockScan : conditions générales d’utilisation." />
      </Helmet>

      <div className="rounded-[28px] bg-white border border-slate-200 shadow-soft p-6 space-y-4">
        <div className="text-3xl font-black tracking-tight">Conditions Générales d’Utilisation</div>
        <p className="text-slate-600">
          En utilisant StockScan, vous acceptez ces conditions. L’outil fournit une gestion d’inventaire et d’exports ; vous
          restez responsable des données saisies et de leur exactitude.
        </p>
        <ol className="space-y-3 text-slate-600 text-sm list-decimal list-inside">
          <li>Usage : StockScan est destiné aux commerces (alimentaire/non-alimentaire) pour gérer inventaires, produits, exports.</li>
          <li>Données : vous gardez la propriété des données saisies. Nous les traitons pour fournir le service.</li>
          <li>Sécurité : ne partagez pas vos identifiants. En cas de suspicion d’usage frauduleux, changez votre mot de passe.</li>
          <li>Résiliation : vous pouvez supprimer votre compte à tout moment (sur demande). Les données associées seront supprimées sous réserve des obligations légales.</li>
          <li>Support : contactez support@stockscan.app pour assistance.</li>
        </ol>
        <div className="mt-2 text-sm">
          <Link className="text-slate-600 hover:text-slate-900" to="/">← Retour</Link>
        </div>
      </div>
    </div>
  );
}
