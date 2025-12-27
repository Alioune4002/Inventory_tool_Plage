import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Divider from "../ui/Divider";
import Button from "../ui/Button";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import useEntitlements from "../app/useEntitlements";
import { getWording } from "../lib/labels";
import { Link } from "react-router-dom";
import AIAssistantPanel from "../components/AIAssistantPanel";

export default function Support() {
  const { tenant, currentService, serviceProfile } = useAuth();
  const { data: entitlements } = useEntitlements();
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const nowMonth = new Date().toISOString().slice(0, 7);
  const supportServiceId = currentService?.id || "all";

  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const serviceDomain = serviceType === "retail_general" ? "general" : tenant?.domain;
  const wording = getWording(serviceType, serviceDomain);

  const itemLabel = wording.itemLabel || "élément";
  const identifierLabel = wording.identifierLabel || "identifiant";

  const emailSupport = "support@stockscan.app";
  const emailSubject = encodeURIComponent("Support StockScan — Demande d’aide");
  const emailBody = encodeURIComponent(
    `Bonjour,\n\nJ’ai besoin d’aide sur StockScan.\n\n• Problème : \n• Où (page) : \n• Ce que je voulais faire : \n• Message d’erreur (si possible) : \n\nMerci !\n`
  );
  const mailto = `mailto:${emailSupport}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <PageTransition>
      <Helmet>
        <title>Support | StockScan</title>
        <meta
          name="description"
          content="Support StockScan : réponses rapides, bonnes pratiques, contact et assistance."
        />
      </Helmet>

      <div className="space-y-4">
        {/* Header */}
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">Support</div>
          <div className="text-2xl font-black tracking-tight">Aide & Contact</div>
          <div className="text-slate-600 text-sm">
            Une question ? Un blocage ? Voici les réponses rapides, puis le moyen le plus simple de nous contacter.
          </div>
        </Card>

        {/* FAQ + Contact */}
        <Card className="p-6 space-y-6">
          {/* FAQ */}
          <div className="space-y-3">
            <div className="font-semibold text-slate-900">Réponses rapides</div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Ajouter un {itemLabel.toLowerCase()} sans {identifierLabel.toLowerCase()}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Allez dans <span className="font-semibold">Produits</span>, puis créez l’élément.  
                  Si vous n’avez pas de code-barres / identifiant, vous pouvez le laisser vide.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Changer de service</div>
                <div className="mt-1 text-sm text-slate-600">
                  Utilisez le <span className="font-semibold">sélecteur de service</span> en haut de l’application
                  (utile si vous avez bar + cuisine, ou plusieurs activités).
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Exporter vos données</div>
                <div className="mt-1 text-sm text-slate-600">
                  Ouvrez <span className="font-semibold">Exports</span>, choisissez le format{" "}
                  <span className="font-semibold">CSV</span> ou <span className="font-semibold">Excel</span>,
                  puis téléchargez.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Un bug ? Le meilleur réflexe</div>
                <div className="mt-1 text-sm text-slate-600">
                  Faites une capture d’écran + notez la page où vous étiez. Ça nous permet de corriger beaucoup plus vite.
                </div>
              </div>
            </div>
          </div>

          <Divider />

          {/* Contact */}
          <div className="space-y-3">
            <div className="font-semibold text-slate-900">Nous contacter</div>

            <div className="text-sm text-slate-600">
              Email :{" "}
              <a className="font-semibold text-slate-900 underline" href={`mailto:${emailSupport}`}>
                {emailSupport}
              </a>
            </div>

            <div className="text-sm text-slate-600">
              Délai moyen : <span className="font-semibold text-slate-900">24h ouvrées</span>.
              (Plus rapide si vous indiquez : page concernée + capture + description.)
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button as="a" href={mailto} variant="primary" className="w-full sm:w-auto">
                Envoyer un message au support
              </Button>

              <Button
                as={Link}
                to="/support"
                variant="secondary"
                className="w-full sm:w-auto"
                title="Accéder à la page support publique"
              >
                Ouvrir la page support publique
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              Conseil : pour une demande urgente, commencez votre message par <span className="font-semibold">[URGENT]</span>.
            </div>
          </div>
        </Card>

        {aiAllowed ? (
          <AIAssistantPanel month={nowMonth} serviceId={supportServiceId} scope="support" allowNoService />
        ) : null}
      </div>
    </PageTransition>
  );
}
