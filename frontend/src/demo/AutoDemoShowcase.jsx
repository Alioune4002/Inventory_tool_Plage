import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Card from "../ui/Card";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

const SCENES = [
  {
    id: "catalogue",
    label: "Catalogue",
    title: "Produits = catalogue",
    subtitle: "Un référentiel unique : catégories, identifiants, TVA, notes.",
    helper: "Zéro stock ici. Le comptage se fait côté Inventaire.",
  },
  {
    id: "inventory",
    label: "Inventaire",
    title: "Inventaire = comptage",
    subtitle: "Quantités du mois, pertes optionnelles, champs métier activés.",
    helper: "Comptage rapide + pré-remplissage des champs non quantité.",
  },
  {
    id: "exports",
    label: "Exports",
    title: "Exports sur mesure",
    subtitle: "Choisissez vos champs, vos catégories et les graphiques.",
    helper: "CSV/XLSX prêts pour la compta et les équipes.",
  },
];

const MOTION = {
  enter: { opacity: 0, y: 16, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
};

const sampleRows = [
  { name: "Article 102", category: "Rayon A", identifier: "SKU-102", price: "12,40 €" },
  { name: "Article 244", category: "Rayon B", identifier: "EAN 356...", price: "6,90 €" },
  { name: "Article 556", category: "Rayon C", identifier: "SKU-556", price: "3,60 €" },
];

const StatCard = ({ label, value }) => (
  <Card className="p-3 border-white/10 bg-white/5">
    <div className="text-xs text-white/60">{label}</div>
    <div className="text-lg font-semibold text-white">{value}</div>
  </Card>
);

const CataloguePanel = () => (
  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 space-y-4">
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>Catalogue</span>
      <span>Mis à jour</span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Références" value="326" />
      <StatCard label="Catégories" value="12" />
      <StatCard label="TVA active" value="Oui" />
    </div>
    <div className="space-y-2">
      {sampleRows.map((row) => (
        <div
          key={row.name}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 flex items-center justify-between"
        >
          <div>
            <div className="font-semibold text-white">{row.name}</div>
            <div className="text-xs text-white/50">
              {row.category} · {row.identifier}
            </div>
          </div>
          <div className="text-xs font-semibold text-white/70">{row.price}</div>
        </div>
      ))}
    </div>
  </div>
);

const InventoryPanel = () => (
  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 space-y-3">
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>Comptage · Décembre</span>
      <span>Pertes activées</span>
    </div>
    <div className="space-y-2">
      {sampleRows.map((row) => (
        <div key={row.name} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center justify-between text-sm text-white">
            <span className="font-semibold">{row.name}</span>
            <span className="text-xs text-white/60">PCS</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-white/70">
              Quantité · —
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-white/60">
              Pertes · 0
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ExportPanel = () => (
  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 space-y-4">
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>Exports</span>
      <span>Excel / CSV</span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
      {["Nom", "Catégorie", "Identifiant", "Quantité", "TVA", "Service"].map((label) => (
        <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1">
          ✓ {label}
        </div>
      ))}
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
      Graphiques & synthèse inclus
    </div>
    <button
      type="button"
      className="w-full rounded-2xl bg-blue-500/90 py-2 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(59,130,246,0.35)]"
    >
      Télécharger l’export
    </button>
  </div>
);

const ScenePanel = ({ sceneId }) => {
  if (sceneId === "inventory") return <InventoryPanel />;
  if (sceneId === "exports") return <ExportPanel />;
  return <CataloguePanel />;
};

const PhonePreview = ({ sceneId }) => (
  <div className="rounded-[36px] border border-white/10 bg-slate-950 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.55)]">
    <div className="rounded-[28px] overflow-hidden border border-white/10 bg-slate-950">
      <div className="h-7 bg-slate-900 flex items-center justify-center">
        <div className="h-2 w-16 rounded-full bg-white/20" />
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] text-white/60">UI mobile (démo)</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
          {sceneId === "inventory" ? "Comptage rapide" : sceneId === "exports" ? "Exports" : "Catalogue"}
        </div>
        <div className="space-y-2">
          {sampleRows.slice(0, 2).map((row) => (
            <div key={row.name} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80">
              <div className="font-semibold">{row.name}</div>
              <div className="text-white/50">{row.category}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function AutoDemoShowcase() {
  if (!DEMO_MODE) return null;

  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { margin: "-30% 0px -30% 0px" });

  const activeScene = useMemo(() => SCENES[active] || SCENES[0], [active]);

  useEffect(() => {
    if (!isInView || reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % SCENES.length);
    }, 7500);
    return () => window.clearInterval(timer);
  }, [isInView, reduceMotion]);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.6)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
      <div className="pointer-events-none absolute -top-32 -right-40 h-72 w-72 rounded-full bg-blue-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-40 h-72 w-72 rounded-full bg-cyan-400/20 blur-[120px]" />

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.35em] text-white/60">Auto-démo</div>
          <h3 className="text-3xl font-black tracking-tight">{activeScene.title}</h3>
          <p className="text-white/70">{activeScene.subtitle}</p>
          <p className="text-sm text-white/50">{activeScene.helper}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            {SCENES.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setActive(idx)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  idx === active
                    ? "border-white/40 bg-white text-slate-900"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {scene.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-3">
            {[
              "Champs adaptés par métier",
              "Inventaire sans doublon",
              "Exports personnalisables",
              "Modules activables à la carte",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>StockScan · Démo</span>
              <span>Données fictives</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScene.id}
                initial={MOTION.enter}
                animate={MOTION.center}
                exit={MOTION.exit}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="mt-4"
              >
                <ScenePanel sceneId={activeScene.id} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="hidden lg:block absolute -right-6 top-10 w-44">
            <PhonePreview sceneId={activeScene.id} />
          </div>

          <div className="mt-4 lg:hidden">
            <PhonePreview sceneId={activeScene.id} />
          </div>
        </div>
      </div>
    </section>
  );
}
