// Deployed backend: https://inventory-tool-plage.onrender.com
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../app/AuthProvider";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import Divider from "../ui/Divider";
import useEntitlements from "../app/useEntitlements";

const safeArray = (v) => (Array.isArray(v) ? v : []);

export default function Settings() {
  const { me, tenant, services, refreshServices, logout } = useAuth();
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
      if (key === "open_container_tracking") {
        nextFeatures[key] = { enabled: value };
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

  const planLabel = entitlements?.plan_effective || "ESSENTIEL";
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
                      <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
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
                      <div key={i} className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
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
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Services</div>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input label="Nouveau service" placeholder="Ex. Bar" value={newService} onChange={(e) => setNewService(e.target.value)} />
            <Button onClick={addService} loading={loading}>
              Ajouter
            </Button>
            {toast && <div className="text-sm text-slate-500">{toast}</div>}
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(services || []).map((s) => {
              const features = s.features || {};
              return (
                <Card key={s.id} className="p-4 space-y-3" hover>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">Type: {s.service_type}</div>
                  <Divider />
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={features.barcode?.enabled !== false}
                        onChange={(e) => toggleFeature(s, "barcode", e.target.checked)}
                      />
                      <span>Code-barres</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={features.sku?.enabled !== false}
                        onChange={(e) => toggleFeature(s, "sku", e.target.checked)}
                      />
                      <span>SKU interne</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={features.dlc?.enabled !== false && tenant?.domain !== "general"}
                        onChange={(e) => toggleFeature(s, "dlc", e.target.checked)}
                        disabled={tenant?.domain === "general"}
                      />
                      <span>DLC</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={features.open_container_tracking?.enabled === true}
                        onChange={(e) => toggleFeature(s, "open_container_tracking", e.target.checked)}
                      />
                      <span>Suivi entamé (bars/resto)</span>
                    </label>
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
