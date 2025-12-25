// frontend/src/pages/Register.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { FAMILLES, MODULES, DEFAULT_MODULES } from "../lib/famillesConfig";
import { api } from "../lib/api";
import { formatApiError } from "../lib/errorUtils";

// ✅ Liste unique, utilisée dans Register + Settings (labels simples)
const SERVICE_TYPE_OPTIONS = [
  { value: "grocery_food", label: "Épicerie alimentaire" },
  { value: "bulk_food", label: "Vrac" },
  { value: "bar", label: "Bar" },
  { value: "kitchen", label: "Cuisine / Restaurant" },
  { value: "bakery", label: "Boulangerie / Pâtisserie" },
  { value: "restaurant_dining", label: "Salle / Restaurant" },
  { value: "retail_general", label: "Boutique non-alimentaire" },
  { value: "pharmacy_parapharmacy", label: "Pharmacie / Parapharmacie" },
  { value: "other", label: "Autre" },
];

// ✅ Petit helper: reconnait le “métier” d’un service_type
function resolveFamilyFromServiceType(serviceType, tenantDomain = "food") {
  const st = String(serviceType || "other");

  // Food
  if (["kitchen", "restaurant_dining", "bar", "grocery_food", "bulk_food", "bakery"].includes(st)) {
    if (st === "kitchen" || st === "restaurant_dining") return "restauration";
    if (st === "bakery") return "boulangerie";
    if (st === "bar") return "bar";
    if (st === "grocery_food" || st === "bulk_food") return "retail";
    return "restauration";
  }

  // General
  if (st === "retail_general") return "mode";
  if (st === "pharmacy_parapharmacy") return "pharmacie";

  // fallback
  return tenantDomain === "general" ? "mode" : "retail";
}

