import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";
import useEntitlements from "../app/useEntitlements";

export default function AIAssistantPanel({ month, serviceId, scope = "inventory", allowNoService = false }) {
  const pushToast = useToast();
  const { data: entitlements } = useEntitlements();

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempted, setAttempted] = useState(false);

  const initial =
    scope === "support"
      ? "Décrivez un blocage : je vous guide étape par étape."
      : "Je peux analyser votre stock et vous donner des priorités claires.";

  const [data, setData] = useState({
    analysis: initial,
    watch_items: [],
    actions: [],
    message: initial,
    insights: [],
    suggested_actions: [],
    question: null,
  });

  const timerRef = useRef(null);

  const entLoaded = entitlements !== null;
  const aiAllowed = entitlements?.entitlements?.ai_assistant_basic === true;
  const planEffective = entitlements?.plan_effective;
  const aiModeLabel = planEffective === "BOUTIQUE" ? "IA light" : planEffective === "PRO" ? "IA coach" : null;

  const canUseAI = !entLoaded || aiAllowed;

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
    if (allowNoService && !serviceId) payload.filters = { service: "all", month };
    return payload;
  }, [allowNoService, month, scope, serviceId]);

  const disabledBecauseNoService = !serviceId && !allowNoService;
  const disabledBecausePaywall = entLoaded && !aiAllowed;

  const openChat = () => {
    const sid = allowNoService && !serviceId ? "all" : serviceId;
    window.dispatchEvent(
      new CustomEvent("stockscan:ai:open", {
        detail: { month, serviceId: sid || "all", scope, resetThread: false },
      })
    );
  };

  const runAssistant = useCallback(async () => {
    if (!serviceId && !allowNoService) {
      showNotice("Sélectionnez un service avant d’analyser.");
      return;
    }

    setAttempted(true);

    if (!canUseAI) {
      showNotice("Cette fonctionnalité est disponible avec les plans Duo ou Multi.");
      setData({
        analysis: "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
        watch_items: ["Passez à Duo ou Multi pour activer l’assistant et obtenir des analyses contextualisées."],
        actions: [{ label: "Voir les offres", type: "link", href: "/tarifs" }],
        message: "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
        insights: [],
        suggested_actions: [],
        question: null,
      });
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const resp = await api.post("/api/ai/assistant/", {
        ...basePayload,
        question: undefined,
      });

      const payload = resp?.data || {};

      if (payload?.enabled === false) {
        showNotice(payload?.message || "Cette fonctionnalité nécessite le plan Duo ou Multi.");
        setData({
          analysis: payload?.message || "Plan Duo ou Multi requis pour utiliser l’assistant IA.",
          watch_items: payload?.watch_items || [],
          actions: payload?.actions || [{ label: "Voir les offres", type: "link", href: "/tarifs" }],
          message: payload?.message || "Plan Duo ou Multi requis.",
          insights: payload?.insights || [],
          suggested_actions: payload?.suggested_actions || [],
          question: payload?.question ?? null,
        });
        return;
      }

      setData(payload);
    } catch (e) {
      const apiMsg = e?.friendlyMessage || e?.response?.data?.detail || e?.message;

      const code = e?.response?.data?.code;
      if (e?.response?.status === 403 && (code === "FEATURE_NOT_INCLUDED" || code?.startsWith?.("LIMIT_"))) {
        const isWeekLimit = code === "LIMIT_AI_REQUESTS_WEEK";
        const isMonthLimit = code === "LIMIT_AI_REQUESTS_MONTH";
        const message = isWeekLimit
          ? "Quota IA hebdomadaire atteint. Passez au plan Multi pour continuer."
          : isMonthLimit
          ? "Quota IA mensuel atteint. Passez au plan Multi pour continuer."
          : "Plan Duo ou Multi requis pour utiliser l’assistant IA.";
        showNotice(message);
        setData({
          analysis: message,
          watch_items: [
            isWeekLimit
              ? "Votre quota hebdomadaire est atteint."
              : isMonthLimit
              ? "Votre quota mensuel est atteint."
              : "Passez à Duo ou Multi pour activer l’assistant.",
          ],
          actions: [{ label: "Voir les offres", type: "link", href: "/tarifs" }],
          message,
          insights: [],
          suggested_actions: [],
          question: null,
        });
      } else {
        showNotice(apiMsg || "L’assistant n’est pas disponible pour le moment.");
        pushToast?.({ message: "Assistant IA indisponible.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }, [allowNoService, basePayload, canUseAI, pushToast, serviceId, showNotice]);

  const analysisText = data?.analysis || data?.message || initial;

  const watchItems = useMemo(() => {
    const w = Array.isArray(data?.watch_items) ? data.watch_items : [];
    if (w.length) return w.slice(0, 2);
    const ins = Array.isArray(data?.insights) ? data.insights : [];
    return ins
      .map((x) => `${x?.title || ""}${x?.description ? ` — ${x.description}` : ""}`.trim())
      .filter(Boolean)
      .slice(0, 2);
  }, [data]);

  const actions = useMemo(() => {
    const out = [];
    const a = Array.isArray(data?.actions) ? data.actions : [];
    for (const act of a) {
      if (!act?.label) continue;
      out.push({ label: act.label, href: act.href || null, type: act.type || (act.href ? "link" : "info") });
    }
    return out.slice(0, 2);
  }, [data]);

  return (
    <Card className="p-5 space-y-4" data-tour="tour-ai-mini">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Assistant IA</div>
          <div className="text-lg font-black text-[var(--text)] leading-tight">Coach</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            {scope === "support"
              ? "Support guidé : exports, scan, facturation, configuration."
              : "Analyse stock & pertes, priorités et prochaines actions."}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {disabledBecausePaywall && attempted ? (
            <Badge className="bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]">
              Duo / Multi
            </Badge>
          ) : null}

          {aiModeLabel && !disabledBecausePaywall ? (
            <Badge className="bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-border)]">
              {aiModeLabel}
            </Badge>
          ) : null}

          <Button
            size="sm"
            onClick={runAssistant}
            loading={loading}
            disabled={loading || disabledBecauseNoService || disabledBecausePaywall}
          >
            Analyser
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={openChat}
            disabled={disabledBecauseNoService}
            title="Ouvrir le chat"
          >
            Ouvrir le chat
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 space-y-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Diagnostic</div>
          <div className="text-sm leading-relaxed text-[var(--text)]">{analysisText}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">À surveiller</div>
          {watchItems.length ? (
            <ul className="text-sm text-[var(--text)] list-disc pl-4 space-y-1">
              {watchItems.map((x, idx) => (
                <li key={`${x}-${idx}`}>{x}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-[var(--muted)]">Rien d’urgent à signaler pour l’instant.</div>
          )}
        </div>

        {actions.length ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Actions rapides</div>
            <div className="flex flex-wrap gap-2">
              {actions.map((a, idx) =>
                a.href ? (
                  <Button key={`${a.label}-${idx}`} as={Link} to={a.href} size="sm" variant="secondary">
                    {a.label}
                  </Button>
                ) : (
                  <Badge key={`${a.label}-${idx}`} variant="neutral">
                    {a.label}
                  </Badge>
                )
              )}
            </div>
          </div>
        ) : null}

        {data?.question ? (
          <div className="rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]">
            Pour affiner : {data.question}
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
          {notice}
        </div>
      ) : null}

      {disabledBecauseNoService ? (
        <div className="text-xs text-[var(--muted)]">
          Astuce : sélectionnez un service en haut pour obtenir une analyse fiable.
        </div>
      ) : null}

      {disabledBecausePaywall && entLoaded ? (
        <div className="text-xs text-[var(--muted)]">
          Disponible avec les plans Duo ou Multi —{" "}
          <Link className="underline font-semibold text-[var(--text)]" to="/tarifs">
            voir les offres
          </Link>
          .
        </div>
      ) : null}
    </Card>
  );
}