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
      <div className="min-h-[60vh] grid place-items-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white/80">
          Chargement…
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

  // Si jamais RequireAuth est utilisé sur une page publique/auth, router gére

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