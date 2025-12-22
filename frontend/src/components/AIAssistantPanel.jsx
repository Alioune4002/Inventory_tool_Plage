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
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-100";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100";
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100";
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
  const moduleMap = useMemo(() => MODULES.reduce((acc, mod) => ({ ...acc, [mod.id]: mod }), {}), []);
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
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setNotice("");
    }, 10000);
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
        showNotice("Sélectionnez un service avant d’interroger l’assistant.");
        return;
      }
      setAttempted(true);
      if (!canUseAI) {
        showNotice("Je peux t’assister pleinement avec le plan Pro. Active-le pour débloquer mes conseils.");
        return;
      }
      setLoading(true);
      setNotice("");
      try {
        const resp = await api.post("/api/ai/assistant/", {
          ...basePayload,
          question: userQuestion || undefined,
        });
        setData(resp.data || {});
        if (userQuestion) setQuestion("");
      } catch (e) {
        showNotice("Votre assistant IA est en pause clope. Réessayez dans quelques secondes.");
        pushToast?.({ message: "Assistant IA indisponible.", type: "error" });
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
    setAttempted(true);
    runAssistant(trimmed);
  };

  const handleAnalyze = () => {
    setAttempted(true);
    runAssistant("");
  };

  const handleAction = async (action) => {
    if (action.requires_confirmation) {
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
      pushToast?.({ message: "Impossible d'exécuter cette action.", type: "error" });
    }
  };

  return (
    <Card className="p-5 space-y-4" data-tour="tour-ai">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Assistant IA</div>
          <div className="text-lg font-bold">Coach d’usage</div>
        </div>
        <div className="flex items-center gap-2">
          {!canUseAI && entLoaded && attempted && (
            <Badge className="bg-amber-100 text-amber-700">Plan Pro</Badge>
          )}
          <Button size="sm" onClick={handleAnalyze} loading={loading}>
            Analyser
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800/60">
        <div className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">{data?.message}</div>
      </div>

      {data?.question && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-100">
          Question : {data.question}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-100">Questions rapides</div>
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
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
          <textarea
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            placeholder="Posez une question précise (ex: quels produits sont à risque ?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>Réponses basées sur vos données.</span>
            <Button size="sm" onClick={handleAsk} loading={loading}>
              Envoyer
            </Button>
          </div>
        </div>
        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-100">
            {notice}
          </div>
        )}

        {!!recommendedModules.length && (
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50 space-y-2">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              Modules conseillés pour {familyMeta?.name || "votre métier"}
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendedModules.map((modId) => (
                <Badge
                  key={modId}
                  className={`${
                    inactiveRecommended.includes(modId)
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                  }`}
                >
                  {moduleMap[modId]?.name || modId}
                </Badge>
              ))}
            </div>
            {inactiveRecommended.length ? (
              <div className="text-xs text-slate-500">
                Active les modules en attente pour débloquer tous les champs utiles.
              </div>
            ) : (
              <div className="text-xs text-slate-500">Tous les modules recommandés sont actifs ✅</div>
            )}
            <Button as={Link} to="/app/settings" size="sm" variant="secondary">
              Ouvrir Paramètres → Modules
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-100">Insights</div>
        {data?.insights?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {data.insights.map((ins, idx) => (
              <Card key={idx} className="p-4 space-y-1" hover>
                <Badge className={severityClass(ins.severity || "info")}>{ins.severity || "info"}</Badge>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ins.title}</div>
                <div className="text-sm text-slate-600 dark:text-slate-200">{ins.description}</div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Aucun insight pour le moment.</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-100">Actions suggérées</div>
        {data?.suggested_actions?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.suggested_actions.map((act, idx) => (
              <Button key={idx} variant={act.requires_confirmation ? "secondary" : "primary"} onClick={() => handleAction(act)}>
                {act.label || "Action"}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Aucune action proposée.</div>
        )}
      </div>
    </Card>
  );
}
