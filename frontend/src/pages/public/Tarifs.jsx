import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PublicShell from "../../components/public/PublicShell";
import { api, setAuthToken } from "../../lib/api";
import { getStoredToken } from "../../lib/auth";

const SALES_EMAIL = "support@stockscan.app";

function buildMailto() {
  const subject = encodeURIComponent("StockScan — Demande (Entreprise / besoin spécifique)");
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite échanger à propos de StockScan.\n\n` +
      `Mon activité : (ex : restaurant, bar, boutique, hôtel, camping…)\n` +
      `Nombre de services / zones : \n` +
      `Nombre d'utilisateurs : \n` +
      `Besoin principal : (ex : lots, dates, multi-sites, export, conformité…)\n` +
      `Délai : \n\n` +
      `Merci !\n`
  );
  return `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
}

function Toast({ show, title, message, variant = "info", onClose }) {
  if (!show) return null;

  const styles =
    variant === "success"
      ? "border-emerald-400/30 bg-emerald-900/30 text-emerald-50"
      : variant === "error"
      ? "border-red-400/30 bg-red-900/30 text-red-50"
      : "border-white/10 bg-white/10 text-white";

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md">
      <div
        className={`rounded-2xl border ${styles} backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] px-4 py-3 flex items-start gap-3`}
        role="status"
        aria-live="polite"
      >
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {message ? <div className="text-xs opacity-90 mt-1">{message}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/70 hover:text-white text-sm font-semibold px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition"
          aria-label="Fermer"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export default function Tarifs() {
  const [cycle, setCycle] = useState("MONTHLY");
  const [loadingPlan, setLoadingPlan] = useState("");

  const [toast, setToast] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
  });

  const stripeEnabled = import.meta.env.VITE_STRIPE_ENABLED === "true";
  const plans = useMemo(() => buildPlans(cycle), [cycle]);

  const showToast = (title, message = "", variant = "info") => {
    setToast({ show: true, title, message, variant });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  };

  const openSalesEmail = () => {
    const mailto = buildMailto();
    try {
      window.location.href = mailto;
      
      showToast("Demande envoyée", `Si rien ne s’ouvre, écrivez à ${SALES_EMAIL}.`, "info");
    } catch {
      showToast("Impossible d’ouvrir l’e-mail", `Écrivez à ${SALES_EMAIL}.`, "error");
    }
  };

  const startCheckout = async (planCode) => {
   
    if (!planCode || planCode === "ESSENTIEL" || planCode === "ENTREPRISE") {
      if (planCode === "ESSENTIEL") {
        window.location.href = "/register";
      } else {
        openSalesEmail();
      }
      return;
    }

    if (!stripeEnabled) {
      showToast("Paiements désactivés", "Stripe n’est pas configuré sur ce déploiement.", "error");
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
        plan_code: planCode,
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
      showToast("Paiement impossible", msg, "error");
    } finally {
      setLoadingPlan("");
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SALES_EMAIL);
      showToast("Adresse copiée ✅", SALES_EMAIL, "success");
    } catch {
      showToast("Copie impossible", `Copiez : ${SALES_EMAIL}`, "error");
    }
  };

  return (
    <PublicShell>
      <Helmet>
        <title>Tarifs | StockScan</title>
        <meta
          name="description"
          content="Plans Solo, Duo, Multi et Entreprise. Inventaire métier, multi-services, exports CSV/Excel, options activables."
        />
      </Helmet>

      <Toast
        show={toast.show}
        title={toast.title}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-12 space-y-10 text-white">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Tarifs</p>
          <h1 className="text-3xl md:text-4xl font-black">Des offres simples, sans surprise</h1>
          <p className="text-lg text-slate-200 max-w-3xl">
            Commencez gratuitement. Passez à Duo si vous avez deux zones (ex : cuisine & bar, boutique & réserve).
            Multi pour les équipes et les structures multi-services (ex : hôtel, camping, bar avec réserve + restauration avec la partie cuisine).
            Entreprise si vous avez des contraintes spécifiques (conformité, multi-sites, déploiement).
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                  <p className="text-sm text-slate-200">{plan.subtitle}</p>
                </div>
                {plan.popular && (
                  <span className="shrink-0 px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/15 text-blue-200 border border-blue-400/30">
                    Recommandé
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
              <p>Oui. Solo est gratuit. Vous pouvez évoluer à tout moment.</p>
            </div>
            <div>
              <p className="font-semibold">Multi-services : c’est quoi ?</p>
              <p>Plusieurs zones (ex : bar, cuisine, réserve) avec inventaires séparés ou regroupés.</p>
            </div>
            <div>
              <p className="font-semibold">Exports CSV/Excel ?</p>
              <p>Solo : CSV + Excel (1/mois). Duo : CSV illimités, Excel 30/mois. Multi : CSV + Excel illimités + partage e-mail.</p>
            </div>
            <div>
              <p className="font-semibold">Plan Entreprise : ça sert à quoi ?</p>
              <p>
                Pour hôtels/campings multi-services, multi-sites, conformité, déploiement accompagné ou besoins sur-mesure.
              </p>
            </div>
            <div>
              <p className="font-semibold">Et en cas d’impayé ?</p>
              <p>Après quelques jours, retour au plan gratuit. Aucune donnée supprimée.</p>
            </div>
            <div>
              <p className="font-semibold">Support</p>
              <p>Réponse sous 24h ouvrées (objectif) : {SALES_EMAIL}</p>
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
          <h3 className="text-2xl font-black">Besoin d’un plan Entreprise ?</h3>
          <p className="text-slate-200">
            Le plan Entreprise est sur devis : parfait pour hôtels, campings multi-services, structures multi-sites,
            ou besoins de conformité. Écrivez-nous, on vous répond rapidement.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              className="rounded-full bg-white text-slate-900 font-semibold px-4 py-2 hover:bg-slate-100 transition"
              onClick={openSalesEmail}
              type="button"
            >
              Écrire (demande Entreprise)
            </button>

            <button
              className="rounded-full bg-white/10 text-white border border-white/25 font-semibold px-4 py-2 hover:bg-white/15 transition"
              onClick={copyEmail}
              type="button"
            >
              Copier l’adresse e-mail
            </button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function buildPlans(cycle) {
  const isYearly = cycle === "YEARLY";

  return [
    {
      name: "Solo",
      planCode: "ESSENTIEL",
      subtitle: "Pour démarrer gratuitement",
      price: "0€",
      cycleLabel: "",
      features: [
        "1 service, 1 utilisateur, 100 produits",
        "Historique 14 jours",
        "Exports CSV (1/mois) + Excel (1/mois)",
        "Inventaire simple (code-barres / référence interne)",
        "Lecture/export même en dépassement",
      ],
      cta: "Démarrer gratuitement",
      note: "Vous pouvez évoluer vers un plan payant à tout moment.",
    },
    {
      name: "Duo",
      planCode: "BOUTIQUE",
      subtitle: "Idéal pour 2 zones (ex : cuisine & bar, boutique & réserve)",
      price: isYearly ? "90€" : "9€",
      cycleLabel: isYearly ? "/an" : "/mois",
      yearly: isYearly ? "Économie ≈ 2 mois" : "ou 90€ / an",
      features: [
        "2 services, 3 utilisateurs, 1 000 produits",
        "Exports CSV illimités + Excel (30/mois)",
        "IA (15 requêtes/mois) + analyses light",
        "Pertes + alertes stock",
        "Rôles par service",
        "Support prioritaire par e-mail",
      ],
      cta: "Passer au plan Duo",
      note: "Parfait si vous avez deux équipes ou deux zones.",
    },
    {
      name: "Multi",
      planCode: "PRO",
      subtitle: "Pour équipes & structures multi-services (hôtel, camping, bar + restauration)",
      price: isYearly ? "190€" : "19€",
      cycleLabel: isYearly ? "/an" : "/mois",
      yearly: isYearly ? "Économie ≈ 2 mois" : "ou 190€ / an",
      popular: true,
      features: [
        "5 services, 10 utilisateurs, produits illimités",
        "Options avancées (dates, lots, entamés…)",
        "Exports CSV + Excel illimités, partage e-mail",
        "IA pilotage (200 requêtes/mois)",
        "Alertes avancées",
      ],
      cta: "Choisir le plan Multi",
      note: "Le meilleur équilibre pour la majorité des équipes.",
    },
    {
      name: "Entreprise",
      planCode: "ENTREPRISE",
      subtitle: "Sur devis : multi-sites, conformité, déploiement accompagné",
      price: "Sur devis",
      cycleLabel: "",
      features: [
        "Hôtels / campings : multi-services & organisation par zones",
        "Conformité et besoins spécifiques",
        "Déploiement accompagné (onboarding)",
        "Intégrations (API / SSO) sur demande",
        "Support dédié",
      ],
      cta: "Demander un devis",
      note: "Le bouton ouvre un e-mail pré-rempli (pas de page contact).",
    },
  ];
}
