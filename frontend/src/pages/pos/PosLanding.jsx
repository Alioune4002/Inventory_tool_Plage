
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ReceiptText,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
  Zap,
  CheckCircle2,
} from "lucide-react";

import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { useAuth } from "../../app/AuthProvider";
import posLogo from "../../assets/pos-logo.png";
import { trackPublicVisit } from "../../lib/trackVisit";

const PosLogo = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black">
        POS
      </div>
    );
  }
  return (
    <img
      src={posLogo}
      alt="StockScan POS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const POS_FAQ = [
  {
    q: "Est-ce vraiment gratuit ?",
    a: "Oui. StockScan POS est gratuit : pas d’abonnement, pas de carte bancaire. Vous pouvez activer des options plus avancées plus tard si besoin.",
  },
  {
    q: "Puis-je l’utiliser sur tablette ?",
    a: "Oui. Le POS est pensé pour tablette et mobile : boutons larges, interface claire et mode plein écran.",
  },
  {
    q: "Est-ce adapté à un restaurant ?",
    a: "Oui pour l’encaissement simple. Pour le service à table et la cuisine, utilisez StockScan KDS (également gratuit).",
  },
  {
    q: "Puis-je suivre mes ventes ?",
    a: "Oui. Un résumé des ventes et des paiements est disponible pour garder le contrôle, sans complexité.",
  },
  {
    q: "La caisse est-elle certifiée fiscalement ?",
    a: "Non. StockScan POS n’est pas une caisse certifiée. Elle convient aux besoins simples, gratuits et rapides.",
  },
];

const SEO_PARAGRAPHS = [
  "StockScan POS est un logiciel de caisse enregistreuse gratuit conçu pour les commerces de proximité. Il fonctionne directement dans un navigateur, sur tablette, mobile ou ordinateur, sans installation complexe. Vous encaissez rapidement, appliquez des remises simples, acceptez plusieurs moyens de paiement et retrouvez vos chiffres clés en quelques secondes.",
  "Cette caisse enregistreuse en ligne gratuite couvre l’essentiel : panier rapide, remises par article ou globales, paiements multiples (espèces, carte, chèque, ticket restaurant) et tickets lisibles. Tout est pensé pour aller vite, rester clair et éviter les erreurs.",
  "StockScan POS est idéal pour restaurant, bar, boulangerie, épicerie, food truck, association ou commerce de quartier. Si vous souhaitez aller plus loin, vous pouvez activer StockScan complet plus tard, sans changer d’outil : vos produits, ventes et habitudes restent au même endroit.",
  "À la différence d’une caisse classique, StockScan POS a été conçu pour rester léger et fiable, y compris avec un réseau instable. C’est une caisse tablette gratuite et professionnelle : simple pour l’équipe, compréhensible pour le dirigeant, et prête à évoluer quand votre activité grandit.",
];

const HOW_IT_WORKS = [
  "Créez un compte gratuit en moins de 2 minutes.",
  "Ajoutez vos produits (ou importez-les si vous en avez déjà).",
  "Encaissez vos clients en quelques clics.",
  "Consultez vos ventes et vos rapports quand vous le souhaitez.",
];

const COMPATIBLE = [
  "Restaurants (encaissement simple)",
  "Bars",
  "Boulangeries / pâtisseries",
  "Épiceries",
  "Associations",
  "Food trucks",
  "Commerces de proximité",
];

const NOT_COMPATIBLE = [
  "Pharmacies",
  "Grandes enseignes réglementées",
  "Situations nécessitant une caisse certifiée fiscalement",
];

