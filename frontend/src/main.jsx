// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import AppShell from "./app/AppShell.jsx";
import { AuthProvider } from "./app/AuthProvider.jsx";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./app/ErrorBoundary.jsx";

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