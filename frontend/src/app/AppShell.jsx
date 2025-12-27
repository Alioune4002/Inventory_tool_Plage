
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, Boxes, Package, Tag, Download, Settings, HelpCircle, MinusCircle } from "lucide-react";
import AppRoutes from "./routes";
import { useAuth } from "./AuthProvider";
import { ToastProvider, useToast } from "./ToastContext";
import useEntitlements from "./useEntitlements";
import ErrorBoundary from "./ErrorBoundary";
import { formatApiError } from "../lib/errorUtils";

const Sidebar = React.lazy(() => import("../components/Sidebar"));
const Topbar = React.lazy(() => import("../components/Topbar"));
const Toasts = React.lazy(() => import("../components/Toast"));
const BillingBanners = React.lazy(() => import("../components/BillingBanners"));
const MobileNav = React.lazy(() => import("../components/MobileNav"));
const GuidedTour = React.lazy(() => import("../components/GuidedTour"));

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
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "tour-dashboard" },
      { to: "/app/inventory", label: "Inventaire", icon: Boxes, tour: "tour-inventory" },
      { to: "/app/products", label: "Produits", icon: Package, tour: "tour-products" },
      { to: "/app/categories", label: "Catégories", icon: Tag },
      { to: "/app/losses", label: "Pertes", icon: MinusCircle, tour: "tour-losses" },
      { to: "/app/exports", label: "Exports", icon: Download, tour: "tour-exports" },
      { to: "/app/settings", label: "Settings", icon: Settings, tour: "tour-settings" },
      { to: "/app/support", label: "Support", icon: HelpCircle },
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
          <Suspense fallback={null}>
            <Topbar
              onLogout={onLogout}
              tenant={tenant}
              user={me}
              onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              onOpenMobileNav={() => setMobileNavOpen(true)}
            />
          </Suspense>
        )}

        <div className="h-full flex">
          {isAppSection && isAuthed && (
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
          )}

          <div className="flex-1 min-w-0">
            <main className="mx-auto max-w-6xl px-4 py-6">
              {isAppSection && isAuthed && (
                <Suspense fallback={null}>
                  <BillingBanners entitlements={entitlements} />
                </Suspense>
              )}

              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </main>
          </div>
        </div>

        <Suspense fallback={null}>
          <GuidedTour onRequestMobileNav={setMobileNavOpen} />
        </Suspense>
        <Suspense fallback={null}>
          <Toasts />
        </Suspense>
        <Suspense fallback={null}>
          <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} items={navItems} />
        </Suspense>
      </div>
    </ToastProvider>
  );
}
