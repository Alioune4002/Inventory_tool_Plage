
import React, { useMemo } from "react";
import { LogOut, Moon, Sun, Menu } from "lucide-react";
import { useAuth } from "../app/AuthProvider";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Select from "../ui/Select";

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
  const serviceOptions = (services || []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-[var(--surface)]/90 border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-bold text-[var(--text)] truncate">
              {tenant?.name || "StockScan"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {isGeneral ? "Commerce non-alimentaire" : "Commerce alimentaire"}
            </div>
          </div>

          {showServiceSelect && (
            <div className="min-w-0 max-w-[72vw]">
              <Select
                label="Service"
                value={serviceId || ""}
                onChange={(value) => selectService(value)}
                options={[...serviceOptions, { value: "all", label: "Tous les services" }]}
                ariaLabel="Sélectionner un service"
                buttonClassName="shadow-soft"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="lg:hidden rounded-full border border-[var(--border)] bg-[var(--surface)]/80 p-2 text-[var(--text)] hover:bg-[var(--accent)]/20 transition"
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
              {isLight ? (
                <Moon size={16} className="text-[var(--text)]" />
              ) : (
                <Sun size={16} className="text-[var(--muted)]" />
              )}
              <span className="hidden sm:inline">{isLight ? "Sombre" : "Clair"}</span>
            </Button>
          )}

          <Badge variant="info" className="hidden sm:inline-flex">
            {loading ? "Chargement…" : me?.username || "Compte"}
          </Badge>

          <Button
            variant="secondary"
            size="sm"
            onClick={onLogout || logout}
            className="border-[var(--border)]"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
