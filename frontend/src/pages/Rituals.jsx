import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Select from "../ui/Select";
import Input from "../ui/Input";
import Skeleton from "../ui/Skeleton";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { useEntitlements } from "../app/useEntitlements";

export default function Rituals() {
  const { serviceId, services, selectService } = useAuth();
  const { data: entitlements } = useEntitlements();
  const pushToast = useToast();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rituals, setRituals] = useState([]);
  const [loading, setLoading] = useState(false);

  const canUse = Boolean(entitlements?.entitlements?.rituals);
  const serviceOptions = useMemo(
    () => (services || []).map((s) => ({ value: s.id, label: s.name })),
    [services]
  );

  const load = async () => {
    if (!serviceId || !canUse) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rituals/?month=${month}&service=${serviceId}`);
      setRituals(res?.data?.rituals || []);
    } catch {
      setRituals([]);
      pushToast?.({ message: "Impossible de charger les rituels.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month, canUse]);

  return (
    <PageTransition>
      <Helmet>
        <title>Rituels | StockScan</title>
        <meta name="description" content="Rituels métier pour piloter votre stock." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-[var(--muted)]">Rituels métier</div>
          <h1 className="text-2xl font-black text-[var(--text)]">Rituels actionnables</h1>
          <p className="text-sm text-[var(--muted)]">
            Une checklist claire, des alertes prioritaires et des actions directes.
          </p>
        </Card>

        {!canUse ? (
          <Card className="p-6">
            <div className="text-sm text-[var(--muted)]">
              Cette fonctionnalité n’est pas incluse dans votre plan.
            </div>
            <Button className="mt-3" onClick={() => (window.location.href = "/tarifs")}>
              Voir les plans
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-6 space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <Input label="Mois" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                {services?.length > 0 && (
                  <Select
                    label="Service"
                    value={serviceId || ""}
                    onChange={(value) => selectService(value)}
                    options={serviceOptions}
                  />
                )}
                <Button className="mt-5 md:mt-0" onClick={load} loading={loading}>
                  Rafraîchir
                </Button>
              </div>
            </Card>

            <div className="grid gap-4">
              {loading ? (
                <Card className="p-6">
                  <Skeleton className="h-24 w-full" />
                </Card>
              ) : rituals.length === 0 ? (
                <Card className="p-6 text-sm text-[var(--muted)]">Aucun rituel disponible.</Card>
              ) : (
                rituals.map((ritual) => (
                  <Card key={ritual.id} className="p-6 space-y-4">
                    <div>
                      <div className="text-sm text-[var(--muted)]">{ritual.summary}</div>
                      <div className="text-lg font-semibold text-[var(--text)]">{ritual.title}</div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      {(ritual.items || []).map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
                        >
                          <div className="text-xs text-[var(--muted)]">{item.label}</div>
                          <div className="text-lg font-semibold text-[var(--text)]">{item.value ?? 0}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(ritual.actions || []).map((action) => (
                        <Button
                          key={action.label}
                          size="sm"
                          variant="secondary"
                          onClick={() => (window.location.href = action.href)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
