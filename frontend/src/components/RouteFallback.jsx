import React from "react";

export default function RouteFallback() {
  return (
    <div className="min-h-[45vh] flex items-center justify-center px-4">
      <div className="text-sm text-[var(--muted)]">Chargement…</div>
    </div>
  );
}
