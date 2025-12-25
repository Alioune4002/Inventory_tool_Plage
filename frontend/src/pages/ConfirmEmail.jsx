
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../ui/Card";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { api, setAuthToken } from "../lib/api";
import { clearToken } from "../lib/auth";

export default function ConfirmEmail() {
  const [params] = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const emailToken = params.get("email_token") || "";

  const [state, setState] = useState({ loading: true, ok: false, message: "" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid || !token || !emailToken) {
        setState({ loading: false, ok: false, message: "Lien incomplet." });
        return;
      }
      try {
        // sécurité: on purge une session potentiellement incohérente
        clearToken();
        setAuthToken(null);

        const res = await api.get(
          `/api/auth/email-change/confirm/?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}&email_token=${encodeURIComponent(emailToken)}`
        );
        const msg = res?.data?.detail || "Email mis à jour.";
        if (!cancelled) setState({ loading: false, ok: true, message: msg });
      } catch (e) {
        const msg = e?.response?.data?.detail || "Lien invalide ou expiré.";
        if (!cancelled) setState({ loading: false, ok: false, message: msg });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, token, emailToken]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg p-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm font-semibold">Confirmation de nouvelle adresse email</div>
          <div className="text-sm text-[var(--muted)]">
            {state.loading ? "Confirmation en cours…" : state.message}
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <Button onClick={() => (window.location.href = "/login")}>
              Se reconnecter
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/")}>
              Retour au site
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}