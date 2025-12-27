import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import useEntitlements from "../app/useEntitlements";
import { useAuth } from "../app/AuthProvider";
import { FAMILLES, MODULES, resolveFamilyId } from "../lib/famillesConfig";

const severityClass = (sev) => {
  switch (sev) {
    case "critical":
      return "bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]";
    case "warning":
      return "bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]";
    default:
      return "bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-border)]";
  }
};

const SUGGESTIONS = [
  "Quels modules dois-je activer pour mon métier ?",
  "Où sont mes pertes les plus importantes ?",
  "Comment améliorer mes catégories et éviter les doublons ?",
  "Peux-tu résumer mon stock du mois ?",
];

export default function AIAssistantPanel({ month, serviceId }) {
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();
  const { serviceProfile, services, tenant } = useAuth();

  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const [attempted, setAttempted] = useState(false);

  const [data, setData] = useState({
    message: "Posez une question ou lancez une analyse pour obtenir des conseils.",
    insights: [],
    suggested_actions: [],
    question: null,
  });

  const timerRef = useRef(null);

  const entLoaded = entitlements !== null;
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const planEffective = entitlements?.plan_effective;
  const aiModeLabel = planEffective === "BOUTIQUE" ? "IA light" : planEffective === "PRO" ? "IA complet" : null;

  // UX soft : autorisé tant que les entitlements ne sont pas chargés (évite un flash paywall)
  const canUseAI = !entLoaded || aiAllowed;

  const currentService = useMemo(() => {
    if (!services?.length) return null;
    if (!serviceId || serviceId === "all") return null;
    return services.find((s) => String(s.id) === String(serviceId)) || null;
  }, [serviceId, services]);

  const serviceType = serviceProfile?.service_type || currentService?.service_type || "other";
  const tenantDomain = tenant?.domain || "food";
  const serviceDomain = serviceType === "retail_general" ? "general" : tenantDomain;

  const familyId = resolveFamilyId(serviceType, serviceDomain);
  const familyMeta = FAMILLES.find((f) => f.id === familyId) ?? FAMILLES[0];

  const moduleMap = useMemo(() => {
    const acc = {};
    for (const mod of MODULES) acc[mod.id] = mod;
    return acc;
  }, []);

  const serviceFeatures = serviceProfile?.features || currentService?.features || {};

  const isModuleActive = useCallback(
    (moduleId) => {
      switch (moduleId) {
        case "identifier":
          return serviceFeatures?.barcode?.enabled !== false || serviceFeatures?.sku?.enabled !== false;
        case "pricing":
          return (
            serviceFeatures?.prices?.purchase_enabled !== false ||
            serviceFeatures?.prices?.selling_enabled !== false
          );
        case "expiry":
          return serviceFeatures?.dlc?.enabled === true;
        case "lot":
          return serviceFeatures?.lot?.enabled === true;
        case "opened":
          return serviceFeatures?.open_container_tracking?.enabled === true;
        case "variants":
          return serviceFeatures?.variants?.enabled === true;
        case "multiUnit":
          return serviceFeatures?.multi_unit?.enabled === true;
        case "itemType":
          return serviceFeatures?.item_type?.enabled === true;
        default:
          return false;
      }
    },
    [serviceFeatures]
  );

  const recommendedModules = familyMeta?.modules || [];
  const inactiveRecommended = recommendedModules.filter((id) => !isModuleActive(id));

  const showNotice = useCallback((message) => {
    setNotice(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setNotice(""), 9000);
  }, []);

  const basePayload = useMemo(
    () => ({
      scope: "inventory",
      period_start: month,
      period_end: month,
      filters: { service: serviceId, month },
    }),
    [month, serviceId]
  );

  const runAssistant = useCallback(
    async (userQuestion) => {
      if (!serviceId) {
        showNotice("Sélectionnez un service avant d’utiliser l’assistant.");
        return;
      }

      setAttempted(true);

      // Si entitlements chargés et IA interdite => paywall immédiat côté front
      if (!canUseAI) {
        showNotice("Cette fonctionnalité est disponible avec le plan Multi.");
        setData((prev) => ({
          ...prev,
          message: "Plan Multi requis pour utiliser l’assistant IA.",
          insights: [
            {
              title: "Accès limité",
              description:
                "Passez au plan Multi pour activer l’assistant IA et obtenir des conseils basés sur vos données.",
              severity: "warning",
            },
          ],
          suggested_actions: [],
          question: null,
        }));
        return;
      }

      setLoading(true);
      setNotice("");

      try {
        const resp = await api.post("/api/ai/assistant/", {
          ...basePayload,
          question: userQuestion || undefined,
        });

        const payload = resp?.data || {};

        // ✅ Backend “soft paywall” / IA désactivée => pas d’erreur, mais enabled=false
        if (payload?.enabled === false) {
          showNotice(payload?.message || "Cette fonctionnalité nécessite le plan Multi.");
          setData({
            message: payload?.message || "Plan Multi requis pour utiliser l’assistant IA.",
            insights: payload?.insights || [],
            suggested_actions: payload?.suggested_actions || [],
            question: payload?.question ?? null,
          });
          if (userQuestion) setQuestion("");
          return;
        }

        setData(payload);
        if (userQuestion) setQuestion("");
      } catch (e) {
        const apiMsg = e?.friendlyMessage || e?.response?.data?.detail || e?.message;

        const code = e?.response?.data?.code;
        if (e?.response?.status === 403 && (code === "FEATURE_NOT_INCLUDED" || code?.startsWith?.("LIMIT_"))) {
          const isLimit = code === "LIMIT_AI_REQUESTS_MONTH";
          const message = isLimit
            ? "Quota IA mensuel atteint. Passez au plan Multi pour continuer."
            : "Plan Multi requis pour utiliser l’assistant IA.";
          showNotice(message);
          setData((prev) => ({
            ...prev,
            message,
            insights: [
              {
                title: isLimit ? "Quota atteint" : "Plan requis",
                description: isLimit
                  ? "Votre quota IA mensuel est atteint. Passez au plan Multi pour plus de requêtes."
                  : "Passez au plan Multi pour activer l’assistant IA.",
                severity: "warning",
              },
            ],
            suggested_actions: [],
            question: null,
          }));
        } else {
          showNotice(apiMsg || "L’assistant n’est pas disponible pour le moment. Réessayez dans quelques secondes.");
          pushToast?.({ message: "Assistant IA indisponible.", type: "error" });
        }
      } finally {
        setLoading(false);
      }
    },
    [basePayload, canUseAI, pushToast, serviceId, showNotice]
  );

  const handleAsk = () => {
    const trimmed = question.trim();
    if (!trimmed) {
      showNotice("Écrivez une question pour démarrer.");
      return;
    }
    runAssistant(trimmed);
  };

  const handleAnalyze = () => runAssistant("");

  const handleAction = async (action) => {
    if (action?.requires_confirmation) {
      const ok = window.confirm(action.label || "Confirmer l'action ?");
      if (!ok) return;
    }
    try {
      await api.request({
        url: action.endpoint,
        method: (action.method || "POST").toLowerCase(),
        data: action.payload || {},
      });
      pushToast?.({ message: "Action appliquée.", type: "success" });
      runAssistant("");
    } catch (e) {
      pushToast?.({ message: e?.friendlyMessage || "Impossible d'exécuter cette action.", type: "error" });
    }
  };

  const disabledBecauseNoService = !serviceId;
  const disabledBecausePaywall = entLoaded && !aiAllowed;

  return (
    <Card className="p-5 space-y-4" data-tour="tour-ai">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Assistant IA</div>
          <div className="text-lg font-bold text-[var(--text)]">Coach d’usage</div>
          <div className="text-xs text-[var(--muted)]">Conseils basés sur vos données (mois/service sélectionné).</div>
        </div>

        <div className="flex items-center gap-2">
          {disabledBecausePaywall && attempted ? (
            <Badge className="bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]">
              Plan Multi
            </Badge>
          ) : null}
          {aiModeLabel && !disabledBecausePaywall ? (
            <Badge className="bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-border)]">
              {aiModeLabel}
            </Badge>
          ) : null}

          <Button
            size="sm"
            onClick={handleAnalyze}
            loading={loading}
            disabled={loading || disabledBecauseNoService || disabledBecausePaywall}
          >
            Analyser
          </Button>
        </div>
      </div>

      {/* message principal */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed">
        <div className="whitespace-pre-wrap text-[var(--text)]">{data?.message}</div>
      </div>

      {/* question (warning) */}
      {data?.question ? (
        <div className="rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn-text)]">
          Question : {data.question}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--text)]">Questions rapides</div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((prompt) => (
            <Button
              key={prompt}
              size="sm"
              variant="secondary"
              onClick={() => {
                setQuestion(prompt);
                runAssistant(prompt);
              }}
              disabled={loading || disabledBecauseNoService || disabledBecausePaywall}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* zone saisie */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <textarea
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            placeholder="Posez une question précise (ex : quels produits sont à risque ?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading || disabledBecausePaywall}
          />
          <div className="flex items-center justify-between pt-2 text-xs text-[var(--muted)]">
            <span>{disabledBecausePaywall ? "Disponible avec le plan Multi." : "Réponses basées sur vos données."}</span>
            <Button
              size="sm"
              onClick={handleAsk}
              loading={loading}
              disabled={loading || disabledBecauseNoService || disabledBecausePaywall}
            >
              Envoyer
            </Button>
          </div>
        </div>

        {/* notice (info) */}
        {notice ? (
          <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
            {notice}
          </div>
        ) : null}

        {/* modules conseillés */}
        {!!recommendedModules.length ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-2">
            <div className="text-sm font-semibold text-[var(--text)]">
              Modules conseillés pour {familyMeta?.name || "votre métier"}
            </div>

            <div className="flex flex-wrap gap-2">
              {recommendedModules.map((modId) => (
                <Badge
                  key={modId}
                  className={
                    inactiveRecommended.includes(modId)
                      ? "bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]"
                      : "bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]"
                  }
                >
                  {moduleMap[modId]?.name || modId}
                </Badge>
              ))}
            </div>

            {inactiveRecommended.length ? (
              <div className="text-xs text-[var(--muted)]">Active les modules en attente pour débloquer tous les champs utiles.</div>
            ) : (
              <div className="text-xs text-[var(--muted)]">Tous les modules recommandés sont actifs ✅</div>
            )}

            <Button as={Link} to="/app/settings" size="sm" variant="secondary">
              Ouvrir Paramètres → Modules
            </Button>
          </div>
        ) : null}
      </div>

      {/* insights */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--text)]">Insights</div>
        {data?.insights?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {data.insights.map((ins, idx) => (
              <Card key={idx} className="p-4 space-y-1" hover>
                <Badge className={severityClass(ins.severity || "info")}>{ins.severity || "info"}</Badge>
                <div className="text-sm font-semibold text-[var(--text)]">{ins.title}</div>
                <div className="text-sm text-[var(--muted)]">{ins.description}</div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">Aucun insight pour le moment.</div>
        )}
      </div>

      {/* actions */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--text)]">Actions suggérées</div>
        {data?.suggested_actions?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.suggested_actions.map((act, idx) => (
              <Button
                key={idx}
                variant={act.requires_confirmation ? "secondary" : "primary"}
                onClick={() => handleAction(act)}
                disabled={loading}
              >
                {act.label || "Action"}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">Aucune action proposée.</div>
        )}
      </div>
    </Card>
  );
}
