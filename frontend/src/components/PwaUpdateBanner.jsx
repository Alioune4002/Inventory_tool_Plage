import React, { useEffect, useState } from "react";
import Button from "../ui/Button";

export default function PwaUpdateBanner() {
  const [updateFn, setUpdateFn] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onNeedRefresh = (event) => {
      const updater = event?.detail?.updateSW;
      if (typeof updater === "function") {
        setUpdateFn(() => updater);
        setVisible(true);
      }
    };
    const onOfflineReady = () => {
      // noop for now; handled by toast elsewhere if needed
    };

    window.addEventListener("pwa:need-refresh", onNeedRefresh);
    window.addEventListener("pwa:offline-ready", onOfflineReady);
    return () => {
      window.removeEventListener("pwa:need-refresh", onNeedRefresh);
      window.removeEventListener("pwa:offline-ready", onOfflineReady);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="text-sm font-semibold text-[var(--text)]">Nouvelle version disponible</div>
        <div className="text-xs text-[var(--muted)] mt-1">
          Mettez à jour pour profiter des dernières améliorations.
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              updateFn?.(true);
              setVisible(false);
            }}
          >
            Mettre à jour
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setVisible(false)}>
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}
