import React, { useEffect, useRef, useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { X, Camera } from "lucide-react";

export default function BarcodeScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | starting | running | error
  const [err, setErr] = useState("");

  const stop = () => {
    try {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    } catch {
      
    }
  };

  const isNoCodeFoundError = (error) => {
    if (!error) return false;
    const name = String(error?.name || "");
    const msg = String(error?.message || "");
    
    return name.includes("NotFound") || msg.toLowerCase().includes("not found");
  };

  useEffect(() => {
    if (!open) {
      stop();
      setStatus("idle");
      setErr("");
      return;
    }

    let canceled = false;

    const start = async () => {
      setErr("");
      setStatus("starting");

      try {
        const mod = await import("@zxing/browser");
        const reader = new mod.BrowserMultiFormatReader();

        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        if (!videoRef.current) {
          setStatus("error");
          setErr("Impossible d’accéder au flux vidéo.");
          return;
        }

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, error) => {
            if (canceled) return;

            if (result) {
              const text = String(result.getText?.() || "").trim();
              if (text) {
                stop(); // évite les multi-détections
                setStatus("idle");
                onDetected?.(text);
              }
              return;
            }

            
            if (isNoCodeFoundError(error)) return;

        
            if (error) {
            
              console.debug("[ZXing] scan error:", error);
            }
          }
        );

        controlsRef.current = controls;
        setStatus("running");
      } catch (e) {
        setStatus("error");
        setErr(
          e?.message ||
            "Permission caméra refusée ou navigateur incompatible. Essayez sur Chrome/Safari mobile, puis autorisez la caméra."
        );
      }
    };

    start();

    return () => {
      canceled = true;
      stop();
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/60">
      <Card className="w-full max-w-lg border-white/10 bg-white/5 text-white glass">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <div className="font-semibold">Scanner un code-barres</div>
          </div>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose?.();
            }}
            className="rounded-full border border-white/15 p-2 hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
            <video ref={videoRef} className="w-full h-[320px] object-cover" muted playsInline autoPlay />
          </div>

          <div className="text-xs text-white/70">
            {status === "starting" ? "Démarrage de la caméra…" : "Vise un code-barres : détection automatique."}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              className="w-full justify-center"
              onClick={() => {
                stop();
                onClose?.();
              }}
            >
              Annuler
            </Button>
          </div>

          <div className="text-[11px] text-white/50">
            Astuce : augmente la luminosité et évite les reflets (iOS : Safari/Chrome).
          </div>
        </div>
      </Card>
    </div>
  );
}
