import React, { useCallback, useEffect, useState } from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useToast } from "../app/ToastContext";

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

export default function AIAssistantPanel({ month, serviceId }) {
  const pushToast = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    message: "Lancer une analyse pour obtenir des insights.",
    insights: [],
    suggested_actions: [],
    question: null,
  });

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.post("/api/ai/assistant/", {
        scope: "inventory",
        period_start: month,
        period_end: month,
        filters: { service: serviceId, month },
      });
      setData(resp.data || {});
    } catch (e) {
      pushToast?.({ message: "Assistant indisponible pour le moment.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [month, serviceId, pushToast]);

  useEffect(() => {
    // Auto-load on mount
    analyze();
  }, [analyze]);

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
      analyze();
    } catch (e) {
      pushToast?.({ message: "Impossible d'exécuter cette action.", type: "error" });
    }
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Assistant IA</div>
          <div className="text-lg font-bold">Analyse proactive</div>
        </div>
        <Button size="sm" onClick={analyze} loading={loading}>
          Analyser maintenant
        </Button>
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

