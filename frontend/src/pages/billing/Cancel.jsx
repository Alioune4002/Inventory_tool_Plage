// frontend/src/pages/billing/Cancel.jsx
import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";

import PageTransition from "../../components/PageTransition";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";

import { useAuth } from "../../app/AuthProvider";
import useEntitlements from "../../app/useEntitlements";
import { formatPlanLabel } from "../../lib/planLabels";

export default function BillingCancel() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { tenant, isAuthed } = useAuth();
  const { data: entitlements } = useEntitlements();

  const reason = params.get("reason"); // optionnel si tu veux l’ajouter côté backend
  const lastPlan = formatPlanLabel(entitlements?.plan_effective, "Solo");

  const headline = useMemo(() => {
    if (!isAuthed) return "Paiement annulé";
    return "Paiement annulé — aucun débit";
  }, [isAuthed]);

  const subtitle = useMemo(() => {
    if (!isAuthed) {
      return "Vous avez quitté le paiement avant validation. Aucun débit n’a été effectué.";
    }
    return `Aucun débit n’a été effectué. Vous conservez l’accès à votre espace (${tenant?.name || "votre commerce"}) et pouvez reprendre l’inventaire immédiatement.`;
  }, [isAuthed, tenant]);

  return (
    <PageTransition>
      <Helmet>
        <title>Paiement annulé | StockScan</title>
        <meta name="description" content="Paiement annulé. Aucun débit n'a été effectué." />
      </Helmet>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 space-y-4">
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-slate-500">Facturation</div>
              <h1 className="text-2xl font-black">{headline}</h1>
              <p className="text-sm text-slate-600">{subtitle}</p>
            </div>
            <Badge variant="warning">Annulé</Badge>
          </div>

          {isAuthed ? (
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <Card className="p-4" hover={false}>
                <div className="text-xs text-slate-500">Commerce</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{tenant?.name || "—"}</div>
                <div className="text-xs text-slate-500">{tenant?.domain ? `Domaine: ${tenant.domain}` : ""}</div>
              </Card>

              <Card className="p-4" hover={false}>
                <div className="text-xs text-slate-500">Plan actuel</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{lastPlan}</div>
                <div className="text-xs text-slate-500">
                  Vous pouvez retenter le paiement à tout moment.
                </div>
              </Card>
            </div>
          ) : null}

          {reason ? (
            <div className="text-xs text-slate-500 pt-1">
              Détail: <span className="font-semibold text-slate-700">{reason}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-3">
            <Button onClick={() => navigate("/tarifs")}>Revenir aux tarifs</Button>
            {isAuthed ? (
              <>
                <Button variant="secondary" onClick={() => navigate("/app/dashboard")}>
                  Retour au Dashboard
                </Button>
                <Button variant="secondary" onClick={() => navigate("/app/settings")}>
                  Paramètres
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => navigate("/login")}>
                Se connecter
              </Button>
            )}
          </div>

          <div className="text-xs text-slate-500 pt-2">
            Besoin d’aide ? En cas de blocage, on peut activer un essai Duo/Multi sur demande.
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <div className="text-sm font-semibold text-slate-800">Rappel</div>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Aucune donnée n’est supprimée si vous n’activez pas un plan</li>
            <li>• Lecture & export restent possibles même si vous dépassez les quotas</li>
            <li>• Vous pouvez réessayer plus tard (même appareil, même compte)</li>
          </ul>
        </Card>
      </div>
    </PageTransition>
  );
}
