// Deployed backend: https://inventory-tool-plage.onrender.com
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import Skeleton from "../ui/Skeleton";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import Divider from "../ui/Divider";
import useEntitlements from "../app/useEntitlements";
import { FAMILLES, MODULES, resolveFamilyId } from "../lib/famillesConfig";
import { getWording } from "../lib/labels";
import { formatPlanLabel } from "../lib/planLabels";

const safeArray = (v) => (Array.isArray(v) ? v : []);

const FeatureToggle = ({ label, description, helper, checked, onChange, disabled }) => (
  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
    <input
      type="checkbox"
      className="mt-1 accent-blue-600"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <div className="space-y-1">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      {description ? <div className="text-xs text-slate-500">{description}</div> : null}
      {helper ? <div className="text-xs text-slate-400">{helper}</div> : null}
    </div>
  </label>
);

export default function Settings() {
  const { me, tenant, services, refreshServices, logout, serviceId, selectService, isAllServices } = useAuth();
  const { data: entitlements, loading: entLoading, refetch: refetchEntitlements } = useEntitlements();
  const pushToast = useToast();

  const [newService, setNewService] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmA, setConfirmA] = useState(false);
  const [confirmB, setConfirmB] = useState(false);

  const [scanMode, setScanMode] = useState(() => localStorage.getItem("scanMode") || "scan");
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem("coach") !== "off");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [emailForm, setEmailForm] = useState({ email: "" });
  const [pwdForm, setPwdForm] = useState({ pwd: "", confirm: "" });

  const [billingBusy, setBillingBusy] = useState(false);

  // ✅ Members / access (owner only)
  const [membersVisible, setMembersVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "operator",
    service_id: "", // "" => all services
  });

  const serviceOptions = useMemo(() => safeArray(services), [services]);
  const hasMultiServices = serviceOptions.length > 1;
  const defaultServiceId = useMemo(() => {
    if (serviceId && serviceId !== "all") return String(serviceId);
    if (serviceOptions[0]) return String(serviceOptions[0].id);
    return "";
  }, [serviceId, serviceOptions]);
  const moduleLookup = useMemo(
    () =>
      MODULES.reduce((acc, mod) => {
        acc[mod.id] = mod;
        return acc;
      }, {}),
    []
  );

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await api.get("/api/auth/members/summary/");
      const data = res?.data || {};
      setMembers(safeArray(data.members));
      setRecentActivity(safeArray(data.recent_activity));
      setMembersVisible(true);
    } catch (e) {
      if (e?.response?.status === 403) {
        setMembersVisible(false);
        setMembers([]);
        setRecentActivity([]);
      } else {
        setMembersVisible(false);
        pushToast?.({ message: "Impossible de charger l’équipe (réessaie).", type: "error" });
      }
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMember = async () => {
    if (!inviteForm.email.trim()) {
      pushToast?.({ message: "Email requis.", type: "error" });
      return;
    }
    setMembersLoading(true);
    try {
      const payload = {
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        service_id: inviteForm.service_id ? Number(inviteForm.service_id) : null,
      };
      const res = await api.post("/api/auth/memberships/", payload);
      const temp = res?.data?.temp_password;
      if (temp) {
        pushToast?.({
          message: `Membre créé. Mot de passe temporaire: ${temp}`,
          type: "warn",
        });
      } else {
        pushToast?.({ message: "Membre ajouté / mis à jour.", type: "success" });
      }
      setInviteForm({ email: "", role: "operator", service_id: "" });
      await loadMembers();
      refetchEntitlements?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Impossible d’ajouter ce membre.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setMembersLoading(false);
    }
  };

  const updateMember = async (membershipId, patch) => {
    setMembersLoading(true);
    try {
      await api.patch(`/api/auth/memberships/${membershipId}/`, patch);
      pushToast?.({ message: "Accès mis à jour.", type: "success" });
      await loadMembers();
      refetchEntitlements?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Mise à jour impossible.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setMembersLoading(false);
    }
  };

  const removeMember = async (membershipId) => {
    setMembersLoading(true);
    try {
      await api.delete(`/api/auth/memberships/${membershipId}/`);
      pushToast?.({ message: "Membre retiré.", type: "success" });
      await loadMembers();
      refetchEntitlements?.();
    } catch (e) {
      pushToast?.({ message: "Suppression impossible.", type: "error" });
    } finally {
      setMembersLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setBillingBusy(true);
    try {
      const res = await api.post("/api/auth/billing/portal/", {});
      const url = res?.data?.url;
      if (!url) throw new Error("URL Stripe manquante.");
      window.location.href = url;
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Impossible d’ouvrir la gestion d’abonnement. Réessaie plus tard.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setBillingBusy(false);
    }
  };

  const toggleFeature = async (svc, key, value) => {
    setLoading(true);
    try {
      const nextFeatures = { ...(svc.features || {}) };
      if (key === "prices_purchase") {
        const prices = { ...(nextFeatures.prices || {}) };
        prices.purchase_enabled = value;
        nextFeatures.prices = prices;
      } else if (key === "prices_selling") {
        const prices = { ...(nextFeatures.prices || {}) };
        prices.selling_enabled = value;
        nextFeatures.prices = prices;
      } else if (key === "tva") {
        nextFeatures.tva = { ...(nextFeatures.tva || {}), enabled: value };
      } else {
        nextFeatures[key] = { ...(nextFeatures[key] || {}), enabled: value };
      }
      await api.patch(`/api/auth/services/${svc.id}/`, { features: nextFeatures });
      await refreshServices();
      pushToast?.({ message: "Service mis à jour.", type: "success" });
    } catch (e) {
      pushToast?.({ message: "Mise à jour impossible.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const applyIdentifierDefaults = async (svc, identifiers) => {
    const recBarcode = typeof identifiers?.barcode === "boolean" ? identifiers.barcode : true;
    const recSku = typeof identifiers?.sku === "boolean" ? identifiers.sku : true;

    setLoading(true);
    try {
      const nextFeatures = { ...(svc.features || {}) };
      nextFeatures.barcode = { ...(nextFeatures.barcode || {}), enabled: recBarcode };
      nextFeatures.sku = { ...(nextFeatures.sku || {}), enabled: recSku };
      await api.patch(`/api/auth/services/${svc.id}/`, { features: nextFeatures });
      await refreshServices();
      pushToast?.({ message: "Identifiants mis à jour selon la recommandation métier.", type: "success" });
    } catch (e) {
      pushToast?.({ message: "Mise à jour impossible.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const addService = async () => {
    if (!newService.trim()) return;
    setLoading(true);
    setToast("");
    try {
      await api.post("/api/auth/services/", { name: newService.trim() });
      await refreshServices();
      setNewService("");
      setToast("Service ajouté.");
      pushToast?.({ message: "Service ajouté", type: "success" });
      refetchEntitlements?.();
      loadMembers(); // services list change impact scope labels
    } catch (e) {
      const msg =
        e?.friendlyMessage ||
        e?.response?.data?.detail ||
        e?.response?.data?.non_field_errors?.[0] ||
        "Impossible d’ajouter ce service.";
      setToast(msg);
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirmA || !confirmB) return;
    setDeleting(true);
    try {
      await api.delete("/api/auth/delete-account/");
      pushToast?.({ message: "Compte supprimé. Vous allez être déconnecté.", type: "warn" });
      logout();
    } catch (e) {
      pushToast?.({ message: "Suppression impossible (réessaie plus tard).", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const planLabel = formatPlanLabel(entitlements?.plan_effective, "Solo");
  const subStatus = entitlements?.subscription_status || "NONE";
  const expiresAt = entitlements?.expires_at ? new Date(entitlements.expires_at).toLocaleDateString("fr-FR") : null;

  return (
    <PageTransition>
      <Helmet>
        <title>Settings | StockScan</title>
        <meta name="description" content="Préférences du compte et services." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-slate-500">Paramètres</div>
          <h1 className="text-2xl font-black">Compte & Services</h1>
          <p className="text-slate-600 text-sm">Gérez votre compte, vos services, votre équipe et votre abonnement.</p>
        </Card>

        {/* ✅ Owner: Team & access */}
        {membersVisible ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-700">Équipe & Accès</div>
                <div className="text-sm text-slate-500">
                  Donnez accès à un service précis (ex: Salle uniquement) + modifiez les rôles.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" onClick={loadMembers} loading={membersLoading}>
                  Rafraîchir
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3 items-end">
              <Input
                label="Inviter / ajouter (email)"
                type="email"
                placeholder="responsable@societe.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
              />
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Rôle</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="operator">Operator (inventaire)</option>
                  <option value="manager">Manager (catégories/exports)</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Scope service</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  value={inviteForm.service_id}
                  onChange={(e) => setInviteForm((p) => ({ ...p, service_id: e.target.value }))}
                >
                  <option value="">Tous les services</option>
                  {serviceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <Button onClick={addMember} loading={membersLoading}>
                Ajouter
              </Button>
            </div>

            <Divider />

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4 space-y-3" hover>
                <div className="text-sm font-semibold text-slate-800">Membres</div>

                {membersLoading ? (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : members.length ? (
                  <div className="space-y-2">
                    {members.map((m) => {
                      const user = m?.user || {};
                      const scope = m?.service_scope?.id ? String(m.service_scope.id) : "";
                      return (
                        <Card key={m.id} className="p-4 space-y-3" hover>
                          <div className="text-sm font-semibold text-slate-900">
                            {user.username || "Utilisateur"} · <span className="text-slate-600">{user.email || "—"}</span>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-2 items-end">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-600">Rôle</span>
                              <select
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                                value={m.role || "operator"}
                                onChange={(e) => updateMember(m.id, { role: e.target.value })}
                                disabled={membersLoading}
                              >
                                <option value="operator">operator</option>
                                <option value="manager">manager</option>
                                <option value="owner">owner</option>
                              </select>
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-600">Service</span>
                              <select
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                                value={scope}
                                onChange={(e) =>
                                  updateMember(m.id, { service_id: e.target.value ? Number(e.target.value) : null })
                                }
                                disabled={membersLoading}
                              >
                                <option value="">Tous les services</option>
                                {serviceOptions.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <Button
                              variant="danger"
                              onClick={() => removeMember(m.id)}
                              loading={membersLoading}
                              disabled={membersLoading}
                            >
                              Retirer
                            </Button>
                          </div>

                          <div className="text-xs text-slate-500">
                            Scope actuel :{" "}
                            {m?.service_scope?.name ? <span className="font-semibold">{m.service_scope.name}</span> : "multi-services"}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aucun membre.</div>
                )}
              </Card>

              <Card className="p-4 space-y-3" hover>
                <div className="text-sm font-semibold text-slate-800">Traçabilité (récent)</div>

                {membersLoading ? (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : recentActivity.length ? (
                  <div className="space-y-2">
                    {recentActivity.slice(0, 12).map((a, idx) => (
                      <div key={idx} className="text-sm text-slate-700">
                        <span className="font-semibold">{a.action}</span>{" "}
                        <span className="text-slate-500">
                          · {a.user?.username || "system"} · {new Date(a.at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aucune activité (audit pas encore alimenté).</div>
                )}
              </Card>
            </div>

            <div className="text-xs text-slate-500">
              Next V2: invitations par email + acceptation via lien (au lieu de “création directe”).
            </div>
          </Card>
        ) : null}

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Compte</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Utilisateur" value={me?.username || ""} readOnly />
            <Input label="Commerce" value={tenant?.name || ""} readOnly />
          </div>
          <div>
            <Button variant="secondary" onClick={logout}>
              Déconnexion
            </Button>
          </div>
        </Card>

        {/* Billing */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-slate-700">Abonnement & facturation</div>
              <div className="text-sm text-slate-500">
                Plan actuel : <span className="font-semibold text-slate-800">{planLabel}</span>
                {expiresAt ? (
                  <span className="ml-2">
                    · Fin de période : <span className="font-semibold">{expiresAt}</span>
                  </span>
                ) : null}
                <span className="ml-2">
                  · Statut : <span className="font-semibold">{subStatus}</span>
                </span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={openBillingPortal} loading={billingBusy} disabled={billingBusy}>
                Gérer mon abonnement (Stripe)
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/tarifs")}>
                Comparer les plans
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            En cas d’impayé, vous pouvez mettre à jour votre carte depuis Stripe. Aucun effacement de données : lecture et export restent possibles.
          </div>

          {entLoading ? <div className="text-sm text-slate-500">Chargement des informations d’abonnement…</div> : null}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Sécurité / Identifiants</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Changer d’email"
              placeholder="nouvel email"
              value={emailForm.email}
              onChange={(e) => setEmailForm({ email: e.target.value })}
              helper="Front uniquement pour l’instant"
            />
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => pushToast?.({ message: "Changement d’email côté backend à implémenter.", type: "info" })}
              >
                Mettre à jour
              </Button>
            </div>
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={pwdForm.pwd}
              onChange={(e) => setPwdForm((p) => ({ ...p, pwd: e.target.value }))}
              helper="Front uniquement pour l’instant"
            />
            <Input
              label="Confirmer mot de passe"
              type="password"
              value={pwdForm.confirm}
              onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))}
            />
            <div className="sm:col-span-2 flex gap-2">
              <Button
                onClick={() => {
                  if (!pwdForm.pwd || pwdForm.pwd !== pwdForm.confirm) {
                    pushToast?.({ message: "Les mots de passe ne correspondent pas.", type: "error" });
                    return;
                  }
                  pushToast?.({ message: "Changement de mot de passe à brancher backend.", type: "info" });
                }}
              >
                Mettre à jour le mot de passe
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Préférences UI</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Mode de saisie</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                value={scanMode}
                onChange={(e) => {
                  setScanMode(e.target.value);
                  localStorage.setItem("scanMode", e.target.value);
                }}
              >
                <option value="scan">Scan prioritaire</option>
                <option value="manual">Saisie manuelle</option>
              </select>
              <span className="text-xs text-slate-500">Ajuste l’accent sur les flux scan/sans-code-barres.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Coach onboarding</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                value={coachEnabled ? "on" : "off"}
                onChange={(e) => {
                  const on = e.target.value === "on";
                  setCoachEnabled(on);
                  localStorage.setItem("coach", on ? "on" : "off");
                }}
              >
                <option value="on">Activé</option>
                <option value="off">Désactivé</option>
              </select>
              <span className="text-xs text-slate-500">Affiche/masque les aides rapides.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Thème</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                value={theme}
                onChange={(e) => {
                  const next = e.target.value;
                  setTheme(next);
                  localStorage.setItem("theme", next);
                  document.documentElement.setAttribute("data-theme", next);
                }}
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </select>
              <span className="text-xs text-slate-500">Persiste sur cet appareil.</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                localStorage.removeItem("stockscan_tour_v1");
                pushToast?.({ message: "Visite guidée réinitialisée. Retournez sur le dashboard pour la relancer.", type: "success" });
              }}
            >
              Relancer la visite guidée
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">Services & modules</div>
              <div className="text-sm text-slate-500">
                Activez les modules métier : ils pilotent les champs visibles dans Produits, Inventaire et Exports.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-800">Regrouper ou séparer vos services</div>
            <div className="text-xs text-slate-500">
              Ce choix organise la navigation et les tableaux de bord (vue globale ou vue par service).
            </div>
            {hasMultiServices ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={isAllServices ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => selectService("all")}
                  >
                    Regrouper (vue globale)
                  </Button>
                  <Button
                    variant={!isAllServices ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => {
                      if (defaultServiceId) selectService(defaultServiceId);
                    }}
                  >
                    Séparer (par service)
                  </Button>
                </div>
                {!isAllServices && defaultServiceId ? (
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">Service par défaut</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                      value={defaultServiceId}
                      onChange={(e) => selectService(e.target.value)}
                    >
                      {serviceOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="text-xs text-slate-500">
                  Vous pourrez toujours basculer depuis la barre supérieure.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Ajoutez un 2e service pour activer le regroupement multi-services.
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input label="Nouveau service" placeholder="Ex. Bar" value={newService} onChange={(e) => setNewService(e.target.value)} />
            <Button onClick={addService} loading={loading}>
              Ajouter
            </Button>
            {toast && <div className="text-sm text-slate-500">{toast}</div>}
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {(services || []).map((s) => {
              const features = s.features || {};
              const serviceType = s.service_type;
              const familyId = resolveFamilyId(serviceType, tenant?.domain);
              const familyMeta = FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0];
              const modules = familyMeta?.modules || [];
              const moduleNames = modules.map((id) => moduleLookup[id]?.name || id);
              const identifiers = familyMeta?.identifiers || {};
              const wording = getWording(serviceType, tenant?.domain);

              const recBarcode = typeof identifiers.barcode === "boolean" ? identifiers.barcode : true;
              const recSku = typeof identifiers.sku === "boolean" ? identifiers.sku : true;
              const priceCfg = features.prices || {};
              const purchaseEnabled = priceCfg.purchase_enabled !== false;
              const sellingEnabled = priceCfg.selling_enabled !== false;
              const tvaEnabled = features.tva?.enabled !== false;
              const dlcEnabled = features.dlc?.enabled !== false && tenant?.domain !== "general";
              const openEnabled = features.open_container_tracking?.enabled === true;
              const lotEnabled = features.lot?.enabled === true;
              const multiUnitEnabled = features.multi_unit?.enabled === true;
              const variantsEnabled = features.variants?.enabled === true;
              const itemTypeEnabled = features.item_type?.enabled === true;
              const hasModule = (id) => modules.includes(id);

              return (
                <Card key={s.id} className="p-4 space-y-3" hover>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">Métier : {familyMeta?.name || "—"}</div>
                    <div className="text-xs text-slate-400">
                      Modules recommandés : {moduleNames.length ? moduleNames.join(", ") : "Base"}
                    </div>
                  </div>
                  <Divider />

                  <div className="space-y-3 text-sm">
                    {hasModule("identifier") && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Identifiants</div>
                        <FeatureToggle
                          label={wording?.barcodeLabel || "Code-barres"}
                          description="Scan rapide pour retrouver un article et éviter les doublons."
                          helper={`Recommandé : ${recBarcode ? "activé" : "désactivé"} pour ${familyMeta?.name || "ce métier"}.`}
                          checked={features.barcode?.enabled !== false}
                          onChange={(e) => toggleFeature(s, "barcode", e.target.checked)}
                          disabled={loading}
                        />
                        <FeatureToggle
                          label={wording?.skuLabel || "SKU interne"}
                          description="Référence interne stable pour garder un catalogue propre."
                          helper={`Recommandé : ${recSku ? "activé" : "désactivé"} pour ${familyMeta?.name || "ce métier"}.`}
                          checked={features.sku?.enabled !== false}
                          onChange={(e) => toggleFeature(s, "sku", e.target.checked)}
                          disabled={loading}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyIdentifierDefaults(s, identifiers)}
                          disabled={loading}
                        >
                          Appliquer la recommandation métier
                        </Button>
                      </div>
                    )}

                    {hasModule("pricing") && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pricing & TVA</div>
                        <FeatureToggle
                          label="Prix d’achat (HT)"
                          description="Base de valeur de stock et coût des pertes."
                          checked={purchaseEnabled}
                          onChange={(e) => toggleFeature(s, "prices_purchase", e.target.checked)}
                          disabled={loading}
                        />
                        <FeatureToggle
                          label="Prix de vente (TTC par défaut)"
                          description="Active les marges théoriques et le CA potentiel."
                          checked={sellingEnabled}
                          onChange={(e) => toggleFeature(s, "prices_selling", e.target.checked)}
                          disabled={loading}
                        />
                        <FeatureToggle
                          label="TVA"
                          description="Taux exportables (0%, 5.5%, 10%, 20%)."
                          checked={tvaEnabled}
                          onChange={(e) => toggleFeature(s, "tva", e.target.checked)}
                          disabled={loading}
                        />
                        <div className="text-xs text-slate-500">
                          Sans prix de vente, la marge estimée reste indicative.
                        </div>
                      </div>
                    )}

                    {hasModule("expiry") && (
                      <FeatureToggle
                        label="DLC / DDM"
                        description="Ajoute les dates limites dans Inventaire et Exports."
                        checked={dlcEnabled}
                        onChange={(e) => toggleFeature(s, "dlc", e.target.checked)}
                        disabled={tenant?.domain === "general" || loading}
                      />
                    )}

                    {hasModule("lot") && (
                      <FeatureToggle
                        label="Lot / Batch"
                        description="Traçabilité renforcée, utile pour la conformité."
                        checked={lotEnabled}
                        onChange={(e) => toggleFeature(s, "lot", e.target.checked)}
                        disabled={loading}
                      />
                    )}

                    {hasModule("variants") && (
                      <FeatureToggle
                        label="Variantes (taille, couleur)"
                        description="Ajoute tailles/couleurs sur Produits et Inventaire."
                        checked={variantsEnabled}
                        onChange={(e) => toggleFeature(s, "variants", e.target.checked)}
                        disabled={loading}
                      />
                    )}

                    {hasModule("opened") && (
                      <FeatureToggle
                        label="Ouvert / entamé"
                        description="Suivi des contenants entamés (bar, cuisine, boulangerie)."
                        checked={openEnabled}
                        onChange={(e) => toggleFeature(s, "open_container_tracking", e.target.checked)}
                        disabled={loading}
                      />
                    )}

                    {hasModule("multiUnit") && (
                      <FeatureToggle
                        label="Multi-unités & conversions"
                        description="Conversions d’unités (kg ↔ pièce ↔ L)."
                        checked={multiUnitEnabled}
                        onChange={(e) => toggleFeature(s, "multi_unit", e.target.checked)}
                        disabled={loading}
                      />
                    )}

                    {hasModule("itemType") && (
                      <FeatureToggle
                        label="Matières premières / produits finis"
                        description="Active un type d’article pour séparer matières et ventes."
                        helper="Les ventes/marges s’appuient sur les produits finis."
                        checked={itemTypeEnabled}
                        onChange={(e) => toggleFeature(s, "item_type", e.target.checked)}
                        disabled={loading}
                      />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 space-y-3 border-red-200/70 bg-red-50/70">
          <div className="text-sm font-semibold text-red-700">Suppression du compte</div>
          <div className="text-sm text-red-700">
            Cette action est définitive. Si vous êtes le seul membre du commerce, le tenant et ses données seront supprimés.
          </div>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-red-800">
              <input
                type="checkbox"
                className="mt-1 accent-red-600"
                checked={confirmA}
                onChange={(e) => setConfirmA(e.target.checked)}
              />
              <span>Je comprends que mes données et services associés peuvent être supprimés.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-red-800">
              <input
                type="checkbox"
                className="mt-1 accent-red-600"
                checked={confirmB}
                onChange={(e) => setConfirmB(e.target.checked)}
              />
              <span>Action irréversible : je devrai recréer un compte pour utiliser StockScan.</span>
            </label>
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              disabled={!confirmA || !confirmB || deleting}
              loading={deleting}
              onClick={deleteAccount}
            >
              Supprimer mon compte
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
