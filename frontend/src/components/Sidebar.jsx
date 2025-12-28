import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import { getWording } from "../lib/labels";
import { navItems } from "../app/navItems";

export default function Sidebar() {
  const { tenant, services, serviceId, serviceProfile } = useAuth();
  const tenantDomain = tenant?.domain || "food";
  const isGeneral = tenantDomain === "general";
  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = serviceProfile?.service_type || currentService?.service_type;
  const wording = getWording(serviceType, tenantDomain);
  const identifierLabel = wording?.identifierLabel || "code-barres";

  const items = navItems;

  return (
    <aside className="hidden lg:flex h-full w-72 flex-col p-3 space-y-3 text-[var(--text)] min-w-0-safe">
      <Card className="p-4 flex items-center justify-between min-w-0-safe">
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
            <div className="font-black tracking-tight text-lg truncate">
              <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-cyan-200 dark:via-sky-200 dark:to-fuchsia-200 bg-clip-text text-transparent">
                StockScan
              </span>
            </div>
            <div className="text-xs text-[var(--muted)]">Inventaire premium</div>
          </div>
        </div>
      </Card>

      <Card className="p-2" hover>
        <nav className="space-y-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                data-tour={it.tour}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition min-w-0-safe",
                    "hover:bg-[var(--accent)]/20",
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-glow hover:bg-[var(--primary)]"
                      : "text-[var(--text)]"
                  )
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </Card>

      <Card className="mt-auto p-4">
        <div className="text-xs font-semibold text-[var(--text)]">Conseil</div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {isGeneral
            ? `Crée tes catégories, puis ajoute tes produits (identifiant : ${identifierLabel}).`
            : "Commence par l’inventaire du mois, puis exporte en Excel."}
        </div>
      </Card>
    </aside>
  );
}
