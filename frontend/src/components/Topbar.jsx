// src/components/Topbar.jsx
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

function serviceDomainFromType(serviceType) {
  const t = String(serviceType || "").toLowerCase();
  // food-ish
  const food = new Set([
    "kitchen",
    "restaurant_dining",
    "bar",
    "bakery",
    "grocery_food",
    "bulk_food",
  ]);
  // general-ish
  const general = new Set([
    "pharmacy_parapharmacy",
    "retail_general",
    "other",
  ]);

  if (food.has(t)) return "food";
  if (general.has(t)) return "general";
  return "unknown";
}

export default function Topbar({ onLogout, onToggleTheme, onOpenMobileNav }) {
  const { me, tenant, services, serviceId, selectService, logout, loading, serviceProfile } = useAuth();
  const isLight = useIsLightTheme();

  const tenantDomain = tenant?.domain || "food";
  const isGeneralTenant = tenantDomain === "general";

  const showServiceSelect = !isGeneralTenant && (services?.length || 0) > 1;
  const serviceOptions = (services || []).map((s) => ({ value: s.id, label: s.name }));

  const headerSubtitle = useMemo(() => {
    const svcs = services || [];
    const domains = new Set(
      svcs.map((s) => serviceDomainFromType(s?.service_type)).filter((d) => d && d !== "unknown")
    );

    // si l'utilisateur a créé des services cross-domain => multiservice
    if (domains.size >= 2) return "Établissement multiservice";

    // fallback: tenant domain
    return isGeneralTenant ? "Commerce non-alimentaire" : "Commerce alimentaire";
  }, [services, isGeneralTenant]);

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-[var(--surface)]/90 border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-bold text-[var(--text)] truncate">
              {tenant?.name || "StockScan"}
            </div>
            <div className="text-xs text-[var(--muted)]">{headerSubtitle}</div>
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
              {isLight ? <Moon size={16} className="text-[var(--text)]" /> : <Sun size={16} className="text-[var(--muted)]" />}
              <span className="hidden sm:inline">{isLight ? "Sombre" : "Clair"}</span>
            </Button>
          )}

          <Badge variant="info" className="hidden sm:inline-flex">
            {loading ? "Chargement…" : me?.username || "Compte"}
          </Badge>

          <Button variant="secondary" size="sm" onClick={onLogout || logout} className="border-[var(--border)]">
            <LogOut size={16} />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}