// frontend/src/pages/CheckEmail.jsx
import React, { useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { resendVerificationEmail } from "../lib/api";
import { useToast } from "../app/ToastContext";
import { formatApiError } from "../lib/errorUtils";

export default function CheckEmail() {
  const loc = useLocation();
  const nav = useNavigate();
  const pushToast = useToast();
  const [sending, setSending] = useState(false);

  const email = useMemo(() => {
    const stateEmail = (loc.state?.email || "").trim();
    if (stateEmail) return stateEmail;
    try {
      const qs = new URLSearchParams(loc.search || "");
      return (qs.get("email") || "").trim();
    } catch {
      return "";
    }
  }, [loc.state, loc.search]);

  const resend = async () => {
    if (!email) {
      pushToast?.({ type: "error", message: "Email manquant. Retourne à l’inscription." });
      return;
    }

    setSending(true);
    try {
      await resendVerificationEmail({ email });
      pushToast?.({ type: "success", message: "Email de vérification renvoyé." });
    } catch (e) {
      pushToast?.({ type: "error", message: formatApiError(e, { context: "generic" }) });
    } finally {
      setSending(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Vérifie ton email | StockScan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--bg)" }} />
        <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />

        <div className="relative mx-auto max-w-lg p-4 pt-10">
          <Card className="p-6 space-y-4">
            <div className="text-lg font-black text-[var(--text)]">Dernière étape : vérifie ton email</div>

            <div className="text-sm text-[var(--muted)]">
              On t’a envoyé un lien de confirmation{email ? ` à ${email}` : ""}. Clique dessus pour activer ton compte.
            </div>

            {!email ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                <div className="font-semibold text-[var(--text)]">Email introuvable</div>
                <div className="text-[var(--muted)]">
                  On n’a pas l’adresse email sur cette page. Retourne à la connexion ou à l’inscription.
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button variant="secondary" onClick={() => nav("/login")}>
                    Aller à la connexion
                  </Button>
                  <Button onClick={() => nav("/register")}>Créer un compte</Button>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={resend} disabled={!email || sending} loading={sending}>
                Renvoyer l’email
              </Button>
              <Button variant="secondary" onClick={() => nav("/login", { state: { email } })}>
                Se connecter
              </Button>
            </div>

            <div className="text-xs text-[var(--muted)]">
              Astuce : regarde aussi les spams.{" "}
              <Link className="underline" to="/">
                Retour au site
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}