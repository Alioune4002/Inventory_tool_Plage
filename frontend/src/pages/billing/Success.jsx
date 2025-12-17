// frontend/src/pages/billing/Success.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";

import PageTransition from "../../components/PageTransition";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";

import { useToast } from "../../app/ToastContext";
import { useAuth } from "../../app/AuthProvider";
import useEntitlements from "../../app/useEntitlements";

function prettyPlan(code) {
  const c = String(code || "").toUpperCase();
  if (c === "ESSENTIEL") return "Essentiel";
  if (c === "BOUTIQUE") return "Boutique";
  if (c === "PRO") return "Pro";
  if (c === "ENTREPRISE") return "Entreprise";
  return c || "—";
}

function prettyStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "Actif";
  if (s === "PAST_DUE") return "Paiement en attente";
  if (s === "CANCELED") return "Annulé";
  if (s === "NONE") return "Aucun";
  if (s === "FREE") return "Gratuit";
  if (s === "SUSPENDED") return "Suspendu";
  return s || "—";
}

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pushToast = useToast();

  const { refreshServices, tenant, isAuthed } = useAuth();
  const { data: entitlements, loading: entLoading, refetch } = useEntitlements();

  const [syncing, setSyncing] = useState(true);
  const [syncedOnce, setSyncedOnce] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(10);

  const sessionId = params.get("session_id"); // Stripe peut renvoyer ça si tu l’ajoutes côté backend

  const headline = useMemo(() => {
    if (!isAuthed) return "Paiement confirmé";
    const plan = prettyPlan(entitlements?.plan_effective);
    if (plan && plan !== "—") return `Plan ${plan} activé`;
    return "Plan activé";
  }, [entitlements, isAuthed]);

  useEffect(() => {
    let alive = true;

    async function syncAfterCheckout() {
      // Même si Stripe a confirmé, le webhook peut mettre quelques secondes.
      // On refetch plusieurs fois de façon douce.
      try {
        if (!isAuthed) {
          // si pas authed, on ne peut pas refetch tenant/entitlements => on affiche juste un écran OK
          if (alive) setSyncing(false);
          return;
        }

        if (alive) setSyncing(true);

        // 1) refetch direct
        await refetch?.();
        await refreshServices?.();

        // 2) si toujours pas à jour, on retente 2 fois
        // (sans spinner agressif : juste une courte sync)
        for (let i = 0; i < 2; i++) {
          if (!alive) return;
          await new Promise((r) => setTimeout(r, 900));
          await refetch?.();
        }

        if (!alive) return;
        setSyncedOnce(true);
        pushToast?.({
          type: "success",
          message: "Paiement confirmé. Votre accès premium est prêt.",
        });
      } catch (e) {
        // On reste “success” côté UI, mais on explique que la synchro peut prendre un moment.
        pushToast?.({
          type: "info",
          message:
            "Paiement confirmé. La synchronisation peut prendre quelques secondes (webhook). Rafraîchissez si besoin.",
        });
      } finally {
        if (alive) setSyncing(false);
      }
    }

    syncAfterCheckout();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const planEffective = prettyPlan(entitlements?.plan_effective);
  const status = prettyStatus(entitlements?.subscription_status);

  useEffect(() => {
    if (!isAuthed) return;
    if (redirectCountdown <= 0) {
      navigate("/app/dashboard");
      return;
    }
    const timer = window.setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [redirectCountdown, isAuthed, navigate]);

  return (
    <PageTransition>
      <Helmet>
        <title>Paiement confirmé | StockScan</title>
        <meta name="description" content="Paiement confirmé. Activation du plan en cours." />
      </Helmet>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 space-y-4">
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-slate-500">Facturation</div>
              <h1 className="text-2xl font-black">{headline}</h1>
              <p className="text-sm text-slate-600">
                Merci. Vous pouvez reprendre l’inventaire immédiatement. Vos données restent intactes.
              </p>
            </div>
            <Badge variant="info">{syncing || entLoading ? "Synchronisation…" : "OK"}</Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <Card className="p-4" hover={false}>
              <div className="text-xs text-slate-500">Commerce</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{tenant?.name || "—"}</div>
              <div className="text-xs text-slate-500">{tenant?.domain ? `Domaine: ${tenant.domain}` : ""}</div>
            </Card>

            <Card className="p-4" hover={false}>
              <div className="text-xs text-slate-500">Statut</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{status}</div>
              <div className="text-xs text-slate-500">Plan: {planEffective}</div>
            </Card>
          </div>

          {sessionId ? (
            <div className="text-xs text-slate-500 pt-1">Référence: {sessionId}</div>
          ) : null}
          {isAuthed ? (
            <div className="text-xs text-slate-500 pt-1">
              Redirection vers le dashboard dans {redirectCountdown}s…
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-3">
            <Button onClick={() => navigate("/dashboard")}>Aller au Dashboard</Button>
            <Button variant="secondary" onClick={() => navigate("/settings")}>
              Ouvrir les paramètres
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setSyncing(true);
                try {
                  await refetch?.();
                  await refreshServices?.();
                  pushToast?.({ type: "success", message: "Données de facturation rafraîchies." });
                } catch (e) {
                  pushToast?.({ type: "error", message: "Rafraîchissement impossible." });
                } finally {
                  setSyncing(false);
                }
              }}
              loading={syncing}
            >
              Rafraîchir
            </Button>
          </div>

          {!syncedOnce && isAuthed ? (
            <div className="text-xs text-slate-500 pt-2">
              Si vous venez juste de payer : le webhook Stripe peut prendre quelques secondes. Cette page se met à jour
              automatiquement, sinon cliquez sur “Rafraîchir”.
            </div>
          ) : null}
        </Card>

        <Card className="p-6 space-y-2">
          <div className="text-sm font-semibold text-slate-800">Ce que vous pouvez faire maintenant</div>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Ajouter des services/utilisateurs selon votre plan</li>
            <li>• Déclarer les pertes (DLC, casse, vol) et suivre vos alertes</li>
            <li>• Exporter vos inventaires (CSV / PDF selon plan)</li>
          </ul>
        </Card>
      </div>
    </PageTransition>
  );
}
