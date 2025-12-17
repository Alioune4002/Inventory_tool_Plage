import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import AutoDemoShowcase from "../demo/AutoDemoShowcase";
import {
  Utensils,
  Wine,
  Croissant,
  ShoppingBasket,
  Pill,
  Store,
  Hotel,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function PillTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
        "border",
        active
          ? "bg-white text-slate-950 border-white shadow-glow"
          : "bg-white/5 text-white border-white/15 hover:bg-white/10 hover:border-white/25",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TradeCard({ to, title, desc, tag, Icon }) {
  return (
    <Link
      to={to}
      className={[
        "group relative overflow-hidden rounded-3xl border border-white/10",
        "bg-white/5 backdrop-blur",
        "p-5 transition",
        "hover:-translate-y-1 hover:border-white/20 hover:bg-white/7",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/60",
      ].join(" ")}
    >
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-600/20 blur-[70px] opacity-0 group-hover:opacity-100 transition" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-400/15 blur-[70px] opacity-0 group-hover:opacity-100 transition" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Icon className="h-5 w-5 text-white/90" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide rounded-full px-2.5 py-1 border border-white/15 text-white/70 bg-white/5">
              {tag}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-blue-200 transition truncate">
            {title}
          </h3>
          <p className="mt-2 text-sm text-white/70">{desc}</p>
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 group-hover:text-blue-200 transition">
        Découvrir <ArrowRight className="h-4 w-4" />
      </div>

      <div className="mt-3 text-xs text-white/55">
        Métier-first : champs, unités et règles adaptés automatiquement.
      </div>
    </Link>
  );
}

export default function Landing() {
  const nav = useNavigate();

  const features = [
    { title: "Ajoutez des produits", desc: "Scan code-barres si dispo, sinon SKU interne générable." },
    { title: "Inventaire par mois", desc: "Par service ou global — adapté au métier choisi." },
    { title: "Stats + export", desc: "Valeur stock, pertes, CSV/XLSX, partage email." },
  ];

  const trades = useMemo(
    () => [
      {
        group: "food",
        to: "/pour-restaurant-cuisine",
        title: "Restaurant / Cuisine",
        desc: "Entamés, pesées, DLC, pertes.",
        tag: "Food",
        Icon: Utensils,
      },
      {
        group: "food",
        to: "/pour-bar",
        title: "Bar / Salle",
        desc: "Volumes, bouteilles entamées, service rapide.",
        tag: "Food",
        Icon: Wine,
      },
      {
        group: "food",
        to: "/pour-boulangerie-patisserie",
        title: "Boulangerie / Pâtisserie",
        desc: "Production, invendus, matières.",
        tag: "Food",
        Icon: Croissant,
      },
      {
        group: "food",
        to: "/pour-epicerie",
        title: "Épicerie / Alimentaire",
        desc: "EAN/SKU, prix achat/vente, DLC/DDM.",
        tag: "Food",
        Icon: ShoppingBasket,
      },
      {
        group: "regulated",
        to: "/pour-pharmacie",
        title: "Pharmacie / Parapharmacie",
        desc: "Lots, péremption, emplacements, registre.",
        tag: "Réglementé",
        Icon: Pill,
      },
      {
        group: "retail",
        to: "/pour-boutique",
        title: "Boutique / Retail",
        desc: "SKU, variantes, tailles/couleurs, sans DLC.",
        tag: "Retail",
        Icon: Store,
      },
      {
        group: "multi",
        to: "/pour-hotel-camping",
        title: "Hôtel / Camping",
        desc: "Multi-services : bar, épicerie, resto, boutique…",
        tag: "Multi",
        Icon: Hotel,
      },
    ],
    []
  );

  const [tab, setTab] = useState("all");
  const filteredTrades = useMemo(() => {
    if (tab === "all") return trades;
    return trades.filter((t) => t.group === tab);
  }, [tab, trades]);

  return (
    <PageTransition>
      <Helmet>
        <title>Le logiciel d’inventaire qui s’adapte à votre métier | StockScan</title>
        <meta
          name="description"
          content="Restaurant, boulangerie, pharmacie, boutique, hôtel/camping… StockScan ajuste automatiquement l’inventaire à votre activité."
        />
      </Helmet>

      <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
        {/* Stripe-like background */}
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-grid" />
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-600 blur-[140px] opacity-35" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-400 blur-[160px] opacity-25" />

        <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between relative z-10">
          <div className="font-black tracking-tight text-xl text-white">StockScan</div>
          <div className="flex items-center gap-2">
            <Link
              className="rounded-full px-4 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition"
              to="/login"
            >
              Se connecter
            </Link>
            <Link
              className="rounded-full px-4 py-2 text-sm font-semibold bg-blue-600 text-white shadow-glow hover:-translate-y-[1px] transition"
              to="/register"
            >
              Créer un compte
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-16 relative z-10">
          <Card className="overflow-hidden border-white/10 bg-white/5 glass">
            {/* HERO */}
            <div className="p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-900 text-white">
              <div className="space-y-5 text-white">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-white/15 bg-white/10 text-xs font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Inventaire premium, simple
                </span>

                <h1 className="text-4xl md:text-5xl font-black leading-[1.05] text-white">
                  L’inventaire qui s’adapte à votre business
                </h1>

                <p className="text-white/80 text-lg">
                  Tous les commerces sont couverts : <span className="font-semibold text-white">food</span>,{" "}
                  <span className="font-semibold text-white">retail</span>,{" "}
                  <span className="font-semibold text-white">réglementé</span>,{" "}
                  <span className="font-semibold text-white">multi-services</span>. Vous choisissez votre métier →
                  StockScan ajuste les champs, unités et règles automatiquement.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => nav("/register")} className="w-full sm:w-auto shadow-glow">
                    Démarrer l’inscription guidée
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => nav("/login")}
                    className="w-full sm:w-auto bg-white text-slate-900 border-white/60"
                  >
                    J’ai déjà un compte
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { k: "Métier-first", v: "Champs adaptés, inutiles masqués" },
                    { k: "Scan / SKU", v: "Code-barres ou SKU interne" },
                    { k: "Exports", v: "CSV/XLSX + partage email" },
                  ].map((b) => (
                    <Card key={b.k} className="p-3 border-white/15 bg-white/10 text-white" glass hover>
                      <div className="font-bold">{b.k}</div>
                      <div className="text-white/80">{b.v}</div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* HERO PREVIEW */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="text-sm text-white/70">Aperçu</div>
                <div className="mt-2 text-xl font-black">Dashboard</div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Card glass className="p-4 border-white/15 bg-white/10">
                    <div className="text-xs text-white/70">Valeur stock</div>
                    <div className="text-2xl font-black">12 480 €</div>
                  </Card>
                  <Card glass className="p-4 border-white/15 bg-white/10">
                    <div className="text-xs text-white/70">Produits</div>
                    <div className="text-2xl font-black">326</div>
                  </Card>
                </div>

                <Card glass className="mt-3 p-4 border-white/15 bg-white/10">
                  <div className="text-xs text-white/70">Organisation</div>
                  <div className="text-lg font-bold">Par service</div>
                  <div className="text-xs text-white/70 mt-1">
                    Séparez les accès : salle / cuisine / bar / boutique, etc.
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* FEATURES */}
            <div className="px-8 md:px-12 pb-10 grid md:grid-cols-3 gap-4 bg-slate-900 text-white">
              {features.map((f) => (
                <Card key={f.title} className="p-4 bg-slate-900 border-slate-800 text-white" hover>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-slate-200 mt-1">{f.desc}</div>
                </Card>
              ))}
            </div>

            {/* MÉTIERS PREMIUM + TABS */}
            <section className="px-8 md:px-12 py-12 bg-slate-900 text-white" id="metiers">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm text-white/60">Adapté à votre activité</div>
                  <h2 className="text-3xl font-black tracking-tight">Choisissez votre type de commerce</h2>
                  <p className="text-sm text-white/70 mt-2">
                    Pas de “one-size-fits-all” : DLC, lots, entamés, unités, variantes…{" "}
                    <span className="font-semibold text-white">l’interface suit votre métier</span>.
                  </p>
                </div>
                <Link to="/metiers" className="text-blue-300 font-semibold text-sm hover:text-blue-200 transition">
                  Voir tous les métiers →
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <PillTab active={tab === "all"} onClick={() => setTab("all")}>Tous</PillTab>
                <PillTab active={tab === "food"} onClick={() => setTab("food")}>Food</PillTab>
                <PillTab active={tab === "retail"} onClick={() => setTab("retail")}>Retail</PillTab>
                <PillTab active={tab === "regulated"} onClick={() => setTab("regulated")}>Réglementé</PillTab>
                <PillTab active={tab === "multi"} onClick={() => setTab("multi")}>Multi-services</PillTab>
              </div>

              <div className="mt-8 grid md:grid-cols-3 gap-4">
                {filteredTrades.map((t) => (
                  <TradeCard key={t.to} {...t} />
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-white">Vous ne vous retrouvez pas dans la liste ?</div>
                <div className="text-sm text-white/70 mt-1">
                  Choisissez <span className="font-semibold text-white">“Autre”</span> à l’inscription : StockScan reste
                  adaptable (unités, services, champs) et vous pourrez ajuster ensuite.
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => nav("/register")} className="w-full sm:w-auto">
                    Créer mon espace
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => nav("/metiers")}
                    className="w-full sm:w-auto bg-white text-slate-900 border-white/60"
                  >
                    Explorer les métiers
                  </Button>
                </div>
              </div>
            </section>

            {/* AUTO DEMO */}
            <section className="py-14 bg-slate-950">
              <div className="mx-auto max-w-6xl px-4">
                <div className="mb-6">
                  <div className="text-sm text-slate-400">Auto-démo</div>
                  <h2 className="text-3xl font-black tracking-tight text-white">Voyez StockScan en action</h2>
                  <p className="mt-2 text-slate-300">
                    Démo guidée (données fictives) : inventaire, pertes, exports, dashboard — sans créer de compte.
                  </p>
                </div>
                <AutoDemoShowcase />
              </div>
            </section>

            {/* FOOTER */}
            <footer className="px-8 md:px-12 py-6 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-white/80">
              <div className="text-sm">© {new Date().getFullYear()} StockScan</div>
              <div className="flex gap-4 text-sm">
                <Link className="hover:text-white" to="/terms">CGU</Link>
                <Link className="hover:text-white" to="/privacy">Confidentialité</Link>
                <Link className="hover:text-white" to="/support">Support</Link>
              </div>
            </footer>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
}