// frontend/src/components/BillingBanners.jsx
import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { formatPlanLabel, formatUpgradeLabel } from "../lib/planLabels";

const Banner = ({ title, subtitle, tone = "info", actions = [] }) => {
  const palette = {
    info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]",
    warning: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
    danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  }[tone];

  return (
    <Card className={`p-4 border ${palette}`} hover={false}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold uppercase tracking-wide opacity-80">{title}</div>
          <div className="text-sm opacity-90">{subtitle}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant || (tone === "danger" ? "danger" : "primary")}
              onClick={a.onClick}
              disabled={a.disabled}
              loading={a.loading}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
};

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(diff));
}

async function openBillingPortal(setBusy) {
  try {
    setBusy(true);
    const res = await api.post("/api/auth/billing/portal/", {});
    const url = res?.data?.url;
    if (!url) throw new Error("URL Billing Portal manquante.");
    window.location.href = url;
  } catch (e) {
    const msg =
      e?.response?.data?.detail ||
      e?.message ||
      "Impossible d’ouvrir la gestion d’abonnement. Réessaie plus tard.";
    alert(msg);
  } finally {
    setBusy(false);
  }
}

export default function BillingBanners({ entitlements }) {
  const [busy, setBusy] = useState(false);

  if (!entitlements) return null;

  const {
    plan_source,
    expires_at,
    limits,
    usage,
    subscription_status,
    last_plan_was_trial,
    plan_effective,
  } = entitlements;

  const planLabel = formatPlanLabel(plan_effective, "Solo");
  const upgradeLabel = formatUpgradeLabel(plan_effective);

  const banners = [];
  const dLeft = daysLeft(expires_at);

  const goTarifs = () => {
    window.location.href = "/tarifs";
  };

  // Essai en cours
  if (plan_source === "TRIAL" && dLeft !== null) {
    if (dLeft <= 3) {
      banners.push({
        tone: "warning",
        title: "Votre essai se termine bientôt",
        subtitle:
          `Plus que ${dLeft} jour${dLeft > 1 ? "s" : ""} avant la fin de votre accès premium. Continuez sans interruption en choisissant un plan.`,
        actions: [
          { label: "Choisir un plan", onClick: goTarifs, variant: "primary" },
          { label: "Comparer les offres", onClick: goTarifs, variant: "secondary" },
        ],
      });
    } else {
      banners.push({
        tone: "info",
        title: "Essai premium en cours",
        subtitle:
          `Il vous reste ${dLeft} jour${dLeft > 1 ? "s" : ""} pour tester les fonctionnalités premium. À la fin, retour Solo automatiquement.`,
        actions: [
          { label: "Voir les plans", onClick: goTarifs, variant: "primary" },
        ],
      });
    }
  }

  // Fin d'essai
  if (plan_source === "FREE" && last_plan_was_trial) {
    banners.push({
      tone: "neutral",
      title: "Fin de l’accès premium",
      subtitle:
        "Votre essai est terminé. Vous êtes revenu sur Solo (gratuit). Vos données restent intactes, et l’export reste disponible.",
      actions: [
        { label: "Comparer les plans", onClick: goTarifs, variant: "primary" },
      ],
    });
  }

  // Impayés / suspension
  if (subscription_status === "PAST_DUE") {
    banners.push({
      tone: "warning",
      title: "Paiement en attente",
      subtitle:
        "Votre paiement n’a pas été régularisé. Pour éviter la suspension, mettez à jour votre moyen de paiement.",
      actions: [
        {
          label: "Régulariser",
          onClick: () => openBillingPortal(setBusy),
          loading: busy,
          disabled: busy,
          variant: "primary",
        },
        { label: "Voir les plans", onClick: goTarifs, variant: "secondary" },
      ],
    });
  } else if (subscription_status === "SUSPENDED") {
    banners.push({
      tone: "danger",
      title: "Accès premium suspendu",
      subtitle:
        "Faute de paiement, votre compte est repassé sur Solo. Vos données sont conservées, l’export reste disponible.",
      actions: [
        {
          label: "Réactiver via Stripe",
          onClick: () => openBillingPortal(setBusy),
          loading: busy,
          disabled: busy,
          variant: "danger",
        },
        { label: "Comparer les plans", onClick: goTarifs, variant: "secondary" },
      ],
    });
  }

  // Limites dépassées
  const overProd =
    limits?.max_products != null &&
    usage?.products_count != null &&
    usage.products_count > limits.max_products;
  const overSrv =
    limits?.max_services != null &&
    usage?.services_count != null &&
    usage.services_count > limits.max_services;
  const overUsers =
    limits?.max_users != null &&
    usage?.users_count != null &&
    usage.users_count > limits.max_users;

  if (overProd) {
    banners.push({
      tone: "danger",
      title: "Limite de produits atteinte",
      subtitle:
        `Plan ${planLabel} : limite à ${limits?.max_products ?? "100"} produits. Vous en avez ${usage?.products_count ?? "plus que la limite"}. Lecture/export OK, ajout bloqué.`,
      actions: [
        {
          label: upgradeLabel ? `Passer à ${upgradeLabel}` : "Contacter l'équipe",
          onClick: upgradeLabel ? goTarifs : () => (window.location.href = "/contact"),
          variant: "danger",
        },
      ],
    });
  }
  if (overSrv) {
    banners.push({
      tone: "warning",
      title: "Limite de services atteinte",
      subtitle:
        `Plan ${planLabel} : ${limits?.max_services ?? "1"} service(s) autorisé(s). Pour en ajouter, passez au plan supérieur.`,
      actions: [
        {
          label: upgradeLabel ? `Passer à ${upgradeLabel}` : "Comparer les plans",
          onClick: goTarifs,
          variant: "primary",
        },
      ],
    });
  }
  if (overUsers) {
    banners.push({
      tone: "warning",
      title: "Nombre maximal d’utilisateurs atteint",
      subtitle:
        `Plan ${planLabel} : ${limits?.max_users ?? "1"} utilisateur(s). Ajoutez-en davantage en changeant de plan.`,
      actions: [
        {
          label: upgradeLabel ? `Passer à ${upgradeLabel}` : "Comparer les plans",
          onClick: goTarifs,
          variant: "primary",
        },
      ],
    });
  }

  if (!banners.length) return null;

  return (
    <div className="space-y-3">
      {banners.map((b, idx) => (
        <Banner key={`${b.title}-${idx}`} {...b} />
      ))}
    </div>
  );
}
