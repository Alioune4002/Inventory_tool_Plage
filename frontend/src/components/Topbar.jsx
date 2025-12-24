// frontend/src/components/Topbar.jsx
import React, { useMemo } from "react";
import { LogOut, Moon, Sun, Menu } from "lucide-react";
import { useAuth } from "../app/AuthProvider";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

function useIsLightTheme() {
  return useMemo(() => {
    const t = document?.documentElement?.getAttribute("data-theme");
    return t === "light";
  }, [document?.documentElement?.getAttribute?.("data-theme")]);
}

export default function Topbar({ onLogout, onToggleTheme, onOpenMobileNav }) {
  const { me, tenant, services, serviceId, selectService, logout, loading } = useAuth();
  const isLight = useIsLightTheme();

  const isGeneral = tenant?.domain === "general";
  const showServiceSelect = !isGeneral && services?.length > 1;

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-[var(--surface)]/90 border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <div className="text-sm font-bold text-[var(--text)]">{tenant?.name || "StockScan"}</div>
            <div className="text-xs text-[var(--muted)]">
              {isGeneral ? "Commerce non-alimentaire" : "Commerce alimentaire"}
            </div>
          </div>

          {showServiceSelect && (
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2 shadow-soft">
              <div className="text-xs text-[var(--muted)]">Service</div>
              <select
                value={serviceId || ""}
                onChange={(e) => selectService(e.target.value)}
                className="text-sm font-semibold text-[var(--text)] bg-transparent outline-none"
                aria-label="Sélectionner un service"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="all">Tous les services</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="lg:hidden rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
              aria-label="Ouvrir la navigation"
            >
              <Menu size={18} />
            </button>
          )}

          {onToggleTheme && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              aria-label="Basculer thème"
              className="inline-flex"
              title={isLight ? "Passer en sombre" : "Passer en clair"}
            >
              {isLight ? <Moon size={16} className="text-slate-700" /> : <Sun size={16} className="text-slate-500" />}
              <span className="hidden sm:inline">
                {isLight ? "Sombre" : "Clair"}
              </span>
            </Button>
          )}

          <Badge variant="info" className="hidden sm:inline-flex">
            {loading ? "Chargement…" : me?.username || "Compte"}
          </Badge>

          <Button
            variant="secondary"
            size="sm"
            onClick={onLogout || logout}
            className="border-slate-300"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}