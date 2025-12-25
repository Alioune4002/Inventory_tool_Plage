// frontend/src/pages/Settings.jsx

// Deployed backend: https://inventory-tool-plage.onrender.com
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import PageTransition from "../components/PageTransition";
import Skeleton from "../ui/Skeleton";
import { useAuth } from "../app/AuthProvider";
import {
  api,
  requestEmailChange,
  requestPasswordReset,
  resendVerificationEmail,
  deleteMyAccount,
} from "../lib/api";
import { useToast } from "../app/ToastContext";
import Divider from "../ui/Divider";
import useEntitlements from "../app/useEntitlements";
import { FAMILLES, MODULES, resolveFamilyId } from "../lib/famillesConfig";
import { getWording } from "../lib/labels";
import { formatPlanLabel } from "../lib/planLabels";
import { getTourKey, getTourPendingKey } from "../lib/tour";

const safeArray = (v) => (Array.isArray(v) ? v : []);

const FeatureToggle = ({ label, description, helper, checked, onChange, disabled }) => (
  <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
    <input
      type="checkbox"
      className="mt-1 accent-blue-600"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <div className="space-y-1">
      <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
      {description ? <div className="text-xs text-[var(--muted)]">{description}</div> : null}
      {helper ? <div className="text-xs text-[var(--muted)] opacity-90">{helper}</div> : null}
    </div>
  </label>
);

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function Settings() {
  const { me, tenant, services, refreshServices, logout, serviceId, selectService, isAllServices, refreshMe } =
    useAuth();
  const { data: entitlements, loading: entLoading, refetch: refetchEntitlements } = useEntitlements();
  const pushToast = useToast();

  const userId = me?.id || me?.user?.id || me?.user_id || "";
  const currentEmail = me?.email || "";

  const [newService, setNewService] = useState("");
  // ✅ NEW: type lors de l’ajout d’un service (settings)
  const [newServiceType, setNewServiceType] = useState("other");

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [confirmA, setConfirmA] = useState(false);
  const [confirmB, setConfirmB] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  const [scanMode, setScanMode] = useState(() => localStorage.getItem("scanMode") || "scan");
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem("coach") !== "off");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [billingBusy, setBillingBusy] = useState(false);

  // ✅ Security forms
  const [emailForm, setEmailForm] = useState({ email: "" });
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityInfo, setSecurityInfo] = useState({
    emailChangeRequested: false,
    resetRequested: false,
  });

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

  const [lastInviteLink, setLastInviteLink] = useState("");

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

  const inviteMember = async () => {
    if (!inviteForm.email.trim()) {
      pushToast?.({ message: "Email requis.", type: "error" });
      return;
    }
    setMembersLoading(true);
    setLastInviteLink("");
    try {
      const payload = {
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        service_id: inviteForm.service_id ? Number(inviteForm.service_id) : null,
      };

      const res = await api.post("/api/auth/invitations/", payload);

      const link = res?.data?.invite_link || "";
      const emailSent = res?.data?.email_sent === true;

      setInviteForm({ email: "", role: "operator", service_id: "" });

      if (link && (!emailSent || import.meta.env.DEV)) {
        setLastInviteLink(link);
      }

      if (emailSent) {
        pushToast?.({
          message: "Invitation envoyée par email. L’invité va créer son mot de passe via le lien.",
          type: "success",
        });
      } else {
        pushToast?.({
          message:
            "Invitation créée, mais l’email n’a pas pu être envoyé. Copie le lien d’invitation et partage-le manuellement.",
          type: "warn",
        });
      }

      await loadMembers();
      refetchEntitlements?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.email || "Impossible d’envoyer l’invitation.";
      pushToast?.({ message: typeof msg === "string" ? msg : "Invitation impossible.", type: "error" });
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
    try {
      // ✅ NEW: on envoie aussi service_type pour que le preset s’applique bien
      await api.post("/api/auth/services/", { name: newService.trim(), service_type: newServiceType || "other" });

      await refreshServices();
      setNewService("");
      setNewServiceType("other"); // ✅ reset type
      pushToast?.({ message: "Service ajouté", type: "success" });
      refetchEntitlements?.();
      loadMembers();
    } catch (e) {
      const msg =
        e?.friendlyMessage ||
        e?.response?.data?.detail ||
        e?.response?.data?.non_field_errors?.[0] ||
        "Impossible d’ajouter ce service.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // ✅ Security actions (branchés)
  // -----------------------------
  const submitEmailChange = async () => {
    const email = (emailForm.email || "").trim();
    if (!email) {
      pushToast?.({ message: "Nouvel email requis.", type: "error" });
      return;
    }
    if (email.toLowerCase() === (currentEmail || "").toLowerCase()) {
      pushToast?.({ message: "C’est déjà votre email actuel.", type: "info" });
      return;
    }

    setSecurityBusy(true);
    try {
      await requestEmailChange({ email });
      setSecurityInfo((p) => ({ ...p, emailChangeRequested: true }));
      pushToast?.({
        message: "Email envoyé. Confirme le changement via le lien reçu (puis reconnecte-toi).",
        type: "success",
      });
      setEmailForm({ email: "" });
    } catch (e) {
      const msg = e?.friendlyMessage || e?.response?.data?.detail || "Impossible d’envoyer l’email de confirmation.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setSecurityBusy(false);
    }
  };

  const submitPasswordResetEmail = async () => {
    // Pour être “accessible à tous”, on supporte reset par email OU par username
    const email = (currentEmail || "").trim();
    const username = (me?.username || "").trim();

    if (!email && !username) {
      pushToast?.({ message: "Impossible : aucun email/username détecté.", type: "error" });
      return;
    }

    setSecurityBusy(true);
    try {
      await requestPasswordReset({ email: email || undefined, username: email ? undefined : username });
      setSecurityInfo((p) => ({ ...p, resetRequested: true }));
      pushToast?.({
        message: "Email envoyé. Ouvre le lien pour définir un nouveau mot de passe.",
        type: "success",
      });
    } catch (e) {
      const msg = e?.friendlyMessage || e?.response?.data?.detail || "Impossible d’envoyer l’email de réinitialisation.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setSecurityBusy(false);
    }
  };

  const submitResendVerification = async () => {
    const email = (currentEmail || "").trim();
    if (!email) {
      pushToast?.({ message: "Aucun email sur le compte. Ajoute un email puis réessaie.", type: "error" });
      return;
    }
    setSecurityBusy(true);
    try {
      await resendVerificationEmail({ email });
      pushToast?.({ message: "Email de vérification renvoyé.", type: "success" });
    } catch (e) {
      const msg = e?.friendlyMessage || e?.response?.data?.detail || "Impossible de renvoyer l’email.";
      pushToast?.({ message: msg, type: "error" });
    } finally {
      setSecurityBusy(false);
    }
  };

  const deleteAccount = async () => {
    const phraseOk = String(deletePhrase || "").trim().toUpperCase() === "SUPPRIMER";
    if (!confirmA || !confirmB || !phraseOk) {
      pushToast?.({ message: "Confirme les cases + tape SUPPRIMER pour continuer.", type: "error" });
      return;
    }

    setDeleting(true);
    try {
      await deleteMyAccount();
      pushToast?.({ message: "Compte supprimé. Déconnexion…", type: "warn" });
      logout();
    } catch (e) {
      const msg = e?.friendlyMessage || e?.response?.data?.detail || "Suppression impossible (réessaie plus tard).";
      pushToast?.({ message: msg, type: "error" });
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
          <div className="text-sm text-[var(--muted)]">Paramètres</div>
          <h1 className="text-2xl font-black text-[var(--text)]">Compte & Services</h1>
          <p className="text-[var(--muted)] text-sm">Gérez votre compte, vos services, votre équipe et votre abonnement.</p>
        </Card>

        {/* ✅ Owner: Team & access */}
        {membersVisible ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Équipe & Accès</div>
                <div className="text-sm text-[var(--muted)]">Invitez un membre : il reçoit un lien et crée lui-même son mot de passe.</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" onClick={loadMembers} loading={membersLoading}>
                  Rafraîchir
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3 items-end">
              <Input
                label="Inviter (email)"
                type="email"
                placeholder="responsable@societe.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
              />

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[var(--text)]">Rôle</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="operator">Operator (inventaire)</option>
                  <option value="manager">Manager (catégories/exports)</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[var(--text)]">Scope service</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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

              <Button onClick={inviteMember} loading={membersLoading}>
                Envoyer l’invitation
              </Button>
            </div>

            {lastInviteLink ? (
              <div className="rounded-2xl border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="font-semibold">Lien d'invitation</div>
                <div className="text-xs opacity-80">(à utiliser si l'email n'a pas été reçu)</div>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await copyToClipboard(lastInviteLink);
                      pushToast?.({ message: ok ? "Lien copié." : "Copie impossible.", type: ok ? "success" : "error" });
                    }}
                  >
                    Copier
                  </Button>
                </div>
              </div>
            ) : null}

            <Divider />

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4 space-y-3" hover>
                <div className="text-sm font-semibold text-[var(--text)]">Membres</div>

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
                          <div className="text-sm font-semibold text-[var(--text)]">
                            {user.username || "Utilisateur"} · <span className="text-[var(--muted)]">{user.email || "—"}</span>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-2 items-end">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold text-[var(--muted)]">Rôle</span>
                              <select
                                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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
                              <span className="text-xs font-semibold text-[var(--muted)]">Service</span>
                              <select
                                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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

                          <div className="text-xs text-[var(--muted)]">
                            Scope actuel :{" "}
                            {m?.service_scope?.name ? (
                              <span className="font-semibold text-[var(--text)]">{m.service_scope.name}</span>
                            ) : (
                              "multi-services"
                            )}
                          </div>

                          {m?.last_action?.action ? (
                            <div className="text-xs text-[var(--muted)]">
                              Dernière action : <span className="font-semibold text-[var(--text)]">{m.last_action.action}</span>
                              {m.last_action.at ? (
                                <span className="opacity-80"> · {new Date(m.last_action.at).toLocaleString("fr-FR")}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">Aucun membre.</div>
                )}
              </Card>

              <Card className="p-4 space-y-3" hover>
                <div className="text-sm font-semibold text-[var(--text)]">Traçabilité (récent)</div>

                {membersLoading ? (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : recentActivity.length ? (
                  <div className="space-y-2">
                    {recentActivity.slice(0, 12).map((a, idx) => (
                      <div key={idx} className="text-sm text-[var(--text)]">
                        <span className="font-semibold">{a.action}</span>{" "}
                        <span className="text-[var(--muted)]">
                          · {a.user?.username || "system"} · {new Date(a.at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">Aucune activité (audit pas encore alimenté).</div>
                )}
              </Card>
            </div>

            <div className="text-xs text-[var(--muted)]">Next V2 : afficher aussi les invitations en attente + relance.</div>
          </Card>
        ) : null}

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-[var(--text)]">Compte</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Utilisateur" value={me?.username || ""} readOnly />
            <Input label="Commerce" value={tenant?.name || ""} readOnly />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={logout}>
              Déconnexion
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // mini “self-heal”
                refreshMe?.();
                refetchEntitlements?.();
                refreshServices?.();
                pushToast?.({ message: "Synchronisation demandée.", type: "info" });
              }}
            >
              Synchroniser
            </Button>
          </div>
        </Card>

        {/* Billing */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Abonnement & facturation</div>
              <div className="text-sm text-[var(--muted)]">
                Plan actuel : <span className="font-semibold text-[var(--text)]">{planLabel}</span>
                {expiresAt ? (
                  <span className="ml-2">
                    · Fin de période : <span className="font-semibold text-[var(--text)]">{expiresAt}</span>
                  </span>
                ) : null}
                <span className="ml-2">
                  · Statut : <span className="font-semibold text-[var(--text)]">{subStatus}</span>
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

          <div className="text-xs text-[var(--muted)]">
            En cas d’impayé, vous pouvez mettre à jour votre carte depuis Stripe. Aucun effacement de données : lecture et export restent possibles.
          </div>

          {entLoading ? <div className="text-sm text-[var(--muted)]">Chargement…</div> : null}
        </Card>

        {/* ✅ Security / Identifiants (branché) */}
        <Card className="p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Sécurité</div>
            <div className="text-sm text-[var(--muted)]">
              Tout est conçu pour être simple : StockScan envoie des liens sécurisés par email (pas de manipulation “technique”).
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Email actuel"
              value={currentEmail || "—"}
              readOnly
              helper="C’est l’email utilisé pour les liens de sécurité."
            />

            <div className="flex items-end gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={submitResendVerification}
                loading={securityBusy}
                disabled={securityBusy || !currentEmail}
              >
                Renvoyer l’email de vérification
              </Button>
            </div>

            <Input
              label="Nouvel email"
              placeholder="nouveau@email.com"
              value={emailForm.email}
              onChange={(e) => setEmailForm({ email: e.target.value })}
              helper="Vous recevrez un email de confirmation. Une reconnexion peut être nécessaire."
            />

            <div className="flex items-end">
              <Button variant="secondary" onClick={submitEmailChange} loading={securityBusy} disabled={securityBusy}>
                Envoyer le lien de confirmation
              </Button>
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--text)]">Mot de passe</div>
              <div className="text-sm text-[var(--muted)]">Pour changer votre mot de passe, on vous envoie un lien sécurisé.</div>
              <div className="flex gap-2 flex-wrap pt-1">
                <Button onClick={submitPasswordResetEmail} loading={securityBusy} disabled={securityBusy}>
                  Recevoir le lien de changement de mot de passe
                </Button>
                <Button variant="ghost" onClick={() => (window.location.href = "/login")}>
                  Je suis bloqué
                </Button>
              </div>

              {securityInfo.emailChangeRequested ? (
                <div className="text-xs text-[var(--muted)]">✅ Lien de changement d’email envoyé (pense à vérifier tes spams).</div>
              ) : null}
              {securityInfo.resetRequested ? (
                <div className="text-xs text-[var(--muted)]">
                  ✅ Lien de changement de mot de passe envoyé (pense à vérifier tes spams).
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="text-sm font-semibold text-[var(--text)]">Préférences UI</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[var(--text)]">Mode de saisie</span>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                value={scanMode}
                onChange={(e) => {
                  setScanMode(e.target.value);
                  localStorage.setItem("scanMode", e.target.value);
                }}
              >
                <option value="scan">Scan prioritaire</option>
                <option value="manual">Saisie manuelle</option>
              </select>
              <span className="text-xs text-[var(--muted)]">Ajuste l’accent sur les flux scan/sans-code-barres.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[var(--text)]">Coach onboarding</span>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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
              <span className="text-xs text-[var(--muted)]">Affiche/masque les aides rapides.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[var(--text)]">Thème</span>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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
              <span className="text-xs text-[var(--muted)]">Persiste sur cet appareil.</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const tourKey = getTourKey(userId);
                const pendingKey = getTourPendingKey(userId);
                localStorage.removeItem(tourKey);
                localStorage.setItem(pendingKey, "1");
                pushToast?.({ message: "Visite guidée prête. Retournez sur le dashboard pour la relancer.", type: "success" });
              }}
            >
              Relancer la visite guidée
            </Button>
          </div>
        </Card>

        {/* Services & modules (inchangé sur le fond) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Services & modules</div>
              <div className="text-sm text-[var(--muted)]">
                Activez les modules métier : ils pilotent les champs visibles dans Produits, Inventaire et Exports.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <div className="text-sm font-semibold text-[var(--text)]">Regrouper ou séparer vos services</div>
            <div className="text-xs text-[var(--muted)]">
              Ce choix organise la navigation et les tableaux de bord (vue globale ou vue par service).
            </div>

            {hasMultiServices ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant={isAllServices ? "primary" : "secondary"} size="sm" onClick={() => selectService("all")}>
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
                    <span className="text-xs font-semibold text-[var(--muted)]">Service par défaut</span>
                    <select
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
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

                <div className="text-xs text-[var(--muted)]">Vous pourrez toujours basculer depuis la barre supérieure.</div>
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">Ajoutez un 2e service pour activer le regroupement multi-services.</div>
            )}
          </div>

          {/* ✅ MAJ : ajout service + type */}
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <Input
              label="Nouveau service"
              placeholder="Ex. Bar"
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
            />

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-[var(--text)]">Type</span>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
                value={newServiceType}
                onChange={(e) => setNewServiceType(e.target.value)}
              >
                <option value="grocery_food">Épicerie alimentaire</option>
                <option value="bulk_food">Vrac</option>
                <option value="bar">Bar</option>
                <option value="kitchen">Cuisine / Restaurant</option>
                <option value="bakery">Boulangerie / Pâtisserie</option>
                <option value="restaurant_dining">Salle / Restaurant</option>
                <option value="retail_general">Boutique non-alimentaire</option>
                <option value="pharmacy_parapharmacy">Pharmacie / Parapharmacie</option>
                <option value="other">Autre</option>
              </select>
            </label>

            <Button onClick={addService} loading={loading}>
              Ajouter
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {(services || []).map((s) => {
              const features = s.features || {};
              const serviceType = s.service_type;
              const familyIdResolved = resolveFamilyId(serviceType, tenant?.domain);
              const familyMetaResolved = FAMILLES.find((f) => f.id === familyIdResolved) ?? FAMILLES[0];
              const modulesResolved = familyMetaResolved?.modules || [];
              const moduleNames = modulesResolved.map((id) => moduleLookup[id]?.name || id);
              const identifiers = familyMetaResolved?.identifiers || {};
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

              const hasModule = (id) => modulesResolved.includes(id);

              return (
                <Card key={s.id} className="p-4 space-y-3" hover>
                  <div className="space-y-1">
                    <div className="font-semibold text-[var(--text)]">{s.name}</div>
                    <div className="text-xs text-[var(--muted)]">Métier : {familyMetaResolved?.name || "—"}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Modules recommandés : {moduleNames.length ? moduleNames.join(", ") : "Base"}
                    </div>
                  </div>

                  <Divider />

                  <div className="space-y-3 text-sm">
                    {hasModule("identifier") && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Identifiants</div>

                        <FeatureToggle
                          label={wording?.barcodeLabel || "Code-barres"}
                          description="Scan rapide pour retrouver un article et éviter les doublons."
                          helper={`Recommandé : ${recBarcode ? "activé" : "désactivé"} pour ${
                            familyMetaResolved?.name || "ce métier"
                          }.`}
                          checked={features.barcode?.enabled !== false}
                          onChange={(e) => toggleFeature(s, "barcode", e.target.checked)}
                          disabled={loading}
                        />

                        <FeatureToggle
                          label={wording?.skuLabel || "SKU interne"}
                          description="Référence interne stable pour garder un catalogue propre."
                          helper={`Recommandé : ${recSku ? "activé" : "désactivé"} pour ${
                            familyMetaResolved?.name || "ce métier"
                          }.`}
                          checked={features.sku?.enabled !== false}
                          onChange={(e) => toggleFeature(s, "sku", e.target.checked)}
                          disabled={loading}
                        />

                        <Button variant="ghost" size="sm" onClick={() => applyIdentifierDefaults(s, identifiers)} disabled={loading}>
                          Appliquer la recommandation métier
                        </Button>
                      </div>
                    )}

                    {hasModule("pricing") && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pricing & TVA</div>

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

                        <div className="text-xs text-[var(--muted)]">Sans prix de vente, la marge estimée reste indicative.</div>
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

        {/* ✅ Delete account (robuste) */}
        <Card className="p-6 space-y-3 border-red-200/70 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="text-sm font-semibold text-red-800 dark:text-red-200">Suppression du compte</div>
          <div className="text-sm text-red-800 dark:text-red-200">
            Cette action est définitive. Si vous êtes le seul membre du commerce, le tenant et ses données seront supprimés.
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-red-900 dark:text-red-200">
              <input
                type="checkbox"
                className="mt-1 accent-red-600"
                checked={confirmA}
                onChange={(e) => setConfirmA(e.target.checked)}
              />
              <span>Je comprends que mes données, services et abonnements associés peuvent être supprimés.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-red-900 dark:text-red-200">
              <input
                type="checkbox"
                className="mt-1 accent-red-600"
                checked={confirmB}
                onChange={(e) => setConfirmB(e.target.checked)}
              />
              <span>Action irréversible : je devrai recréer un compte et me réabonner pour utiliser StockScan.</span>
            </label>
          </div>

          <Input
            label='Tapez "SUPPRIMER" pour confirmer'
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            helper="Protection anti-clic accidentel."
          />

          <div className="flex gap-3">
            <Button
              variant="danger"
              disabled={!confirmA || !confirmB || String(deletePhrase || "").trim().toUpperCase() !== "SUPPRIMER" || deleting}
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