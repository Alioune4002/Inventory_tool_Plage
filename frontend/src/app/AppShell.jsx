// src/app/AppShell.jsx
import React, { Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AppRoutes from "./routes";
import { useAuth } from "./AuthProvider";
import { ToastProvider, useToast } from "./ToastContext";
import useEntitlements from "./useEntitlements";
import ErrorBoundary from "./ErrorBoundary";
import { formatApiError } from "../lib/errorUtils";
import { captureException } from "../lib/monitoring";
import PwaUpdateBanner from "../components/PwaUpdateBanner";

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
      captureException(event?.reason || new Error("Unhandled rejection"));
      pushToast?.({ message: msg, type: "error" });
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, [pushToast]);

  return null;
}

function NetworkStatusToaster() {
  const pushToast = useToast();

  useEffect(() => {
    const updateFlag = (offline) => {
      if (offline) document.documentElement.setAttribute("data-offline", "true");
      else document.documentElement.removeAttribute("data-offline");
    };

    const onOffline = () => {
      updateFlag(true);
      pushToast?.({ message: "Hors ligne : certaines actions sont bloquées.", type: "warning", durationMs: 14000 });
    };
    const onOnline = () => {
      updateFlag(false);
      pushToast?.({ message: "Connexion rétablie.", type: "success", durationMs: 6000 });
    };

    updateFlag(!navigator.onLine);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [pushToast]);

  return null;
}

export default function AppShell() {
  const location = useLocation();
  const { isAuthed, tenant, me, logout } = useAuth();
  const { data: entitlements } = useEntitlements();
  const [theme, setTheme] = useState(getInitialTheme);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isCoreApp = location.pathname.startsWith("/app");
  const isStandaloneApp =
    location.pathname.startsWith("/pos/app") ||
    location.pathname.startsWith("/kds/app") ||
    location.pathname.startsWith("/orders");
  const showTopbar = isCoreApp || isStandaloneApp;
  const showSidebar = isCoreApp;

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

  const userId = me?.id || me?.user?.id || me?.user_id || "";

  return (
    <ToastProvider>
      <UnhandledRejectionToaster />
      <NetworkStatusToaster />

      <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {showTopbar && isAuthed && (
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
          {showSidebar && isAuthed && (
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
          )}

          <div className="flex-1 min-w-0">
            <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {showSidebar && isAuthed && (
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

        {/* ✅ Guided tour: userId + ability to open mobile nav */}
        {showSidebar && isAuthed ? (
          <Suspense fallback={null}>
            <GuidedTour userId={userId} onRequestMobileNav={setMobileNavOpen} />
          </Suspense>
        ) : null}

        <Suspense fallback={null}>
          <Toasts />
        </Suspense>

        <PwaUpdateBanner />

        {showSidebar ? (
          <Suspense fallback={null}>
            <MobileNav
              open={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
              onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            />
          </Suspense>
        ) : null}
      </div>
    </ToastProvider>
  );
}
