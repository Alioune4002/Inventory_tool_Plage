import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import PageTransition from "../components/PageTransition";
import AutoDemoBlock from "../components/public/AutoDemoBlock.jsx";

export default function Landing() {
  const nav = useNavigate();

  const features = [
    { title: "Ajouter des produits", desc: "Scan code-barres si dispo, sinon SKU interne générable." },
    { title: "Inventaire par mois", desc: "Par service ou global, adapté au métier choisi." },
    { title: "Stats + export", desc: "Valeur stock, pertes, CSV/XLSX, partage email." },
  ];

  return (
    <PageTransition>
      <Helmet>
        <title>Le logiciel d’inventaire qui s’adapte à votre métier | StockScan</title>
        <meta
          name="description"
          content="Restaurant, boulangerie, pharmacie, boutique ou camping : StockScan ajuste automatiquement l’inventaire à votre activité."
        />
      </Helmet>

      <div className="min-h-screen bg-slate-950 text-white">
        <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
          <div className="font-black tracking-tight text-xl text-white">StockScan</div>
          <div className="flex items-center gap-2">
            <Link
              className="rounded-full px-4 py-2 text-sm font-semibold border border-slate-700 bg-slate-900 text-white shadow-soft hover:bg-slate-800"
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

        <main className="mx-auto max-w-6xl px-4 pb-16">
          <Card className="overflow-hidden">
            <div className="p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-900 text-white">
              <div className="space-y-4 text-white">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-white/25 bg-white/10 text-xs font-semibold">
                  ✨ Inventaire premium, simple
                </span>
                <h1 className="text-4xl md:text-5xl font-black leading-[1.05] text-white">
                  Le logiciel d’inventaire qui s’adapte à votre métier
                </h1>
                <p className="text-white/80 text-lg">
                  Restaurant, boulangerie, pharmacie, boutique ou camping : StockScan ajuste automatiquement l’inventaire à votre activité.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => nav("/register")} className="w-full sm:w-auto shadow-glow">
                    Voir comment StockScan fonctionne
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
                    { k: "Métier-first", v: "Champs adaptés, champs inutiles masqués" },
                    { k: "Scan / SKU", v: "Code-barres ou SKU interne généré" },
                    { k: "Exports", v: "CSV/XLSX + partage email" },
                  ].map((b) => (
                    <Card key={b.k} className="p-3 border-white/15 bg-white/10 text-white" glass hover>
                      <div className="font-bold">{b.k}</div>
                      <div className="text-white/80">{b.v}</div>
                    </Card>
                  ))}
                </div>
              </div>

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
                  <div className="text-xs text-white/70">Prochain inventaire</div>
                  <div className="text-lg font-bold">Mois en cours</div>
                </Card>
              </motion.div>
            </div>

            <div className="px-8 md:px-12 pb-10 grid md:grid-cols-3 gap-4 bg-slate-900 text-white">
              {features.map((f) => (
                <Card key={f.title} className="p-4 bg-slate-900 border-slate-800 text-white" hover>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-slate-200 mt-1">{f.desc}</div>
                </Card>
              ))}
            </div>

            <div className="px-8 md:px-12 pb-10 space-y-6 bg-slate-900 text-white" id="metiers">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Choisissez votre type de commerce</h2>
                <Link to="/metiers" className="text-blue-400 font-semibold text-sm">Voir tous les métiers →</Link>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { to: "/pour-restaurant-cuisine", title: "Restaurant / Cuisine", desc: "Produits entamés, pesées, DLC, pertes." },
                  { to: "/pour-bar", title: "Bar", desc: "Unités + volume, bouteilles entamées." },
                  { to: "/pour-boulangerie-patisserie", title: "Boulangerie / Pâtisserie", desc: "Production jour, invendus, matières." },
                  { to: "/pour-epicerie", title: "Épicerie", desc: "Code-barres, prix achat/vente, DLC/DDM." },
                  { to: "/pour-pharmacie", title: "Pharmacie", desc: "Lots, péremption, emplacements, registre." },
                  { to: "/pour-boutique", title: "Boutique non-food", desc: "SKU conseillé, variantes, sans DLC." },
                  { to: "/pour-hotel-camping", title: "Hôtel / Camping", desc: "Multi-services : épicerie, bar, restauration." },
                ].map((card) => (
                  <Link
                    key={card.to}
                    to={card.to}
                    className="group rounded-2xl bg-slate-900 border border-slate-800 p-4 hover:-translate-y-1 hover:shadow-md transition"
                  >
                    <h3 className="text-lg font-semibold group-hover:text-blue-300">{card.title}</h3>
                    <p className="text-sm text-slate-200 mt-1">{card.desc}</p>
                    <span className="text-blue-400 text-sm font-semibold mt-3 inline-block">Découvrir →</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-8 md:px-12 pb-10 bg-slate-950">
              <AutoDemoBlock />
            </div>

            <div className="px-8 md:px-12 pb-12 bg-slate-950 text-white">
              <h2 className="text-xl font-semibold mb-3">En savoir plus</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link to="/comment-ca-marche" className="text-blue-400 font-semibold underline">Comment ça marche</Link>
                <Link to="/metiers" className="text-blue-400 font-semibold underline">Métiers</Link>
                <Link to="/fonctionnalites" className="text-blue-400 font-semibold underline">Fonctionnalités</Link>
                <Link to="/tarifs" className="text-blue-400 font-semibold underline">Tarifs</Link>
                <Link to="/support" className="text-blue-400 font-semibold underline">Support</Link>
              </div>
            </div>

            <footer className="px-8 md:px-12 py-6 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-white/80">
              <div className="text-sm">© {new Date().getFullYear()} StockScan</div>
              <div className="flex gap-4 text-sm">
                <Link className="hover:text-white" to="/terms">
                  CGU
                </Link>
                <Link className="hover:text-white" to="/privacy">
                  Confidentialité
                </Link>
                <Link className="hover:text-white" to="/support">
                  Support
                </Link>
              </div>
            </footer>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
}
