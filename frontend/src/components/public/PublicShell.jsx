import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function PublicShell({ children }) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      if (prevTheme) document.documentElement.setAttribute("data-theme", prevTheme);
    };
  }, []);

  return (
    <div className="public-shell relative w-full overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-grid" />
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-blue-600 blur-[140px] opacity-30" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-400 blur-[160px] opacity-20" />

      {/* HEADER */}
      <header className="relative z-10 mx-auto max-w-6xl px-4 py-5 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0 group">
          {/* ✅ S transparent + micro animation */}
          <span className="relative inline-flex h-10 w-10 md:h-11 md:w-11 items-center justify-center">
            <img
              src="/sans_fond_icon.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 md:h-11 md:w-11 object-contain animate-floatSoft drop-shadow-[0_12px_30px_rgba(56,189,248,0.20)] group-hover:scale-[1.03] transition-transform"
              draggable="false"
            />
          </span>

          {/* ✅ StockScan en dur (dégradé premium) */}
          <span className="truncate text-xl md:text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-fuchsia-200 bg-clip-text text-transparent">
              StockScan
            </span>
            <span className="ml-2 hidden sm:inline text-white/55 text-sm font-semibold tracking-normal">
              Inventaire simple.
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 text-sm font-semibold">
          <Link to="/metiers" className="text-white/80 hover:text-white">Métiers</Link>
          <Link to="/fonctionnalites" className="text-white/80 hover:text-white">Fonctionnalités</Link>
          <Link to="/tarifs" className="text-white/80 hover:text-white">Tarifs</Link>
          <Link to="/support" className="text-white/80 hover:text-white">Support</Link>
        </nav>

        {/* ✅ Un seul bouton (login) */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            className="rounded-full px-3 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition whitespace-nowrap"
            to="/login"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-white/10 mt-16">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between text-white/70">
          <div className="text-sm">© {new Date().getFullYear()} StockScan</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/comment-ca-marche" className="hover:text-white">Comment ça marche</Link>
            <Link to="/metiers" className="hover:text-white">Métiers</Link>
            <Link to="/tarifs" className="hover:text-white">Tarifs</Link>
            <Link to="/terms" className="hover:text-white">CGU</Link>
            <Link to="/privacy" className="hover:text-white">Confidentialité</Link>
            <Link to="/legal" className="hover:text-white">Mentions légales</Link>
            <Link to="/support" className="hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
