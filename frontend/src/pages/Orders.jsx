import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ChefHat,
  ClipboardList,
  Minus,
  Plus,
  Search,
  Send,
  Table2,
} from "lucide-react";

import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Drawer from "../ui/Drawer";
import Badge from "../ui/Badge";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import { isKdsEnabled } from "../lib/kdsAccess";
import kdsLogo from "../assets/kds-logo.png";

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "À préparer",
  READY: "Prêt",
  SERVED: "Servi",
  PAID: "Payé",
  CANCELLED: "Annulée",
};

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0,00";
  return n.toFixed(2).replace(".", ",");
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const KdsLogo = () => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="font-black tracking-tight text-lg text-[var(--text)]">StockScan KDS</div>
    );
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

export default function Orders() {
  const { serviceId, services, serviceProfile, selectService } = useAuth();
  const pushToast = useToast();

  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);

  const [menuLoading, setMenuLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [newTableName, setNewTableName] = useState("");

  const [cartItems, setCartItems] = useState([]);
  const [orderNote, setOrderNote] = useState("");
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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

  const tableOptions = useMemo(() => {
    const list = tables.map((t) => ({ value: t.id, label: t.name }));
    return [{ value: "", label: "À emporter" }, ...list];
  }, [tables]);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [query, menuItems]);

  const totalAmount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.qty * item.unit_price, 0),
    [cartItems]
  );

  const refreshTables = useCallback(async () => {
    if (!isReadyService || !kdsActive) return;
    setTablesLoading(true);
    try {
      const res = await api.get("/api/kds/tables/");
      setTables(res.data || []);
    } catch {
      pushToast?.({ message: "Impossible de charger les tables.", type: "error" });
    } finally {
      setTablesLoading(false);
    }
  }, [isReadyService, kdsActive, pushToast]);

  const refreshMenu = useCallback(async () => {
    if (!isReadyService || !kdsActive) return;
    setMenuLoading(true);
    try {
      const res = await api.get("/api/kds/menu-items/?with_availability=1");
      setMenuItems(res.data || []);
    } catch {
      pushToast?.({ message: "Impossible de charger les plats.", type: "error" });
    } finally {
      setMenuLoading(false);
    }
  }, [isReadyService, kdsActive, pushToast]);

  const refreshOpenOrders = useCallback(async () => {
    if (!isReadyService || !kdsActive) return;
    setOrdersLoading(true);
    try {
      const res = await api.get("/api/kds/orders/open/");
      setOpenOrders(res.data || []);
    } catch {
      pushToast?.({ message: "Impossible de charger les commandes ouvertes.", type: "error" });
    } finally {
      setOrdersLoading(false);
    }
  }, [isReadyService, kdsActive, pushToast]);

  useEffect(() => {
    refreshTables();
    refreshMenu();
    refreshOpenOrders();
  }, [refreshTables, refreshMenu, refreshOpenOrders]);

  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return undefined;
    const previousHref = manifestLink.getAttribute("href") || "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/orders.webmanifest");
    return () => {
      manifestLink.setAttribute("href", previousHref);
    };
  }, []);

  const addToCart = (item) => {
    if (!item?.price || Number(item.price) <= 0) {
      pushToast?.({
        message: `Prix manquant pour ${item?.name || "ce plat"}.`,
        type: "warn",
      });
      return;
    }
    if (item.available_count === 0) {
      pushToast?.({ message: "Stock insuffisant pour ce plat.", type: "warn" });
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((p) => p.menu_item_id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.menu_item_id === item.id ? { ...p, qty: p.qty + 1 } : p
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          qty: 1,
          unit_price: Number(item.price || 0),
          notes: "",
        },
      ];
    });
  };

  const updateCartItem = (id, patch) => {
    setCartItems((prev) => prev.map((p) => (p.menu_item_id === id ? { ...p, ...patch } : p)));
  };

  const removeCartItem = (id) => {
    setCartItems((prev) => prev.filter((p) => p.menu_item_id !== id));
  };

  const resetCart = () => {
    setCartItems([]);
    setOrderNote("");
  };

  const buildOrderPayload = () => ({
    table_id: selectedTableId ? Number(selectedTableId) : null,
    note: orderNote || "",
    lines: cartItems.map((item) => ({
      menu_item_id: item.menu_item_id,
      qty: String(item.qty),
      notes: item.notes || "",
    })),
  });

  const createOrderDraft = async () => {
    if (!cartItems.length) {
      pushToast?.({ message: "Ajoutez au moins un plat.", type: "warn" });
      return null;
    }
    try {
      const res = await api.post("/api/kds/orders/", buildOrderPayload());
      return res.data;
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_menu_price") {
        pushToast?.({
          message: "Certains plats n’ont pas de prix. Ajoutez-les au menu.",
          type: "error",
        });
        return null;
      }
      if (data?.detail) {
        pushToast?.({ message: data.detail, type: "error" });
        return null;
      }
      pushToast?.({ message: "Impossible de créer la commande.", type: "error" });
      return null;
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    const draft = await createOrderDraft();
    if (draft) {
      pushToast?.({ message: "Brouillon enregistré.", type: "success" });
      resetCart();
      await refreshOpenOrders();
    }
    setSavingDraft(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const draft = await createOrderDraft();
      if (!draft?.id) return;
      const res = await api.post(`/api/kds/orders/${draft.id}/send/`);
      pushToast?.({ message: "Commande envoyée en cuisine.", type: "success" });
      resetCart();
      await refreshOpenOrders();
      await refreshMenu();
      return res.data;
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_recipe") {
        pushToast?.({
          message: "Recette manquante pour certains plats. Complétez les ingrédients.",
          type: "error",
        });
      } else if (data?.code === "stock_insufficient") {
        pushToast?.({
          message: "Stock insuffisant pour certains ingrédients.",
          type: "error",
        });
      } else {
        pushToast?.({ message: data?.detail || "Impossible d’envoyer la commande.", type: "error" });
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendExisting = async (orderId) => {
    try {
      await api.post(`/api/kds/orders/${orderId}/send/`);
      pushToast?.({ message: "Commande envoyée en cuisine.", type: "success" });
      setDrawerOpen(false);
      setSelectedOrder(null);
      await refreshOpenOrders();
      await refreshMenu();
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_recipe") {
        pushToast?.({ message: "Recette manquante pour certains plats.", type: "error" });
      } else if (data?.code === "stock_insufficient") {
        pushToast?.({ message: "Stock insuffisant pour certains ingrédients.", type: "error" });
      } else {
        pushToast?.({ message: data?.detail || "Impossible d’envoyer la commande.", type: "error" });
      }
    }
  };

  const handleOpenOrder = async (orderId) => {
    try {
      const res = await api.get(`/api/kds/orders/${orderId}/`);
      setSelectedOrder(res.data);
      setDrawerOpen(true);
    } catch {
      pushToast?.({ message: "Impossible d’ouvrir la commande.", type: "error" });
    }
  };

  const handleCreateTable = async () => {
    const name = newTableName.trim();
    if (!name) return;
    try {
      const res = await api.post("/api/kds/tables/", { name });
      setTables((prev) => [...prev, res.data]);
      setNewTableName("");
      setSelectedTableId(res.data?.id || "");
      pushToast?.({ message: "Table ajoutée.", type: "success" });
    } catch {
      pushToast?.({ message: "Impossible d’ajouter la table.", type: "error" });
    }
  };

  const serviceLabel = serviceProfile?.name || "";

  return (
    <PageTransition>
      <Helmet>
        <title>Commandes | StockScan</title>
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center">
              <KdsLogo />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--muted)]">Module Commandes</div>
              <div className="text-2xl font-black text-[var(--text)]">Prise de commande (Salle)</div>
              <div className="text-sm text-[var(--muted)]">
                Réduisez vos pas : la commande arrive directement en cuisine.
              </div>
            </div>
          </div>
          {serviceLabel ? (
            <div className="text-sm text-[var(--muted)]">Service actif : {serviceLabel}</div>
          ) : null}
        </Card>

        {!isReadyService ? (
          <Card className="p-6 space-y-2">
            <div className="text-lg font-semibold">Sélectionnez un service</div>
            <div className="text-sm text-[var(--muted)]">
              Le module Commandes nécessite un service précis. Choisissez un service dans la barre du haut.
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
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-lg font-semibold">Plats & menus</div>
                <div className="text-xs text-[var(--muted)]">
                  {menuLoading ? "Chargement…" : `${filteredMenu.length} plat(s) disponibles`}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Input
                  label="Recherche rapide"
                  placeholder="Nom du plat"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rightSlot={<Search className="h-4 w-4 text-[var(--muted)]" />}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredMenu.map((item) => {
                    const available = Number(item.available_count ?? 0);
                    const price = Number(item.price || 0);
                    const disabled = available <= 0 || price <= 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addToCart(item)}
                        disabled={disabled}
                        className="text-left"
                      >
                        <Card
                          className={`p-4 h-full transition ${
                            disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]"
                          }`}
                          hover={!disabled}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-[var(--text)]">{item.name}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {price > 0 ? `${formatMoney(price)} €` : "Prix manquant"}
                              </div>
                            </div>
                            <Badge variant={available > 0 ? "success" : "danger"}>
                              Dispo {available}
                            </Badge>
                          </div>
                          <div className="mt-3 text-xs text-[var(--muted)]">
                            {disabled
                              ? "Indisponible (stock ou prix manquant)"
                              : "Ajouter au panier"}
                          </div>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Table & commande</div>
                  <Badge variant="info">Salle</Badge>
                </div>

                <Select
                  label="Table"
                  value={selectedTableId}
                  options={tableOptions}
                  onChange={(val) => setSelectedTableId(String(val))}
                  helper="Choisissez une table ou laissez “À emporter”."
                />

                <div className="flex gap-2">
                  <Input
                    label="Nouvelle table"
                    placeholder="Ex. Terrasse 4"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={handleCreateTable}
                      disabled={tablesLoading || !newTableName.trim()}
                    >
                      <Table2 size={16} />
                      Ajouter
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {cartItems.length ? (
                    cartItems.map((item) => (
                      <div
                        key={item.menu_item_id}
                        className="rounded-2xl border border-[var(--border)] p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">
                              {item.name}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {formatMoney(item.unit_price)} € / unité
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateCartItem(item.menu_item_id, { qty: Math.max(item.qty - 1, 1) })
                              }
                            >
                              <Minus size={14} />
                            </Button>
                            <div className="text-sm font-semibold">{item.qty}</div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateCartItem(item.menu_item_id, { qty: item.qty + 1 })
                              }
                            >
                              <Plus size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCartItem(item.menu_item_id)}
                            >
                              <Minus size={14} />
                            </Button>
                          </div>
                        </div>
                        <Input
                          label="Note"
                          placeholder="Ex. Sans oignons"
                          value={item.notes}
                          onChange={(e) => updateCartItem(item.menu_item_id, { notes: e.target.value })}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">
                      Ajoutez des plats depuis la liste pour créer une commande.
                    </div>
                  )}
                </div>

                <Input
                  label="Note commande"
                  placeholder="Ex. Allergènes, timing"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                />

                <div className="rounded-2xl border border-[var(--border)] px-4 py-3 flex items-center justify-between">
                  <div className="text-sm text-[var(--muted)]">Total</div>
                  <div className="text-lg font-semibold text-[var(--text)]">
                    {formatMoney(totalAmount)} €
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={handleSaveDraft} loading={savingDraft}>
                    <ClipboardList size={16} />
                    Enregistrer brouillon
                  </Button>
                  <Button onClick={handleSend} loading={sending}>
                    <Send size={16} />
                    Envoyer en cuisine
                  </Button>
                </div>
              </Card>

              <Card className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Commandes ouvertes</div>
                  <Button variant="ghost" size="sm" onClick={refreshOpenOrders}>
                    Rafraîchir
                  </Button>
                </div>
                {ordersLoading ? (
                  <div className="text-sm text-[var(--muted)]">Chargement…</div>
                ) : openOrders.length ? (
                  <div className="space-y-2">
                    {openOrders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => handleOpenOrder(order.id)}
                        className="w-full text-left"
                      >
                        <div className="rounded-2xl border border-[var(--border)] p-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">
                              {order.table?.name || "À emporter"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {STATUS_LABELS[order.status] || order.status}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            {formatMoney(order.total_amount)} €
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">Aucune commande ouverte.</div>
                )}
              </Card>
            </div>
          </div>
        ) : null}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Détail commande"
        footer={
          selectedOrder?.status === "DRAFT" ? (
            <Button onClick={() => handleSendExisting(selectedOrder.id)}>
              <Send size={16} />
              Envoyer en cuisine
            </Button>
          ) : null
        }
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] p-4 space-y-1">
              <div className="text-sm font-semibold">
                {selectedOrder.table?.name || "À emporter"}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Statut : {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Créée à {formatTime(selectedOrder.created_at)}
              </div>
            </div>

            <div className="space-y-2">
              {selectedOrder.lines?.map((line) => (
                <div key={line.id} className="rounded-2xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{line.menu_item_name}</div>
                    <div className="text-sm">x {line.qty}</div>
                  </div>
                  {line.notes ? (
                    <div className="text-xs text-[var(--muted)] mt-1">{line.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[var(--border)] p-4 flex items-center justify-between">
              <div className="text-sm text-[var(--muted)]">Total</div>
              <div className="text-lg font-semibold">{formatMoney(selectedOrder.total_amount)} €</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">Chargement…</div>
        )}
      </Drawer>
    </PageTransition>
  );
}
