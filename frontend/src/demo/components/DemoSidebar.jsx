import React from "react";

const demoLinks = [
  "Dashboard",
  "Inventaire",
  "Pertes",
  "Exports",
  "Settings",
];

export default function DemoSidebar() {
  return (
    <aside className="hidden lg:flex h-full w-72 flex-col gap-3 p-4 bg-white/5 border-r border-white/10 rounded-r-3xl">
      <div className="text-sm font-semibold text-[var(--muted)]">Navigation</div>
      {demoLinks.map((label) => (
        <div
          key={label}
          className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/80 bg-white/5"
        >
          {label}
        </div>
      ))}
      <div className="mt-auto text-xs text-white/60">Données factices · aucun effet réel.</div>
    </aside>
  );
}
