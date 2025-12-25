
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
 
  const directCode = (err?.code || "").toLowerCase();
  if (directCode === "email_not_verified") return true;

  const data = err?.response?.data || {};
  const code = (data.code || "").toLowerCase();
  const detail = (data.detail || data.message || "").toLowerCase();
  const nonField = Array.isArray(data.non_field_errors)
    ? String(data.non_field_errors[0] || "").toLowerCase()
    : "";

  if (code === "email_not_verified") return true;

  const hay = `${detail} ${nonField}`;
  return hay.includes("email") && (hay.includes("verify") || hay.includes("vérif") || hay.includes("non vérifié"));
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const pushToast = useToast();

  const invited = loc.state?.invited;
  const invitedEmail = loc.state?.email;

  const [form, setForm] = useState({ username: "", password: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const from = useMemo(() => safeFromLocation(loc.state), [loc.state]);

  useEffect(() => {
    if (invitedEmail) setForm((p) => ({ ...p, username: invitedEmail }));
  }, [invitedEmail]);

  useEffect(() => {
    if (loc.state?.reason === "auth_required") {
      setErr("Connexion requise. Merci de te reconnecter.");
    }
  }, [loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setNeedsVerify(false);
    setLoading(true);

    try {
      await login(form);
      nav(from, { replace: true });
    } catch (e2) {
      if (isEmailNotVerifiedError(e2)) {
        const email = extractEmailFromUsername(form.username);
        setNeedsVerify(true);
        setErr(
          "Ton compte existe, mais il n’est pas encore activé. Vérifie ton email (et les spams) puis clique sur le lien de confirmation."
        );

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
      setNeedsVerify(true);
      nav("/check-email", { state: { email }, replace: false });
    } catch {
      pushToast?.({ type: "error", message: "Impossible pour le moment. Réessaie plus tard." });
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
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      <Helmet>
        <title>Connexion | StockScan</title>
        <meta name="description" content="Connectez-vous à StockScan pour gérer vos inventaires." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-blue-600 blur-[120px] opacity-40" />
      <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-400 blur-[120px] opacity-30" />

      <Card className="w-full max-w-md glass border-white/10 bg-white/5 text-white">
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Bienvenue</div>
            <h1 className="text-3xl font-black leading-tight">Connexion</h1>
            <p className="text-white/70 mt-1">Accède à ton espace StockScan.</p>
          </div>

          {invited ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Invitation acceptée ✅ {invitedEmail ? `Connecte-toi avec ${invitedEmail}.` : "Tu peux te connecter."}
            </div>
          ) : null}

          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
              {err}

              {needsVerify ? (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button onClick={resend} loading={resending} disabled={resending} size="sm">
                    Renvoyer l’email
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => nav("/check-email", { state: { email: extractEmailFromUsername(form.username) } })}
                  >
                    Aller à la vérification
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-3">
            <Input
              label="Nom d’utilisateur ou email"
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
                  className="text-xs font-semibold text-white/80 px-2 py-1 rounded-full border border-white/20 hover:bg-white/10 transition"
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? "Cacher" : "Voir"}
                </button>
              }
            />

            <Button type="submit" className="w-full justify-center" loading={loading} disabled={!form.username || !form.password || loading}>
              Se connecter
            </Button>
          </form>

          <div className="text-sm text-white/70 flex justify-between items-center">
            <Link to="/" className="underline">Retour landing</Link>
            <Link to="/register" className="underline">Créer un compte</Link>
          </div>

          <div className="text-xs text-white/40">
            Tu n’as pas reçu l’email ? Mets ton email en identifiant puis clique sur “Renvoyer l’email”.
          </div>
        </div>
      </Card>
    </div>
  );
}