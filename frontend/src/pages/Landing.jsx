// frontend/src/pages/Landing.jsx
import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Barcode, BookOpen, ClipboardList, Sparkles, FileText } from "lucide-react";
import PublicShell from "../components/public/PublicShell";
import Card from "../ui/Card";
import LazyAutoDemoShowcase from "../components/public/LazyAutoDemoShowcase";
import { FAMILLES, MODULES } from "../lib/famillesConfig";

const familyIcons = {
  retail: Barcode,
  mode: BookOpen,
  bar: Sparkles,
  restauration: ClipboardList,
  boulangerie: Sparkles,
  pharmacie: Barcode,
};

const ROUTES = {
  retail: "/pour-epicerie",
  mode: "/pour-boutique",
  bar: "/pour-bar",
  restauration: "/pour-restaurant-cuisine",
  boulangerie: "/pour-boulangerie-patisserie",
  pharmacie: "/pour-pharmacie",
};

const steps = [
  { title: "1) Choisissez votre métier", desc: "L’interface s’adapte : vocabulaire, champs utiles, écran plus lisible." },
  { title: "2) Organisez votre établissement", desc: "Un ou plusieurs espaces : rayons / zones / services." },
  { title: "3) Faites votre inventaire", desc: "Vous comptez. StockScan structure, calcule et exporte proprement." },
];

