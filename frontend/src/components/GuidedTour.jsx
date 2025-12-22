import React, { useEffect, useMemo, useState } from "react";
import Joyride, { STATUS } from "react-joyride";
import { useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

const TOUR_KEY = "stockscan_tour_v1";

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

export default function GuidedTour() {
  const { isAuthed } = useAuth();
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

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY) === "done";
    if (isAuthed && isApp && isDesktop && !done) {
      setRun(true);
      return;
    }
    setRun(false);
  }, [isAuthed, isApp, isDesktop]);

  const handleCallback = (data) => {
    const { status, index, type } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem(TOUR_KEY, "done");
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
      callback={handleCallback}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: "#0f172a",
          backgroundColor: "#0f172a",
          overlayColor: "rgba(2,6,23,0.7)",
          primaryColor: "#38bdf8",
          textColor: "#e2e8f0",
        },
        tooltip: {
          borderRadius: 16,
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
