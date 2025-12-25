import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { confirmPasswordReset } from "../lib/api";
import { useToast } from "../app/ToastContext";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const pushToast = useToast();

  const [form, setForm] = useState({ p1: "", p2: "" });
  const [loading, setLoading] = useState(false);

  const linkOk = useMemo(() => Boolean(uid && token), [uid, token]);

  const submit = async () => {
    if (!linkOk) {
      pushToast?.({ message: "Lien incomplet.", type: "error" });
      return;
    }
    if (!form.p1 || form.p1.length < 8) {
      pushToast?.({ message: "Mot de passe trop court (8 caractères minimum).", type: "error" });
      return;
    }
    if (form.p1 !== form.p2) {
      pushToast?.({ message: "Les mots de passe ne correspondent pas.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset({
        uid,
        token,
        new_password: form.p1,
        new_password_confirm: form.p2,
      });
      pushToast?.({ message: "Mot de passe mis à jour. Tu peux te connecter.", type: "success" });
      window.location.href = "/login";
    } catch (e) {
      const msg = e?.response?.data?.detail || "Impossible de réinitialiser (lien expiré ?).";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg p-4">
        <Card className="p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold">Nouveau mot de passe</div>
            <div className="text-xs text-[var(--muted)]">
              Choisis un mot de passe solide (min. 8 caractères).
            </div>
          </div>

          <div className="grid gap-3">
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={form.p1}
              onChange={(e) => setForm((p) => ({ ...p, p1: e.target.value }))}
            />
            <Input
              label="Confirmer"
              type="password"
              value={form.p2}
              onChange={(e) => setForm((p) => ({ ...p, p2: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={submit} loading={loading} disabled={loading}>
              Valider
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/login")}>
              Annuler
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}