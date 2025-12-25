
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../ui/Card";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { api } from "../lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [state, setState] = useState({ loading: true, ok: false, message: "" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid || !token) {
        setState({ loading: false, ok: false, message: "Lien incomplet." });
        return;
      }
      try {
        const res = await api.get(`/api/auth/verify-email/?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`);
        const msg = res?.data?.detail || "Email vérifié.";
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
  }, [uid, token]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg p-4">
        <Card className="p-6 space-y-3">
          <div className="text-sm font-semibold">Vérification email</div>
          <div className="text-sm text-[var(--muted)]">
            {state.loading ? "Vérification en cours…" : state.message}
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <Button onClick={() => (window.location.href = "/login")}>
              Aller à la connexion
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