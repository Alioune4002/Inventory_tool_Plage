
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Toasts from "../components/Toast";
import AppRoutes from "./routes";
import { useAuth } from "./AuthProvider";
import { ToastProvider, useToast } from "./ToastContext";
import BillingBanners from "../components/BillingBanners";
import useEntitlements from "./useEntitlements";
import MobileNav from "../components/MobileNav";
import GuidedTour from "../components/GuidedTour";
import ErrorBoundary from "./ErrorBoundary";
import { formatApiError } from "../lib/errorUtils";

function getInitialTheme() {
  try {
    const t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    // noop
  }
  return "dark";
}

function UnhandledRejectionToaster() {
  const pushToast = useToast();

  useEffect(() => {
    const onUnhandled = (event) => {
      const msg = formatApiError(event?.reason, { context: "generic" });
      pushToast?.({ message: msg, type: "error" });
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, [pushToast]);

  return null;
}

export default function AppShell() {
  const location = useLocation();
  const { isAuthed, tenant, me, logout } = useAuth();
  const { data: entitlements } = useEntitlements();
  const [theme, setTheme] = useState(getInitialTheme);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { to: "/app/dashboard", label: "Dashboard", tour: "tour-dashboard" },
      { to: "/app/inventory", label: "Inventaire", tour: "tour-inventory" },
      { to: "/app/products", label: "Produits", tour: "tour-products" },
      { to: "/app/categories", label: "Catégories" },
      { to: "/app/losses", label: "Pertes", tour: "tour-losses" },
      { to: "/app/exports", label: "Exports", tour: "tour-exports" },
      { to: "/app/settings", label: "Settings", tour: "tour-settings" },
      { to: "/app/support", label: "Support" },
    ],
    []
  );

  const isAppSection = location.pathname.startsWith("/app");

  const onLogout = () => {
    logout();
    
  };

  
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // noop
    }
  }, [theme]);

  useEffect(() => {
    if (mobileNavOpen) setMobileNavOpen(false);
    
  }, [location.pathname]);

  return (
    <ToastProvider>
      <UnhandledRejectionToaster />

      <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {isAppSection && isAuthed && (
          <Topbar
            onLogout={onLogout}
            tenant={tenant}
            user={me}
            onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        )}

        <div className="h-full flex">
          {isAppSection && isAuthed && <Sidebar />}

          <div className="flex-1 min-w-0">
            <main className="mx-auto max-w-6xl px-4 py-6">
              {isAppSection && isAuthed && <BillingBanners entitlements={entitlements} />}

              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </main>
          </div>
        </div>

        <GuidedTour onRequestMobileNav={setMobileNavOpen} />
        <Toasts />
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} items={navItems} />
      </div>
    </ToastProvider>
  );
}