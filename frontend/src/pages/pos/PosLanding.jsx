import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ReceiptText, CreditCard, BarChart3, ShieldCheck, Sparkles } from "lucide-react";

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
      alt="Logo POS"
      className="h-12 w-12 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const POS_FAQ = [
  {
    q: "Est-ce vraiment gratuit ?",
    a: "Oui. La caisse est gratuite, sans abonnement et sans carte bancaire. Vous activez des options plus avancées plus tard si besoin.",
  },
  {
    q: "Puis-je utiliser une tablette ?",
    a: "Oui. Le POS est optimisé pour tablette et mobile, avec un mode plein écran et des boutons larges.",
  },
  {
    q: "Est-ce adapté à un restaurant ?",
    a: "Oui pour l’encaissement simple. Pour le service à table et la cuisine, utilisez StockScan KDS.",
  },
  {
    q: "Puis-je suivre mes ventes ?",
    a: "Oui. Des rapports simples sont disponibles pour suivre votre activité.",
  },
  {
    q: "La caisse est-elle certifiée fiscalement ?",
    a: "Non. StockScan POS n’est pas une caisse certifiée fiscale. Elle convient aux besoins simples et gratuits.",
  },
];

const SEO_PARAGRAPHS = [
  "StockScan POS est un logiciel de caisse enregistreuse gratuit pensé pour les commerces de proximité. Il fonctionne dans un navigateur, sur tablette ou sur ordinateur, sans installation complexe. Vous encaissez rapidement, suivez vos ventes et retrouvez vos rapports en quelques secondes. C’est une caisse enregistreuse en ligne simple, claire et sans configuration lourde.",
  "Ce POS gratuit couvre les besoins essentiels : panier rapide, remises par article ou globales, multi‑paiements (espèces, carte, chèque, ticket restaurant) et récapitulatif clair. Les chiffres clés sont disponibles sur la période choisie. Vous gagnez du temps et vous gardez le contrôle, sans jargon technique.",
  "Ce logiciel de caisse gratuit est idéal pour restaurant, bar, boulangerie, épicerie, association, food truck ou commerce de quartier. Si vous gérez un stock plus complexe, vous pourrez activer StockScan plus tard, sans migration. La synchronisation stock réel ↔ ventes est prête quand vous l’êtes, sans double saisie.",
  "À la différence d’un POS classique, StockScan POS a été conçu pour rester léger et fiable, même avec un réseau instable. C’est une caisse tablette gratuite et professionnelle, claire pour l’équipe et compréhensible pour le dirigeant. Vous disposez d’une solution propre, stable et évolutive, sans limite cachée.",
];

const HOW_IT_WORKS = [
  "Créez un compte gratuit en moins de 2 minutes.",
  "Ajoutez vos produits (ou importez-les si vous en avez déjà).",
  "Encaissez vos clients en quelques clics.",
  "Consultez vos ventes et rapports quand vous voulez.",
];

const COMPATIBLE = [
  "Restaurants",
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
  "Contextes nécessitant une caisse certifiée fiscale",
];

export default function PosLanding() {
  const { isAuthed } = useAuth();
  const next = encodeURIComponent("/pos/app");
  const primaryHref = isAuthed ? "/pos/app" : `/login?next=${next}`;
  const secondaryHref = `/register?next=${next}`;

  useEffect(() => {
    trackPublicVisit("pos");
  }, []);

  return (
    <div className="public-shell min-h-screen">
      <Helmet>
        <title>Logiciel de caisse enregistreuse gratuit | StockScan POS</title>
        <meta
          name="description"
          content="Logiciel de caisse enregistreuse gratuit pour restaurants, bars, boulangeries et commerces. POS en ligne simple, rapide, sans abonnement ni carte bancaire."
        />
        <link rel="canonical" href="https://stockscan.app/pos" />
      </Helmet>

      <header className="mx-auto w-full max-w-6xl px-4 pt-10 pb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <PosLogo />
          <div>
            <div className="text-lg font-black text-white">StockScan POS</div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Caisse gratuite</div>
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

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 space-y-12 text-white">
        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
              Logiciel de caisse enregistreuse gratuit
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight">
              Logiciel de caisse enregistreuse gratuit
            </h1>
            <p className="text-lg text-slate-200">
              Encaissez, suivez vos ventes et consultez vos rapports depuis une caisse tablette simple et fiable.
              StockScan POS reste léger, rapide et professionnel, sans abonnement ni carte bancaire.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button as={Link} to={primaryHref} size="lg">
                Ouvrir la caisse
              </Button>
              <Button as={Link} to={secondaryHref} variant="secondary" size="lg">
                Créer un compte gratuit
              </Button>
            </div>
            <div className="text-sm text-slate-300">
              Outil gratuit propulsé par la technologie StockScan.
            </div>
          </div>

          <Card className="p-6 space-y-4">
            <div className="text-sm font-semibold text-white/70">Ce que vous gagnez</div>
            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <ReceiptText className="h-5 w-5 text-blue-300" />
                <span>Tickets clairs, remises simples, encaissement rapide.</span>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-300" />
                <span>Multi‑paiements : espèces, carte, chèque, ticket restaurant.</span>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-blue-300" />
                <span>Rapports simples et lisibles pour suivre vos ventes.</span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-300" />
                <span>Stock synchronisé quand vous activez StockScan.</span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Non certifié fiscalement. Idéal pour les usages simples et gratuits.
            </div>
          </Card>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <Sparkles className="h-4 w-4 text-amber-300" />
              100% gratuit, sans carte bancaire
            </div>
            <p className="text-sm text-slate-200">
              StockScan POS est gratuit, sans abonnement ni engagement. Vous pouvez commencer aujourd’hui,
              encaisser vos clients et garder vos ventes sous contrôle.
            </p>
          </Card>
          <Card className="p-6 space-y-3">
            <div className="text-sm font-semibold text-white/80">Synchronisation intelligente</div>
            <p className="text-sm text-slate-200">
              Vos ventes peuvent alimenter votre stock réel sans double saisie. Vous activez StockScan complet
              seulement si vous en avez besoin.
            </p>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black">Pourquoi choisir ce POS gratuit ?</h2>
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

        <section className="grid md:grid-cols-2 gap-6">
          {POS_FAQ.map((item) => (
            <Card key={item.q} className="p-5 space-y-2">
              <div className="text-sm font-semibold text-white">{item.q}</div>
              <p className="text-sm text-slate-200">{item.a}</p>
            </Card>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center space-y-3">
          <div className="text-sm uppercase tracking-[0.2em] text-white/70">Prêt à encaisser</div>
          <h2 className="text-2xl md:text-3xl font-black">Ouvrez votre caisse gratuite</h2>
          <p className="text-sm text-slate-200">
            Un seul compte pour POS, KDS et StockScan. Commencez gratuitement et activez le stock avancé quand
            vous êtes prêt.
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

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-xs text-white/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span>Outil gratuit propulsé par la technologie StockScan.</span>
          <span>POS gratuit — sans abonnement — sans carte bancaire — non certifié fiscalement.</span>
        </div>
      </footer>
    </div>
  );
}
