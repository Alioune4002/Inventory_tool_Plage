import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Card from "../ui/Card";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

const SCENES = [
  {
    id: "catalogue",
    label: "Catalogue",
    title: "Catalogue propre",
    subtitle: "Nom, catégorie, identifiant et prix — sans surcharge.",
    helper: "Les quantités se font dans l’inventaire du mois.",
  },
  {
    id: "inventory",
    label: "Inventaire",
    title: "Comptage du mois",
    subtitle: "Quantités + pertes optionnelles, en quelques minutes.",
    helper: "DLC / lots activables selon vos besoins.",
  },
  {
    id: "exports",
    label: "Exports",
    title: "Exports lisibles",
    subtitle: "CSV / Excel + champs personnalisés.",
    helper: "Synthèse & graphiques disponibles en plan Multi.",
  },
];

const MOTION = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const sampleRows = [
  { name: "Baguette tradition", category: "Boulangerie", identifier: "SKU-104", price: "1,20 €" },
  { name: "Croissant", category: "Viennoiseries", identifier: "SKU-201", price: "1,40 €" },
  { name: "Farine T55", category: "Ingrédients", identifier: "EAN 356...", price: "14,80 €" },
];

const isLowEndDevice = () => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  return (cores && cores <= 4) || (memory && memory <= 4);
};

const StatChip = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
    <div className="text-[11px] text-white/50">{label}</div>
    <div className="text-sm font-semibold text-white">{value}</div>
  </div>
);

const CataloguePanel = () => (
  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 space-y-3">
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>Catalogue</span>
      <span>Référentiel</span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <StatChip label="Références" value="326" />
      <StatChip label="Catégories" value="12" />
    </div>
    <div className="space-y-2">
      {sampleRows.slice(0, 2).map((row) => (
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
      <span>Inventaire · Décembre</span>
      <span>Pertes (optionnel)</span>
    </div>
    <div className="space-y-2">
      {sampleRows.slice(0, 2).map((row) => (
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
  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 space-y-3">
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>Exports</span>
      <span>CSV / Excel</span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
      {["Nom", "Catégorie", "Identifiant", "Quantité", "Service", "DLC"].map((label) => (
        <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1">
          ✓ {label}
        </div>
      ))}
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
      Synthèse & graphiques : plan Multi.
    </div>
    <button
      type="button"
      className="w-full rounded-2xl bg-blue-500/90 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.25)]"
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
  <div className="rounded-[30px] border border-white/10 bg-slate-950 p-3 shadow-[0_18px_36px_rgba(15,23,42,0.45)]">
    <div className="rounded-[22px] overflow-hidden border border-white/10 bg-slate-950">
      <div className="h-6 bg-slate-900 flex items-center justify-center">
        <div className="h-2 w-14 rounded-full bg-white/20" />
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] text-white/60">UI mobile</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
          {sceneId === "inventory" ? "Comptage rapide" : sceneId === "exports" ? "Exports" : "Catalogue"}
        </div>
        <div className="space-y-2">
          {sampleRows.slice(0, 1).map((row) => (
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
  const isInView = useInView(containerRef, { margin: "-35% 0px -35% 0px" });
  const lowEnd = isLowEndDevice();
  const canAnimate = !reduceMotion && !lowEnd;

  const activeScene = useMemo(() => SCENES[active] || SCENES[0], [active]);

  useEffect(() => {
    if (!isInView || !canAnimate) return undefined;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % SCENES.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [isInView, canAnimate]);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.45)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />

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
            {canAnimate ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScene.id}
                  initial={MOTION.enter}
                  animate={MOTION.center}
                  exit={MOTION.exit}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="mt-4"
                >
                  <ScenePanel sceneId={activeScene.id} />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="mt-4">
                <ScenePanel sceneId={activeScene.id} />
              </div>
            )}
          </div>

          <div className="hidden lg:block absolute -right-4 top-10 w-40">
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
