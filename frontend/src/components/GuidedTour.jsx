import React, { useEffect, useMemo, useState } from "react";
import Joyride, { STATUS } from "react-joyride";
import { useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { getTourKey, getTourPendingKey } from "../lib/tour";

const buildSteps = () => [
  {
    target: '[data-tour="tour-dashboard"]',
    content: "Voici votre vue globale : valeur de stock, pertes et points d’attention.",
  },
  {
    target: '[data-tour="tour-products"]',
    content: "Produits = catalogue. Ajoutez vos références une seule fois.",
  },
  {
    target: '[data-tour="tour-inventory"]',
    content: "Inventaire = comptage. Saisissez vos quantités du mois ou de la semaine.",
  },
  {
    target: '[data-tour="tour-losses"]',
    content: "Pertes & casse : déclarez les pertes pour garder des stats fiables.",
  },
  {
    target: '[data-tour="tour-settings"]',
    content: "Modules : activez TVA, DLC, lots, variantes… selon votre métier.",
  },
  {
    target: '[data-tour="tour-exports"]',
    content: "Exports CSV/XLSX : partagez vos tableaux et archives.",
  },
  {
    target: '[data-tour="tour-ai"]',
    content: "Coach IA : conseils et alertes contextualisés (selon votre plan).",
  },
];

export default function GuidedTour({ onRequestMobileNav }) {
  const { isAuthed, me } = useAuth();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const steps = useMemo(() => buildSteps(), []);
  const isApp = location.pathname.startsWith("/app");
  const userId = me?.id || me?.user?.id || me?.user_id || "";
  const tourKey = getTourKey(userId);
  const pendingKey = getTourPendingKey(userId);

  useEffect(() => {
    if (!isAuthed || !isApp || !userId) {
      setRun(false);
      return;
    }
    const done = localStorage.getItem(tourKey) === "done";
    const pending = localStorage.getItem(pendingKey) === "1";
    if (!done || pending) {
      setRun(true);
      return;
    }
    setRun(false);
  }, [isAuthed, isApp, pendingKey, tourKey, userId]);

  useEffect(() => {
    if (!onRequestMobileNav) return;
    if (!run) {
      onRequestMobileNav(false);
      return;
    }
    if (!isDesktop) onRequestMobileNav(true);
  }, [isDesktop, onRequestMobileNav, run]);

  const handleCallback = (data) => {
    const { status, index, type } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem(tourKey, "done");
      localStorage.removeItem(pendingKey);
      onRequestMobileNav?.(false);
      setRun(false);
      setStepIndex(0);
      return;
    }
    if (type === "step:after") {
      setStepIndex(index + 1);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      disableOverlayClose
      scrollToFirstStep
      callback={handleCallback}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: "#0b1220",
          backgroundColor: "#0b1220",
          overlayColor: "rgba(2,6,23,0.82)",
          primaryColor: "#3b82f6",
          textColor: "#e2e8f0",
        },
        tooltip: {
          borderRadius: 18,
          border: "1px solid rgba(59,130,246,0.35)",
          boxShadow: "0 24px 60px rgba(2, 6, 23, 0.6)",
          padding: 16,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonNext: {
          backgroundColor: "#3b82f6",
          color: "#fff",
          borderRadius: 999,
          padding: "8px 16px",
          fontWeight: 700,
        },
        buttonBack: {
          color: "#e2e8f0",
        },
        buttonSkip: {
          color: "#94a3b8",
        },
        spotlight: {
          borderRadius: 16,
          boxShadow: "0 0 0 9999px rgba(2,6,23,0.82)",
        },
      }}
      locale={{
        next: "Suivant",
        back: "Retour",
        skip: "Passer",
        last: "Terminer",
      }}
    />
  );
}
