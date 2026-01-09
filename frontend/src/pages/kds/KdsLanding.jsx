import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChefHat, ClipboardList, Bell, Sparkles, Timer } from "lucide-react";

import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { useAuth } from "../../app/AuthProvider";
import kdsLogo from "../../assets/kds-logo.png";
import { trackPublicVisit } from "../../lib/trackVisit";

const KdsLogo = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black">
        KDS
      </div>
    );
  }
  return (
    <img
      src={kdsLogo}
      alt="Logo KDS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const KDS_FAQ = [
  {
    q: "Le KDS est-il gratuit ?",
    a: "Oui. Le KDS est gratuit, sans abonnement et sans carte bancaire. Vous pouvez commencer immédiatement.",
  },
  {
    q: "Faut-il un matériel spécifique ?",
    a: "Non. Une tablette ou un ordinateur suffit. L’interface est pensée pour l’écran cuisine.",
  },
  {
    q: "Est-ce adapté à un bar ?",
    a: "Oui si vous servez à table. Le KDS centralise les commandes et fluidifie la préparation.",
  },
  {
    q: "Puis-je relier le KDS à ma caisse ?",
    a: "Oui. Les commandes restent liées à l’encaissement dans StockScan POS.",
  },
];

const SEO_PARAGRAPHS = [
  "StockScan KDS est un logiciel de prise de commande restaurant gratuit conçu pour la salle et la cuisine. Les commandes partent de la tablette serveur et arrivent immédiatement sur l’écran cuisine. Vous réduisez les aller‑retours, vous évitez les oublis et vous gagnez du temps à chaque service.",
  "Cet écran cuisine restaurant est pensé pour être lisible, stable et rapide. Les statuts sont simples : à préparer, prêt, servi. Le KDS gratuit organise les commandes par statut et met en avant les notes (sans oignons, cuisson, allergies). Résultat : une équipe plus alignée et moins d’erreurs.",
  "Le KDS s’adresse aux restaurants, bars avec service à table, food trucks, boulangeries avec service sur place et équipes de service à table en général. Si votre activité n’est pas orientée service, le POS gratuit suffit. Dans tous les cas, vous pouvez activer StockScan complet plus tard, sans changer d’outil.",
  "En choisissant ce logiciel de prise de commande tablette, vous bénéficiez d’une solution simple et professionnelle, sans carte bancaire. L’interface reste légère, même en période de rush. Le KDS fonctionne seul et se synchronise avec la caisse quand vous en avez besoin.",
];

const HOW_IT_WORKS = [
  "Créez un compte gratuit en moins de 2 minutes.",
  "Prenez les commandes en salle, sur mobile ou tablette.",
  "Les commandes arrivent en cuisine en temps réel.",
  "Suivez l’avancement jusqu’au service.",
];

const COMPATIBLE = [
  "Restaurants",
  "Bars avec service à table",
  "Food trucks",
  "Boulangeries avec service sur place",
  "Service à table en général",
];

export default function KdsLanding() {
  const { isAuthed } = useAuth();
  const next = encodeURIComponent("/kds/app");
  const primaryHref = isAuthed ? "/kds/app" : `/login?next=${next}`;
  const secondaryHref = `/register?next=${next}`;

  useEffect(() => {
    trackPublicVisit("kds");
  }, []);

  return (
    <div className="public-shell min-h-screen">
      <Helmet>
        <title>Logiciel de prise de commande restaurant gratuit | StockScan KDS</title>
        <meta
          name="description"
          content="Logiciel de prise de commande restaurant gratuit : écran cuisine clair, commandes en temps réel, service fluide. KDS optimisé tablette et mobile."
        />
        <link rel="canonical" href="https://stockscan.app/kds" />
      </Helmet>

      <header className="mx-auto w-full max-w-6xl px-4 pt-10 pb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <KdsLogo />
          <div>
            <div className="text-lg font-black text-white">StockScan KDS</div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Cuisine gratuite</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button as={Link} to={primaryHref} size="sm">
            Ouvrir le KDS
          </Button>
          <Button as={Link} to={secondaryHref} variant="secondary" size="sm">
            Créer un compte gratuit
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 space-y-12 text-white">
        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
              Logiciel de prise de commande restaurant gratuit
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight">
              Logiciel de prise de commande restaurant gratuit
            </h1>
            <p className="text-lg text-slate-200">
              Réduisez vos pas : la commande arrive directement en cuisine. Un KDS gratuit, clair et pensé pour la
              tablette, sans abonnement ni carte bancaire.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir le KDS
              </Button>
              <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
                Créer un compte gratuit
              </Button>
            </div>
            <div className="text-sm text-slate-300">Outil gratuit propulsé par la technologie StockScan.</div>
          </div>

          <Card className="p-6 space-y-4">
            <div className="text-sm font-semibold text-white/70">Pourquoi vos équipes l’adorent</div>
            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-blue-300" />
                <span>Commandes centralisées et lisibles sur tablette cuisine.</span>
              </div>
              <div className="flex items-start gap-3">
                <ChefHat className="h-5 w-5 text-blue-300" />
                <span>Statuts clairs pour éviter les oublis et fluidifier le service.</span>
              </div>
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-300" />
                <span>Priorisez, préparez, servez sans perdre le fil.</span>
              </div>
              <div className="flex items-start gap-3">
                <Timer className="h-5 w-5 text-blue-300" />
                <span>Meilleure cadence et moins d’erreurs pendant le rush.</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <Sparkles className="h-4 w-4 text-amber-300" />
              KDS gratuit, sans carte bancaire
            </div>
            <p className="text-sm text-slate-200">
              L’écran cuisine est gratuit, sans engagement. Vous pouvez commencer avec une seule tablette et
              étendre l’équipe quand vous le souhaitez.
            </p>
          </Card>
          <Card className="p-6 space-y-3">
            <div className="text-sm font-semibold text-white/80">Synchronisation caisse & stock</div>
            <p className="text-sm text-slate-200">
              Les commandes restent reliées à l’encaissement, et la synchronisation stock réel est prête quand vous
              activez StockScan complet.
            </p>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black">Pourquoi choisir ce KDS gratuit ?</h2>
          {SEO_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 18)} className="text-sm text-slate-200 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-black">Comment ça marche</h3>
            <ol className="space-y-3 text-sm text-slate-200 list-decimal list-inside">
              {HOW_IT_WORKS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-black">À qui s’adresse le KDS</h3>
            <div className="text-sm text-slate-200">
              <div className="text-sm font-semibold text-white">Compatible</div>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {COMPATIBLE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          {KDS_FAQ.map((item) => (
            <Card key={item.q} className="p-5 space-y-2">
              <div className="text-sm font-semibold text-white">{item.q}</div>
              <p className="text-sm text-slate-200">{item.a}</p>
            </Card>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center space-y-3">
          <div className="text-sm uppercase tracking-[0.2em] text-white/70">Prêt pour le service</div>
          <h2 className="text-2xl md:text-3xl font-black">Ouvrez votre KDS gratuit</h2>
          <p className="text-sm text-slate-200">
            Un seul compte pour POS, KDS et StockScan. Commencez gratuitement et activez le stock avancé quand
            vous en avez besoin.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button as={Link} to={primaryHref} size="lg">
              Ouvrir le KDS
            </Button>
            <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
              Créer un compte gratuit
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-xs text-white/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span>Outil gratuit propulsé par la technologie StockScan.</span>
          <span>KDS gratuit — sans abonnement — sans carte bancaire — sans limite cachée.</span>
        </div>
      </footer>
    </div>
  );
}
