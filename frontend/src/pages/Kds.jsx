// frontend/src/pages/Kds.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ChefHat,
  ClipboardList,
  Minus,
  Plus,
  Search,
  Send,
  Table2,
  Clock3,
  CheckCircle2,
  XCircle,
  Store,
  CookingPot,
  Wrench,
  LayoutGrid,
  ScanLine,
  Check,
  X,
} from "lucide-react";

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

const POLL_MS = 2500;
const KDS_GUIDE_STORAGE = "kds_hub_guide_v2_cash_ui";
const KDS_POS_NUDGE_STORAGE = "kds_pos_nudge_v2_cash_ui";

const HEADER_H = 64;
const DOCK_H = 96;

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "À préparer",
  READY: "Prêt",
  SERVED: "Servi",
  PAID: "Payé",
  CANCELLED: "Annulée",
};

const CANCEL_REASONS = [
  { value: "cancelled", label: "Annulation client" },
  { value: "mistake", label: "Erreur de saisie" },
  { value: "breakage", label: "Produit cassé / perdu" },
  { value: "other", label: "Autre" },
];

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

function useLandscapeLock(enabled = true) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortrait(portrait);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);

  const requestLock = async () => {
    try {
      if (screen?.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch {
      // ignore
    }
  };

  return { isPortrait, requestLock };
}

function LandscapeOverlay({ open, onTry }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="text-lg font-black text-white">Mode paysage recommandé</div>
        <div className="mt-2 text-sm text-white/80">
          Pour un KDS “poste cuisine”, passe l’écran en paysage.
        </div>
        <button
          onClick={onTry}
          className="mt-4 w-full rounded-2xl bg-white/20 border border-white/20 px-4 py-3 text-white font-semibold"
        >
          Passer en paysage
        </button>
      </div>
    </div>
  );
}

const KdsLogo = () => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="font-black tracking-tight text-lg text-[var(--text)]">
        StockScan KDS
      </div>
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

function GlassPanel({ className = "", children }) {
  const glass =
    "border border-[var(--border)]/70 bg-[var(--surface)]/65 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.18)]";
  return <div className={`${glass} rounded-3xl ${className}`}>{children}</div>;
}

