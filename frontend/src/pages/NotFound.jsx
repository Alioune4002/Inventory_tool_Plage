import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import PublicShell from "../components/public/PublicShell";
import Button from "../ui/Button";

export default function NotFound() {
  const loc = useLocation();

  return (
    <PublicShell>
      <Helmet>
        <title>404 — Page introuvable | StockScan</title>
        <meta name="description" content="Page introuvable (404) — StockScan." />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-14 text-white">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-8 md:p-12">
          {/* fond animé */}
          <div className="pointer-events-none absolute inset-0 opacity-30 bg-grid" />
          <motion.div
            className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-600 blur-[140px] opacity-30"
            animate={{ y: [0, 12, 0], x: [0, 8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-cyan-400 blur-[160px] opacity-20"
            animate={{ y: [0, -10, 0], x: [0, -8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            {/* Texte */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                Incident de navigation détecté
              </div>

              <h1 className="text-3xl md:text-5xl font-black leading-[1.05]">
                Oups… cette page a disparu
              </h1>

              <p className="text-slate-200 text-sm md:text-base">
                On a cherché partout, même dans l’arrière-boutique. Rien.
                <br />
                <span className="text-white/80">
                  Chemin demandé :
                </span>{" "}
                <span className="font-mono text-white/90 break-all">
                  {loc.pathname}
                </span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button as={Link} to="/" className="w-full sm:w-auto">
                  Retour à l’accueil
                </Button>

                <Button
                  as={Link}
                  to="/metiers"
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  Voir les métiers
                </Button>

                <Button
                  as={Link}
                  to="/support"
                  variant="ghost"
                  className="w-full sm:w-auto"
                >
                  Contacter le support
                </Button>
              </div>

              <div className="text-xs text-white/60">
                Astuce : si tu arrives ici depuis un lien, envoie-le au support — on le corrigera vite.
              </div>
            </div>

            {/* Illustration 404 */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <div className="text-xs text-white/60">Diagnostic</div>

                <div className="mt-3 flex items-end gap-3">
                  <motion.div
                    className="text-6xl md:text-7xl font-black tracking-tight"
                    animate={{ rotate: [0, -2, 0, 2, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    404
                  </motion.div>
                  <div className="pb-2 text-sm text-white/70">
                    Page introuvable
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <motion.div
                    className="h-2 w-full rounded-full bg-white/10 overflow-hidden"
                    initial={false}
                  >
                    <motion.div
                      className="h-full rounded-full bg-white/60"
                      animate={{ x: ["-60%", "120%"] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      style={{ width: "45%" }}
                    />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/60">Statut</div>
                      <div className="mt-1 text-sm font-semibold">Non trouvée</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/60">Action</div>
                      <div className="mt-1 text-sm font-semibold">Revenir / naviguer</div>
                    </div>
                  </div>

                  <div className="text-xs text-white/60">
                    StockScan : on garde l’inventaire… même des pages perdues.
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}