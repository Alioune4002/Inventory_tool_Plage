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
const KDS_GUIDE_STORAGE = "kds_hub_guide_v1";
const KDS_POS_NUDGE_STORAGE = "kds_pos_nudge_v1";

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

/**
 * Apple-like glass helpers (works in light/dark as long as your theme vars are good).
 * We keep it local to avoid touching Card component.
 */
const glassCard =
  "border border-[var(--border)]/70 bg-[var(--surface)]/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)]";

function Segmented({ value, onChange, items }) {
  return (
    <div className={`inline-flex items-center rounded-2xl p-1 ${glassCard}`}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={[
              "px-3 py-2 rounded-xl text-sm font-semibold transition",
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

  const isReadyService = Boolean(serviceId && String(serviceId) !== "all");
  const kdsActive = isKdsEnabled(serviceProfile);

  const [tab, setTab] = useState(defaultTab); // "orders" | "kitchen"

  // ===== Shared UX / onboarding =====
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

  // POS nudge (discret, 1x)
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

  // ===== Service selection =====
  const serviceOptions = useMemo(
    () =>
      (services || []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [services]
  );

  // ===== Header CTAs =====
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
  // ORDERS (Salle) state
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
      await api.post(`/api/kds/orders/${draft.id}/send/`);
      pushToast?.({ message: "Commande envoyée en cuisine.", type: "success" });
      resetCart();
      await refreshOpenOrders();
      await refreshMenu();

      // UX: bascule auto en cuisine + suggestion POS (discrète)
      setTab("kitchen");
      setShowPosNudge(true);
      return true;
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_recipe") {
        pushToast?.({
          message: "Recette manquante pour certains plats. Complétez les ingrédients.",
          type: "error",
        });
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
  // KITCHEN (Cuisine) state
  // =========================
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [kitchenLoading, setKitchenLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("cancelled");
  const [cancelText, setCancelText] = useState("");
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
      fetchKitchenFeed();
      refreshOpenOrders(); // garde la cohérence côté salle
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

  // ===== Guard states =====
  const serviceLabel = serviceProfile?.name || "";

  return (
    <PageTransition>
      <Helmet>
        <title>KDS | StockScan</title>
        <meta
          name="description"
          content="Hub KDS StockScan : prise de commande (salle) + cuisine en temps réel."
        />
      </Helmet>

      <div className="space-y-4">
        {/* HEADER glass */}
        <Card className={`p-5 ${glassCard}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <KdsLogo />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Hub Commandes & Cuisine
                </div>
                <div className="text-2xl font-black text-[var(--text)] truncate">StockScan KDS</div>
                <div className="text-sm text-[var(--muted)]">
                  De la prise de commande à la préparation, en temps réel.
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2">
              {serviceLabel ? (
                <div className="text-xs text-[var(--muted)]">Service actif : {serviceLabel}</div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  as={Link}
                  to="/pos/app"
                  size="sm"
                  variant="secondary"
                  title="Ouvrir la caisse pour encaisser et imprimer les tickets"
                >
                  <Store className="h-4 w-4" />
                  Ouvrir la caisse
                </Button>

                <Button as={Link} to={coreCta.href} size="sm" variant="secondary">
                  {coreCta.label}
                </Button>

                <Button size="sm" variant="ghost" onClick={handleLogout}>
                  Se déconnecter
                </Button>
              </div>
            </div>
          </div>

          {/* Segmented switch */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={tab}
              onChange={setTab}
              items={[
                { value: "orders", label: "Salle", icon: <ClipboardList className="h-4 w-4" /> },
                { value: "kitchen", label: "Cuisine", icon: <ChefHat className="h-4 w-4" /> },
              ]}
            />

            {isReadyService && kdsActive ? (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border border-[var(--border)]/70 bg-[var(--surface)]/60 backdrop-blur">
                  <CookingPot className="h-4 w-4" />
                  Flux auto toutes les {Math.round(POLL_MS / 100) / 10}s
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Guide */}
        {showGuide && isReadyService && kdsActive ? (
          <Card className={`p-5 space-y-3 ${glassCard}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text)]">
                Guide express — bien démarrer
              </div>
              <Button size="sm" variant="ghost" onClick={dismissGuide}>
                Fermer
              </Button>
            </div>
            <ol className="list-decimal pl-5 text-sm text-[var(--muted)] space-y-1">
              <li>Dans <b>Salle</b>, créez une commande et envoyez-la en cuisine.</li>
              <li>Dans <b>Cuisine</b>, marquez <b>Prêt</b> puis <b>Servi</b>.</li>
              <li>Pour encaisser, utilisez la <b>Caisse</b> (tickets, stats, exports).</li>
              <li>Le stock se met à jour automatiquement à l’encaissement via StockScan.</li>
            </ol>
          </Card>
        ) : null}

        {!showGuide && isReadyService && kdsActive ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reopenGuide}
              className="text-xs font-semibold text-[var(--text)] underline underline-offset-4"
            >
              Relancer le guide
            </button>
          </div>
        ) : null}

        {/* Guards */}
        {!isReadyService ? (
          <Card className={`p-6 space-y-2 ${glassCard}`}>
            <div className="text-lg font-semibold">Sélectionnez un service</div>
            <div className="text-sm text-[var(--muted)]">
              Le KDS nécessite un service précis. Choisissez un service dans la barre du haut.
            </div>
            {serviceOptions.length ? (
              <Select label="Service" value={serviceId} options={serviceOptions} onChange={selectService} />
            ) : null}
          </Card>
        ) : null}

        {isReadyService && !kdsActive ? (
          <Card className={`p-6 space-y-2 ${glassCard}`}>
            <div className="text-lg font-semibold">Module non activé</div>
            <div className="text-sm text-[var(--muted)]">
              Activez “Commandes & Cuisine” dans Paramètres pour ce service.
            </div>
            <Button onClick={() => (window.location.href = "/app/settings")}>Ouvrir les paramètres</Button>
          </Card>
        ) : null}

        {/* POS nudge (discret, contextuel) */}
        {isReadyService && kdsActive && showPosNudge ? (
          <Card className={`p-4 ${glassCard}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--text)]">
                <span className="font-semibold">Pour aller encore plus vite :</span>{" "}
                encaissez dans la caisse (multi-paiements, ticket, stats, exports PDF/Excel).
              </div>
              <div className="flex items-center gap-2">
                <Button as={Link} to="/pos/app" size="sm">
                  <Store className="h-4 w-4" />
                  Ouvrir la caisse
                </Button>
                <Button variant="ghost" size="sm" onClick={dismissPosNudge}>
                  Ok
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Content */}
        {isReadyService && kdsActive ? (
          tab === "orders" ? (
            // =====================
            // SALLE (ORDERS)
            // =====================
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className={`p-6 space-y-4 ${glassCard}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Salle
                    </div>
                    <div className="text-lg font-semibold text-[var(--text)]">Plats & menus</div>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {menuLoading ? "Chargement…" : `${filteredMenu.length} plat(s)`}
                  </div>
                </div>

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
                          className={[
                            "p-4 h-full transition rounded-3xl",
                            glassCard,
                            disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]",
                          ].join(" ")}
                          hover={!disabled}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text)] truncate">
                                {item.name}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {price > 0 ? `${formatMoney(price)} €` : "Prix manquant"}
                              </div>
                            </div>
                            <Badge variant={available > 0 ? "success" : "danger"}>
                              Dispo {available}
                            </Badge>
                          </div>

                          <div className="mt-3 text-xs text-[var(--muted)]">
                            {disabled ? "Indisponible (stock ou prix manquant)" : "Ajouter au panier"}
                          </div>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className={`p-6 space-y-4 ${glassCard}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Salle
                      </div>
                      <div className="text-lg font-semibold">Table & commande</div>
                    </div>
                    <Badge variant="info">Prise de commande</Badge>
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
                          className={`rounded-3xl p-3 flex flex-col gap-2 ${glassCard}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text)] truncate">
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
                                onClick={() => updateCartItem(item.menu_item_id, { qty: item.qty + 1 })}
                              >
                                <Plus size={14} />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCartItem(item.menu_item_id)}
                                title="Retirer"
                              >
                                <XCircle size={14} />
                              </Button>
                            </div>
                          </div>

                          <Input
                            label="Note"
                            placeholder="Ex. Sans oignons"
                            value={item.notes}
                            onChange={(e) =>
                              updateCartItem(item.menu_item_id, { notes: e.target.value })
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted)]">
                        Ajoutez des plats pour créer une commande.
                      </div>
                    )}
                  </div>

                  <Input
                    label="Note commande"
                    placeholder="Ex. Allergènes, timing"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                  />

                  <div className={`rounded-3xl px-4 py-3 flex items-center justify-between ${glassCard}`}>
                    <div className="text-sm text-[var(--muted)]">Total</div>
                    <div className="text-lg font-semibold text-[var(--text)]">
                      {formatMoney(totalAmount)} €
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="secondary" onClick={handleSaveDraft} loading={savingDraft}>
                      <ClipboardList size={16} />
                      Enregistrer
                    </Button>
                    <Button onClick={handleSend} loading={sending}>
                      <Send size={16} />
                      Envoyer en cuisine
                    </Button>
                  </div>
                </Card>

                <Card className={`p-6 space-y-3 ${glassCard}`}>
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
                          <div className={`rounded-3xl p-3 flex items-center justify-between gap-3 ${glassCard}`}>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text)] truncate">
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
          ) : (
            // =====================
            // CUISINE (KITCHEN)
            // =====================
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className={`p-6 space-y-3 ${glassCard}`}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">À préparer</div>
                  <Badge variant="info">{ordersByStatus.sent.length}</Badge>
                </div>

                {kitchenLoading ? (
                  <div className="text-sm text-[var(--muted)]">Chargement…</div>
                ) : ordersByStatus.sent.length ? (
                  <div className="space-y-3">
                    {ordersByStatus.sent.map((order) => (
                      <div key={order.id} className={`rounded-3xl p-4 space-y-2 ${glassCard}`}>
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
                          <Button
                            size="sm"
                            onClick={() => sendKitchenAction("ready", order.id)}
                            loading={actionLoading}
                          >
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

              <Card className={`p-6 space-y-3 ${glassCard}`}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Prêt à servir</div>
                  <Badge variant="success">{ordersByStatus.ready.length}</Badge>
                </div>

                {kitchenLoading ? (
                  <div className="text-sm text-[var(--muted)]">Chargement…</div>
                ) : ordersByStatus.ready.length ? (
                  <div className="space-y-3">
                    {ordersByStatus.ready.map((order) => (
                      <div key={order.id} className={`rounded-3xl p-4 space-y-2 ${glassCard}`}>
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
                          <Button
                            size="sm"
                            onClick={() => sendKitchenAction("served", order.id)}
                            loading={actionLoading}
                          >
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
          )
        ) : null}

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
              <div className={`rounded-3xl p-4 space-y-1 ${glassCard}`}>
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
                  <div key={line.id} className={`rounded-3xl p-3 ${glassCard}`}>
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

              <div className={`rounded-3xl p-4 flex items-center justify-between ${glassCard}`}>
                <div className="text-sm text-[var(--muted)]">Total</div>
                <div className="text-lg font-semibold">
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
              <div className={`rounded-3xl p-3 text-xs text-[var(--muted)] ${glassCard}`}>
                Commande : {cancelOrder.table?.name || "À emporter"} ·{" "}
                {(STATUS_LABELS[cancelOrder.status] || cancelOrder.status)}
              </div>
            ) : null}
          </div>
        </Drawer>
      </div>
    </PageTransition>
  );
}