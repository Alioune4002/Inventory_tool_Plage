
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ChefHat,
  ClipboardList,
  Bell,
  Sparkles,
  Timer,
  TabletSmartphone,
  Zap,
  CheckCircle2,
} from "lucide-react";

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
      alt="StockScan KDS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const KDS_FAQ = [
  {
    q: "Le KDS est-il gratuit ?",
    a: "Oui. StockScan KDS est gratuit : pas d’abonnement, pas de carte bancaire. Vous pouvez commencer immédiatement.",
  },
  {
    q: "Faut-il un matériel spécifique ?",
    a: "Non. Une tablette ou un ordinateur suffit. L’interface est pensée pour l’écran cuisine.",
  },
  {
    q: "Est-ce adapté à un bar ?",
    a: "Oui si vous avez du service à table. Le KDS centralise les commandes et fluidifie la préparation.",
  },
  {
    q: "Puis-je relier le KDS à ma caisse ?",
    a: "Oui. Les commandes restent reliées à l’encaissement dans StockScan POS.",
  },
];

const SEO_PARAGRAPHS = [
  "StockScan KDS est un logiciel de prise de commande restaurant gratuit conçu pour la salle et la cuisine. Les commandes partent de la tablette et arrivent immédiatement sur l’écran cuisine. Vous réduisez les aller-retours, vous évitez les oublis et vous gagnez du temps à chaque service.",
  "Cet écran cuisine restaurant est pensé pour être lisible, stable et rapide. Les statuts sont simples : à préparer, prêt, servi. Le KDS gratuit organise les commandes et met en avant les notes (cuisson, allergies, sans ingrédients). Résultat : une équipe alignée et moins d’erreurs.",
  "Le KDS s’adresse aux restaurants, bars avec service à table, food trucks, boulangeries avec service sur place et équipes de service à table. Si votre activité n’est pas orientée service, la caisse gratuite suffit. Dans tous les cas, vous pouvez activer StockScan complet plus tard, sans changer d’outil.",
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

  const next = useMemo(() => encodeURIComponent("/kds/app"), []);
  const primaryHref = isAuthed ? "/kds/app" : `/login?next=${next}`;
  const secondaryHref = `/register?next=${next}`;

  useEffect(() => {
    trackPublicVisit("kds");
  }, []);

  const glassCard =
    "bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]";

  return (
    <div className="public-shell min-h-screen text-white overflow-hidden">
      <Helmet>
        <title>Logiciel de prise de commande restaurant gratuit | StockScan KDS</title>
        <meta
          name="description"
          content="Logiciel de prise de commande restaurant gratuit : écran cuisine clair, commandes en temps réel, statuts simples. Optimisé tablette et mobile. Sans abonnement, sans carte bancaire."
        />
        <link rel="canonical" href="https://stockscan.app/kds" />
      </Helmet>

      {/* Fond “verre” + halos */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-24 -left-24 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
      </div>

      <header className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-16 space-y-12">
        {/* HERO */}
        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
              Logiciel de prise de commande restaurant gratuit
            </div>

            <h1 className="text-3xl md:text-5xl font-black leading-tight">
              Logiciel de prise de commande restaurant gratuit, pour la salle et la cuisine
            </h1>

            <p className="text-lg text-slate-200 leading-relaxed">
              Réduisez les aller-retours : la commande arrive directement sur l’écran cuisine.
              Un outil gratuit, lisible et pensé pour la <strong className="text-white">tablette</strong>.
              <br />
              <span className="text-white font-semibold">
                Sans abonnement. Sans carte bancaire. Sans matériel spécial.
              </span>
            </p>

            <div className="flex flex-wrap gap-3">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir le KDS
              </Button>
              <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
                Créer un compte gratuit
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Gratuit, sans engagement
              </span>
              <span className="inline-flex items-center gap-2">
                <TabletSmartphone className="h-4 w-4" />
                Tablette, mobile, ordinateur
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Temps réel en cuisine
              </span>
            </div>
          </div>

          <Card className={`p-6 space-y-4 ${glassCard}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/80">Pourquoi vos équipes l’adorent</div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Gratuit
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-blue-300" />
                <span>Commandes centralisées et lisibles sur l’écran cuisine.</span>
              </div>
              <div className="flex items-start gap-3">
                <ChefHat className="h-5 w-5 text-blue-300" />
                <span>Statuts simples : à préparer, prêt, servi.</span>
              </div>
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-300" />
                <span>Moins d’oublis, moins d’erreurs, plus de fluidité.</span>
              </div>
              <div className="flex items-start gap-3">
                <Timer className="h-5 w-5 text-blue-300" />
                <span>Meilleure cadence pendant le rush, sans perdre le fil.</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              Outil gratuit : vous démarrez avec une tablette, puis vous étendez quand vous le souhaitez.
            </div>
          </Card>
        </section>

        {/* “cheval de Troyes” : gratuit + pourquoi choisir */}
        <section className="grid md:grid-cols-2 gap-6">
          <Card className={`p-6 space-y-3 ${glassCard}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Commencez gratuitement, dès aujourd’hui
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              StockScan KDS est gratuit : pas d’abonnement, pas de carte bancaire. Vous pouvez tester en condition
              réelle et constater l’impact sur la cadence et l’organisation.
            </p>
          </Card>

          <Card className={`p-6 space-y-3 ${glassCard}`}>
            <div className="text-sm font-semibold text-white/90">Pourquoi choisir cet outil</div>
            <p className="text-sm text-slate-200 leading-relaxed">
              Conçu pour être lisible et stable : les commandes sont regroupées, les statuts sont évidents, et les
              notes restent visibles. Vous évitez les confusions et vous gagnez du temps à chaque service.
            </p>
          </Card>
        </section>

        {/* SEO +++++ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black">
            Écran cuisine restaurant gratuit : commandes claires, service fluide
          </h2>
          {SEO_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-sm text-slate-200 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>

        {/* COMMENT ÇA MARCHE + POUR QUI */}
        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <Card className={`p-6 space-y-4 ${glassCard}`}>
            <h3 className="text-xl font-black">Comment ça marche</h3>
            <ol className="space-y-3 text-sm text-slate-200 list-decimal list-inside">
              {HOW_IT_WORKS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>

          <Card className={`p-6 space-y-4 ${glassCard}`}>
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

        {/* FAQ */}
        <section className="grid md:grid-cols-2 gap-6">
          {KDS_FAQ.map((item) => (
            <Card key={item.q} className={`p-5 space-y-2 ${glassCard}`}>
              <div className="text-sm font-semibold text-white">{item.q}</div>
              <p className="text-sm text-slate-200 leading-relaxed">{item.a}</p>
            </Card>
          ))}
        </section>

        {/* CTA */}
        <section className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-8 text-center space-y-3`}>
          <div className="text-sm uppercase tracking-[0.2em] text-white/70">Prêt pour le service</div>
          <h2 className="text-2xl md:text-3xl font-black">Ouvrez votre KDS gratuit</h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            Un seul compte pour POS, KDS et StockScan. Commencez gratuitement, sans carte bancaire, puis activez
            les fonctions avancées quand vous en avez besoin.
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

      <footer className="relative mx-auto w-full max-w-6xl px-4 pb-10 text-xs text-white/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span>Outil gratuit propulsé par la technologie StockScan.</span>
          <span>KDS gratuit — sans abonnement — sans carte bancaire — sans limite cachée.</span>
        </div>
      </footer>
    </div>
  );
}