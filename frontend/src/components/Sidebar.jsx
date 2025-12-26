import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Tag,
  Download,
  Settings,
  HelpCircle,
  MinusCircle,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import { getWording } from "../lib/labels";

const items = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inventory", label: "Inventaire", icon: Boxes },
  { to: "/app/products", label: "Produits", icon: Package },
  { to: "/app/categories", label: "Catégories", icon: Tag },
  { to: "/app/losses", label: "Pertes", icon: MinusCircle },
  { to: "/app/exports", label: "Exports", icon: Download },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/support", label: "Support", icon: HelpCircle },
];

const tourTargets = {
  "/app/dashboard": "tour-dashboard",
  "/app/inventory": "tour-inventory",
  "/app/products": "tour-products",
  "/app/losses": "tour-losses",
  "/app/exports": "tour-exports",
  "/app/settings": "tour-settings",
};

export default function Sidebar() {
  const { tenant, services, serviceId, serviceProfile } = useAuth();
  const tenantDomain = tenant?.domain || "food";
  const isGeneral = tenantDomain === "general";
  const currentService = services?.find((s) => String(s.id) === String(serviceId));
  const serviceType = serviceProfile?.service_type || currentService?.service_type;

  const wording = getWording(serviceType, tenantDomain);
  const identifierLabel = wording?.identifierLabel || "code-barres";

  const filtered = items.filter(() => true);

  return (
    <aside className="hidden lg:flex h-full w-72 flex-col p-3 space-y-3 text-[var(--text)]">
      <Card className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-black tracking-tight text-lg truncate">StockScan</div>
          <div className="text-xs text-[var(--muted)]">Inventaire premium</div>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 shadow-glow" />
      </Card>

      <Card className="p-2" hover>
        <nav className="space-y-1">
          {filtered.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                data-tour={tourTargets[it.to]}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                    "hover:bg-[var(--accent)]/25",
                    isActive
                      ? "bg-[var(--accent)]/45 border border-[var(--border)] shadow-soft"
                      : "border border-transparent text-[var(--text)]"
                  )
                }
              >
                <Icon size={18} />
                {it.label}
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