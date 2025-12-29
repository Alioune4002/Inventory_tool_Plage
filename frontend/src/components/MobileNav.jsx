// src/components/MobileNav.jsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { navItems } from "../app/navItems";
import Button from "../ui/Button";

function isLightTheme() {
  const t = document?.documentElement?.getAttribute("data-theme");
  return t === "light";
}

export default function MobileNav({ open, onClose, onToggleTheme }) {
  const light = useMemo(() => isLightTheme(), [document?.documentElement?.getAttribute?.("data-theme")]);
  const items = navItems;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch">
      <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />

      <div className="relative z-10 h-full w-72 max-w-full bg-[var(--surface)] border-r border-[var(--border)] shadow-[0_35px_60px_rgba(0,0,0,0.45)] p-5 flex flex-col">
        {/* ✅ Header premium (logo + gradient) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative inline-flex h-10 w-10 items-center justify-center shrink-0">
              <img
                src="/sans_fond_icon.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 object-contain drop-shadow-[0_12px_30px_rgba(56,189,248,0.20)]"
                draggable="false"
              />
            </span>

            <div className="min-w-0">
              <div className="font-black tracking-tight text-lg truncate leading-tight">
                <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-cyan-200 dark:via-sky-200 dark:to-fuchsia-200 bg-clip-text text-transparent">
                  StockScan
                </span>
              </div>
              <div className="text-xs text-[var(--muted)]">Inventaire premium</div>
              <div className="text-[11px] text-[var(--muted)] opacity-80">Navigation</div>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="px-2 py-1 text-[var(--text)]">
            Fermer
          </Button>
        </div>

        {onToggleTheme ? (
          <div className="mb-3">
            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={onToggleTheme}
              title={light ? "Passer en sombre" : "Passer en clair"}
            >
              {light ? <Moon size={16} /> : <Sun size={16} />}
              <span className="ml-2">{light ? "Sombre" : "Clair"}</span>
            </Button>
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                data-tour={item.tour}
                className="rounded-2xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface)]/70 transition flex items-center gap-2"
              >
                {Icon ? <Icon size={16} className="shrink-0" /> : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4">
          <Button className="w-full" onClick={() => onClose()}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}