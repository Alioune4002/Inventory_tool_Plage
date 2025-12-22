import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import Button from "../../ui/Button";

export default function PublicShell({ children }) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      if (prevTheme) {
        document.documentElement.setAttribute("data-theme", prevTheme);
      }
    };
  }, []);

  return (
    <div className="public-shell relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-grid" />
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-blue-600 blur-[140px] opacity-30" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-400 blur-[160px] opacity-20" />

      <header className="relative z-10 mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-black tracking-tight text-white">
          StockScan
        </Link>
        <nav className="hidden md:flex items-center gap-4 text-sm font-semibold">
          <Link to="/metiers" className="text-white/80 hover:text-white">
            Métiers
          </Link>
          <Link to="/fonctionnalites" className="text-white/80 hover:text-white">
            Fonctionnalités
          </Link>
          <Link to="/tarifs" className="text-white/80 hover:text-white">
            Tarifs
          </Link>
          <Link to="/support" className="text-white/80 hover:text-white">
            Support
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-full px-4 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition"
            to="/login"
          >
            Se connecter
          </Link>
          <Button as={Link} to="/register" className="rounded-full px-4 py-2 text-sm font-semibold">
            Créer un compte
          </Button>
        </div>
      </header>

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-white/10 mt-16">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between text-white/70">
          <div className="text-sm">© {new Date().getFullYear()} StockScan</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/comment-ca-marche" className="hover:text-white">
              Comment ça marche
            </Link>
            <Link to="/metiers" className="hover:text-white">
              Métiers
            </Link>
            <Link to="/tarifs" className="hover:text-white">
              Tarifs
            </Link>
            <Link to="/terms" className="hover:text-white">
              CGU
            </Link>
            <Link to="/privacy" className="hover:text-white">
              Confidentialité
            </Link>
            <Link to="/support" className="hover:text-white">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
