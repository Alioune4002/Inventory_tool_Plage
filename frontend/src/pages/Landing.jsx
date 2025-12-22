import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Barcode, BookOpen, ClipboardList, Sparkles } from "lucide-react";
import PageTransition from "../components/PageTransition";
import PublicShell from "../components/public/PublicShell";
import Card from "../ui/Card";
import Button from "../ui/Button";
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

const steps = [
  {
    title: "Choisissez votre famille métier",
    desc: "StockScan active uniquement les champs utiles à votre commerce.",
  },
  {
    title: "Configurez vos services",
    desc: "Regrouper ou séparer les inventaires selon vos équipes.",
  },
  {
    title: "Lancez votre comptage",
    desc: "Inventaire = comptage du mois. Catalogue = référentiel.",
  },
];

export default function Landing() {
  const nav = useNavigate();

  return (
    <PublicShell>
      <PageTransition>
        <Helmet>
          <title>Inventaire métier & catalogue clair | StockScan</title>
          <meta
            name="description"
            content="StockScan : inventaire métier pensé pour retail, mode, bar, restauration, boulangerie et pharmacie. Catalogue propre, comptage clair, modules activables, exports premium."
          />
        </Helmet>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 space-y-14">
          <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-4 w-4" />
                Inventaire & catalogue métier-first
              </div>

              <h1 className="text-4xl md:text-5xl font-black leading-[1.05]">
                L’inventaire métier qui respecte votre commerce
              </h1>

              <p className="text-lg text-slate-200">
                Produits = <span className="font-semibold text-white">catalogue</span>.
                Inventaire = <span className="font-semibold text-white">comptage</span>.
                Chaque écran s’adapte à votre métier, sans champs hors-sujet.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => nav("/register")} className="w-full sm:w-auto">
                  Démarrer l’onboarding
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => nav("/metiers")}
                  className="w-full sm:w-auto bg-white text-slate-900 border-white/60"
                >
                  Voir les familles métiers
                </Button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {[
                  { title: "Catalogue propre", desc: "SKU / barcode selon votre métier" },
                  { title: "Comptage rapide", desc: "Socle minimal + modules" },
                  { title: "Exports premium", desc: "Champs et catégories au choix" },
                ].map((item) => (
                  <Card key={item.title} className="p-3 border-white/10 bg-white/5" hover>
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-white/70 mt-1">{item.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
            >
              <div className="text-sm text-white/70">Aperçu</div>
              <div className="mt-2 text-2xl font-black text-white">Dashboard métier</div>
              <div className="mt-4 space-y-3">
                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Valeur de stock (HT)</div>
                  <div className="text-2xl font-black text-white">12 480 €</div>
                </Card>
                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Pertes déclarées</div>
                  <div className="text-xl font-semibold text-white">- 380 €</div>
                  <div className="text-xs text-white/60">Casse + DLC + erreurs</div>
                </Card>
                <Card className="p-4 border-white/10 bg-white/5">
                  <div className="text-xs text-white/60">Modules actifs</div>
                  <div className="text-sm text-white/80">Pricing & TVA · DLC · Entamés</div>
                </Card>
              </div>
            </motion.div>
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 border-white/10 bg-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <BookOpen className="h-4 w-4" /> Catalogue
              </div>
              <h2 className="text-xl font-semibold">Produits = référentiel</h2>
              <p className="text-sm text-slate-200">
                Votre base stable : nom, catégorie, identifiants (barcode/SKU), prix & TVA selon modules.
              </p>
            </Card>
            <Card className="p-6 border-white/10 bg-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <ClipboardList className="h-4 w-4" /> Inventaire
              </div>
              <h2 className="text-xl font-semibold">Inventaire = comptage</h2>
              <p className="text-sm text-slate-200">
                Le stock à date : quantité comptée + pertes optionnelles. Rien d’autre si vous ne l’activez pas.
              </p>
            </Card>
          </section>

          <section className="space-y-6" id="metiers">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm text-white/60">Familles métiers</div>
                <h2 className="text-3xl font-black">Conçu pour votre commerce</h2>
                <p className="text-sm text-slate-300 mt-2">
                  Retail, mode, bar, restauration, boulangerie, pharmacie — chaque famille a ses règles et son vocabulaire.
                </p>
              </div>
              <Link to="/metiers" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
                Explorer tous les métiers →
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FAMILLES.map((family) => {
                const Icon = familyIcons[family.id] || Sparkles;
                return (
                  <Card key={family.id} className="p-5 border-white/10 bg-white/5 space-y-3" hover>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="text-lg font-semibold">{family.name}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-300" />
                    </div>
                    <div className="text-sm text-slate-200">{family.copy?.headline}</div>
                    <div className="text-xs text-slate-400">{family.copy?.subline}</div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-6">
            <div>
              <div className="text-sm text-white/60">Modules activables</div>
              <h2 className="text-3xl font-black">Vous choisissez ce que vous voyez</h2>
              <p className="text-sm text-slate-300 mt-2">
                Pricing & TVA, DLC/DDM, lots, entamés, variantes, multi-unités… activez seulement ce qui sert votre métier.
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

          <section className="grid md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <Card key={step.title} className="p-5 border-white/10 bg-white/5 space-y-2" hover>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Onboarding</div>
                <div className="text-lg font-semibold text-white">{step.title}</div>
                <div className="text-sm text-slate-300">{step.desc}</div>
              </Card>
            ))}
          </section>

          <section className="space-y-4">
            <div className="text-sm text-slate-400">Auto-démo</div>
            <h2 className="text-3xl font-black">Voyez StockScan en action</h2>
            <p className="text-sm text-slate-300">
              Démo guidée, légère et réaliste : inventaire, pertes, exports, dashboard — sans création de compte.
            </p>
            <AutoDemoShowcase />
          </section>

          <section className="rounded-3xl bg-blue-600 text-white p-8 space-y-3 shadow-[0_30px_70px_rgba(37,99,235,0.35)]">
            <h2 className="text-2xl font-black">Prêt à configurer votre inventaire ?</h2>
            <p className="text-sm text-blue-100">
              Choisissez votre famille métier, activez les modules, puis lancez votre premier comptage.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="bg-white text-slate-900" onClick={() => nav("/register")}>
                Créer mon espace
              </Button>
              <Button variant="secondary" className="bg-white/10 text-white border-white/30" onClick={() => nav("/tarifs")}>
                Voir les tarifs
              </Button>
            </div>
          </section>
        </main>
      </PageTransition>
    </PublicShell>
  );
}
