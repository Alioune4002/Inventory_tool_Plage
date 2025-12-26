import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

function fullPath(loc) {
  const p = loc?.pathname || "/";
  const s = loc?.search || "";
  const h = loc?.hash || "";
  return `${p}${s}${h}`;
}

export default function RequireAuth({ children }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold text-[var(--text)] shadow-soft">
          <span className="text-[var(--muted)]">Chargement…</span>
        </div>
      </div>
    );
  }

  const path = location?.pathname || "";
  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/check-email") ||
    path.startsWith("/verify-email") ||
    path.startsWith("/reset-password");

  
  if (!isAuthed && isAuthPage) {
    return children;
  }

  if (!isAuthed) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: fullPath(location),
          reason: "auth_required",
        }}
      />
    );
  }

  return children;
}