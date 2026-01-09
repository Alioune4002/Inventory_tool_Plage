// src/components/GuidedTour.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  if (!el) return;
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

    try {
      el.style.borderRadius = el.style.borderRadius || "16px";
      el.style.outline = "2px solid rgba(59, 130, 246, 0.95)";
      el.style.boxShadow = "0 0 0 8px rgba(59, 130, 246, 0.18)";
      el.style.position = el.style.position || "relative";
      el.style.zIndex = "90";
    } catch {
      // ignore
    }
  };

  const waitForTarget = (targets, timeout = 4500) =>
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

const isDashboardPath = (p) => {
  const path = String(p || "");
  // ✅ routes app
  return path === "/app" || path.startsWith("/app/dashboard");
};

export default function GuidedTour({ userId, onRequestMobileNav }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [startedByUser, setStartedByUser] = useState(false);

  const [anchor, setAnchor] = useState(null); // { top,left,width,height }
  const [placement, setPlacement] = useState("bottom"); // top|bottom|left|right|sheet
  const [readyAnim, setReadyAnim] = useState(false);

  const highlighterRef = useRef(makeHighlighter());
  const rafRef = useRef(null);

  // ---------------------------------------------
  // Steps: ordre = modules sidebar (tout couvert)
  // ---------------------------------------------
  const steps = useMemo(
    () => [
      {
        id: "dashboard",
        title: "Dashboard",
        body:
          "Votre vue globale : valeur de stock, alertes, raccourcis, et accès rapide aux écrans clés. Idéal pour voir “où vous en êtes” en 10 secondes.",
        targets: [
          '[data-tour="nav-dashboard"]',
          'a[href="/app"]',
          'a[href="/app/dashboard"]',
          'a[href$="/dashboard"]',
        ],
        wantNavOpen: true,
      },
      {
        id: "inventory",
        title: "Inventaire",
        body:
          "Le cœur de StockScan : comptez vos stocks (mode progressif / chrono), comparez les périodes et gardez un historique propre sans refaire des tableaux Excel.",
        targets: ['[data-tour="nav-inventory"]', 'a[href$="/inventory"]', 'a[href*="/inventory"]'],
        wantNavOpen: true,
      },
      {
        id: "products",
        title: "Produits",
        body:
          "Créez et maintenez votre catalogue. Scan ou saisie, catégories, unités, DLC/DDM, lots, variantes… tout ce qui évite les doublons et les erreurs.",
        targets: ['[data-tour="nav-products"]', 'a[href$="/products"]', 'a[href*="/products"]'],
        wantNavOpen: true,
      },
      {
        id: "categories",
        title: "Catégories",
        body:
          "Organisez vos produits pour gagner du temps en inventaire et obtenir des exports plus lisibles (compta, contrôle interne, associé…).",
        targets: ['[data-tour="nav-categories"]', 'a[href$="/categories"]', 'a[href*="/categories"]'],
        wantNavOpen: true,
      },
      {
        id: "losses",
        title: "Pertes",
        body:
          "Déclarez ce qui est jeté / cassé / périmé. Vous comprenez vos pertes réelles et vous améliorez vos commandes et votre rentabilité.",
        targets: ['[data-tour="nav-losses"]', 'a[href$="/losses"]', 'a[href*="/losses"]', 'a[href*="/pertes"]'],
        wantNavOpen: true,
      },
      {
        id: "exports",
        title: "Exports",
        body:
          "Exportez inventaires, catalogues et documents (CSV / Excel / PDF). Parfait pour la compta, le partage, ou archiver vos contrôles.",
        targets: ['[data-tour="nav-exports"]', 'a[href$="/exports"]', 'a[href*="/exports"]'],
        wantNavOpen: true,
      },
      {
        id: "duplicates",
        title: "Doublons",
        body:
          "Détectez et fusionnez les doublons (souvent causés par des variantes de nom ou plusieurs scans). Résultat : un catalogue clean et un inventaire plus rapide.",
        targets: ['[data-tour="nav-duplicates"]', 'a[href$="/duplicates"]', 'a[href*="/duplicates"]'],
        wantNavOpen: true,
      },
      {
        id: "rituals",
        title: "Rituels",
        body:
          "Des checklists simples pour standardiser votre routine : inventaire, réception, contrôle DLC, etc. Vous gagnez en régularité et en fiabilité.",
        targets: ['[data-tour="dashboard-rituals"]', 'a[href$="/rituals"]', 'a[href*="/rituals"]'],
        wantNavOpen: false,
      },
      {
        id: "receipts",
        title: "Réceptions",
        body:
          "Réception fournisseur : scannez / saisissez au fil de l’arrivée, réduisez les erreurs, et mettez votre stock à jour immédiatement.",
        targets: ['[data-tour="nav-receipts"]', 'a[href$="/receipts"]', 'a[href*="/receipts"]', 'a[href*="/receptions"]'],
        wantNavOpen: true,
      },
      {
        id: "labels",
        title: "Étiquettes",
        body:
          "Générez des étiquettes (prix / code-barres) rapidement pour vos rayons et votre organisation interne. Ultra utile pour éviter les erreurs en caisse / saisie.",
        targets: ['[data-tour="nav-labels"]', 'a[href$="/labels"]', 'a[href*="/labels"]', 'a[href*="/etiquettes"]'],
        wantNavOpen: true,
      },
      {
        id: "finish",
        title: "C’est bon ✅",
        body:
          "Vous êtes prêt. Vous pouvez relancer cette visite à tout moment dans Paramètres → “Relancer la visite guidée”.",
        targets: ['[data-tour="nav-settings"]', 'a[href$="/settings"]', 'a[href*="/settings"]'],
        wantNavOpen: true,
      },
    ],
    []
  );

  // ---------------------------------------------
  // Start logic: démarre seulement sur Dashboard (/app)
  // ---------------------------------------------
  useEffect(() => {
    if (!userId) return;

    const tourKey = getTourKey(userId);
    const pendingKey = getTourPendingKey(userId);

    const alreadyDone = localStorage.getItem(tourKey) === "done";
    const pending = localStorage.getItem(pendingKey) === "1";

    const shouldStart = pending || !alreadyDone;
    if (!shouldStart) return;

    if (!isDashboardPath(window.location.pathname)) {
      localStorage.setItem(pendingKey, "1");
      return;
    }

    if (pending) localStorage.removeItem(pendingKey);
    setStartedByUser(pending);
    setStepIndex(0);
    setOpen(true);
    setReadyAnim(false);

    // ✅ ouvrir le menu mobile
    try {
      onRequestMobileNav?.(true);
    } catch {
      // ignore
    }
  }, [userId, onRequestMobileNav]);

  // ---------------------------------------------
  // Anchor placement
  // ---------------------------------------------
  const computeAnchor = (el) => {
    if (!el) return { placement: "sheet", rect: null };

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    if (r.width < 4 || r.height < 4) return { placement: "sheet", rect: null };

    if (vw < 520) return { placement: "sheet", rect: null };

    const spaceTop = r.top;
    const spaceBottom = vh - r.bottom;
    const spaceLeft = r.left;
    const spaceRight = vw - r.right;

    const best = [
      { k: "bottom", v: spaceBottom },
      { k: "top", v: spaceTop },
      { k: "right", v: spaceRight },
      { k: "left", v: spaceLeft },
    ].sort((a, b) => b.v - a.v)[0]?.k;

    return { placement: best || "bottom", rect: { top: r.top, left: r.left, width: r.width, height: r.height } };
  };

  const updateAnchorLoop = (el) => {
    if (!open) return;

    const tick = () => {
      if (!open) return;
      const res = computeAnchor(el);
      setPlacement(res.placement);
      setAnchor(res.rect);
      rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  // ---------------------------------------------
  // Step change: open nav, wait, scroll, highlight, anchor
  // ---------------------------------------------
  useEffect(() => {
    if (!open) {
      highlighterRef.current.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const step = steps[clamp(stepIndex, 0, steps.length - 1)];
    let cancelled = false;

    if (step?.wantNavOpen) {
      try {
        onRequestMobileNav?.(true);
      } catch {
        // ignore
      }
    }

    (async () => {
      const el = await highlighterRef.current.waitForTarget(step?.targets, 4500);
      if (cancelled) return;

      if (el) {
        scrollToTarget(el);
        setTimeout(() => {
          if (cancelled) return;
          highlighterRef.current.apply(el);
          const res = computeAnchor(el);
          setPlacement(res.placement);
          setAnchor(res.rect);
          updateAnchorLoop(el);
          setTimeout(() => setReadyAnim(true), 60);
        }, 140);
      } else {
        highlighterRef.current.clear();
        setPlacement("sheet");
        setAnchor(null);
        setTimeout(() => setReadyAnim(true), 60);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, stepIndex, steps, onRequestMobileNav]);

  // Escape / arrows
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
    setAnchor(null);
    setPlacement("sheet");
    setReadyAnim(false);
    highlighterRef.current.clear();
    try {
      onRequestMobileNav?.(false);
    } catch {
      // ignore
    }
  };

  const skip = () => finish("skipped");

  const next = () => {
    setReadyAnim(false);
    setStepIndex((i) => {
      const n = i + 1;
      if (n >= steps.length) {
        finish("done");
        return i;
      }
      return n;
    });
  };

  const prev = () => {
    setReadyAnim(false);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  if (!open) return null;

  const step = steps[clamp(stepIndex, 0, steps.length - 1)];
  const progress = `${stepIndex + 1}/${steps.length}`;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const isSheet = placement === "sheet" || !anchor;

  const POP_W = vw < 900 ? 360 : 420;
  const POP_H = 210;

  const popStyle = (() => {
    if (isSheet || !anchor) return null;
    const pad = 12;
    const r = anchor;

    let top = 0;
    let left = 0;

    if (placement === "bottom") {
      top = r.top + r.height + 12;
      left = r.left + r.width / 2 - POP_W / 2;
    } else if (placement === "top") {
      top = r.top - POP_H - 12;
      left = r.left + r.width / 2 - POP_W / 2;
    } else if (placement === "right") {
      top = r.top + r.height / 2 - POP_H / 2;
      left = r.left + r.width + 12;
    } else {
      top = r.top + r.height / 2 - POP_H / 2;
      left = r.left - POP_W - 12;
    }

    top = Math.max(pad, Math.min(top, (window.innerHeight || 800) - POP_H - pad));
    left = Math.max(pad, Math.min(left, (window.innerWidth || 1200) - POP_W - pad));

    return { position: "fixed", top, left, width: POP_W, zIndex: 100 };
  })();

  const arrowStyle = (() => {
    if (isSheet || !anchor || !popStyle) return null;

    const r = anchor;
    const popTop = popStyle.top;
    const popLeft = popStyle.left;

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const base = {
      position: "fixed",
      zIndex: 101,
      width: 12,
      height: 12,
      transform: "rotate(45deg)",
      borderRadius: 2,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    };

    if (placement === "bottom") {
      return { ...base, top: popTop - 6, left: clamp(cx - 6, popLeft + 16, popLeft + POP_W - 28) };
    }
    if (placement === "top") {
      return { ...base, top: popTop + POP_H - 6, left: clamp(cx - 6, popLeft + 16, popLeft + POP_W - 28) };
    }
    if (placement === "right") {
      return { ...base, top: clamp(cy - 6, popTop + 16, popTop + POP_H - 28), left: popLeft - 6 };
    }
    return { ...base, top: clamp(cy - 6, popTop + 16, popTop + POP_H - 28), left: popLeft + POP_W - 6 };
  })();

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Visite guidée">
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourPop { from { transform: translateY(10px) scale(0.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes tourPopDesktop { from { transform: translateY(6px) scale(0.985); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>

      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: "tourFadeIn 180ms ease-out" }}
        onClick={skip}
      />

      {!isSheet && arrowStyle ? (
        <div style={{ ...arrowStyle, animation: readyAnim ? "tourPopDesktop 180ms ease-out" : undefined }} />
      ) : null}

      {!isSheet && popStyle ? (
        <div style={{ ...popStyle, animation: readyAnim ? "tourPopDesktop 220ms ease-out" : undefined }}>
          <TourCard
            step={step}
            progress={progress}
            startedByUser={startedByUser}
            onPrev={prev}
            onNext={next}
            onSkip={skip}
            isFirst={stepIndex === 0}
            isLast={stepIndex === steps.length - 1}
          />
        </div>
      ) : null}

      {isSheet ? (
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6">
          <div className="mx-auto w-full max-w-[560px]" style={{ animation: readyAnim ? "tourPop 220ms ease-out" : undefined }}>
            <TourCard
              step={step}
              progress={progress}
              startedByUser={startedByUser}
              onPrev={prev}
              onNext={next}
              onSkip={skip}
              isFirst={stepIndex === 0}
              isLast={stepIndex === steps.length - 1}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TourCard({ step, progress, startedByUser, onPrev, onNext, onSkip, isFirst, isLast }) {
  const [cur, total] = String(progress).split("/").map((v) => Number(v || 0));
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
      <div
        className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(59,130,246,0.02) 45%, rgba(0,0,0,0))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-[var(--muted)]">
              Visite guidée · Étape {progress}
              {startedByUser ? " · relancée" : ""}
            </div>
            <div className="text-lg sm:text-xl font-black text-[var(--text)]">{step?.title}</div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:opacity-90"
            aria-label="Fermer la visite"
            title="Fermer"
          >
            Fermer
          </button>
        </div>

        <div className="pt-3 text-sm sm:text-[15px] leading-relaxed text-[var(--muted)]">{step?.body}</div>

        <div className="pt-4 flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === cur - 1 ? 22 : 8,
                background: i === cur - 1 ? "var(--text)" : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className={[
            "rounded-2xl px-4 py-2 text-sm font-semibold border border-[var(--border)]",
            isFirst ? "opacity-50 text-[var(--muted)]" : "text-[var(--text)] hover:opacity-90",
          ].join(" ")}
        >
          Précédent
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:opacity-90"
          >
            Passer
          </button>

          <button
            type="button"
            onClick={onNext}
            className="rounded-2xl px-4 py-2 text-sm font-semibold bg-[var(--text)] text-[var(--surface)] hover:opacity-90"
          >
            {isLast ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-4 text-[11px] text-[var(--muted)]">
        Raccourcis : ← / → pour naviguer, Échap pour fermer.
      </div>
    </div>
  );
}
