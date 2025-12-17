import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";

/**
 * 3-step premium onboarding:
 * 0) Activité + mono/multi
 * 1) Services (pré-remplis + éditables)
 * 2) Compte + CGU
 */

const businessOptions = [
  { value: "restaurant", label: "Restaurant / Cuisine", hint: "Cuisine + salle, entamés, pertes, exports." },
  { value: "bar", label: "Bar", hint: "Bouteilles entamées, volumes, inventaire rapide." },
  { value: "bakery", label: "Boulangerie / Pâtisserie", hint: "Production, invendus, matières, pertes." },
  { value: "grocery", label: "Épicerie / Food", hint: "EAN/SKU, prix achat/vente, stats." },
  { value: "retail", label: "Boutique non-alimentaire", hint: "SKU conseillé, variantes, pas de DLC." },
  { value: "pharmacy", label: "Pharmacie / Parapharmacie", hint: "Lots/péremption, traçabilité renforcée." },
  { value: "hotel_camping", label: "Hôtel / Camping multi-services", hint: "Bar + épicerie + resto + boutique." },
  { value: "other", label: "Autre", hint: "Configuration libre." },
];

const serviceTypeOptions = {
  food: [
    { value: "kitchen", label: "Cuisine / Production" },
    { value: "bar", label: "Bar" },
    { value: "grocery_food", label: "Épicerie / Alimentaire" },
    { value: "bulk_food", label: "Vrac" },
  ],
  general: [
    { value: "retail_general", label: "Boutique / Retail" },
    { value: "pharmacy_parapharmacy", label: "Pharmacie / Parapharmacie" },
    { value: "other", label: "Autre" },
  ],
};

const domainOptions = [
  { value: "food", label: "Alimentaire" },
  { value: "general", label: "Non-alimentaire" },
];

