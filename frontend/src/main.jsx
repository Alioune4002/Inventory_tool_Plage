// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import AppShell from "./app/AppShell.jsx";
import { AuthProvider } from "./app/AuthProvider.jsx";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./app/ErrorBoundary.jsx";
import { initMonitoring } from "./lib/monitoring";
import { registerSW } from "virtual:pwa-register";

initMonitoring();

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent("pwa:need-refresh", { detail: { updateSW } }));
    },
    onOfflineReady() {
      window.dispatchEvent(new Event("pwa:offline-ready"));
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </AuthProvider>
      </HelmetProvider>
    </BrowserRouter>
  </React.StrictMode>
);