export default function Landing() {
  const siteUrl = "https://stockscan.app";
  const canonicalUrl = `${siteUrl}/`;
  const ogImage = `${siteUrl}/og-image.png`;

  const seoTitle =
    "StockScan — Inventaire clair et rapide pour commerces (restaurant, bar, boulangerie, épicerie, boutique, pharmacie)";
  const seoDescription =
    "StockScan simplifie l’inventaire : catalogue produit propre, inventaires rapides (progressif/chrono), tableau de bord (vue globale), pertes, doublons, exports CSV/Excel/PDF et options activables (prix/TVA, DLC/DDM, lots…). Interface adaptée à votre métier.";

  const appJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "StockScan",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: canonicalUrl,
      description: seoDescription,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", category: "Free" },
    }),
    [canonicalUrl, seoDescription]
  );

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "StockScan est-il adapté à mon activité ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Oui. StockScan adapte l’interface au métier (restaurant, bar, boulangerie, épicerie, boutique, pharmacie…). Vous gardez l’essentiel, puis vous activez des options si besoin.",
          },
        },
        {
          "@type": "Question",
          name: "Puis-je gérer plusieurs espaces (rayons, zones ou services) ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Oui. Vous pouvez créer une ou plusieurs unités de travail (rayons / zones / services) et consulter une vue consolidée dans le tableau de bord.",
          },
        },
        {
          "@type": "Question",
          name: "Les exports sont-ils prêts à partager ?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Oui. Vous pouvez exporter des fichiers CSV/Excel/PDF lisibles, utiles pour l’équipe, un associé ou le comptable.",
          },
        },
      ],
    }),
    []
  );

  return (
    <PublicShell>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:site_name" content="StockScan" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={ogImage} />

        <script type="application/ld+json">{JSON.stringify(appJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* ✅ Fond “glace” identique à Fonctionnalites : pas de bg-slate-950 */}
      <main className="w-full bg-transparent text-white">
        <div className="mx-auto w-full max-w-[1480px] px-2 sm:px-3 lg:px-4 py-10">
          {/* ✅ Bloc central arrondi identique */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8 md:p-10 space-y-12">
            {/* HERO */}
            <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <Sparkles className="h-4 w-4" />
                  Inventaire clair, adapté à votre métier
                </div>

                <h1 className="text-4xl md:text-5xl font-black leading-[1.05] text-white">
                  L’outil qui rend l’inventaire enfin simple (et lisible)
                </h1>

                <p className="text-lg text-slate-200 max-w-2xl">
                  StockScan vous aide à{" "}
                  <span className="font-semibold text-white">garder un catalogue propre</span> et à{" "}
                  <span className="font-semibold text-white">réaliser vos inventaires plus vite</span>, sans vous noyer
                  dans des réglages. Et si vous avez des besoins avancés : vous activez des options au bon moment.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 transition"
                  >
                    Essayer gratuitement
                  </Link>

                  <Link
                    to="/fonctionnalites"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
                  >
                    Voir les fonctionnalités
                  </Link>
                </div>

                {/* Points de confiance */}
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { title: "Catalogue propre", desc: "catégories, référence interne, code-barres" },
                    { title: "Inventaire rapide", desc: "mode progressif ou chrono, guidé" },
                    { title: "Exports prêts", desc: "CSV / Excel / PDF, faciles à partager" },
                  ].map((item) => (
                    <Card key={item.title} className="p-3 border-white/10 bg-white/5 rounded-2xl" hover>
                      <div className="font-semibold text-white">{item.title}</div>
                      <div className="text-xs text-white/70 mt-1">{item.desc}</div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* PREVIEW (même logique “glace” : pas de gros bloc sombre) */}
              <Card className="p-6 border-white/10 bg-white/5 rounded-[32px] shadow-[0_30px_80px_rgba(0,0,0,0.35)]" hover>
                <div className="text-sm text-white/70">Aperçu</div>
                <div className="mt-2 text-2xl font-black text-white">Tableau de bord</div>

                <div className="mt-4 space-y-3">
                  <Card className="p-4 border-white/10 bg-white/5 rounded-2xl">
                    <div className="text-xs text-white/60">Valeur du stock (achat)</div>
                    <div className="text-2xl font-black text-white">12 480 €</div>
                    <div className="text-xs text-white/60 mt-1">Lecture rapide, sans jargon.</div>
                  </Card>

                  <Card className="p-4 border-white/10 bg-white/5 rounded-2xl">
                    <div className="text-xs text-white/60">Pertes déclarées</div>
                    <div className="text-xl font-semibold text-white">- 380 €</div>
                    <div className="text-xs text-white/60">casse, péremption, erreurs…</div>
                  </Card>

                  <Card className="p-4 border-white/10 bg-white/5 rounded-2xl">
                    <div className="text-xs text-white/60">Organisation</div>
                    <div className="text-sm text-white/80">
                      Une ou plusieurs unités : rayons / zones / services (selon votre établissement).
                    </div>
                  </Card>
                </div>
              </Card>
            </section>

            {/* ✅ “Ce que vous obtenez en 10 minutes” (impact first impression) */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
                    En 10 minutes
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Ce que vous obtenez dès aujourd’hui
                  </h2>
                  <p className="text-sm text-slate-200 mt-2 max-w-3xl">
                    Pas de prise de tête : vous configurez le minimum, vous faites un premier comptage, et le tableau de
                    bord commence déjà à parler.
                  </p>
                </div>

                <Link
                  to="/comment-ca-marche"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  Voir un exemple <ArrowRight className="h-4 w-4 text-blue-300" />
                </Link>
              </div>

              <div className="mt-5 grid md:grid-cols-3 gap-4">
                {[
                  {
                    title: "Un catalogue propre",
                    desc: "Catégories + unité + référence interne (ou code-barres).",
                  },
                  {
                    title: "Un premier inventaire guidé",
                    desc: "Mode progressif ou chrono, sans surcharge d’écran.",
                  },
                  {
                    title: "Un export partageable",
                    desc: "CSV / Excel / PDF prêt pour l’équipe ou le comptable.",
                  },
                ].map((b) => (
                  <Card key={b.title} className="p-5 border-white/10 bg-white/5 rounded-3xl" hover>
                    <div className="text-lg font-semibold text-white">{b.title}</div>
                    <div className="text-sm text-slate-200 mt-1">{b.desc}</div>
                  </Card>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 transition"
                >
                  Démarrer maintenant
                </Link>
                <Link
                  to="/fonctionnalites"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
                >
                  Lire le détail
                </Link>
              </div>
            </section>

            {/* PITCH COURT */}
            <section className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 border-white/10 bg-white/5 space-y-2 rounded-3xl" hover>
                <div className="flex items-center gap-2 text-sm text-blue-200">
                  <BookOpen className="h-4 w-4" /> Catalogue
                </div>
                <h2 className="text-xl font-semibold text-white">Votre base produits</h2>
                <p className="text-sm text-slate-200">
                  Une base claire : nom, catégorie, unité, code-barres (si vous en avez) ou référence interne. Vous
                  corrigez facilement, et vous évitez les doublons.
                </p>
              </Card>

              <Card className="p-6 border-white/10 bg-white/5 space-y-2 rounded-3xl" hover>
                <div className="flex items-center gap-2 text-sm text-blue-200">
                  <ClipboardList className="h-4 w-4" /> Inventaires
                </div>
                <h2 className="text-xl font-semibold text-white">Vos inventaires</h2>
                <p className="text-sm text-slate-200">
                  Vous comptez les quantités. StockScan structure, calcule et met en forme. Et si besoin : pertes, dates
                  (DLC/DDM), lots, produits entamés… uniquement si vous activez l’option.
                </p>
              </Card>
            </section>

            {/* METIERS */}
            <section className="space-y-6" id="metiers">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm text-white/60">Métiers</div>
                  <h2 className="text-3xl font-black text-white">Conçu pour votre commerce</h2>
                  <p className="text-sm text-slate-300 mt-2">
                    Restaurant, bar, boulangerie, épicerie, boutique, pharmacie… StockScan s’adapte au vocabulaire et
                    aux informations utiles.
                  </p>
                </div>

                <Link to="/metiers" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
                  Voir tous les métiers →
                </Link>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {FAMILLES.map((family) => {
                  const Icon = familyIcons[family.id] || Sparkles;

                  return (
                    <Link
                      key={family.id}
                      to={ROUTES[family.id] || "/metiers"}
                      className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 hover:-translate-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="text-lg font-semibold">{family.name}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-blue-300" />
                      </div>

                      <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-blue-200">
                        {family.copy?.headline || "Inventaire adapté à votre activité"}
                      </h3>
                      <p className="mt-2 text-sm text-slate-200">
                        {family.copy?.subline || "Interface simple et progressive : les bons détails au bon moment."}
                      </p>

                      <span className="mt-3 inline-flex text-sm font-semibold text-blue-300">Découvrir →</span>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* OPTIONS */}
            <section className="space-y-6">
              <div>
                <div className="text-sm text-white/60">Options</div>
                <h2 className="text-3xl font-black text-white">Simple par défaut, puissant si besoin</h2>
                <p className="text-sm text-slate-300 mt-2">
                  Vous démarrez léger. Puis vous activez des options au bon moment : prix/TVA, dates (DLC/DDM), lots,
                  produits entamés, variantes…
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((module) => (
                  <Card key={module.id} className="p-5 border-white/10 bg-white/5 space-y-2 rounded-3xl" hover>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{module.name}</div>
                    <div className="text-sm text-slate-200">{module.description}</div>
                  </Card>
                ))}
              </div>

              <div className="text-xs text-slate-300">
                Pour voir le détail complet :{" "}
                <Link to="/fonctionnalites" className="font-semibold text-blue-300 hover:text-blue-200">
                  fonctionnalités
                </Link>
                .
              </div>
            </section>

            {/* ÉTAPES */}
            <section className="grid md:grid-cols-3 gap-4">
              {steps.map((step) => (
                <Card key={step.title} className="p-5 border-white/10 bg-white/5 space-y-2 rounded-3xl" hover>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Démarrage</div>
                  <div className="text-lg font-semibold text-white">{step.title}</div>
                  <div className="text-sm text-slate-300">{step.desc}</div>
                </Card>
              ))}
            </section>

            {/* DÉMO */}
            <section className="space-y-4">
              <div className="text-sm text-slate-400">Démo</div>
              <h2 className="text-3xl font-black text-white">Voir StockScan en action</h2>
              <p className="text-sm text-slate-300">
                Une démonstration guidée : inventaire, pertes, exports, tableau de bord — sans créer de compte.
              </p>

              <div className="[&_[role='progressbar']]:hidden [&_.progress]:hidden [&_.progress-bar]:hidden">
                <LazyAutoDemoShowcase />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/fonctionnalites"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  <FileText className="h-4 w-4 text-blue-300" />
                  Voir la liste complète
                </Link>
              </div>
            </section>

            {/* CTA */}
            <section className="rounded-[32px] bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
              <h2 className="text-2xl font-black">Prêt à faire votre premier inventaire ?</h2>
              <p className="text-sm text-blue-100">
                En 2 minutes : choisissez votre métier, puis démarrez votre comptage. (Promis, c’est plus simple que
                votre dernier fichier Excel 😄)
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 transition"
                >
                  Essayer maintenant
                </Link>
                <Link
                  to="/tarifs"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold border border-white/30 bg-white/10 text-white hover:bg-white/15 transition"
                >
                  Voir les offres
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}