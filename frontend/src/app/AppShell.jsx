import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Toast from "../components/Toast";
import AppRoutes from "./routes";
import { useAuth } from "./AuthProvider";
import { ToastProvider } from "./ToastContext";
import BillingBanners from "../components/BillingBanners";
import useEntitlements from "./useEntitlements";
import MobileNav from "../components/MobileNav";

export default function AppShell() {
  const location = useLocation();
  const { isAuthed, loading, tenant, me, logout } = useAuth();
  const { data: entitlements } = useEntitlements();
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { to: "/app/dashboard", label: "Dashboard" },
      { to: "/app/inventory", label: "Inventaire" },
      { to: "/app/products", label: "Produits" },
      { to: "/app/categories", label: "Catégories" },
      { to: "/app/losses", label: "Pertes" },
      { to: "/app/exports", label: "Exports" },
      { to: "/app/settings", label: "Settings" },
      { to: "/app/support", label: "Support" },
    ],
    []
  );

  const isAppSection = location.pathname.startsWith("/app");

  const onLogout = () => {
    logout();
    setToast({ message: "Déconnexion effectuée.", type: "info" });
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ToastProvider pushToast={setToast}>
      <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {isAppSection && isAuthed && (
          <Topbar
            onLogout={onLogout}
            tenant={tenant}
            user={me}
            onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        )}
        <div className="h-full flex">
          {isAppSection && isAuthed && <Sidebar />}
          <div className="flex-1 min-w-0">
            <main className="mx-auto max-w-6xl px-4 py-6">
              {isAppSection && isAuthed && <BillingBanners entitlements={entitlements} />}
              <AppRoutes setToast={setToast} />
            </main>
          </div>
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} items={navItems} />
      </div>
    </ToastProvider>
  );
}