const presets = (type, isMulti) => {
  switch (type) {
    case "restaurant":
      return isMulti
        ? [
            { id: "svc-1", domain: "food", service_type: "kitchen", service_name: "Cuisine" },
            { id: "svc-2", domain: "food", service_type: "bar", service_name: "Salle / Bar" },
          ]
        : [{ id: "svc-1", domain: "food", service_type: "kitchen", service_name: "Cuisine" }];

    case "bar":
      return isMulti
        ? [
            { id: "svc-1", domain: "food", service_type: "bar", service_name: "Bar" },
            { id: "svc-2", domain: "food", service_type: "kitchen", service_name: "Cuisine / Snacking" },
          ]
        : [{ id: "svc-1", domain: "food", service_type: "bar", service_name: "Bar" }];

    case "bakery":
      return isMulti
        ? [
            { id: "svc-1", domain: "food", service_type: "kitchen", service_name: "Production" },
            { id: "svc-2", domain: "general", service_type: "retail_general", service_name: "Boutique" },
          ]
        : [{ id: "svc-1", domain: "food", service_type: "kitchen", service_name: "Production" }];

    case "grocery":
      return isMulti
        ? [
            { id: "svc-1", domain: "food", service_type: "grocery_food", service_name: "Épicerie" },
            { id: "svc-2", domain: "food", service_type: "bulk_food", service_name: "Vrac" },
          ]
        : [{ id: "svc-1", domain: "food", service_type: "grocery_food", service_name: "Épicerie" }];

    case "retail":
      return [{ id: "svc-1", domain: "general", service_type: "retail_general", service_name: "Boutique" }];

    case "pharmacy":
      return [{ id: "svc-1", domain: "general", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie" }];

    case "hotel_camping":
      return isMulti
        ? [
            { id: "svc-1", domain: "food", service_type: "grocery_food", service_name: "Épicerie" },
            { id: "svc-2", domain: "food", service_type: "bar", service_name: "Bar" },
            { id: "svc-3", domain: "food", service_type: "kitchen", service_name: "Restauration" },
            { id: "svc-4", domain: "general", service_type: "retail_general", service_name: "Boutique" },
          ]
        : [{ id: "svc-1", domain: "food", service_type: "grocery_food", service_name: "Épicerie" }];

    default:
      return [{ id: "svc-1", domain: "general", service_type: "other", service_name: "Principal" }];
  }
};

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  // 0..2
  const [step, setStep] = useState(0);

  // Step 0: activity + mode
  const [businessType, setBusinessType] = useState("");
  const [multiMode, setMultiMode] = useState("single"); // single | multi

  // Step 1: services
  const [services, setServices] = useState([]);

  // Step 2: account
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [accept, setAccept] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMulti = multiMode === "multi";

  const mainDomain = useMemo(
    () => (services?.some((s) => s.domain === "food") ? "food" : "general"),
    [services]
  );

  const chosenBusiness = useMemo(
    () => businessOptions.find((b) => b.value === businessType),
    [businessType]
  );

  const applyPreset = (type, mode) => {
    const list = presets(type || "other", mode === "multi");
    setServices(list);
  };

  const updateService = (idx, field, value) => {
    setServices((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], [field]: value };
      if (field === "domain") {
        cur.service_type = serviceTypeOptions[value]?.[0]?.value || "other";
      }
      next[idx] = cur;
      return next;
    });
  };

  const addService = () => {
    const nextId = `svc-${services.length + 1}`;
    setServices((prev) => [
      ...prev,
      { id: nextId, domain: "food", service_type: "grocery_food", service_name: "" },
    ]);
  };

  const removeService = (idx) => {
    if (idx === 0) return;
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateStep = (s = step) => {
    if (s === 0) {
      if (!businessType) return "Choisis ton activité pour préconfigurer l’expérience.";
      return "";
    }

    if (s === 1) {
      if (!services?.length) return "On n’a pas pu préparer tes services. Reviens à l’étape précédente.";
      const missingName = services.some((svc) => !svc.service_name?.trim());
      if (missingName) return "Renseigne le nom de chaque service.";
      return "";
    }

    if (s === 2) {
      if (!tenantName?.trim() || !email?.trim() || !password) return "Complète commerce, email et mot de passe.";
      if (password.length < 8) return "Mot de passe : minimum 8 caractères.";
      if (password !== password2) return "Les mots de passe ne correspondent pas.";
      if (!accept) return "Merci d’accepter les CGU.";
      return "";
    }

    return "";
  };

  const next = () => {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");

    if (step === 0) {
      // on prépare les services automatiquement avant d’arriver à l’étape 1
      applyPreset(businessType, multiMode);
    }

    if (step < 2) setStep((v) => v + 1);
  };

  const back = () => setStep((v) => Math.max(0, v - 1));

  const submit = async (e) => {
    e.preventDefault();
    const msg = validateStep(2);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const main = services[0];
      const extras = isMulti ? services.slice(1).filter((s) => s.service_name?.trim()) : [];

      await register({
        tenant_name: tenantName.trim(),
        email: email.trim(),
        password,
        domain: mainDomain,
        business_type: businessType || "other",
        service_type: main?.service_type,
        service_name: main?.service_name,
        extra_services: extras.map((s) => ({
          name: s.service_name,
          service_type: s.service_type,
          domain: s.domain,
        })),
      });

      nav("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Création impossible. Vérifie les champs.");
    } finally {
      setLoading(false);
    }
  };

  const StepHeader = () => (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-white/60">Inscription</div>
        <h1 className="text-3xl font-black leading-tight">Créer mon espace</h1>
        <p className="text-white/70 mt-1">
          Parcours rapide, configuré selon ton métier.
        </p>
      </div>
      <div className="text-sm text-white/70 bg-white/10 rounded-full px-3 py-1">
        Étape {step + 1} / 3
      </div>
    </div>
  );

  const SummaryBar = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
      <div className="text-sm text-white/80">
        <span className="text-white/60">Activité :</span>{" "}
        <span className="font-semibold">{chosenBusiness?.label || "—"}</span>
        <span className="text-white/30"> · </span>
        <span className="text-white/60">Mode :</span>{" "}
        <span className="font-semibold">{isMulti ? "Multi-services" : "Un seul service"}</span>
        <span className="text-white/30"> · </span>
        <span className="text-white/60">Services :</span>{" "}
        <span className="font-semibold">{services?.length || 0}</span>
      </div>

      {step >= 1 ? (
        <div className="text-xs text-white/60">
          Service principal : <span className="text-white/80 font-semibold">{services?.[0]?.service_name || "—"}</span>
        </div>
      ) : null}
    </div>
  );

  const renderStep0 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Votre activité</h2>
        <p className="text-white/70 text-sm">
          On préconfigure les champs (DLC, prix, entamés, lots…) selon ton métier.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {businessOptions.map((opt) => {
          const active = businessType === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBusinessType(opt.value)}
              className={[
                "rounded-2xl border px-4 py-3 text-left transition",
                active ? "bg-white text-slate-900 border-white" : "bg-white/5 border-white/20 text-white hover:bg-white/10",
              ].join(" ")}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className={`text-xs mt-1 ${active ? "text-slate-600" : "text-white/70"}`}>{opt.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 space-y-2">
        <h3 className="text-lg font-bold">Organisation</h3>
        <p className="text-white/70 text-sm">
          Un service = une zone d’inventaire (ex : Salle, Cuisine, Bar, Boutique…).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMultiMode("single")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition",
              multiMode === "single"
                ? "bg-white text-slate-900 border-white"
                : "bg-white/5 border-white/20 text-white hover:bg-white/10",
            ].join(" ")}
          >
            <div className="font-semibold">Un seul service</div>
            <div className={`text-xs mt-1 ${multiMode === "single" ? "text-slate-600" : "text-white/70"}`}>
              Idéal si tu as une seule zone (ex : boutique seule, bar seul).
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMultiMode("multi")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition",
              multiMode === "multi"
                ? "bg-white text-slate-900 border-white"
                : "bg-white/5 border-white/20 text-white hover:bg-white/10",
            ].join(" ")}
          >
            <div className="font-semibold">Multi-services</div>
            <div className={`text-xs mt-1 ${multiMode === "multi" ? "text-slate-600" : "text-white/70"}`}>
              Camping/hôtel : Bar + Cuisine + Épicerie + Boutique, chacun son inventaire.
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Vos services</h2>
        <p className="text-white/70 text-sm">
          Le service principal est utilisé par défaut. Tu peux renommer et ajuster le type.
        </p>
      </div>

      <div className="space-y-4">
        {services.map((svc, idx) => {
          const typeOpts = serviceTypeOptions[svc.domain] || serviceTypeOptions.food;
          const placeholder = svc.domain === "food" ? "Ex. Cuisine, Bar, Épicerie" : "Ex. Boutique, Téléphonie";

          return (
            <div key={svc.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/80">
                  {idx === 0 ? "Service principal" : `Service ${idx + 1}`}
                </div>
                {idx > 0 && (
                  <button
                    type="button"
                    className="text-xs text-white/60 hover:text-white underline"
                    onClick={() => removeService(idx)}
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="text-sm font-medium text-white/90">Domaine</span>
                  <select
                    className="w-full rounded-2xl border border-white/20 bg-white/10 text-white px-3 py-2.5"
                    value={svc.domain}
                    onChange={(e) => updateService(idx, "domain", e.target.value)}
                  >
                    {domainOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-sm font-medium text-white/90">Type</span>
                  <select
                    className="w-full rounded-2xl border border-white/20 bg-white/10 text-white px-3 py-2.5"
                    value={svc.service_type}
                    onChange={(e) => updateService(idx, "service_type", e.target.value)}
                  >
                    {typeOpts.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Input
                label="Nom du service"
                placeholder={placeholder}
                value={svc.service_name}
                onChange={(e) => updateService(idx, "service_name", e.target.value)}
                required
              />
            </div>
          );
        })}

        {isMulti ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addService}>
              Ajouter un service
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => applyPreset(businessType, multiMode)}
            >
              Recharger preset
            </Button>
          </div>
        ) : (
          <div className="flex">
            <Button type="button" variant="ghost" onClick={() => applyPreset(businessType, multiMode)}>
              Recharger preset
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Compte & accès</h2>
        <p className="text-white/70 text-sm">Ton espace est sauvegardé et synchronisé. Tu pourras inviter des membres ensuite.</p>
      </div>

      <Input
        label={isMulti ? "Nom de l’établissement" : "Nom du commerce"}
        placeholder={isMulti ? "Ex. Camping de la Plage" : "Ex. Boutique Avenue"}
        value={tenantName}
        onChange={(e) => setTenantName(e.target.value)}
        required
      />

      <Input
        label="Email"
        type="email"
        placeholder="vous@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Mot de passe"
        type="password"
        placeholder="Minimum 8 caractères"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        helper="Astuce : 1 majuscule + 1 chiffre = plus sûr."
      />

      <Input
        label="Confirmer le mot de passe"
        type="password"
        placeholder="Retape le mot de passe"
        value={password2}
        onChange={(e) => setPassword2(e.target.value)}
        required
      />

      <label className="flex items-start gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          className="mt-1 accent-blue-500"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
        />
        <span>
          J’ai lu et j’accepte les <Link to="/terms" className="underline">CGU</Link>.
        </span>
      </label>

      <Button type="submit" loading={loading} className="w-full justify-center">
        Créer mon espace
      </Button>

      <div className="text-sm text-white/70">
        Déjà un compte ? <Link to="/login" className="underline">Se connecter</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      <Helmet>
        <title>Créer mon compte | StockScan</title>
        <meta name="description" content="Créez un espace StockScan adapté à votre métier et vos services." />
      </Helmet>

      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-blue-600 blur-[120px] opacity-40" />
      <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-400 blur-[120px] opacity-30" />

      <Card className="w-full max-w-3xl bg-white/5 border-white/10 text-white glass">
        <div className="p-6 space-y-6">
          <StepHeader />

          {/* Summary */}
          <SummaryBar />

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {step === 0 ? renderStep0() : step === 1 ? renderStep1() : renderStep2()}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={back} disabled={step === 0}>
                Retour
              </Button>

              {step < 2 ? (
                <Button type="button" onClick={next} variant="primary">
                  Continuer
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}