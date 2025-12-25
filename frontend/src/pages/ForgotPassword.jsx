import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { requestPasswordReset } from "../lib/api";
import { useToast } from "../app/ToastContext";

export default function ForgotPassword() {
  const pushToast = useToast();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!emailOrUsername.trim()) {
      pushToast?.({ type: "error", message: "Renseigne ton email ou ton nom d’utilisateur." });
      return;
    }
    setLoading(true);
    try {
      const v = emailOrUsername.trim();
      const payload = v.includes("@") ? { email: v } : { username: v };
      await requestPasswordReset(payload);
      pushToast?.({
        type: "success",
        message: "Si le compte existe, un email de réinitialisation a été envoyé.",
      });
      setEmailOrUsername("");
    } catch (e) {
      pushToast?.({ type: "error", message: "Impossible pour le moment. Réessaie plus tard." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Mot de passe oublié | StockScan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mx-auto max-w-lg p-4">
        <Card className="p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold">Mot de passe oublié</div>
            <div className="text-xs text-[var(--muted)]">
              Entre ton email (ou ton nom d’utilisateur). On t’envoie un lien si le compte existe.
            </div>
          </div>

          <Input
            label="Email ou nom d’utilisateur"
            placeholder="contact@commerce.fr"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            autoComplete="username"
          />

          <div className="flex gap-2 flex-wrap">
            <Button onClick={submit} loading={loading} disabled={loading}>
              Envoyer le lien
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/login")}>
              Retour
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}