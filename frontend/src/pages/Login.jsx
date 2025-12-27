// frontend/src/pages/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { formatApiError } from "../lib/errorUtils";
import { resendVerificationEmail } from "../lib/api";
import { useToast } from "../app/ToastContext";

function safeFromLocation(locState) {
  const raw = locState?.from;
  if (!raw) return "/app/dashboard";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw?.pathname) return raw.pathname + (raw?.search || "") + (raw?.hash || "");
  return "/app/dashboard";
}

function isEmailLike(value) {
  return typeof value === "string" && value.includes("@");
}

function extractEmailFromUsername(value) {
  const v = String(value || "").trim();
  return isEmailLike(v) ? v : "";
}

function isEmailNotVerifiedError(err) {
  if (!err) return false;
  if (err.code === "email_not_verified" || err.isEmailNotVerified) return true;

  const data = err?.response?.data || {};
  const code = String(data.code || "").toLowerCase();
  if (code === "email_not_verified") return true;

  const detail = String(data.detail || data.message || err.message || "").toLowerCase();
  return detail.includes("email") && detail.includes("non vérifi");
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const pushToast = useToast();

  const invited = Boolean(loc.state?.invited);
  const invitedEmail = loc.state?.email;

  const [form, setForm] = useState({ username: "", password: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const from = useMemo(() => safeFromLocation(loc.state), [loc.state]);

  // ✅ Forcer dark sur Login (volontairement)
  useEffect(() => {
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      if (prevTheme) document.documentElement.setAttribute("data-theme", prevTheme);
      else document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  useEffect(() => {
    if (invitedEmail) setForm((p) => ({ ...p, username: invitedEmail }));
  }, [invitedEmail]);

  useEffect(() => {
    if (loc.state?.reason === "auth_required") {
      setErr("Session expirée. Merci de te reconnecter.");
    }
  }, [loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await login(form);
      nav(from, { replace: true });
    } catch (e2) {
      if (isEmailNotVerifiedError(e2)) {
        const email = extractEmailFromUsername(form.username);
        nav("/check-email", { state: { email }, replace: false });
        return;
      }
      setErr(formatApiError(e2, { context: "login" }));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    const email = extractEmailFromUsername(form.username);
    if (!email) {
      pushToast?.({ type: "error", message: "Entre ton email dans le champ identifiant, puis réessaie." });
      return;
    }
    setResending(true);
    try {
      await resendVerificationEmail({ email });
      pushToast?.({ type: "success", message: "Email de vérification renvoyé." });
      nav("/check-email", { state: { email }, replace: false });
    } catch (e) {
      pushToast?.({ type: "error", message: formatApiError(e, { context: "generic" }) });
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!err) return undefined;
    const timer = window.setTimeout(() => setErr(""), 7000);
    return () => window.clearTimeout(timer);
  }, [err]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-2 sm:px-4 relative overflow-x-hidden">
      <Helmet>
        <title>Connexion | StockScan</title>
        <meta name="description" content="Connectez-vous à StockScan pour gérer vos inventaires." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* background premium (dark) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--bg)" }} />
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full blur-[120px] opacity-25 bg-blue-500 pointer-events-none" />
      <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full blur-[120px] opacity-20 bg-emerald-400 pointer-events-none" />

      <Card className="w-full max-w-md p-0" glass>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Bienvenue</div>
            <h1 className="text-3xl font-black leading-tight text-[var(--text)]">Connexion</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Accède à ton espace StockScan.</p>
          </div>

          {invited ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              <div className="font-semibold text-[var(--text)]">Invitation acceptée ✅</div>
              <div className="text-[var(--muted)]">
                {invitedEmail ? `Connecte-toi avec ${invitedEmail}.` : "Tu peux te connecter."}
              </div>
            </div>
          ) : null}

          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm" role="alert">
              <div className="text-[var(--text)]">{err}</div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button onClick={resend} loading={resending} disabled={resending} size="sm">
                  Renvoyer l’email
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => nav("/check-email", { state: { email: extractEmailFromUsername(form.username) } })}
                >
                  Vérifier mon email
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-3">
            <Input
              label="Identifiant (email ou nom d’utilisateur)"
              placeholder="vous@commerce.fr"
              value={form.username}
              autoFocus
              onChange={(e) => {
                setForm((p) => ({ ...p, username: e.target.value }));
                if (err) setErr("");
              }}
              autoComplete="username"
            />

            <Input
              label="Mot de passe"
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => {
                setForm((p) => ({ ...p, password: e.target.value }));
                if (err) setErr("");
              }}
              autoComplete="current-password"
              rightSlot={
                <button
                  type="button"
                  className="text-xs font-semibold px-2 py-1 rounded-full border border-[var(--border)] bg-white/5 hover:bg-white/10 transition"
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? "Cacher" : "Voir"}
                </button>
              }
            />

            <Button
              type="submit"
              className="w-full justify-center"
              loading={loading}
              disabled={!form.username || !form.password || loading}
            >
              Se connecter
            </Button>
          </form>

          <div className="text-sm text-[var(--muted)] flex justify-between items-center">
            <Link to="/" className="underline">
              Retour au site
            </Link>
            <Link to="/register" className="underline">
              Créer un compte
            </Link>
          </div>

          <div className="text-xs text-[var(--muted)]">
            Email d’activation non reçu ? Mets ton email en identifiant puis clique sur “Renvoyer l’email”.
          </div>
        </div>
      </Card>
    </div>
  );
}
