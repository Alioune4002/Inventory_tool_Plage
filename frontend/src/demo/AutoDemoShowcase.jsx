import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import DemoProvider, { useDemo } from "./context/DemoProvider";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Card from "../ui/Card";
import DemoDashboard from "./pages/DemoDashboard";
import DemoInventory from "./pages/DemoInventory";
import DemoExports from "./pages/DemoExports";
import DemoLosses from "./pages/DemoLosses";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

function DemoShell() {
  const { route, setRoute, highlight, toast, setAutoActive } = useDemo();
  const shellRef = useRef(null);
  const isVisible = useInView(shellRef, { margin: "-30% 0px -30% 0px" });

  useEffect(() => {
    if (isVisible) {
      setAutoActive(true);
    }
  }, [isVisible, setAutoActive]);

  const Screen = () => {
    if (route === "inventory") return <DemoInventory />;
    if (route === "exports") return <DemoExports />;
    if (route === "losses") return <DemoLosses />;
    return <DemoDashboard />;
  };

  const navItems = [
    ["dashboard", "Dashboard"],
    ["inventory", "Inventaire"],
    ["losses", "Pertes"],
    ["exports", "Exports"],
  ];

  return (
    <div
      ref={shellRef}
      className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 text-white shadow-[0_30px_70px_rgba(15,23,42,0.65)] overflow-hidden"
    >
      <div className="hidden lg:block">
        <Topbar />
      </div>

      <div className="grid lg:grid-cols-[288px_1fr_360px] min-h-[520px]">
        <Sidebar />

        <div className="p-4 lg:p-6 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 relative overflow-hidden">
          <div className="flex flex-wrap gap-2 mb-4 text-slate-100">
            {navItems.map(([k, label]) => (
              <motion.button
                key={k}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setRoute(k)}
                className={`px-3 py-2 rounded-2xl text-sm font-semibold border border-[var(--border)]
                ${route === k ? "bg-slate-900 text-white shadow-[0_0_20px_rgba(15,23,42,0.45)]" : "bg-[var(--surface)] text-[var(--text)]"}`}
              >
                {label}
              </motion.button>
            ))}
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.94 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {highlight?.text ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="pointer-events-none absolute top-4 right-4 z-20 max-w-[280px] w-full"
                >
                  <Card className="p-4 bg-white/10 text-white border border-white/20 shadow-[0_40px_60px_rgba(2,6,23,0.55)]">
                    <div className="text-xs uppercase tracking-wide text-white/70">Auto-démo</div>
                    <div className="mt-1 text-sm font-semibold leading-tight">{highlight.text}</div>
                    <div className="mt-2 text-xs text-white/70">
                      Données fictives · UI identique au produit
                    </div>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {toast ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
                >
                  <div className="px-5 py-3 rounded-2xl bg-white/90 border border-slate-200 shadow-soft text-sm font-semibold text-slate-900">
                    {toast.message}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="hidden lg:block p-6">
          <div className="sticky top-20 space-y-3">
            <div className="text-sm font-semibold text-slate-400">Aperçu mobile</div>
            <div className="rounded-[38px] border border-slate-700 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.45)] p-3">
              <div className="rounded-[30px] overflow-hidden border border-slate-200 bg-slate-950 text-white">
                <div className="h-7 bg-slate-900 flex items-center justify-center">
                  <div className="h-2 w-16 rounded-full bg-white/20" />
                </div>
                <div className="p-3">
                  <div className="text-xs text-slate-400 mb-2">UI réelle (démo)</div>
                  <div className="scale-[0.85] origin-top-left w-[120%]">
                    <Screen />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Affichage simplifié pour montrer l’app sur téléphone (comme Stripe).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutoDemoShowcase() {
  if (!DEMO_MODE) {
    return null;
  }
  return (
    <DemoProvider>
      <DemoShell />
    </DemoProvider>
  );
}
