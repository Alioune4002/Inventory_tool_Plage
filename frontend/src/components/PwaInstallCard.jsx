import React, { useEffect, useMemo, useState } from "react";
import { Share2, Download } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const standaloneMatch = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(standaloneMatch || iosStandalone);
}

export default function PwaInstallCard({ className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayMode = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onDisplayMode);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  const showIosHint = ios && !deferredPrompt;

  return (
    <Card className={`p-5 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Badge variant="info">App mobile</Badge>
        <div className="text-sm font-semibold text-[var(--text)]">Installer StockScan</div>
      </div>
      <div className="text-sm text-[var(--muted)]">
        Une expérience fluide, sans onglets : accès rapide, interface dédiée, et mises à jour propres.
      </div>
      <ul className="text-xs text-[var(--muted)] space-y-1">
        <li>• Démarrage instantané depuis l’écran d’accueil</li>
        <li>• Interface plein écran comme une vraie app</li>
        <li>• Mode hors ligne minimal pour continuer</li>
      </ul>

      {showIosHint ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]">
          <div className="font-semibold mb-1">iPhone / iPad</div>
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Share2 size={16} />
            <span>Appuyez sur Partager puis “Sur l’écran d’accueil”.</span>
          </div>
        </div>
      ) : (
        <Button onClick={handleInstall} className="w-full">
          <Download size={16} />
          Installer l’application
        </Button>
      )}
    </Card>
  );
}
