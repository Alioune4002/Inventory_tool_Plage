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
    <div ref={shellRef} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-soft overflow-hidden">
      {/* Frame app */}
      <div className="hidden lg:block">
        <Topbar />
      </div>

      <div className="grid lg:grid-cols-[288px_1fr_360px] min-h-[520px]">
        <Sidebar />

        <div className="p-4 lg:p-6">
          {/* mini nav (demo) */}
          <div className="flex flex-wrap gap-2 mb-4">
            {navItems.map(([k, label]) => (
              <motion.button
                key={k}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setRoute(k)}
                className={`px-3 py-2 rounded-2xl text-sm font-semibold border border-[var(--border)]
                ${route === k ? "bg-slate-900 text-white shadow-[0_0_20px_rgba(15,23,42,0.4)]" : "bg-[var(--surface)] text-[var(--text)]"}`}
              >
                {label}
              </motion.button>
            ))}
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>

            {/* Overlay highlight */}
            <AnimatePresence>
              {highlight?.text ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute -top-3 right-0 max-w-md"
                >
                  <Card className="p-4 bg-slate-900 text-white border border-white/10 shadow-glow">
                    <div className="text-xs uppercase tracking-wide text-white/70">Auto-démo</div>
                    <div className="mt-1 text-sm font-semibold">{highlight.text}</div>
                    <div className="mt-2 text-xs text-white/70">
                      Données fictives · UI identique au produit
                    </div>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Toast demo */}
            <AnimatePresence>
              {toast ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
                >
                  <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-soft text-sm font-semibold">
                    {toast.message}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile preview */}
        <div className="hidden lg:block p-6">
          <div className="sticky top-20">
            <div className="text-sm font-semibold text-slate-700 mb-3">Aperçu mobile</div>
            <div className="rounded-[36px] border border-slate-200 bg-white shadow-soft p-3">
              <div className="rounded-[28px] overflow-hidden border border-slate-200">
                <div className="h-7 bg-slate-900 flex items-center justify-center">
                  <div className="h-2 w-16 rounded-full bg-white/20" />
                </div>
                <div className="p-3">
                  <div className="text-xs text-slate-500 mb-2">UI réelle (démo)</div>
                  <div className="scale-[0.85] origin-top-left w-[120%]">
                    <Screen />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Affichage simplifié pour montrer l’app sur téléphone (comme Stripe).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutoDemoShowcase() {
  return (
    <DemoProvider>
      <DemoShell />
    </DemoProvider>
  );
}
