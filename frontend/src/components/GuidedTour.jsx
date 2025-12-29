
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getTourKey, getTourPendingKey } from "../lib/tour";


const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const pickTarget = (targets) => {
  for (const sel of targets || []) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      // ignore invalid selectors
    }
  }
  return null;
};

const scrollToTarget = (el) => {
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch {
    // ignore
  }
};

const makeHighlighter = () => {
  let lastEl = null;
  let lastStyle = null;

  const clear = () => {
    if (!lastEl) return;
    try {
      lastEl.style.boxShadow = lastStyle.boxShadow ?? "";
      lastEl.style.outline = lastStyle.outline ?? "";
      lastEl.style.position = lastStyle.position ?? "";
      lastEl.style.zIndex = lastStyle.zIndex ?? "";
      lastEl.style.borderRadius = lastStyle.borderRadius ?? "";
    } catch {
      // ignore
    }
    lastEl = null;
    lastStyle = null;
  };

  const apply = (el) => {
    clear();
    if (!el) return;

    lastEl = el;
    lastStyle = {
      boxShadow: el.style.boxShadow,
      outline: el.style.outline,
      position: el.style.position,
      zIndex: el.style.zIndex,
      borderRadius: el.style.borderRadius,
    };

    // Highlight visible + safe (sans dépendre de classes Tailwind “purgeables”)
    try {
      el.style.borderRadius = el.style.borderRadius || "14px";
      el.style.outline = "2px solid rgba(59, 130, 246, 0.95)";
      el.style.boxShadow = "0 0 0 6px rgba(59, 130, 246, 0.18)";
      // s’assurer qu’il n’est pas “écrasé” par un parent
      el.style.position = el.style.position || "relative";
      el.style.zIndex = "70";
    } catch {
      // ignore
    }
  };

  const waitForTarget = (targets, timeout = 2000) =>
    new Promise((resolve) => {
      const start = Date.now();

      const tick = () => {
        const el = pickTarget(targets);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return resolve(null);
        requestAnimationFrame(tick);
      };

      tick();
    });

  return { apply, clear, waitForTarget };
};

