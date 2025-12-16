import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Divider from "../ui/Divider";
import Button from "../ui/Button";
import { Helmet } from "react-helmet-async";

export default function Support() {
  return (
    <PageTransition>
      <Helmet>
        <title>Support | StockScan</title>
        <meta name="description" content="Support StockScan : aide, FAQ, contact." />
      </Helmet>
      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">Support</div>
          <div className="text-2xl font-black tracking-tight">FAQ & Contact</div>
          <div className="text-slate-600 text-sm">
            Questions fréquentes et moyens de nous contacter.
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <div className="font-semibold text-slate-900">FAQ express</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2">
              <li>• Comment ajouter un produit sans code-barres ? → onglet Produits, laissez “Code-barres” vide.</li>
              <li>• Comment changer de service ? → menu en haut (sélecteur service).</li>
              <li>• Comment exporter ? → page Exports, choisissez CSV/Excel.</li>
            </ul>
          </div>
          <Divider />
          <div className="space-y-2">
            <div className="font-semibold text-slate-900">Nous contacter</div>
            <div className="text-sm text-slate-600">Email : support@stockscan.app</div>
            <div className="text-sm text-slate-600">Réponse sous 24h ouvrées.</div>
            <Button variant="secondary" className="mt-2">Ouvrir un ticket</Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
