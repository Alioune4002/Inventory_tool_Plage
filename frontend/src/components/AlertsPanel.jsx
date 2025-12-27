import React, { useEffect, useState } from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";

const severityStyle = (severity) => {
  if (severity === "critical") return "bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]";
  if (severity === "warning") return "bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]";
  return "bg-slate-500/15 text-slate-200 border border-slate-400/30";
};

export default function AlertsPanel() {
  const { serviceId, services } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const isAllServices = services?.length > 1 && String(serviceId) === "all";

  useEffect(() => {
    if (!serviceId || isAllServices) {
      setAlerts([]);
      setError("");
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");

    api
      .get("/api/alerts/", { params: { limit: 8 } })
      .then((res) => {
        if (!alive) return;
        setAlerts(res?.data?.results || []);
      })
      .catch((e) => {
        if (!alive) return;
        const code = e?.response?.data?.code;
        if (code === "FEATURE_NOT_INCLUDED") {
          setError("Alertes stock a partir du plan Duo. Alertes dates a partir du plan Multi.");
        } else {
          setError("Impossible de charger les alertes pour le moment.");
        }
        setAlerts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [serviceId, isAllServices, refreshTick]);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Alertes</div>
          <div className="text-lg font-bold text-[var(--text)]">Stocks & dates</div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setRefreshTick((t) => t + 1)} disabled={loading}>
          Rafraichir
        </Button>
      </div>

      {isAllServices ? (
        <div className="text-sm text-[var(--muted)]">Selectionnez un service pour voir les alertes.</div>
      ) : loading ? (
        <div className="text-sm text-[var(--muted)]">Chargement des alertes...</div>
      ) : error ? (
        <div className="text-sm text-[var(--muted)]">{error}</div>
      ) : alerts.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">Aucune alerte detectee.</div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={`${alert.type}-${alert.product_id}`} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)] truncate">{alert.product_name}</div>
                <div className="text-xs text-[var(--muted)]">{alert.message}</div>
              </div>
              <Badge className={severityStyle(alert.severity)}>{alert.severity}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