function Segmented({ value, onChange, items }) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-1">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={[
              "px-3 py-2 rounded-xl text-sm font-extrabold transition",
              active
                ? "bg-[var(--accent)]/20 text-[var(--text)]"
                : "text-[var(--muted)] hover:bg-[var(--accent)]/10",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-2">
              {it.icon}
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function KdsHub({ defaultTab = "orders" }) {
  const { serviceId, services, serviceProfile, selectService, tenant, logout } = useAuth();
  const pushToast = useToast();
  const { isPortrait, requestLock } = useLandscapeLock(true);

  const isReadyService = Boolean(serviceId && String(serviceId) !== "all");
  const kdsActive = isKdsEnabled(serviceProfile);

  const [tab, setTab] = useState(defaultTab); // "orders" | "kitchen"

  const [toolsOpen, setToolsOpen] = useState(false);

  // ===== Guide / onboarding =====
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return localStorage.getItem(KDS_GUIDE_STORAGE) !== "1";
    } catch {
      return true;
    }
  });

  const dismissGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem(KDS_GUIDE_STORAGE, "1");
    } catch {
      // noop
    }
  };

  const reopenGuide = () => {
    setShowGuide(true);
    try {
      localStorage.removeItem(KDS_GUIDE_STORAGE);
    } catch {
      // noop
    }
  };

  const [showPosNudge, setShowPosNudge] = useState(() => {
    try {
      return localStorage.getItem(KDS_POS_NUDGE_STORAGE) !== "1";
    } catch {
      return true;
    }
  });

  const dismissPosNudge = () => {
    setShowPosNudge(false);
    try {
      localStorage.setItem(KDS_POS_NUDGE_STORAGE, "1");
    } catch {
      // noop
    }
  };

  const serviceOptions = useMemo(
    () =>
      (services || []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [services]
  );

  const hasCoreAccess = Boolean(tenant && (serviceProfile || services?.length));
  const coreCta = hasCoreAccess
    ? { label: "Ouvrir StockScan", href: "/app/dashboard" }
    : { label: "Activer StockScan", href: "/app/settings" };

  const handleLogout = () => {
    logout();
    window.location.href = "/login?next=/kds/app";
  };

  // ===== Manifest swap for PWA =====
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return undefined;
    const previousHref = manifestLink.getAttribute("href") || "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/kds.webmanifest");
    return () => {
      manifestLink.setAttribute("href", previousHref);
    };
  }, []);

  // =========================
  // ORDERS (Salle)
  // =========================
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

  const menuScrollRef = useRef(null);

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

  const addToCart = (item) => {
    if (!item?.price || Number(item.price) <= 0) {
      pushToast?.({ message: `Prix manquant pour ${item?.name || "ce plat"}.`, type: "warn" });
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
        pushToast?.({ message: "Certains plats n’ont pas de prix. Ajoutez-les au menu.", type: "error" });
        return null;
      }
      pushToast?.({ message: data?.detail || "Impossible de créer la commande.", type: "error" });
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
      await api.post(`/api/kds/orders/${draft.id}/send/`);
      pushToast?.({ message: "Commande envoyée en cuisine.", type: "success" });
      resetCart();
      await refreshOpenOrders();
      await refreshMenu();

      setTab("kitchen");
      setShowPosNudge(true);
      return true;
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_recipe") {
        pushToast?.({ message: "Recette manquante pour certains plats. Complétez les ingrédients.", type: "error" });
      } else if (data?.code === "stock_insufficient") {
        pushToast?.({ message: "Stock insuffisant pour certains ingrédients.", type: "error" });
      } else {
        pushToast?.({ message: data?.detail || "Impossible d’envoyer la commande.", type: "error" });
      }
      return false;
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

      setTab("kitchen");
      setShowPosNudge(true);
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

  // =========================
  // KITCHEN (Cuisine)
  // =========================
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [kitchenLoading, setKitchenLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("cancelled");
  const [cancelText, setCancelText] = useState("");
  const [cancelRestock, setCancelRestock] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKitchenFeed = useCallback(async () => {
    if (!isReadyService || !kdsActive) return;
    setKitchenLoading(true);
    try {
      const res = await api.get("/api/kds/kitchen/feed");
      setKitchenOrders(res.data || []);
    } catch {
      pushToast?.({ message: "Impossible de charger le flux cuisine.", type: "error" });
    } finally {
      setKitchenLoading(false);
    }
  }, [isReadyService, kdsActive, pushToast]);

  useEffect(() => {
    fetchKitchenFeed();
  }, [fetchKitchenFeed]);

  useEffect(() => {
    if (!isReadyService || !kdsActive) return undefined;
    const timer = window.setInterval(fetchKitchenFeed, POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchKitchenFeed, isReadyService, kdsActive]);

  const sendKitchenAction = async (action, orderId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/kds/orders/${orderId}/${action}/`);
      pushToast?.({ message: "Statut mis à jour.", type: "success" });
      fetchKitchenFeed();
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
    setCancelRestock(true);
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelOrder) return;
    setActionLoading(true);
    try {
      await api.post(`/api/kds/orders/${cancelOrder.id}/cancel/`, {
        reason_code: cancelReason,
        reason_text: cancelReason === "other" ? cancelText : "",
        restock: cancelRestock,
      });
      pushToast?.({ message: "Commande annulée.", type: "success" });
      setCancelOpen(false);
      setCancelOrder(null);
      fetchKitchenFeed();
      refreshOpenOrders();
      refreshMenu();
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
    kitchenOrders.forEach((order) => {
      if (order.status === "READY") ready.push(order);
      else if (order.status === "SENT") sent.push(order);
    });
    return { sent, ready };
  }, [kitchenOrders]);

  const serviceLabel = serviceProfile?.name || "";

  // ===== Layout =====
  const root = "h-[100dvh] overflow-hidden";
  const mainH = `h-[calc(100dvh-${HEADER_H}px-${DOCK_H}px)]`;
  const dock = "fixed left-0 right-0 bottom-0 z-40";

  return (
    <PageTransition>
      <Helmet>
        <title>KDS | StockScan</title>
        <meta name="description" content="KDS StockScan : prise de commande (salle) + cuisine en temps réel." />
      </Helmet>

      <LandscapeOverlay open={isPortrait} onTry={requestLock} />

      <div className={root}>
        {/* HEADER FIXE */}
        <div className="sticky top-0 z-50">
          <GlassPanel className="h-16 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <KdsLogo />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] truncate">
                  Hub Commandes & Cuisine · {serviceLabel ? `Service : ${serviceLabel}` : "Sélectionnez un service"}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-lg font-black text-[var(--text)] truncate">StockScan KDS</div>
                  <Badge variant={tab === "orders" ? "info" : "success"}>
                    {tab === "orders" ? "Salle" : "Cuisine"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Segmented
                value={tab}
                onChange={setTab}
                items={[
                  { value: "orders", label: "Salle", icon: <ClipboardList className="h-4 w-4" /> },
                  { value: "kitchen", label: "Cuisine", icon: <ChefHat className="h-4 w-4" /> },
                ]}
              />

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setToolsOpen(true)}
                title="Commandes ouvertes, guide, raccourcis…"
              >
                <Wrench className="h-4 w-4" />
                Outils
              </Button>

              <Button as={Link} to="/pos/app" size="sm" variant="secondary" title="Ouvrir la caisse">
                <Store className="h-4 w-4" />
                POS
              </Button>

              <Button as={Link} to={coreCta.href} size="sm" variant="secondary">
                {coreCta.label}
              </Button>

              <Button size="sm" variant="ghost" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </div>
          </GlassPanel>
        </div>

        {/* MAIN */}
        <div className={`${mainH} p-3`}>
          {/* Guards */}
          {!isReadyService ? (
            <GlassPanel className="h-full p-6 flex flex-col justify-center items-center text-center">
              <div className="text-xl font-black text-[var(--text)]">Sélectionnez un service</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Le KDS nécessite un service précis.
              </div>
              {serviceOptions.length ? (
                <div className="mt-4 w-full max-w-sm">
                  <Select
                    label="Service"
                    value={serviceId}
                    options={serviceOptions}
                    onChange={selectService}
                  />
                </div>
              ) : null}
            </GlassPanel>
          ) : isReadyService && !kdsActive ? (
            <GlassPanel className="h-full p-6 flex flex-col justify-center items-center text-center">
              <div className="text-xl font-black text-[var(--text)]">Module non activé</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Activez “Commandes & Cuisine” dans Paramètres pour ce service.
              </div>
              <div className="mt-4">
                <Button onClick={() => (window.location.href = "/app/settings")}>
                  Ouvrir les paramètres
                </Button>
              </div>
            </GlassPanel>
          ) : tab === "orders" ? (
            // ===== SALLE (fixed layout) =====
            <div className="h-full grid grid-cols-[420px_minmax(0,1fr)_380px] gap-3">
              {/* LEFT: panier commande (tableur) */}
              <GlassPanel className="overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-2">
                  <div className="font-extrabold text-[var(--text)]">Commande (Salle)</div>
                  <Badge variant="info">{cartItems.length} ligne(s)</Badge>
                </div>

                <div className="px-4 py-3 border-b border-[var(--border)]/70">
                  <Select
                    label="Table"
                    value={selectedTableId}
                    options={tableOptions}
                    onChange={(val) => setSelectedTableId(String(val))}
                  />
                  <div className="mt-2 flex gap-2">
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
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {cartItems.length ? (
                    cartItems.map((item) => (
                      <div
                        key={item.menu_item_id}
                        className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-[var(--text)] truncate">
                              {item.name}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {formatMoney(item.unit_price)} € / unité
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.menu_item_id)}
                            className="h-9 w-9 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
                            title="Retirer"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateCartItem(item.menu_item_id, {
                                  qty: Math.max(item.qty - 1, 1),
                                })
                              }
                            >
                              <Minus size={14} />
                            </Button>

                            <div className="h-9 min-w-[56px] px-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl flex items-center justify-center font-extrabold text-[var(--text)]">
                              {item.qty}
                            </div>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => updateCartItem(item.menu_item_id, { qty: item.qty + 1 })}
                            >
                              <Plus size={14} />
                            </Button>
                          </div>

                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {formatMoney(item.qty * item.unit_price)} €
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
                      Ajoutez des plats avec les touches au centre.
                    </div>
                  )}

                  <Input
                    label="Note commande"
                    placeholder="Ex. Allergènes, timing"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                  />
                </div>
              </GlassPanel>

              {/* CENTER: touches plats (horizontal) */}
              <GlassPanel className="overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-2">
                  <div className="font-extrabold text-[var(--text)]">Touches plats</div>
                  <div className="text-xs text-[var(--muted)]">
                    {menuLoading ? "Chargement…" : `${filteredMenu.length} plat(s)`}
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-[var(--border)]/70">
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2.5">
                    <Search className="h-4 w-4 text-[var(--muted)]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Recherche live plat"
                      className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-extrabold text-[var(--text)] hover:bg-[var(--accent)]/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div ref={menuScrollRef} dir="rtl" className="h-full overflow-x-auto overflow-y-hidden">
                    <div className="h-full flex gap-3 p-3" dir="ltr">
                      {menuLoading ? (
                        <div className="h-full w-full grid place-items-center text-sm text-[var(--muted)]">
                          Chargement…
                        </div>
                      ) : filteredMenu.length === 0 ? (
                        <div className="h-full w-full grid place-items-center text-sm text-[var(--muted)]">
                          Aucun plat.
                        </div>
                      ) : (
                        filteredMenu.map((item) => {
                          const available = Number(item.available_count ?? 0);
                          const price = Number(item.price || 0);
                          const disabled = available <= 0 || price <= 0;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => addToCart(item)}
                              disabled={disabled}
                              className={[
                                "w-[220px] min-w-[220px] h-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl p-4 text-left transition active:scale-[0.99]",
                                disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-[var(--text)] truncate">
                                    {item.name}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--muted)]">
                                    {price > 0 ? `${formatMoney(price)} €` : "Prix manquant"}
                                  </div>
                                </div>
                                <Badge variant={available > 0 ? "success" : "danger"}>
                                  Dispo {available}
                                </Badge>
                              </div>

                              <div className="mt-4">
                                <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--accent)]/10 px-3 py-2 text-xs font-extrabold text-[var(--text)]">
                                  <Plus className="h-4 w-4" />
                                  Ajouter
                                </div>
                              </div>

                              <div className="mt-3 text-[11px] text-[var(--muted)]">
                                {disabled ? "Indisponible" : "Touch-friendly"}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </GlassPanel>

              {/* RIGHT: commandes ouvertes + actions */}
              <GlassPanel className="overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-2">
                  <div className="font-extrabold text-[var(--text)]">Commandes ouvertes</div>
                  <Button variant="secondary" size="sm" onClick={refreshOpenOrders} disabled={ordersLoading}>
                    Rafraîchir
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {showPosNudge ? (
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
                      <div className="text-sm text-[var(--text)]">
                        <span className="font-extrabold">Encaissement :</span>{" "}
                        passe dans la caisse (POS) pour multi-paiements + tickets + stats.
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button as={Link} to="/pos/app" size="sm">
                          <Store className="h-4 w-4" />
                          Ouvrir POS
                        </Button>
                        <Button variant="ghost" size="sm" onClick={dismissPosNudge}>
                          Ok
                        </Button>
                      </div>
                    </div>
                  ) : null}

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
                          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-[var(--text)] truncate">
                                {order.table?.name || "À emporter"}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {STATUS_LABELS[order.status] || order.status}
                              </div>
                            </div>
                            <div className="text-sm font-extrabold text-[var(--text)]">
                              {formatMoney(order.total_amount)} €
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Aucune commande ouverte.</div>
                  )}
                </div>
              </GlassPanel>
            </div>
          ) : (
            // ===== CUISINE (fixed layout) =====
            <div className="h-full grid grid-cols-2 gap-3">
              <GlassPanel className="overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between">
                  <div className="font-extrabold text-[var(--text)]">À préparer</div>
                  <Badge variant="info">{ordersByStatus.sent.length}</Badge>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {kitchenLoading ? (
                    <div className="text-sm text-[var(--muted)]">Chargement…</div>
                  ) : ordersByStatus.sent.length ? (
                    ordersByStatus.sent.map((order) => (
                      <div key={order.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {order.table?.name || "À emporter"}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            <Clock3 className="inline-block h-3 w-3 mr-1" />
                            {formatTime(order.sent_at || order.created_at)}
                          </div>
                        </div>

                        <div className="space-y-1 text-sm">
                          {order.lines?.map((line) => (
                            <div key={line.id} className="flex justify-between text-[var(--text)]">
                              <span className="truncate">{line.menu_item_name}</span>
                              <span className="font-extrabold">x {line.qty}</span>
                            </div>
                          ))}
                        </div>

                        {order.note ? (
                          <div className="text-xs text-[var(--muted)]">Note : {order.note}</div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => sendKitchenAction("ready", order.id)}
                            loading={actionLoading}
                          >
                            <CheckCircle2 size={16} />
                            Prêt
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
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Aucune commande en attente.</div>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between">
                  <div className="font-extrabold text-[var(--text)]">Prêt à servir</div>
                  <Badge variant="success">{ordersByStatus.ready.length}</Badge>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {kitchenLoading ? (
                    <div className="text-sm text-[var(--muted)]">Chargement…</div>
                  ) : ordersByStatus.ready.length ? (
                    ordersByStatus.ready.map((order) => (
                      <div key={order.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {order.table?.name || "À emporter"}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            Prêt à {formatTime(order.ready_at || order.sent_at)}
                          </div>
                        </div>

                        <div className="space-y-1 text-sm">
                          {order.lines?.map((line) => (
                            <div key={line.id} className="flex justify-between text-[var(--text)]">
                              <span className="truncate">{line.menu_item_name}</span>
                              <span className="font-extrabold">x {line.qty}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => sendKitchenAction("served", order.id)}
                            loading={actionLoading}
                          >
                            <CheckCircle2 size={16} />
                            Servi
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
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Aucun plat prêt.</div>
                  )}
                </div>
              </GlassPanel>
            </div>
          )}
        </div>

        {/* BOTTOM DOCK FIXE */}
        {isReadyService && kdsActive ? (
          <div className={dock}>
            <GlassPanel className="rounded-none border-x-0 border-b-0 px-4 py-3">
              {tab === "orders" ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Total commande</div>
                    <div className="text-3xl font-black text-[var(--text)] leading-none">
                      {formatMoney(totalAmount)} €
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {cartItems.length ? `${cartItems.length} ligne(s)` : "Aucune ligne"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleSaveDraft} loading={savingDraft} disabled={!cartItems.length}>
                      <ClipboardList className="h-4 w-4" />
                      Enregistrer
                    </Button>
                    <Button onClick={handleSend} loading={sending} disabled={!cartItems.length}>
                      <Send className="h-4 w-4" />
                      Envoyer cuisine
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Cuisine</div>
                    <div className="text-lg font-black text-[var(--text)] leading-none">
                      Flux auto toutes les {Math.round(POLL_MS / 100) / 10}s
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      À préparer : {ordersByStatus.sent.length} · Prêt : {ordersByStatus.ready.length}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={fetchKitchenFeed} disabled={kitchenLoading}>
                      <CookingPot className="h-4 w-4" />
                      Rafraîchir
                    </Button>
                    <Button as={Link} to="/pos/app">
                      <Store className="h-4 w-4" />
                      POS
                    </Button>
                  </div>
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {/* Outils drawer */}
        <Drawer
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          title="Outils KDS"
          footer={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={refreshOpenOrders} disabled={ordersLoading}>
                Rafraîchir commandes
              </Button>
              <Button variant="secondary" onClick={fetchKitchenFeed} disabled={kitchenLoading}>
                Rafraîchir cuisine
              </Button>
              <Button variant="ghost" onClick={() => setToolsOpen(false)}>
                Fermer
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {showGuide ? (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text)]">
                    Guide express
                  </div>
                  <Button size="sm" variant="ghost" onClick={dismissGuide}>
                    Fermer
                  </Button>
                </div>
                <ol className="list-decimal pl-5 text-sm text-[var(--muted)] space-y-1">
                  <li><b>Salle</b> : ajoute des plats, sélectionne une table, puis <b>Envoyer cuisine</b>.</li>
                  <li><b>Cuisine</b> : passe <b>Prêt</b> puis <b>Servi</b>.</li>
                  <li>Encaissement : utilise le <b>POS</b> (tickets, multi-paiements, stats).</li>
                  <li>Annulation : choisis <b>Restocker</b> ou <b>Perte</b>.</li>
                </ol>
              </Card>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={reopenGuide}
                  className="text-xs font-semibold text-[var(--text)] underline underline-offset-4"
                >
                  Relancer le guide
                </button>
              </div>
            )}

            <Card className="p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--text)]">Raccourci POS</div>
              <div className="text-sm text-[var(--muted)]">
                Pour encaisser : multi-paiements + ticket + statistiques.
              </div>
              <Button as={Link} to="/pos/app">
                <Store className="h-4 w-4" />
                Ouvrir POS
              </Button>
            </Card>

            <Card className="p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--text)]">Commandes ouvertes</div>
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
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[var(--text)] truncate">
                            {order.table?.name || "À emporter"}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {STATUS_LABELS[order.status] || order.status}
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-[var(--text)]">
                          {formatMoney(order.total_amount)} €
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">Aucune.</div>
              )}
            </Card>
          </div>
        </Drawer>

        {/* Drawer détail commande (Salle) */}
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
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-4 space-y-1">
                <div className="text-sm font-extrabold text-[var(--text)]">
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
                  <div key={line.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-[var(--text)]">{line.menu_item_name}</div>
                      <div className="text-sm font-extrabold text-[var(--text)]">x {line.qty}</div>
                    </div>
                    {line.notes ? (
                      <div className="text-xs text-[var(--muted)] mt-1">{line.notes}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-4 flex items-center justify-between">
                <div className="text-sm text-[var(--muted)]">Total</div>
                <div className="text-lg font-black text-[var(--text)]">
                  {formatMoney(selectedOrder.total_amount)} €
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">Chargement…</div>
          )}
        </Drawer>

        {/* Drawer annulation (Cuisine) */}
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
              Choisissez le motif, puis indiquez si on <b>restock</b> (annulation propre) ou si
              c’est une <b>perte</b> (plat jeté).
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

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={cancelRestock}
                  onChange={(e) => setCancelRestock(e.target.checked)}
                />
                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-[var(--text)]">Restocker le stock</div>
                  <div className="text-xs text-[var(--muted)]">
                    {cancelRestock
                      ? "Oui : annulation sans perte (stock rétabli si décrémenté)."
                      : "Non : perte enregistrée (stock non restocké)."}
                  </div>
                </div>
              </label>
            </div>

            {cancelOrder ? (
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3 text-xs text-[var(--muted)]">
                Commande : {cancelOrder.table?.name || "À emporter"} ·{" "}
                {STATUS_LABELS[cancelOrder.status] || cancelOrder.status}
              </div>
            ) : null}
          </div>
        </Drawer>
      </div>
    </PageTransition>
  );
}