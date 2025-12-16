import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";

const businessOptions = [
  { value: "restaurant", label: "Restaurant / Cuisine" },
  { value: "bar", label: "Bar" },
  { value: "bakery", label: "Boulangerie / Pâtisserie" },
  { value: "grocery", label: "Épicerie / Food" },
  { value: "retail", label: "Boutique non-alimentaire" },
  { value: "pharmacy", label: "Pharmacie / Parapharmacie" },
  { value: "boutique", label: "Mode / Accessoires / Téléphonie" },
  { value: "hotel_camping", label: "Hôtel / Camping multi-services" },
  { value: "other", label: "Autre" },
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
    case "boutique":
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

  const [step, setStep] = useState(0);
  const [multiMode, setMultiMode] = useState(null); // "single" | "multi"
  const [businessType, setBusinessType] = useState("");
  const [services, setServices] = useState([]);
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMulti = multiMode === "multi";

  const mainDomain = useMemo(() => (services.some((s) => s.domain === "food") ? "food" : "general"), [services]);

  const handlePreset = (type, nextMulti = isMulti) => {
    const list = presets(type || "other", nextMulti);
    setServices(list);
  };

  const updateService = (idx, field, value) => {
    setServices((prev) => {
      const next = [...prev];
      const current = { ...next[idx], [field]: value };
      if (field === "domain") {
        current.service_type = (serviceTypeOptions[value]?.[0]?.value) || "other";
      }
      next[idx] = current;
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

  const validateStep = () => {
    if (step === 0 && !multiMode) {
      setError("Choisis un ou plusieurs services.");
      return false;
    }
    if (step === 1 && !businessType) {
      setError("Sélectionne ton métier pour adapter l’expérience.");
      return false;
    }
    if (step === 2) {
      const missing = services.some((s) => !s.service_name?.trim());
      if (missing) {
        setError("Renseigne le nom de chaque service.");
        return false;
      }
    }
    if (step === 3) {
      if (!tenantName || !email || !password) {
        setError("Complète commerce, email et mot de passe.");
        return false;
      }
      if (!accept) {
        setError("Merci d’accepter les CGU.");
        return false;
      }
    }
    setError("");
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step === 0 && businessType) {
      handlePreset(businessType, isMulti);
    }
    if (step < 3) setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    try {
      const extras = isMulti ? services.slice(1).filter((s) => s.service_name?.trim()) : [];
      const main = services[0];
      await register({
        tenant_name: tenantName,
        email,
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

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Nombre de services</h2>
            <p className="text-white/70 text-sm">
              Choisis si ton établissement gère un seul service ou plusieurs (camping, hôtel, multi-boutiques…).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant={multiMode === "single" ? "primary" : "secondary"}
                onClick={() => {
                  setMultiMode("single");
                  if (businessType) handlePreset(businessType, false);
                }}
              >
                Un seul service
              </Button>
              <Button
                type="button"
                variant={multiMode === "multi" ? "primary" : "secondary"}
                onClick={() => {
                  setMultiMode("multi");
                  if (businessType) handlePreset(businessType, true);
                }}
              >
                Plusieurs services
              </Button>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Type d’activité</h2>
            <p className="text-white/70 text-sm">Nous adaptons les champs et les recommandations à ton métier.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {businessOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setBusinessType(opt.value);
                    handlePreset(opt.value, isMulti);
                  }}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    businessType === opt.value ? "bg-white text-slate-900 border-white" : "bg-white/5 border-white/20 text-white"
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-xs opacity-80">
                    {opt.value === "pharmacy" && "Traçabilité par lot, péremption, registre sensibles."}
                    {opt.value === "bakery" && "Production quotidienne, invendus, DLC/DDM."}
                    {opt.value === "restaurant" && "Produits entamés, pesées, pertes cuisine."}
                    {opt.value === "bar" && "Bouteilles entamées, volumes, service rapide."}
                    {opt.value === "grocery" && "EAN/sku, prix achat/vente pour stats précises."}
                    {opt.value === "retail" && "SKU conseillé, pas de DLC, unités pièces."}
                    {opt.value === "hotel_camping" && "Plusieurs services : bar, cuisine, boutique…"}
                    {opt.value === "boutique" && "Mode, accessoires, téléphonie, vape…"}
                    {opt.value === "other" && "Configure librement."}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Configure tes services</h2>
            <p className="text-white/70 text-sm">
              Ajuste nom, domaine et type pour chaque service. Le service principal sera utilisé par défaut.
            </p>
            <div className="space-y-4">
              {services.map((svc, idx) => {
                const typeOpts = serviceTypeOptions[svc.domain] || serviceTypeOptions.food;
                const placeholder =
                  svc.domain === "food" ? "Ex. Épicerie, Bar, Cuisine" : "Ex. Boutique souvenirs, Téléphonie";
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
                        <span className="text-sm font-medium text-white/90">Type de service</span>
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
              {isMulti && (
                <Button type="button" variant="secondary" onClick={addService}>
                  Ajouter un service
                </Button>
              )}
            </div>
          </div>
        );
      case 3:
      default:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Compte & accès</h2>
            <p className="text-white/70 text-sm">Tes inventaires seront sauvegardés et synchronisés.</p>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button
              type="submit"
              loading={loading}
              disabled={!tenantName || !email || !password}
              className="w-full justify-center"
            >
              Créer mon espace
            </Button>
            <div className="text-sm text-white/70">
              Déjà un compte ? <Link to="/login" className="underline">Se connecter</Link>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 relative">
      <Helmet>
        <title>Créer mon compte | StockScan</title>
        <meta name="description" content="Créez un espace StockScan adapté à votre métier et vos services." />
      </Helmet>
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <Card className="w-full max-w-3xl bg-white/5 border-white/10 text-white glass">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-white/60">Inscription guidée</div>
              <h1 className="text-3xl font-black leading-tight">Créer mon espace</h1>
              <p className="text-white/70 mt-1">Parcours adaptatif selon ton métier et le nombre de services.</p>
            </div>
            <div className="text-sm text-white/70 bg-white/10 rounded-full px-3 py-1">
              Étape {step + 1} / 4
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {renderStep()}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                disabled={step === 0}
                className={step === 0 ? "pointer-events-none" : ""}
              >
                Retour
              </Button>
              {step < 3 ? (
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
