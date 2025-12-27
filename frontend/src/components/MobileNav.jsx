
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import Button from "../ui/Button";

function isLightTheme() {
  const t = document?.documentElement?.getAttribute("data-theme");
  return t === "light";
}

export default function MobileNav({ open, onClose, items, onToggleTheme }) {
  const light = useMemo(() => isLightTheme(), [document?.documentElement?.getAttribute?.("data-theme")]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch">
      <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />
      <div className="relative z-10 h-full w-72 max-w-full bg-[var(--surface)] border-r border-[var(--border)] shadow-[0_35px_60px_rgba(0,0,0,0.45)] p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-black text-[var(--text)]">StockScan</div>
            <div className="text-xs text-[var(--muted)]">Navigation</div>
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
