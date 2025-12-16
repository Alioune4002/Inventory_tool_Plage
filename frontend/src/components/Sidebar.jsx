import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Boxes, Package, Tag, Download, Settings, HelpCircle, MinusCircle } from "lucide-react";
import { cn } from "../lib/cn";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";

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

export default function Sidebar() {
  const { tenant } = useAuth();
  const tenantDomain = tenant?.domain || "food";
  const isGeneral = tenantDomain === "general";

  const filtered = items.filter((it) => {
    // si besoin masquer certains items pour non-alimentaire
    return true;
  });

  return (
    <aside className="hidden lg:flex h-full w-72 flex-col p-3 space-y-3 text-[var(--text)]">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="font-black tracking-tight text-lg">StockScan</div>
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
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                    "hover:bg-[var(--accent)]/20",
                    isActive
                      ? "bg-slate-900 text-white shadow-glow hover:bg-slate-900"
                      : "text-[var(--text)]"
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
        <div className="text-xs font-semibold text-slate-700">Conseil</div>
        <div className="mt-1 text-sm text-slate-600">
          {isGeneral
            ? "Crée tes catégories, puis ajoute tes produits (SKU ou code-barres)."
            : "Commence par l’inventaire du mois, puis exporte en Excel."}
        </div>
      </Card>
    </aside>
  );
}
