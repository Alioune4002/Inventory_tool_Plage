import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PublicShell from "../../components/public/PublicShell";
import { api, setAuthToken } from "../../lib/api";
import { getStoredToken } from "../../lib/auth";

export default function Tarifs() {
  const [cycle, setCycle] = useState("MONTHLY");
  const [loadingPlan, setLoadingPlan] = useState("");
  const stripeEnabled = import.meta.env.VITE_STRIPE_ENABLED === "true";

  const plans = useMemo(() => buildPlans(cycle), [cycle]);

  const startCheckout = async (planCode) => {
    if (!planCode || planCode === "ESSENTIEL" || planCode === "ENTREPRISE") {
      if (planCode === "ESSENTIEL") {
        window.location.href = "/register";
      } else {
        window.location.href = "/contact";
      }
      return;
    }

    if (!stripeEnabled) {
      alert("Stripe n’est pas configuré pour ce déploiement. Contactez l’administrateur.");
      return;
    }

    const token = getStoredToken();
    if (!token) {
      const next = encodeURIComponent("/tarifs");
      window.location.href = `/login?next=${next}`;
      return;
    }

    try {
      setLoadingPlan(planCode);
      setAuthToken(token);

      const res = await api.post("/api/auth/billing/checkout/", {
        plan: planCode,
        cycle,
      });

      const url = res?.data?.url;
      if (!url) throw new Error("URL Stripe manquante.");
      window.location.href = url;
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Impossible de démarrer le paiement. Réessaie dans un instant.";
      alert(msg);
    } finally {
      setLoadingPlan("");
    }
  };

  return (
    <PublicShell>
      <Helmet>
        <title>Tarifs | StockScan</title>
        <meta
          name="description"
          content="Plans Essentiel, Boutique, Pro et Entreprise. Catalogue propre, inventaire métier, exports premium, IA coach."
        />
      </Helmet>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Tarifs</p>
          <h1 className="text-3xl md:text-4xl font-bold">Tarifs transparents, sans surprise</h1>
          <p className="text-lg text-slate-200">
            Essentiel gratuit pour démarrer. Boutique et Pro pour les équipes multi-services. Entreprise pour les
            contraintes réglementées ou multi-sites.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-200 font-semibold">Facturation :</span>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <button
                className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                  cycle === "MONTHLY" ? "bg-white text-slate-900" : "text-white/90 hover:text-white"
                }`}
                onClick={() => setCycle("MONTHLY")}
                type="button"
              >
                Mensuelle
              </button>
              <button
                className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                  cycle === "YEARLY" ? "bg-white text-slate-900" : "text-white/90 hover:text-white"
                }`}
                onClick={() => setCycle("YEARLY")}
                type="button"
              >
                Annuelle
              </button>
            </div>
            <span className="text-xs text-slate-300">L’annuel revient moins cher (≈ 2 mois off).</span>
          </div>
        </header>

        <section className="grid lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <article key={plan.name} className="public-card p-6 space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                  <p className="text-sm text-slate-200">{plan.subtitle}</p>
                </div>
                {plan.popular && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/15 text-blue-200 border border-blue-400/30">
                    Populaire
                  </span>
                )}
              </div>

              <div className="text-3xl font-black text-white">
                {plan.price}
                <span className="text-base font-semibold text-slate-300">{plan.cycleLabel}</span>
              </div>
              {plan.yearly && <div className="text-sm text-slate-200">{plan.yearly}</div>}

              <ul className="space-y-2 text-sm text-slate-100 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 items-start">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className="w-full rounded-full bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => startCheckout(plan.planCode)}
                disabled={!stripeEnabled || (Boolean(loadingPlan) && loadingPlan !== plan.planCode)}
                type="button"
              >
                {loadingPlan === plan.planCode ? "Redirection…" : plan.cta}
              </button>

              <p className="text-xs text-slate-300">{plan.note}</p>
            </article>
          ))}
        </section>

        <section className="public-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Questions fréquentes</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-100">
            <div>
              <p className="font-semibold">Puis-je tester avant de payer ?</p>
              <p>Oui, l’essentiel est gratuit. Les plans payants sont activables à tout moment.</p>
            </div>
            <div>
              <p className="font-semibold">Comment sont gérés les multi-services ?</p>
              <p>Boutique : 2 services. Pro : 5 services. Le regroupement est configurable dans les paramètres.</p>
            </div>
            <div>
              <p className="font-semibold">L’assistant IA est-il inclus ?</p>
              <p>Inclus en Pro (IA coach). Désactivable à tout moment. Non inclus en Essentiel/Boutique.</p>
            </div>
            <div>
              <p className="font-semibold">Exports et partage email ?</p>
              <p>Essentiel : CSV limité. Boutique : CSV illimités. Pro : CSV + XLSX + partage email.</p>
            </div>
            <div>
              <p className="font-semibold">Que se passe-t-il si je dépasse les limites ?</p>
              <p>Lecture/export restent possibles. L’ajout est bloqué au-delà des quotas.</p>
            </div>
            <div>
              <p className="font-semibold">Et en cas d’impayé ?</p>
              <p>Grâce de quelques jours, puis retour Essentiel. Aucune donnée supprimée.</p>
            </div>
          </div>
        </section>

        {!stripeEnabled && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-900/30 text-white p-6 space-y-2">
            <div className="text-sm font-semibold">Paiements désactivés</div>
            <p className="text-xs text-amber-100">
              Stripe n’est pas configuré sur cette instance. Vérifiez `VITE_STRIPE_ENABLED` et les clés Stripe.
            </p>
          </section>
        )}

        <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-8 space-y-3">
          <h3 className="text-2xl font-bold">Besoin spécifique (pharmacie, production, multi-entrepôts) ?</h3>
          <p className="text-slate-200">
            On peut adapter StockScan à votre métier : lots, registres, production quotidienne, franchises multi-sites.
          </p>
          <button
            className="rounded-full bg-white text-slate-900 font-semibold px-4 py-2 hover:bg-slate-100 transition"
            onClick={() => (window.location.href = "/contact")}
            type="button"
          >
            Parler à un conseiller
          </button>
        </section>
      </main>
    </PublicShell>
  );
}

