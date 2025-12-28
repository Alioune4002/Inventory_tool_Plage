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

export default function Duplicates() {
  const { serviceId, services, selectService } = useAuth();
  const { data: entitlements } = useEntitlements();
  const pushToast = useToast();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mergeState, setMergeState] = useState({});

  const canUse = Boolean(entitlements?.entitlements?.anti_duplicates);

  const serviceOptions = useMemo(
    () => (services || []).map((s) => ({ value: s.id, label: s.name })),
    [services]
  );

  useEffect(() => {
    if (!groups.length) return;
    const nextState = {};
    groups.forEach((group, index) => {
      const ids = group.products.map((p) => p.id);
      const masterId = group.master_id || ids[0];
      nextState[index] = {
        masterId,
        mergeIds: ids.filter((id) => id !== masterId),
      };
    });
    setMergeState(nextState);
  }, [groups]);

  const load = async () => {
    if (!serviceId || !canUse) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/products/duplicates/?month=${month}&service=${serviceId}`);
      setGroups(res?.data?.groups || []);
    } catch (e) {
      setGroups([]);
      pushToast?.({ message: "Impossible de charger les doublons.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, month, canUse]);

  const updateMaster = (index, masterId) => {
    const ids = groups[index]?.products?.map((p) => p.id) || [];
    setMergeState((prev) => ({
      ...prev,
      [index]: {
        masterId,
        mergeIds: ids.filter((id) => id !== masterId),
      },
    }));
  };

  const toggleMerge = (index, productId) => {
    setMergeState((prev) => {
      const current = prev[index] || { masterId: null, mergeIds: [] };
      if (current.masterId === productId) return prev;
      const exists = current.mergeIds.includes(productId);
      const mergeIds = exists
        ? current.mergeIds.filter((id) => id !== productId)
        : [...current.mergeIds, productId];
      return { ...prev, [index]: { ...current, mergeIds } };
    });
  };

  const mergeGroup = async (index) => {
    const selection = mergeState[index];
    if (!selection?.masterId || !selection.mergeIds?.length) {
      pushToast?.({ message: "Sélectionne au moins un doublon à fusionner.", type: "warn" });
      return;
    }
    const confirmMerge = window.confirm(
      "Confirmer la fusion ? Les doublons seront archivés et l’historique déplacé."
    );
    if (!confirmMerge) return;

    try {
      setLoading(true);
      await api.post("/api/products/merge/", {
        master_id: selection.masterId,
        merge_ids: selection.mergeIds,
      });
      setGroups((prev) => prev.filter((_, idx) => idx !== index));
      pushToast?.({ message: "Fusion effectuée.", type: "success" });
    } catch (e) {
      pushToast?.({ message: "Fusion impossible. Vérifie les droits et le mois.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Doublons | StockScan</title>
        <meta name="description" content="Détecter et fusionner les doublons produits." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 space-y-2">
          <div className="text-sm text-[var(--muted)]">Qualité catalogue</div>
          <h1 className="text-2xl font-black text-[var(--text)]">Doublons produits</h1>
          <p className="text-sm text-[var(--muted)]">
            Identifie les doublons (nom, SKU, code-barres) et fusionne-les en toute sécurité.
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
                    ariaLabel="Sélectionner un service"
                  />
                )}
                <Button className="mt-5 md:mt-0" onClick={load} loading={loading}>
                  Rafraîchir
                </Button>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 w-full" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun doublon détecté pour ce mois.</div>
              ) : (
                <div className="space-y-4">
                  {groups.map((group, index) => {
                    const selection = mergeState[index] || {};
                    return (
                      <div key={`${group.type}-${group.key}-${index}`} className="rounded-2xl border border-[var(--border)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">
                              {group.type === "name_fuzzy"
                                ? "Doublon probable"
                                : group.type === "name"
                                ? "Doublon de nom"
                                : group.type === "sku"
                                ? "Doublon de SKU"
                                : "Doublon de code-barres"}
                            </div>
                            <div className="text-xs text-[var(--muted)] break-anywhere">{group.key}</div>
                          </div>
                          <Button size="sm" onClick={() => mergeGroup(index)} disabled={loading}>
                            Fusionner
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {group.products.map((product) => (
                            <div
                              key={product.id}
                              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                            >
                              <input
                                type="radio"
                                name={`master-${index}`}
                                checked={selection.masterId === product.id}
                                onChange={() => updateMaster(index, product.id)}
                                className="h-4 w-4 accent-[var(--primary)]"
                              />
                              <input
                                type="checkbox"
                                checked={selection.mergeIds?.includes(product.id)}
                                onChange={() => toggleMerge(index, product.id)}
                                className="h-4 w-4 accent-[var(--primary)]"
                                disabled={selection.masterId === product.id}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-[var(--text)] truncate">{product.name}</div>
                                <div className="text-xs text-[var(--muted)]">
                                  {product.barcode || product.internal_sku || "—"} · {product.inventory_month}
                                </div>
                              </div>
                              <div className="text-xs text-[var(--muted)]">Qté: {product.quantity ?? 0}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </PageTransition>
  );
}