export default function GuidedTour({ userId, onRequestMobileNav }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [startedByUser, setStartedByUser] = useState(false); // utile si tu veux tracer plus tard

  const highlighterRef = useRef(makeHighlighter());

  // Étapes pédagogiques + cibles (plusieurs sélecteurs possibles => robuste)
  const steps = useMemo(
    () => [
      {
        id: "welcome",
        title: "Bienvenue sur StockScan",
        body:
          "En 1 minute, on vous montre l’essentiel : produits, inventaires, exports, multi-services et équipe. Vous pourrez relancer cette visite depuis Paramètres.",
        targets: [
          '[data-tour="app-shell"]',
          "#root",
        ],
      },
      {
        id: "service",
        title: "Service sélectionné",
        body:
          "Si vous avez plusieurs services (ex : cuisine + salle, bar + restaurant), StockScan filtre automatiquement les écrans par service.",
        targets: [
          '[data-tour="service-switcher"]',
          '[data-tour="topbar-service"]',
          'button[aria-label*="service"]',
          'select[name="service"]',
        ],
      },
      {
        id: "products",
        title: "Produits",
        body:
          "Ajoutez vos produits manuellement ou par scan. Utilisez les catégories, les unités, et selon votre métier : code-barres, SKU, lots, DLC/DDM, variantes…",
        targets: [
          '[data-tour="nav-products"]',
          'a[href="/products"]',
          'a[href^="/products"]',
        ],
      },
      {
        id: "inventory",
        title: "Inventaires mensuels",
        body:
          "Chaque mois, comptez vos stocks. Vous pouvez déclarer les pertes et suivre l’évolution. StockScan garde l’historique et facilite les comparaisons.",
        targets: [
          '[data-tour="nav-inventory"]',
          'a[href="/inventory"]',
          'a[href^="/inventory"]',
        ],
      },
      {
        id: "scan",
        title: "Scan ou saisie",
        body:
          "Sur mobile, le scan accélère la saisie. Sur ordinateur, la saisie manuelle est souvent plus rapide. Vous pouvez choisir votre mode dans Paramètres.",
        targets: [
          '[data-tour="scan-entry"]',
          '[data-tour="scan-button"]',
          'button[aria-label*="scan"]',
        ],
      },
      {
        id: "stats",
        title: "Tableau de bord & analyses",
        body:
          "Suivez vos indicateurs : valeur de stock, variations, pertes, et selon vos modules : marges théoriques, TVA, etc. Exportez ou partagez quand vous le souhaitez.",
        targets: [
          '[data-tour="nav-dashboard"]',
          'a[href="/"]',
          'a[href="/dashboard"]',
          'a[href^="/dashboard"]',
        ],
      },
      {
        id: "exports",
        title: "Exports (CSV / Excel)",
        body:
          "Téléchargez vos inventaires et catalogues. Très utile pour compta, contrôle interne, ou partage avec un associé.",
        targets: [
          '[data-tour="nav-exports"]',
          'a[href="/exports"]',
          'a[href^="/exports"]',
        ],
      },
      {
        id: "team",
        title: "Équipe & accès",
        body:
          "Invitez des membres (opérateur ou gestionnaire). Vous pouvez limiter l’accès à un service précis, et suivre l’activité récente.",
        targets: [
          '[data-tour="nav-settings"]',
          'a[href="/settings"]',
          'a[href^="/settings"]',
        ],
      },
      {
        id: "services-modules",
        title: "Modules métier",
        body:
          "Dans Paramètres, activez/désactivez les modules selon votre activité : TVA, prix, DLC/DDM, lots, multi-unités, ouvert/entamé, variantes, matières premières…",
        targets: [
          '[data-tour="settings-modules"]',
          'h2, h3',
        ],
      },
      {
        id: "finish",
        title: "C’est prêt",
        body:
          "Vous pouvez commencer. Si vous avez un doute : Paramètres → Relancer la visite guidée.",
        targets: [
          '[data-tour="nav-settings"]',
          'a[href="/settings"]',
          'a[href^="/settings"]',
        ],
      },
    ],
    []
  );

  // Auto-start : 1ère connexion OU relance demandée depuis Paramètres
  useEffect(() => {
    if (!userId) return;

    const tourKey = getTourKey(userId);
    const pendingKey = getTourPendingKey(userId);

    const alreadyDone = localStorage.getItem(tourKey) === "done";
    const pending = localStorage.getItem(pendingKey) === "1";

    if (pending || !alreadyDone) {
      // on “consomme” le pending immédiatement (sinon boucle)
      if (pending) localStorage.removeItem(pendingKey);
      setStartedByUser(pending);
      setStepIndex(0);
      setOpen(true);
    }
  }, [userId]);

  // Highlight + scroll sur chaque step
 useEffect(() => {
  if (!open) {
    highlighterRef.current.clear();
    return;
  }

  const step = steps[clamp(stepIndex, 0, steps.length - 1)];
  let cancelled = false;

  waitForTarget(step?.targets).then((el) => {
    if (cancelled) return;

    if (el) {
      scrollToTarget(el);
      setTimeout(() => {
        if (!cancelled) highlighterRef.current.apply(el);
      }, 120);
    } else {
     
      highlighterRef.current.clear();
    }
  });

  return () => {
    cancelled = true;
  };
}, [open, stepIndex, steps]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish("closed");
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  const markDone = () => {
    if (!userId) return;
    const tourKey = getTourKey(userId);
    localStorage.setItem(tourKey, "done");
  };

  const finish = (_reason = "done") => {
    markDone();
    setOpen(false);
    setStepIndex(0);
    highlighterRef.current.clear();
  };

  const skip = () => finish("skipped");

  const next = () => {
    setStepIndex((i) => {
      const n = i + 1;
      if (n >= steps.length) {
        finish("done");
        return i;
      }
      return n;
    });
  };

  const prev = () => setStepIndex((i) => Math.max(0, i - 1));

  if (!open) return null;

  const step = steps[clamp(stepIndex, 0, steps.length - 1)];
  const progress = `${stepIndex + 1}/${steps.length}`;
  const targetEl = pickTarget(step?.targets);

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label="Visite guidée"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={skip}
      />

      {/* popover: centré + mobile-first (en bas) */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6">
        <div
          className={[
            "mx-auto w-full",
            "max-w-[560px]",
            "rounded-3xl border border-[var(--border)] bg-[var(--surface)]",
            "shadow-2xl",
          ].join(" ")}
        >
          <div className="p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-[var(--muted)]">
                  Visite guidée · Étape {progress}
                  {startedByUser ? " · relancée" : ""}
                </div>
                <div className="text-lg sm:text-xl font-black text-[var(--text)]">
                  {step?.title}
                </div>
              </div>

              <button
                type="button"
                onClick={skip}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:opacity-90"
                aria-label="Fermer la visite"
                title="Fermer"
              >
                Fermer
              </button>
            </div>

            <div className="text-sm sm:text-[15px] leading-relaxed text-[var(--muted)]">
              {step?.body}
            </div>

            {/* aide de ciblage */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (targetEl) scrollToTarget(targetEl);
                }}
                disabled={!targetEl}
                className={[
                  "rounded-2xl px-3 py-2 text-sm font-semibold",
                  "border border-[var(--border)]",
                  targetEl ? "bg-[var(--surface)] text-[var(--text)] hover:opacity-90" : "bg-[var(--surface)] text-[var(--muted)] opacity-60",
                ].join(" ")}
              >
                Voir l’élément concerné
              </button>

              {!targetEl ? (
                <div className="text-xs text-[var(--muted)]">
                  (Astuce : ajoute des attributs <span className="font-semibold">data-tour</span> pour un guidage précis.)
                </div>
              ) : null}
            </div>

            {/* progress dots */}
            <div className="flex items-center gap-1.5 pt-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    i === stepIndex ? "w-6 bg-[var(--text)]" : "w-2 bg-[var(--border)]",
                  ].join(" ")}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={prev}
                disabled={stepIndex === 0}
                className={[
                  "rounded-2xl px-4 py-2 text-sm font-semibold",
                  "border border-[var(--border)]",
                  stepIndex === 0 ? "opacity-50 text-[var(--muted)]" : "text-[var(--text)] hover:opacity-90",
                ].join(" ")}
              >
                Précédent
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={skip}
                  className="rounded-2xl px-4 py-2 text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:opacity-90"
                >
                  Passer
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="rounded-2xl px-4 py-2 text-sm font-semibold bg-[var(--text)] text-[var(--surface)] hover:opacity-90"
                >
                  {stepIndex === steps.length - 1 ? "Terminer" : "Suivant"}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[var(--muted)] pt-2">
              Raccourcis clavier : ← / → pour naviguer, Échap pour fermer.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
