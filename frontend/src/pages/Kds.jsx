import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ChefHat, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Drawer from "../ui/Drawer";
import Select from "../ui/Select";
import Input from "../ui/Input";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { isKdsEnabled } from "../lib/kdsAccess";
import kdsLogo from "../assets/kds-logo.png";

const STATUS_LABELS = {
  SENT: "À préparer",
  READY: "Prêt",
  SERVED: "Servi",
  CANCELLED: "Annulée",
};

const CANCEL_REASONS = [
  { value: "cancelled", label: "Annulation client" },
  { value: "mistake", label: "Erreur de saisie" },
  { value: "breakage", label: "Produit cassé / perdu" },
  { value: "other", label: "Autre" },
];

const POLL_MS = 2500;

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const KdsLogo = () => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="font-black tracking-tight text-lg text-[var(--text)]">StockScan KDS</div>;
  }

  return (
    <img
      src={kdsLogo}
      alt="StockScan KDS"
      className="h-10 w-10 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

export default function Kds() {
  const { serviceId, services, serviceProfile, selectService, tenant } = useAuth();
  const pushToast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("cancelled");
  const [cancelText, setCancelText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const isReadyService = Boolean(serviceId && String(serviceId) !== "all");
  const kdsActive = isKdsEnabled(serviceProfile);

  const serviceOptions = useMemo(
    () =>
      (services || []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [services]
  );

  const fetchFeed = useCallback(async () => {
    if (!isReadyService || !kdsActive) return;
    setLoading(true);
    try {
      const res = await api.get("/api/kds/kitchen/feed");
      setOrders(res.data || []);
    } catch {
      pushToast?.({ message: "Impossible de charger le flux cuisine.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [isReadyService, kdsActive, pushToast]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    if (!isReadyService || !kdsActive) return undefined;
    const timer = window.setInterval(fetchFeed, POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchFeed, isReadyService, kdsActive]);

  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return undefined;
    const previousHref = manifestLink.getAttribute("href") || "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/kds.webmanifest");
    return () => {
      manifestLink.setAttribute("href", previousHref);
    };
  }, []);

  const sendAction = async (action, orderId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/kds/orders/${orderId}/${action}/`);
      pushToast?.({ message: "Statut mis à jour.", type: "success" });
      fetchFeed();
    } catch (error) {
      pushToast?.({
        message: error?.response?.data?.detail || "Impossible de mettre à jour la commande.",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openCancel = (order) => {
    setCancelOrder(order);
    setCancelReason("cancelled");
    setCancelText("");
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelOrder) return;
    setActionLoading(true);
    try {
      await api.post(`/api/kds/orders/${cancelOrder.id}/cancel/`, {
        reason_code: cancelReason,
        reason_text: cancelReason === "other" ? cancelText : "",
      });
      pushToast?.({ message: "Commande annulée.", type: "success" });
      setCancelOpen(false);
      setCancelOrder(null);
      fetchFeed();
    } catch (error) {
      pushToast?.({
        message: error?.response?.data?.detail || "Impossible d’annuler la commande.",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const ordersByStatus = useMemo(() => {
    const sent = [];
    const ready = [];
    orders.forEach((order) => {
      if (order.status === "READY") ready.push(order);
      else if (order.status === "SENT") sent.push(order);
    });
    return { sent, ready };
  }, [orders]);

  const serviceLabel = serviceProfile?.name || "";
  const hasCoreAccess = Boolean(tenant && (serviceProfile || services?.length));
  const coreCta = hasCoreAccess
    ? { label: "Ouvrir StockScan", href: "/app/dashboard" }
    : { label: "Activer StockScan", href: "/app/settings" };

  return (
    <PageTransition>
      <Helmet>
        <title>Cuisine | StockScan</title>
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center">
              <KdsLogo />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--muted)]">Module Cuisine</div>
              <div className="text-2xl font-black text-[var(--text)]">KDS — écran cuisine</div>
              <div className="text-sm text-[var(--muted)]">
                Toutes les commandes arrivent ici, prêtes à être préparées.
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-2">
            {serviceLabel ? (
              <div className="text-sm text-[var(--muted)]">Service actif : {serviceLabel}</div>
            ) : null}
            <Button as={Link} to={coreCta.href} size="sm" variant="secondary">
              {coreCta.label}
            </Button>
          </div>
        </Card>

        {!isReadyService ? (
          <Card className="p-6 space-y-2">
            <div className="text-lg font-semibold">Sélectionnez un service</div>
            <div className="text-sm text-[var(--muted)]">
              Le KDS nécessite un service précis. Choisissez un service dans la barre du haut.
            </div>
            {serviceOptions.length ? (
              <Select
                label="Service"
                value={serviceId}
                options={serviceOptions}
                onChange={selectService}
              />
            ) : null}
          </Card>
        ) : null}

        {isReadyService && !kdsActive ? (
          <Card className="p-6 space-y-2">
            <div className="text-lg font-semibold">Module non activé</div>
            <div className="text-sm text-[var(--muted)]">
              Activez “Commandes & Cuisine” dans Paramètres pour ce service.
            </div>
            <Button onClick={() => (window.location.href = "/app/settings")}>Ouvrir les paramètres</Button>
          </Card>
        ) : null}

        {isReadyService && kdsActive ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">À préparer</div>
                <Badge variant="info">{ordersByStatus.sent.length}</Badge>
              </div>
              {loading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : ordersByStatus.sent.length ? (
                <div className="space-y-3">
                  {ordersByStatus.sent.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-[var(--border)] p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {order.table?.name || "À emporter"}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          <Clock3 className="inline-block h-3 w-3 mr-1" />
                          {formatTime(order.sent_at || order.created_at)}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.lines?.map((line) => (
                          <div key={line.id} className="flex justify-between">
                            <span>{line.menu_item_name}</span>
                            <span>x {line.qty}</span>
                          </div>
                        ))}
                      </div>
                      {order.note ? (
                        <div className="text-xs text-[var(--muted)]">Note : {order.note}</div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => sendAction("ready", order.id)} loading={actionLoading}>
                          <CheckCircle2 size={16} />
                          Marquer prêt
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openCancel(order)}
                          loading={actionLoading}
                        >
                          <XCircle size={16} />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">Aucune commande en attente.</div>
              )}
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Prêt à servir</div>
                <Badge variant="success">{ordersByStatus.ready.length}</Badge>
              </div>
              {loading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : ordersByStatus.ready.length ? (
                <div className="space-y-3">
                  {ordersByStatus.ready.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-[var(--border)] p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {order.table?.name || "À emporter"}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          Prêt à {formatTime(order.ready_at || order.sent_at)}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.lines?.map((line) => (
                          <div key={line.id} className="flex justify-between">
                            <span>{line.menu_item_name}</span>
                            <span>x {line.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => sendAction("served", order.id)} loading={actionLoading}>
                          <CheckCircle2 size={16} />
                          Marquer servi
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openCancel(order)}
                          loading={actionLoading}
                        >
                          <XCircle size={16} />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">Aucun plat prêt pour le service.</div>
              )}
            </Card>
          </div>
        ) : null}
      </div>

      <Drawer
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler une commande"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Fermer
            </Button>
            <Button onClick={confirmCancel} loading={actionLoading}>
              Confirmer l’annulation
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-[var(--muted)]">
            Cette action enregistre une perte si la commande est déjà en cuisine.
          </div>
          <Select
            label="Motif"
            value={cancelReason}
            options={CANCEL_REASONS}
            onChange={(value) => setCancelReason(value)}
          />
          {cancelReason === "other" ? (
            <Input
              label="Précision"
              value={cancelText}
              onChange={(e) => setCancelText(e.target.value)}
              placeholder="Ex. Problème technique"
            />
          ) : null}
          {cancelOrder ? (
            <div className="rounded-2xl border border-[var(--border)] p-3 text-xs text-[var(--muted)]">
              Commande : {cancelOrder.table?.name || "À emporter"} ·{" "}
              {STATUS_LABELS[cancelOrder.status] || cancelOrder.status}
            </div>
          ) : null}
        </div>
      </Drawer>
    </PageTransition>
  );
}