export default function PosLanding() {
  const { isAuthed } = useAuth();

  const next = useMemo(() => encodeURIComponent("/pos/app"), []);
  const primaryHref = isAuthed ? "/pos/app" : `/login?next=${next}`;
  const secondaryHref = `/register?next=${next}`;

  useEffect(() => {
    trackPublicVisit("pos");
  }, []);

  const glassCard =
    "bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]";

  return (
    <div className="public-shell min-h-screen text-white overflow-hidden">
      <Helmet>
        <title>Logiciel de caisse enregistreuse gratuit | StockScan POS</title>
        <meta
          name="description"
          content="Logiciel de caisse enregistreuse gratuit : caisse tablette simple, rapide et fiable. Encaissement, remises, multi-paiements et rapports. Sans abonnement, sans carte bancaire."
        />
        <link rel="canonical" href="https://stockscan.app/pos" />
      </Helmet>

      {/* Fond “effet wow” : verre + halo (sans anglicisme dans le texte) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-24 -left-24 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
      </div>

      <header className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <PosLogo />
          <div>
            <div className="text-lg font-black text-white">StockScan POS</div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
              Caisse gratuite
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button as={Link} to={primaryHref} size="sm">
            Ouvrir la caisse
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
              Logiciel de caisse enregistreuse gratuit
            </div>

            <h1 className="text-3xl md:text-5xl font-black leading-tight">
              Logiciel de caisse enregistreuse gratuit, clair et rapide
            </h1>

            <p className="text-lg text-slate-200 leading-relaxed">
              Encaissez, appliquez des remises, acceptez plusieurs moyens de paiement et suivez vos ventes depuis
              une <strong className="text-white">caisse tablette</strong> simple et fiable.
              <br />
              <span className="text-white font-semibold">
                Sans abonnement. Sans carte bancaire. Sans installation complexe.
              </span>
            </p>

            <div className="flex flex-wrap gap-3">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir la caisse
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
                Encaissement en quelques clics
              </span>
            </div>
          </div>

          {/* Carte “verre” */}
          <Card className={`p-6 space-y-4 ${glassCard}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/80">Ce que vous gagnez</div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Gratuit
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ReceiptText className="h-5 w-5 text-blue-300" />
                <span>Tickets lisibles, remises simples, panier rapide.</span>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-300" />
                <span>Multi-paiements : espèces, carte, chèque, ticket restaurant.</span>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-blue-300" />
                <span>Rapports simples pour suivre votre activité sans jargon.</span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-300" />
                <span>Évolutif : vous activez StockScan complet seulement si besoin.</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              Non certifié fiscalement. Convient aux usages simples, gratuits et rapides.
            </div>
          </Card>
        </section>

        {/* PITCH “cheval de Troyes” : gratuit + pourquoi choisir */}
        <section className="grid md:grid-cols-2 gap-6">
          <Card className={`p-6 space-y-3 ${glassCard}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Commencez gratuitement, sans barrière
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              StockScan POS est une <strong className="text-white">caisse enregistreuse gratuite</strong> :
              vous démarrez aujourd’hui, vous encaissez tout de suite, et vous gardez vos chiffres sous contrôle.
              Aucun abonnement, aucune carte bancaire.
            </p>
          </Card>

          <Card className={`p-6 space-y-3 ${glassCard}`}>
            <div className="text-sm font-semibold text-white/90">Pourquoi choisir cet outil</div>
            <p className="text-sm text-slate-200 leading-relaxed">
              Conçu pour aller vite et rester clair : interface lisible, actions simples, et une base solide.
              Quand vous êtes prêt, vous pouvez activer des fonctions plus avancées, sans changer de méthode.
            </p>
          </Card>
        </section>

        {/* SEO +++++ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black">
            Caisse enregistreuse gratuite : simple, rapide, professionnelle
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
            <h3 className="text-xl font-black">À qui s’adresse la caisse</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-white">Compatible</div>
                <ul className="mt-2 text-sm text-slate-200 list-disc list-inside space-y-1">
                  {COMPATIBLE.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Non adapté</div>
                <ul className="mt-2 text-sm text-slate-200 list-disc list-inside space-y-1">
                  {NOT_COMPATIBLE.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* FAQ */}
        <section className="grid md:grid-cols-2 gap-6">
          {POS_FAQ.map((item) => (
            <Card key={item.q} className={`p-5 space-y-2 ${glassCard}`}>
              <div className="text-sm font-semibold text-white">{item.q}</div>
              <p className="text-sm text-slate-200 leading-relaxed">{item.a}</p>
            </Card>
          ))}
        </section>

        {/* CTA */}
        <section className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-8 text-center space-y-3`}>
          <div className="text-sm uppercase tracking-[0.2em] text-white/70">Prêt à encaisser</div>
          <h2 className="text-2xl md:text-3xl font-black">Ouvrez votre caisse gratuite</h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            Un seul compte pour POS, KDS et StockScan. Commencez gratuitement, sans carte bancaire, puis activez
            les fonctions avancées quand vous en avez besoin.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button as={Link} to={primaryHref} size="lg">
              Ouvrir la caisse
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
          <span>POS gratuit — sans abonnement — sans carte bancaire — non certifié fiscalement.</span>
        </div>
      </footer>
    </div>
  );
}