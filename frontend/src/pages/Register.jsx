import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../app/AuthProvider";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { FAMILLES, MODULES, DEFAULT_MODULES } from "../lib/famillesConfig";

const servicePresets = (family, isMulti, linkedMode = "separate") => {
  const primary = {
    retail: { service_type: "grocery_food", service_name: "Épicerie" },
    mode: { service_type: "retail_general", service_name: "Boutique mode" },
    bar: { service_type: "bar", service_name: "Bar" },
    restauration: { service_type: "kitchen", service_name: "Cuisine" },
    boulangerie: { service_type: "bakery", service_name: "Boulangerie" },
    pharmacie: { service_type: "pharmacy_parapharmacy", service_name: "Pharmacie" },
  }[family] || { service_type: "other", service_name: "Service principal" };

  if (!isMulti) {
    return [{ id: "svc-1", ...primary }];
  }

  if (family === "restauration") {
    if (linkedMode === "merge") {
      return [{ id: "svc-1", service_type: "kitchen", service_name: "Restaurant & Cuisine" }];
    }
    return [
      { id: "svc-1", service_type: "kitchen", service_name: "Cuisine" },
      { id: "svc-2", service_type: "restaurant_dining", service_name: "Salle" },
    ];
  }

  if (family === "boulangerie") {
    if (linkedMode === "merge") {
      return [{ id: "svc-1", service_type: "bakery", service_name: "Boulangerie & Pâtisserie" }];
    }
    return [
      { id: "svc-1", service_type: "bakery", service_name: "Boulangerie" },
      { id: "svc-2", service_type: "bakery", service_name: "Pâtisserie" },
    ];
  }

  if (family === "pharmacie") {
    if (linkedMode === "merge") {
      return [{ id: "svc-1", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie & Parapharmacie" }];
    }
    return [
      { id: "svc-1", service_type: "pharmacy_parapharmacy", service_name: "Pharmacie" },
      { id: "svc-2", service_type: "pharmacy_parapharmacy", service_name: "Parapharmacie" },
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
      className={`w-10 h-10 rounded-full border ${active ? "bg-blue-500 border-blue-400" : "border-white/20"} flex items-center justify-center text-white`}
      onClick={() => onToggle(moduleId)}
    >
      {active ? "✓" : "+"}
    </button>
    <div>
      <div className="font-semibold text-white">{name}</div>
      <div className="text-sm text-slate-400">{description}</div>
    </div>
  </div>
);

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    storeName: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [familyId, setFamilyId] = useState(FAMILLES[0].id);
  const [isGroundedMulti, setIsGroundedMulti] = useState(false);
  const [linkedMode, setLinkedMode] = useState("separate");
  const [step, setStep] = useState(1);
  const [modules, setModules] = useState(DEFAULT_MODULES[familyId] || []);
  const [serviceList, setServiceList] = useState(() => servicePresets(familyId, false));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const familyMeta = useMemo(() => FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0], [familyId]);
  const linkedFamilies = new Set(["restauration", "boulangerie", "pharmacie"]);

  const moduleListForFamily = useMemo(
    () => MODULES.filter((module) => module.families.includes(familyId)),
    [familyId]
  );

  const handleFamilyChange = (id) => {
    setFamilyId(id);
    setModules(DEFAULT_MODULES[id] || []);
    setIsGroundedMulti(false);
    setLinkedMode("separate");
    setServiceList(servicePresets(id, false));
  };

  const handleToggleModule = (id) => {
    setModules((prev) =>
      prev.includes(id) ? prev.filter((module) => module !== id) : [...prev, id]
    );
  };

  const handleServiceNameChange = (idx, value) => {
    setServiceList((prev) => prev.map((svc, index) => (index === idx ? { ...svc, service_name: value } : svc)));
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.storeName || !form.email || !form.password || form.password !== form.passwordConfirm) {
      setError("Il manque un champ ou les mots de passe ne correspondent pas.");
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
        boulangerie: "other",
        pharmacie: "pharmacy",
      };
      const domainByFamily = {
        retail: "food",
        bar: "food",
        restauration: "food",
        boulangerie: "food",
        mode: "general",
        pharmacie: "general",
      };
      await register({
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
      nav("/app/dashboard");
    } catch (err) {
      setError(err?.message || "Impossible de créer le compte pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-10 px-4">
      <Helmet>
        <title>Créer mon espace | StockScan</title>
      </Helmet>

      <h1 className="text-3xl font-black mb-2 text-center">Créer mon espace</h1>
      <p className="text-center text-slate-400 max-w-xl">
        Choisis ta famille métier, active les modules qui te parlent, et réserve les champs
        interprétés pour ton aventure StockScan.
      </p>

      <div className="w-full max-w-4xl mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card className="bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-widest text-slate-500">Étape {step}/3</span>
            <Button variant="secondary" size="sm" onClick={prevStep} disabled={step === 1}>
              Précédent
            </Button>
          </div>

          {step === 1 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Famille métier</h2>
                <p className="text-sm text-slate-400">{familyMeta.copy.subline}</p>
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
                    <div className="text-sm text-slate-400">{family.copy.headline}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-300">
                  Multi-services ?
                </label>
                <Button
                  variant={isGroundedMulti ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    const nextIsMulti = !isGroundedMulti;
                    setIsGroundedMulti(nextIsMulti);
                    setServiceList(servicePresets(familyId, nextIsMulti, linkedMode));
                  }}
                >
                  {isGroundedMulti ? "Multi activé" : "Mono (par défaut)"}
                </Button>
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
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Services</h2>
                <p className="text-sm text-slate-400">
                  Personnalise chaque service, modifie le nom ou ajoute un service à la main.
                </p>
              </div>
              <div className="space-y-3">
                {serviceList.map((service, index) => (
                  <Input
                    key={service.id}
                    label={`Service ${index + 1}`}
                    value={service.service_name}
                    placeholder={`${familyMeta.defaults.categoryLabel || "Service"} ${index + 1}`}
                    onChange={(event) => handleServiceNameChange(index, event.target.value)}
                  />
                ))}
              </div>
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
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Compte & accès</h2>
                <p className="text-sm text-slate-400">
                  Crée ton espace {familyMeta.name.toLowerCase()} et débloque les modules recommandés.
                </p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                <Input
                  label="Nom du commerce"
                  placeholder={familyMeta.copy.headline}
                  value={form.storeName}
                  onChange={(event) => setForm({ ...form, storeName: event.target.value })}
                />
                <Input
                  label="Email professionnel"
                  placeholder={`contact@${familyMeta.name.toLowerCase().replace(/\s+/g, "")}.com`}
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
                <Input
                  label="Mot de passe"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <Input
                  label="Confirme le mot de passe"
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })}
                />
                {error && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" loading={loading}>
                  Créer mon espace personnalisé
                </Button>
              </form>
            </section>
          )}

          <div className="flex items-center justify-between mt-3">
            <Button variant="secondary" onClick={nextStep} disabled={step === 3}>
              {step === 3 ? "Réviser" : "Étape suivante"}
            </Button>
            <div>
              {step > 1 && (
                <Button variant="ghost" size="sm" onClick={prevStep}>
                  ← Revenir
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-white/10 p-6 space-y-5">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Configuration métier
            </span>
            <h2 className="text-2xl font-black mt-1">{familyMeta.name}</h2>
            <p className="text-slate-300">{familyMeta.copy.headline}</p>
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

          <div className="text-sm text-slate-500">
            <p>Personnalise les champs disponibles et garde une expérience cible “famille métier”.</p>
            <p className="mt-2">
              Besoin de changer la famille ou de réactiver le guide ? Tu peux revenir en arrière sans perdre ton avance.
            </p>
          </div>

          <div className="border border-dashed border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 bg-slate-900/40">
            <p>Copy system activé :</p>
            <p className="text-xs text-slate-500">
              {modules.length === 0 ? "Active un module pour voir les champs visibles." : modules.join(", ")}
            </p>
          </div>

          <Link to="/login" className="text-sm text-blue-400">
            Déjà un compte ? Connecte-toi →
          </Link>
        </Card>
      </div>
    </div>
  );
}
