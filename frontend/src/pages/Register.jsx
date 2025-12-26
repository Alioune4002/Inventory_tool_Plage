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

function resolveFamilyFromServiceType(serviceType, tenantDomain = "food") {
  const st = String(serviceType || "other");

  if (["kitchen", "restaurant_dining", "bar", "grocery_food", "bulk_food", "bakery"].includes(st)) {
    if (st === "kitchen" || st === "restaurant_dining") return "restauration";
    if (st === "bakery") return "boulangerie";
    if (st === "bar") return "bar";
    if (st === "grocery_food" || st === "bulk_food") return "retail";
    return "restauration";
  }

  if (st === "retail_general") return "mode";
  if (st === "pharmacy_parapharmacy") return "pharmacie";

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
    if (linkedMode === "merge") return [{ id: "svc-1", service_type: "kitchen", service_name: "Restaurant & Cuisine" }];
    return [
      { id: "svc-1", service_type: "kitchen", service_name: "Cuisine" },
      { id: "svc-2", service_type: "restaurant_dining", service_name: "Salle" },
    ];
  }

  if (family === "boulangerie") {
    if (linkedMode === "merge") return [{ id: "svc-1", service_type: "bakery", service_name: "Boulangerie & Pâtisserie" }];
    return [
      { id: "svc-1", service_type: "bakery", service_name: "Boulangerie" },
      { id: "svc-2", service_type: "bakery", service_name: "Pâtisserie" },
    ];
  }

  if (family === "pharmacie") {
    if (linkedMode === "merge")
      return [{ id: "svc-1", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie & Parapharmacie" }];
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
  <div className="border border-[var(--border)] rounded-2xl p-3 flex items-start gap-3 bg-[var(--surface)]">
    <button
      type="button"
      className={[
        "w-10 h-10 rounded-full border flex items-center justify-center font-black transition",
        active ? "bg-blue-500 border-blue-400 text-white" : "border-[var(--border)] bg-white/5 hover:bg-white/10 text-[var(--text)]",
      ].join(" ")}
      onClick={() => onToggle(moduleId)}
      aria-pressed={active}
      title={active ? "Désactiver" : "Activer"}
    >
      {active ? "✓" : "+"}
    </button>
    <div>
      <div className="font-semibold text-[var(--text)]">{name}</div>
      <div className="text-sm text-[var(--muted)]">{description}</div>
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

  // ✅ Forcer dark sur Register (volontairement)
  useEffect(() => {
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      if (prevTheme) document.documentElement.setAttribute("data-theme", prevTheme);
      else document.documentElement.removeAttribute("data-theme");
    };
  }, []);

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
      } catch {
        await sleep(250);
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.storeName || !form.email || !form.password) {
      setError("Merci de compléter tous les champs.");
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
    <div className="min-h-screen py-10 px-2 sm:px-4 relative overflow-hidden">
      <Helmet>
        <title>Créer mon espace | StockScan</title>
        <meta name="description" content="Créez votre espace StockScan en quelques minutes." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* background premium (dark) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--bg)" }} />
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full blur-[140px] opacity-20 bg-blue-500 pointer-events-none" />
      <div className="absolute -bottom-28 right-0 h-80 w-80 rounded-full blur-[140px] opacity-15 bg-emerald-400 pointer-events-none" />

      <div className="relative flex flex-col items-center">
        <h1 className="text-3xl font-black mb-2 text-center text-[var(--text)]">Créer mon espace</h1>
        <p className="text-center text-[var(--muted)] max-w-xl">
          Choisis ton activité, organise tes services, active les modules utiles — puis commence ton inventaire.
        </p>

        {/* ✅ plus large qu’avant (et meilleur rendu mobile) */}
        <div className="w-full max-w-6xl mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-widest text-[var(--muted)]">
                Étape {stepIndex + 1}/{flowSteps.length}
              </span>
              <Button variant="secondary" size="sm" onClick={prevStep} disabled={stepIndex === 0}>
                Précédent
              </Button>
            </div>

            {currentStep === "mode" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Un service ou plusieurs ?</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Tu peux rester simple… ou séparer tes espaces (cuisine/salle, rayons, etc.).
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGroundedMulti(false);
                      setServiceList(servicePresets(familyId, false, linkedMode));
                    }}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      !isGroundedMulti
                        ? "border-blue-500 bg-[var(--surface)] shadow-[0_0_30px_rgba(37,99,235,0.18)]"
                        : "border-[var(--border)] hover:border-blue-500/50",
                    ].join(" ")}
                  >
                    <div className="font-semibold text-[var(--text)]">Un seul service</div>
                    <div className="text-sm text-[var(--muted)]">Simple, rapide, idéal pour une petite équipe.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsGroundedMulti(true);
                      setServiceList(servicePresets(familyId, true, linkedMode));
                    }}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      isGroundedMulti
                        ? "border-blue-500 bg-[var(--surface)] shadow-[0_0_30px_rgba(37,99,235,0.18)]"
                        : "border-[var(--border)] hover:border-blue-500/50",
                    ].join(" ")}
                  >
                    <div className="font-semibold text-[var(--text)]">Multi-services</div>
                    <div className="text-sm text-[var(--muted)]">
                      Cuisine + Salle, rayons, équipes… tout reste clair.
                      <span className="block mt-1 text-xs text-[var(--muted)] opacity-80">
                        Parfait aussi pour camping / hôtel multi-services.
                      </span>
                    </div>
                  </button>
                </div>
              </section>
            )}

            {currentStep === "family" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Famille métier</h2>
                  <p className="text-sm text-[var(--muted)]">{familyMeta.copy?.subline}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {FAMILLES.map((family) => (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => handleFamilyChange(family.id)}
                      className={[
                        "border rounded-2xl p-4 text-left transition",
                        family.id === familyId
                          ? "border-blue-500 bg-[var(--surface)] shadow-[0_0_30px_rgba(37,99,235,0.18)]"
                          : "border-[var(--border)] hover:border-blue-500/50",
                      ].join(" ")}
                    >
                      <div className="font-semibold text-[var(--text)]">{family.name}</div>
                      <div className="text-sm text-[var(--muted)]">{family.copy?.headline}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {currentStep === "combo" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Organisation recommandée</h2>
                  <p className="text-sm text-[var(--muted)]">
                    On te propose une organisation adaptée à {familyMeta.name.toLowerCase()}.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-white/5 p-4">
                  <div className="text-sm text-[var(--muted)]">Suggestion</div>
                  <div className="text-lg font-semibold text-[var(--text)]">{comboSummary}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">Tu pourras regrouper ou séparer à l’étape suivante.</div>
                </div>
              </section>
            )}

            {currentStep === "services" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Services</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Donne un nom à chaque service et choisis son type : ça personnalise les champs, les règles et les exports.
                  </p>
                </div>

                {linkedFamilies.has(familyId) && isGroundedMulti && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm text-[var(--text)]">Regrouper ou séparer ?</label>
                    <select
                      value={linkedMode}
                      onChange={(event) => {
                        setLinkedMode(event.target.value);
                        setServiceList(servicePresets(familyId, true, event.target.value));
                      }}
                      className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
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
                        <span className="text-sm font-medium text-[var(--text)]">Type de service</span>
                        <select
                          value={service.service_type || "other"}
                          onChange={(event) => handleServiceTypeChange(index, event.target.value)}
                          className="w-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text)] font-semibold"
                        >
                          {SERVICE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-[var(--muted)]">Ce choix active les bons champs (scan, DLC, TVA, lots…).</span>
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
                  <h2 className="text-xl font-semibold text-[var(--text)]">Compte & accès</h2>
                  <p className="text-sm text-[var(--muted)]">Crée ton espace et commence immédiatement.</p>
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
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-sm" role="alert">
                      <div className="text-[var(--text)]">{error}</div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" loading={loading} disabled={loading}>
                    Créer mon espace
                  </Button>
                </form>
              </section>
            )}

            <div className="flex items-center justify-between mt-3">
              <Button variant="secondary" onClick={nextStep} disabled={stepIndex === flowSteps.length - 1}>
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

          <Card className="p-6 space-y-5" glass>
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Configuration</span>
              <h2 className="text-2xl font-black mt-1 text-[var(--text)]">{familyMeta.name}</h2>
              <p className="text-[var(--muted)]">{familyMeta.copy?.headline}</p>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-[var(--muted)]">Modules recommandés</div>
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

            <div className="rounded-2xl border border-[var(--border)] bg-white/5 p-3 text-sm">
              <div className="font-semibold text-[var(--text)]">Identifiants recommandés</div>
              <div className="text-[var(--muted)]">
                {familyMeta.identifiers?.barcode ? "Code-barres activé" : "Code-barres désactivé"} ·{" "}
                {familyMeta.identifiers?.sku ? "SKU activé" : "SKU désactivé"}
              </div>
              <div className="text-xs text-[var(--muted)] opacity-80">Modifiable ensuite dans Settings → Modules.</div>
            </div>

            <Link to="/login" className="text-sm underline text-[var(--text)]">
              Déjà un compte ? Se connecter →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}