function buildPlans(cycle) {
  const isYearly = cycle === "YEARLY";

  return [
    {
      name: "Essentiel",
      planCode: "ESSENTIEL",
      subtitle: "Pour démarrer gratuitement",
      price: "0€",
      cycleLabel: "",
      features: [
        "1 service, 1 utilisateur, 100 produits",
        "Historique mouvements 14 jours",
        "Exports CSV (1/jour)",
        "Inventaire de base (barcode/SKU)",
        "Lecture/export même en dépassement",
      ],
      cta: "Démarrer gratuitement",
      note: "Downgrade sans perte de données.",
    },
    {
      name: "Boutique",
      planCode: "BOUTIQUE",
      subtitle: "Petites équipes & commerce de proximité",
      price: isYearly ? "90€" : "9€",
      cycleLabel: isYearly ? "/an" : "/mois",
      yearly: isYearly ? "Économie ≈ 2 mois" : "ou 90€ / an",
      features: [
        "2 services, 3 utilisateurs, 1 000 produits",
        "Exports CSV illimités",
        "Pertes + alertes stock",
        "Rôles par service",
        "Support prioritaire e-mail",
      ],
      cta: "Passer au plan Boutique",
      note: "Idéal pour retail, mode, bar mono-zone.",
    },
    {
      name: "Pro",
      planCode: "PRO",
      subtitle: "Multi-services & équipes",
      price: isYearly ? "190€" : "19€",
      cycleLabel: isYearly ? "/an" : "/mois",
      yearly: isYearly ? "Économie ≈ 2 mois" : "ou 190€ / an",
      popular: true,
      features: [
        "5 services, 10 utilisateurs, produits illimités",
        "Modules métiers complets (DLC, lots, entamés)",
        "Exports CSV + XLSX, partage e-mail",
        "Assistant IA (coach) et analytics",
        "Automations & alertes avancées",
      ],
      cta: "Choisir le plan Pro",
      note: "Pour structures multi-services exigeantes.",
    },
    {
      name: "Entreprise",
      planCode: "ENTREPRISE",
      subtitle: "Sur-mesure & conformité",
      price: "Sur devis",
      cycleLabel: "",
      features: [
        "Pharmacie : lots + registres conformes",
        "Boulangerie : production / invendus",
        "API et SSO sur demande",
        "Accompagnement déploiement",
        "SLA et support dédié",
      ],
      cta: "Parler à un expert",
      note: "On adapte StockScan à vos contraintes spécifiques.",
    },
  ];
}
