import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { api } from "../lib/api";

export default function InvitationAccept() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    password_confirm: "",
  });

  useEffect(() => {
    const run = async () => {
      setErr("");
      setLoading(true);
      setMeta(null);
      try {
        const res = await api.get(`/api/auth/invitations/accept/?token=${encodeURIComponent(token)}`);
        setMeta(res?.data || null);
      } catch (e) {
        const msg =
          e?.response?.data?.detail ||
          e?.response?.data?.status ||
          "Invitation invalide ou expirée.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    if (token) run();
    else {
      setErr("Token manquant.");
      setLoading(false);
    }
  }, [token]);

  const canSubmit =
    !!token &&
    !loading &&
    meta?.status === "OK" &&
    form.password.length >= 8 &&
    form.password === form.password_confirm;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (form.password.length < 8) return setErr("8 caractères minimum.");
    if (form.password !== form.password_confirm) return setErr("Les mots de passe ne correspondent pas.");

    try {
      await api.post("/api/auth/invitations/accept/", {
        token,
        username: form.username.trim() || undefined,
        password: form.password,
        password_confirm: form.password_confirm,
      });

      nav("/login", { replace: true, state: { invited: true, email: meta?.email } });
    } catch (e2) {
      const msg = e2?.response?.data?.detail || "Impossible d’accepter l’invitation.";
      setErr(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <Helmet>
        <title>Invitation | StockScan</title>
        <meta name="description" content="Accepter une invitation et créer un mot de passe." />
      </Helmet>

      <Card className="w-full max-w-md glass border-white/10 bg-white/5 text-white">
        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Invitation</div>
            <h1 className="text-2xl font-black">Créer ton mot de passe</h1>
            {meta?.tenant?.name ? (
              <p className="text-white/70 mt-1">
                Commerce : <span className="font-semibold">{meta.tenant.name}</span>
              </p>
            ) : null}
          </div>

          {loading ? <div className="text-sm text-white/70">Chargement…</div> : null}

          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          {!loading && meta?.status === "OK" ? (
            <>
              <div className="text-sm text-white/70">
                Email invité : <span className="font-semibold">{meta.email}</span>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <Input
                  label="Nom d’utilisateur (optionnel)"
                  placeholder="ex: prenom.nom"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  autoComplete="username"
                />

                <Input
                  label="Mot de passe"
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="new-password"
                  rightSlot={
                    <button
                      type="button"
                      className="text-xs font-semibold text-white/80 px-2 py-1 rounded-full border border-white/20 hover:bg-white/10"
                      onClick={() => setShowPwd((s) => !s)}
                    >
                      {showPwd ? "Cacher" : "Voir"}
                    </button>
                  }
                />

                <Input
                  label="Confirmer"
                  type={showPwd ? "text" : "password"}
                  value={form.password_confirm}
                  onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))}
                  autoComplete="new-password"
                />

                <Button className="w-full justify-center" type="submit" disabled={!canSubmit} loading={false}>
                  Valider et rejoindre
                </Button>

                <div className="text-xs text-white/60">
                  Mot de passe : 8 caractères minimum.
                </div>
              </form>
            </>
          ) : null}

          <div className="text-sm text-white/70 flex justify-between">
            <Link to="/" className="underline">
              Retour
            </Link>
            <Link to="/login" className="underline">
              Connexion
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}