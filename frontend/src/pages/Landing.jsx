import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Barcode, BookOpen, ClipboardList, Sparkles } from "lucide-react";
import PageTransition from "../components/PageTransition";
import PublicShell from "../components/public/PublicShell";
import Card from "../ui/Card";
import AutoDemoShowcase from "../demo/AutoDemoShowcase";
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
  {
    title: "1) Choisissez votre métier",
    desc: "StockScan s’adapte à votre activité : vous voyez uniquement ce qui est utile.",
  },
  {
    title: "2) Organisez vos services",
    desc: "Un seul service ou plusieurs (ex : bar / cuisine) selon votre organisation.",
  },
  {
    title: "3) Faites l’inventaire",
    desc: "Vous comptez les quantités. StockScan structure, calcule et exporte proprement.",
  },
];

export default function Landing() {
  return (
    <PublicShell>
      <PageTransition>
        <Helmet>
          <title>Inventaire simple et rapide pour votre commerce | StockScan</title>
          <meta
            name="description"
            content="StockScan : un outil clair pour gérer vos produits et vos inventaires mensuels. Adapté aux restaurants, bars, boulangeries, épiceries, boutiques et pharmacies."
          />
        </Helmet>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 space-y-14">
          {/* HERO */}
          <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-4 w-4" />
                Inventaire clair, adapté à votre métier
              </div>

              <h1 className="text-4xl md:text-5xl font-black leading-[1.05] text-white">
                L’inventaire qui donne envie de le faire
              </h1>

              <p className="text-lg text-slate-200">
                StockScan vous aide à <span className="font-semibold text-white">garder une base produits propre</span> et à{" "}
                <span className="font-semibold text-white">faire vos inventaires mensuels</span> rapidement.
                Simple, lisible, et pensé pour votre activité.
              </p>

              {/* CTA (en Link => fiable) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 transition"
                >
                  Commencer gratuitement
                </Link>

                <Link
                  to="/tarifs"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
                >
                  Voir les offres
                </Link>
              </div>

              {/* Proof points */}
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {[
                  { title: "Produits bien rangés", desc: "catégories, code-barres, référence interne" },
                  { title: "Inventaire rapide", desc: "comptage du mois, clair et structuré" },
                  { title: "Exports prêts", desc: "CSV / Excel faciles à envoyer" },
                ].map((item) => (
                  <Card key={item.title} className="p-3 border-white/10 bg-white/5" hover>
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-white/70 mt-1">{item.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            {/* PREVIEW */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
            >
              <div className="text-sm text-white/70">Aperçu</div>
              <div className="mt-2 text-2xl font-black text-white">Tableau de bord</div>

              <div className="mt-4 space-y-3">
                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Valeur de stock (HT)</div>
                  <div className="text-2xl font-black text-white">12 480 €</div>
                </Card>

                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Pertes déclarées</div>
                  <div className="text-xl font-semibold text-white">- 380 €</div>
                  <div className="text-xs text-white/60">casse, DLC, erreurs</div>
                </Card>

                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Options activées</div>
                  <div className="text-sm text-white/80">Prix & TVA · DLC · Produits entamés</div>
                </Card>
              </div>
            </motion.div>
          </section>

          {/* EXPLICATION SIMPLE */}
          <section className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 border-white/10 bg-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <BookOpen className="h-4 w-4" /> Produits
              </div>
              <h2 className="text-xl font-semibold text-white">Votre base produits</h2>
              <p className="text-sm text-slate-200">
                Une base claire : nom, catégorie, code-barres (si vous en avez) ou référence interne.
              </p>
            </Card>

            <Card className="p-6 border-white/10 bg-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <ClipboardList className="h-4 w-4" /> Inventaires
              </div>
              <h2 className="text-xl font-semibold text-white">Votre inventaire mensuel</h2>
              <p className="text-sm text-slate-200">
                Le comptage à date : quantités + (si vous voulez) pertes, lots, DLC… vous choisissez.
              </p>
            </Card>
          </section>

          {/* METIERS (comme Metiers.jsx => Link) */}
          <section className="space-y-6" id="metiers">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm text-white/60">Métiers</div>
                <h2 className="text-3xl font-black text-white">Conçu pour votre commerce</h2>
                <p className="text-sm text-slate-300 mt-2">
                  Restaurant, bar, boulangerie, épicerie, boutique, pharmacie… StockScan parle votre langage.
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
                    className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 hover:-translate-y-1"
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
                      {family.copy?.subline || "Interface simple, organisée, avec les bons détails au bon moment."}
                    </p>

                    <span className="mt-3 inline-flex text-sm font-semibold text-blue-300">Découvrir →</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* OPTIONS (au lieu de “modules”) */}
          <section className="space-y-6">
            <div>
              <div className="text-sm text-white/60">Options</div>
              <h2 className="text-3xl font-black text-white">Vous restez en mode simple</h2>
              <p className="text-sm text-slate-300 mt-2">
                Vous pouvez activer des options quand vous en avez besoin : prix & TVA, DLC/DDM, lots, produits entamés…
                Sinon, StockScan reste minimal et clair.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULES.map((module) => (
                <Card key={module.id} className="p-5 border-white/10 bg-white/5 space-y-2" hover>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{module.name}</div>
                  <div className="text-sm text-slate-200">{module.description}</div>
                </Card>
              ))}
            </div>
          </section>

          {/* STEPS */}
          <section className="grid md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <Card key={step.title} className="p-5 border-white/10 bg-white/5 space-y-2" hover>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Démarrage</div>
                <div className="text-lg font-semibold text-white">{step.title}</div>
                <div className="text-sm text-slate-300">{step.desc}</div>
              </Card>
            ))}
          </section>

          {/* DEMO */}
          <section className="space-y-4">
            <div className="text-sm text-slate-400">Démo</div>
            <h2 className="text-3xl font-black text-white">Voyez StockScan en action</h2>
            <p className="text-sm text-slate-300">
              Une démonstration guidée : inventaire, pertes, exports, tableau de bord — sans créer de compte.
            </p>
            <AutoDemoShowcase />
          </section>

          {/* CTA */}
          <section className="rounded-3xl bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
            <h2 className="text-2xl font-black">Prêt à faire votre premier inventaire ?</h2>
            <p className="text-sm text-blue-100">
              En 2 minutes : choisissez votre métier, puis démarrez votre comptage.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 transition"
              >
                Commencer maintenant
              </Link>
              <Link
                to="/tarifs"
                className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold border border-white/30 bg-white/10 text-white hover:bg-white/15 transition"
              >
                Voir les offres
              </Link>
            </div>
          </section>
        </main>
      </PageTransition>
    </PublicShell>
  );
}