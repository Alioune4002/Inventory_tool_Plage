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

const SUGGESTIONS = [
  "Peux-tu me résumer mon stock ce mois-ci ?",
  "Où sont mes pertes les plus importantes ?",
  "Quels produits risquent d’être en rupture ?",
  "Quels modules dois-je activer pour mon métier ?",
  "Qu’est-ce que je dois prioriser maintenant ?",
  "Ai-je des données manquantes qui bloquent les analyses ?",
];

const SUPPORT_SUGGESTIONS = [
  "Pourquoi j'ai une erreur 403 sur un export ?",
  "Comment exporter en Excel ?",
  "Comment activer l'IA (Duo/Multi) ?",
  "Le scan code-barres ne marche pas, que faire ?",
];

export default function AIAssistantPanel({ month, serviceId, scope = "inventory", allowNoService = false }) {
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();
  const { serviceProfile, services, tenant } = useAuth();

  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const initialMessage =
    scope === "support"
      ? "Décrivez votre problème, je vous guide pas à pas."
      : "Décrivez votre besoin, je vous donne un diagnostic clair et des actions concrètes.";
  const [data, setData] = useState({
    analysis: initialMessage,
    watch_items: [],
    actions: [],
    message: initialMessage,
    insights: [],
    suggested_actions: [],
    question: null,
  });

  const timerRef = useRef(null);

  const entLoaded = entitlements !== null;
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const planEffective = entitlements?.plan_effective;
  const aiModeLabel = planEffective === "BOUTIQUE" ? "IA light" : planEffective === "PRO" ? "IA coach" : null;

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

  const basePayload = useMemo(() => {
    const payload = {
      scope,
      period_start: month,
      period_end: month,
      filters: { service: serviceId, month },
    };
    if (allowNoService && !serviceId) {
      payload.filters = { service: "all", month };
    }
    return payload;
  }, [allowNoService, month, scope, serviceId]);

  const runAssistant = useCallback(
    async (userQuestion) => {
      if (!serviceId && !allowNoService) {
        showNotice("Sélectionnez un service avant d’utiliser l’assistant.");
        return;
      }

      setAttempted(true);

      // Si entitlements chargés et IA interdite => paywall immédiat côté front
      if (!canUseAI) {
        showNotice("Cette fonctionnalité est disponible avec les plans Duo ou Multi.");
        setData((prev) => ({
          ...prev,
          analysis: "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
          watch_items: [
            "Passez à Duo ou Multi pour activer l’assistant IA et obtenir des conseils contextualisés.",
          ],
          actions: [{ label: "Voir les plans", type: "link", href: "/tarifs" }],
          message: "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
          insights: [],
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
          showNotice(payload?.message || "Cette fonctionnalité nécessite le plan Duo ou Multi.");
          setData({
            message: payload?.message || "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
            insights: payload?.insights || [],
            suggested_actions: payload?.suggested_actions || [],
            question: payload?.question ?? null,
          });
          if (userQuestion) setQuestion("");
          return;
        }

        setData(payload);
        setShowSuggestions(false);
        if (userQuestion) setQuestion("");
      } catch (e) {
        const apiMsg = e?.friendlyMessage || e?.response?.data?.detail || e?.message;

        const code = e?.response?.data?.code;
        if (e?.response?.status === 403 && (code === "FEATURE_NOT_INCLUDED" || code?.startsWith?.("LIMIT_"))) {
          const isWeekLimit = code === "LIMIT_AI_REQUESTS_WEEK";
          const isMonthLimit = code === "LIMIT_AI_REQUESTS_MONTH";
          const isLimit = isWeekLimit || isMonthLimit;
          const message =
            isWeekLimit
              ? "Quota IA hebdomadaire atteint. Passez au plan Multi pour continuer."
              : isMonthLimit
              ? "Quota IA mensuel atteint. Passez au plan Multi pour continuer."
              : "Plan Duo ou Multi requis pour utiliser l’assistant IA.";
          showNotice(message);
          setData((prev) => ({
            ...prev,
            analysis: message,
            watch_items: [
              isWeekLimit
                ? "Votre quota IA hebdomadaire est atteint."
                : isMonthLimit
                ? "Votre quota IA mensuel est atteint."
                : "Passez à Duo ou Multi pour activer l’assistant.",
            ],
            actions: [{ label: "Voir les plans", type: "link", href: "/tarifs" }],
            message,
            insights: [],
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
    [allowNoService, basePayload, canUseAI, pushToast, serviceId, showNotice]
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

  const disabledBecauseNoService = !serviceId && !allowNoService;
  const disabledBecausePaywall = entLoaded && !aiAllowed;
  const suggestions = scope === "support" ? SUPPORT_SUGGESTIONS : SUGGESTIONS;
  const inputPlaceholder =
    scope === "support"
      ? "Posez une question sur l'app (exports, scan, facturation)"
      : "Posez une question précise (ex : quels produits sont à risque ?)";

  const analysisText = data?.analysis || data?.message || initialMessage;
  const watchItems = Array.isArray(data?.watch_items) && data.watch_items.length
    ? data.watch_items
    : (data?.insights || []).map((ins) => `${ins?.title || ""}${ins?.description ? ` — ${ins.description}` : ""}`.trim());

  const mergedActions = useMemo(() => {
    const list = [];
    if (Array.isArray(data?.actions)) {
      list.push(
        ...data.actions.map((act) => ({
          label: act?.label || "",
          type: act?.type || (act?.href ? "link" : "info"),
          href: act?.href || null,
        }))
      );
    }
    if (Array.isArray(data?.suggested_actions)) {
      list.push(
        ...data.suggested_actions.map((act) => ({
          label: act?.label || "Action",
          endpoint: act?.endpoint,
          method: act?.method,
          payload: act?.payload,
          requires_confirmation: act?.requires_confirmation,
        }))
      );
    }
    return list.filter((act) => act.label).slice(0, 4);
  }, [data]);

  return (
    <Card className="p-5 space-y-4" data-tour="tour-ai">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Assistant IA</div>
          <div className="text-lg font-bold text-[var(--text)]">Coach IA</div>
          <div className="text-xs text-[var(--muted)]">
            {scope === "support"
              ? "Conseils sur l'app, les exports, le scan et la facturation."
              : "Conseils basés sur vos données (mois/service sélectionné)."}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {disabledBecausePaywall && attempted ? (
            <Badge className="bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]">
              Plan Duo / Multi
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

      {/* carte IA structurée */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 space-y-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Analyse rapide</div>
          <div className="text-sm leading-relaxed text-[var(--text)]">{analysisText}</div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Ce qu’il faut surveiller</div>
          {watchItems?.length ? (
            <ul className="space-y-1 text-sm text-[var(--text)] list-disc pl-4">
              {watchItems.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-[var(--muted)]">Rien de critique à signaler pour le moment.</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Actions recommandées</div>
          {mergedActions.length ? (
            <ol className="space-y-2 text-sm text-[var(--text)] list-decimal pl-4">
              {mergedActions.map((act, idx) => (
                <li key={`${act.label}-${idx}`} className="flex flex-wrap items-center gap-2">
                  <span>{act.label}</span>
                  {act.href ? (
                    <Button as={Link} to={act.href} size="sm" variant="secondary">
                      Ouvrir
                    </Button>
                  ) : act.endpoint ? (
                    <Button size="sm" variant="secondary" onClick={() => handleAction(act)}>
                      Appliquer
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm text-[var(--muted)]">Aucune action urgente pour l’instant.</div>
          )}
        </div>

        {data?.question ? (
          <div className="rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]">
            Pour affiner : {data.question}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-[var(--text)]">Questions rapides</div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSuggestions((prev) => !prev)}
          >
            {showSuggestions ? "Masquer" : "Afficher"}
          </Button>
        </div>

        {showSuggestions ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((prompt) => (
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
        ) : null}

        {/* zone saisie */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <textarea
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            placeholder={inputPlaceholder}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading || disabledBecausePaywall}
          />
          <div className="flex items-center justify-between pt-2 text-xs text-[var(--muted)]">
            <span>
              {disabledBecausePaywall
                ? "Disponible avec les plans Duo ou Multi."
                : scope === "support"
                ? "Réponses basées sur votre contexte StockScan."
                : "Réponses basées sur vos données."}
            </span>
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

    </Card>
  );
}