const servicePresets = (family, isMulti, linkedMode = "separate") => {
  const primary =
    {
      retail: { service_type: "grocery_food", service_name: "Épicerie" },
      mode: { service_type: "retail_general", service_name: "Boutique" },
      bar: { service_type: "bar", service_name: "Bar" },
      restauration: { service_type: "kitchen", service_name: "Restaurant" },
      boulangerie: { service_type: "bakery", service_name: "Boulangerie" },
      pharmacie: { service_type: "pharmacy_parapharmacy", service_name: "Pharmacie" },
      camping_multi: { service_type: "grocery_food", service_name: "Épicerie" },
    }[family] || { service_type: "other", service_name: "Service principal" };

  if (!isMulti) return [{ id: "svc-1", ...primary }];

  if (family === "restauration") {
    if (linkedMode === "merge")
      return [{ id: "svc-1", service_type: "kitchen", service_name: "Restaurant & Cuisine" }];
    return [
      { id: "svc-1", service_type: "kitchen", service_name: "Cuisine" },
      { id: "svc-2", service_type: "restaurant_dining", service_name: "Salle" },
    ];
  }

  if (family === "boulangerie") {
    if (linkedMode === "merge")
      return [{ id: "svc-1", service_type: "bakery", service_name: "Boulangerie & Pâtisserie" }];
    return [
      { id: "svc-1", service_type: "bakery", service_name: "Boulangerie" },
      { id: "svc-2", service_type: "bakery", service_name: "Pâtisserie" },
    ];
  }

  if (family === "pharmacie") {
    if (linkedMode === "merge") {
      return [
        { id: "svc-1", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie & Parapharmacie" },
      ];
    }
    return [
      { id: "svc-1", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie" },
      { id: "svc-2", service_type: "pharmacy_parapharmacy", service_name: "Parapharmacie" },
    ];
  }

  if (family === "camping_multi") {
    return [
      { id: "svc-1", service_type: "grocery_food", service_name: "Épicerie" },
      { id: "svc-2", service_type: "bar", service_name: "Bar" },
      { id: "svc-3", service_type: "kitchen", service_name: "Restauration" },
    ];
  }

  return [
    { id: "svc-1", ...primary },
    { id: "svc-2", service_type: primary.service_type, service_name: "Secondaire" },
  ];
};

const ModuleToggle = ({ moduleId, name, description, active, onToggle }) => (
  <div className="border border-slate-800 rounded-2xl p-3 flex items-start gap-3 bg-slate-900">
    <button
      type="button"
      className={`w-10 h-10 rounded-full border ${
        active ? "bg-blue-500 border-blue-400" : "border-white/20"
      } flex items-center justify-center text-white`}
      onClick={() => onToggle(moduleId)}
      aria-pressed={active}
    >
      {active ? "✓" : "+"}
    </button>
    <div>
      <div className="font-semibold text-white">{name}</div>
      <div className="text-sm text-slate-400">{description}</div>
    </div>
  </div>
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({ storeName: "", email: "", password: "", passwordConfirm: "" });
  const [familyId, setFamilyId] = useState(FAMILLES[0].id);
  const [isGroundedMulti, setIsGroundedMulti] = useState(false);
  const [linkedMode, setLinkedMode] = useState("separate");
  const [stepIndex, setStepIndex] = useState(0);

  const [modules, setModules] = useState(DEFAULT_MODULES[FAMILLES[0].id] || []);
  const [serviceList, setServiceList] = useState(() => servicePresets(FAMILLES[0].id, false));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const familyMeta = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const linkedFamilies = useMemo(() => new Set(["restauration", "boulangerie", "pharmacie"]), []);

  const moduleListForFamily = useMemo(
    () => MODULES.filter((module) => module.families.includes(familyId)),
    [familyId]
  );

  const flowSteps = useMemo(() => {
    const steps = ["mode", "family"];
    if (isGroundedMulti && linkedFamilies.has(familyId)) steps.push("combo");
    if (isGroundedMulti) steps.push("services");
    steps.push("account");
    return steps;
  }, [familyId, isGroundedMulti, linkedFamilies]);

  const currentStep = flowSteps[stepIndex];

  useEffect(() => {
    if (stepIndex > flowSteps.length - 1) setStepIndex(flowSteps.length - 1);
  }, [flowSteps, stepIndex]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(""), 7000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const handleFamilyChange = (id) => {
    setFamilyId(id);
    setModules(DEFAULT_MODULES[id] || []);
    setServiceList(servicePresets(id, isGroundedMulti, linkedMode));
  };

  const handleToggleModule = (id) => {
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const handleServiceNameChange = (idx, value) => {
    setServiceList((prev) => prev.map((svc, i) => (i === idx ? { ...svc, service_name: value } : svc)));
  };

  const handleServiceTypeChange = (idx, value) => {
    setServiceList((prev) => prev.map((svc, i) => (i === idx ? { ...svc, service_type: value } : svc)));
  };

  const nextStep = () => setStepIndex((prev) => Math.min(prev + 1, flowSteps.length - 1));
  const prevStep = () => setStepIndex((prev) => Math.max(prev - 1, 0));

  const updateForm = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (error) setError("");
  };

  const canGoNext =
    currentStep === "mode" ||
    currentStep === "family" ||
    currentStep === "combo" ||
    currentStep === "services" ||
    currentStep === "account";

  // ✅ Applique les modules “global” mais la reco “identifiants” selon le type de chaque service
  const applyModuleDefaults = async () => {
    if (!modules?.length) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await api.get("/api/auth/services/");
        const services = Array.isArray(res?.data) ? res.data : [];
        if (!services.length) return;

        const moduleSet = new Set(modules);
        const identifierEnabled = moduleSet.has("identifier");
        const pricingEnabled = moduleSet.has("pricing");

        await Promise.all(
          services.map(async (svc) => {
            const nextFeatures = { ...(svc.features || {}) };

            const familyForSvcId = resolveFamilyFromServiceType(svc.service_type, "food");
            const familyForSvc = FAMILLES.find((f) => f.id === familyForSvcId) ?? familyMeta;
            const identifiers = familyForSvc?.identifiers || {};

            nextFeatures.barcode = {
              ...(nextFeatures.barcode || {}),
              enabled: identifierEnabled ? Boolean(identifiers.barcode) : false,
            };
            nextFeatures.sku = {
              ...(nextFeatures.sku || {}),
              enabled: identifierEnabled ? Boolean(identifiers.sku) : false,
            };
            nextFeatures.dlc = { ...(nextFeatures.dlc || {}), enabled: moduleSet.has("expiry") };
            nextFeatures.lot = { ...(nextFeatures.lot || {}), enabled: moduleSet.has("lot") };
            nextFeatures.variants = { ...(nextFeatures.variants || {}), enabled: moduleSet.has("variants") };
            nextFeatures.multi_unit = { ...(nextFeatures.multi_unit || {}), enabled: moduleSet.has("multiUnit") };
            nextFeatures.open_container_tracking = {
              ...(nextFeatures.open_container_tracking || {}),
              enabled: moduleSet.has("opened"),
            };
            nextFeatures.item_type = { ...(nextFeatures.item_type || {}), enabled: moduleSet.has("itemType") };
            nextFeatures.prices = {
              ...(nextFeatures.prices || {}),
              purchase_enabled: pricingEnabled,
              selling_enabled: pricingEnabled,
            };
            nextFeatures.tva = { ...(nextFeatures.tva || {}), enabled: pricingEnabled };

            await api.patch(`/api/auth/services/${svc.id}/`, { features: nextFeatures });
          })
        );

        return;
      } catch (e) {
        await sleep(250);
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.storeName || !form.email || !form.password) {
      setError("Il manque un champ.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const [primaryService, ...extraServices] = serviceList;

      const businessTypeByFamily = {
        retail: "grocery",
        mode: "retail",
        bar: "bar",
        restauration: "restaurant",
        boulangerie: "grocery",
        pharmacie: "pharmacy",
        camping_multi: "camping_multi",
      };

      const domainByFamily = {
        retail: "food",
        bar: "food",
        restauration: "food",
        boulangerie: "food",
        mode: "general",
        pharmacie: "general",
        camping_multi: "food",
      };

      const data = await register({
        password: form.password,
        email: form.email,
        tenant_name: form.storeName,
        domain: domainByFamily[familyId] || "food",
        business_type: businessTypeByFamily[familyId] || "other",
        service_type: primaryService?.service_type || "other",
        service_name: primaryService?.service_name || "Principal",
        extra_services: extraServices.map((svc) => ({
          service_type: svc.service_type || "other",
          name: svc.service_name || "Secondaire",
        })),
      });

      // ✅ IMPORTANT: si verification email requise => pas de token => on part sur CheckEmail
      if (data?.requires_verification) {
        nav("/check-email", { state: { email: form.email } });
        return;
      }

      await applyModuleDefaults();
      nav("/app/dashboard");
    } catch (err) {
      setError(formatApiError(err, { context: "register" }));
    } finally {
      setLoading(false);
    }
  };

  const comboSummary =
    {
      restauration: "Restaurant + Cuisine",
      boulangerie: "Boulangerie + Pâtisserie",
      pharmacie: "Pharmacie + Parapharmacie",
    }[familyId] || "";

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-10 px-4">
      <Helmet>
        <title>Créer mon espace | StockScan</title>
        <meta
          name="description"
          content="Créez votre espace StockScan en quelques minutes : famille métier, services, modules et accès."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <h1 className="text-3xl font-black mb-2 text-center">Créer mon espace</h1>
      <p className="text-center text-slate-400 max-w-xl">
        Choisis ta famille métier, active les modules qui te parlent, et garde un onboarding pensé pour ton quotidien.
      </p>

      <div className="w-full max-w-4xl mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card className="bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-widest text-slate-500">
              Étape {stepIndex + 1}/{flowSteps.length}
            </span>
            <Button variant="secondary" size="sm" onClick={prevStep} disabled={stepIndex === 0}>
              Précédent
            </Button>
          </div>

          {currentStep === "mode" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Un service ou plusieurs ?</h2>
                <p className="text-sm text-slate-400">
                  Choisis si tu veux suivre un seul inventaire ou séparer plusieurs espaces.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsGroundedMulti(false);
                    setServiceList(servicePresets(familyId, false, linkedMode));
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    !isGroundedMulti
                      ? "border-blue-500 bg-slate-900 shadow-[0_0_30px_rgba(15,118,255,0.25)]"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="font-semibold">Un seul service</div>
                  <div className="text-sm text-slate-400">Simple, rapide, parfait pour une équipe compacte.</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsGroundedMulti(true);
                    setServiceList(servicePresets(familyId, true, linkedMode));
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isGroundedMulti
                      ? "border-blue-500 bg-slate-900 shadow-[0_0_30px_rgba(15,118,255,0.25)]"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="font-semibold">Multi-services</div>
                  <div className="text-sm text-slate-400">
                    Cuisine + Salle, rayons, équipes… tout reste clair.
                    <span className="block mt-1 text-xs text-slate-500">
                      Idéal aussi pour camping / hôtel multi-services (épicerie + bar + restauration).
                    </span>
                  </div>
                </button>
              </div>
            </section>
          )}

          {currentStep === "family" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Famille métier</h2>
                <p className="text-sm text-slate-400">{familyMeta.copy?.subline}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {FAMILLES.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => handleFamilyChange(family.id)}
                    className={`border rounded-2xl p-4 text-left transition ${
                      family.id === familyId
                        ? "border-blue-500 bg-slate-900 shadow-[0_0_30px_rgba(15,118,255,0.25)]"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="font-semibold text-white">{family.name}</div>
                    <div className="text-sm text-slate-400">{family.copy?.headline}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {currentStep === "combo" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Combinaisons intelligentes</h2>
                <p className="text-sm text-slate-400">
                  On te propose une organisation adaptée à {familyMeta.name.toLowerCase()}.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-sm text-slate-400">Combo conseillé</div>
                <div className="text-lg font-semibold text-white">{comboSummary}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Tu pourras choisir regrouper ou séparer à l’étape suivante.
                </div>
              </div>
            </section>
          )}

          {currentStep === "services" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Organisation des services</h2>
                <p className="text-sm text-slate-400">
                  Donne un nom à chaque service et choisis son type : ça personnalise l’interface (champs, modules, exports).
                </p>
              </div>

              {linkedFamilies.has(familyId) && isGroundedMulti && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300">Regrouper ou séparer ?</label>
                  <select
                    value={linkedMode}
                    onChange={(event) => {
                      setLinkedMode(event.target.value);
                      setServiceList(servicePresets(familyId, true, event.target.value));
                    }}
                    className="rounded-full bg-slate-900 border border-white/10 px-3 py-1 text-sm"
                  >
                    <option value="separate">Séparer (ex : Cuisine vs Salle)</option>
                    <option value="merge">Regrouper (ex : Restaurant & Cuisine)</option>
                  </select>
                </div>
              )}

              <div className="space-y-3">
                {serviceList.map((service, index) => (
                  <div key={service.id} className="grid md:grid-cols-2 gap-3">
                    <Input
                      label={`Nom du service ${index + 1}`}
                      value={service.service_name}
                      placeholder={`Service ${index + 1}`}
                      onChange={(event) => handleServiceNameChange(index, event.target.value)}
                    />

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-200">Type de service</span>
                      <select
                        value={service.service_type || "other"}
                        onChange={(event) => handleServiceTypeChange(index, event.target.value)}
                        className="w-full rounded-2xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white"
                      >
                        {SERVICE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-500">
                        Ce choix active les bons champs (scan, DLC, TVA, lots, etc.).
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              {isGroundedMulti && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setServiceList((prev) => [
                      ...prev,
                      { id: `svc-${Date.now()}`, service_type: "other", service_name: "Nouveau service" },
                    ])
                  }
                >
                  Ajouter un service
                </Button>
              )}
            </section>
          )}

          {currentStep === "account" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Compte & accès</h2>
                <p className="text-sm text-slate-400">Crée ton espace et commence tout de suite.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                <Input
                  label="Nom du commerce"
                  placeholder="Ex : Boulangerie du Centre"
                  value={form.storeName}
                  onChange={updateForm("storeName")}
                />
                <Input
                  label="Email professionnel"
                  placeholder="contact@commerce.fr"
                  type="email"
                  value={form.email}
                  onChange={updateForm("email")}
                />
                <Input label="Mot de passe" type="password" value={form.password} onChange={updateForm("password")} />
                <Input
                  label="Confirme le mot de passe"
                  type="password"
                  value={form.passwordConfirm}
                  onChange={updateForm("passwordConfirm")}
                />

                {error && (
                  <div
                    className="rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-sm text-red-100"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" loading={loading} disabled={loading}>
                  Créer mon espace personnalisé
                </Button>
              </form>
            </section>
          )}

          <div className="flex items-center justify-between mt-3">
            <Button variant="secondary" onClick={nextStep} disabled={!canGoNext || stepIndex === flowSteps.length - 1}>
              {stepIndex === flowSteps.length - 1 ? "Réviser" : "Étape suivante"}
            </Button>

            {stepIndex > 0 ? (
              <Button variant="ghost" size="sm" onClick={prevStep}>
                ← Revenir
              </Button>
            ) : (
              <span />
            )}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-white/10 p-6 space-y-5">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Configuration métier</span>
            <h2 className="text-2xl font-black mt-1">{familyMeta.name}</h2>
            <p className="text-slate-300">{familyMeta.copy?.headline}</p>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-slate-400">Modules recommandés</div>
            {moduleListForFamily.map((module) => (
              <ModuleToggle
                key={module.id}
                moduleId={module.id}
                name={module.name}
                description={module.description}
                active={modules.includes(module.id)}
                onToggle={handleToggleModule}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
            <div className="font-semibold">Identifiants recommandés</div>
            <div className="text-slate-400">
              {familyMeta.identifiers?.barcode ? "Code-barres activé" : "Code-barres désactivé"} ·{" "}
              {familyMeta.identifiers?.sku ? "SKU activé" : "SKU désactivé"}
            </div>
            <div className="text-xs text-slate-500">Modifiable ensuite dans Settings → Modules.</div>
          </div>

          <Link to="/login" className="text-sm text-blue-400">
            Déjà un compte ? Connecte-toi →
          </Link>
        </Card>
      </div>
    </div>
  );
}