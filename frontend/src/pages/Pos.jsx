// src/pages/Pos.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Search,
  Plus,
  Minus,
  Trash2,
  BadgePercent,
  ReceiptText,
  Printer,
  RotateCcw,
  Sparkles,
  Check,
  Store,
  Wrench,
  LayoutGrid,
  ScanLine,
  X,
} from "lucide-react";

import PageTransition from "../components/PageTransition";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Select from "../ui/Select";
import Drawer from "../ui/Drawer";
import Badge from "../ui/Badge";
import { api } from "../lib/api";
import { useAuth } from "../app/AuthProvider";
import { useToast } from "../app/ToastContext";
import BarcodeScannerModal from "../components/BarcodeScannerModal";
import { isKdsEnabled } from "../lib/kdsAccess";
import posLogo from "../assets/pos-logo.png";

const METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "cheque", label: "Chèque" },
  { value: "ticket_restaurant", label: "Ticket restaurant" },
  { value: "other", label: "Autre" },
];

const DISCOUNT_TYPES = [
  { value: "amount", label: "€" },
  { value: "percent", label: "%" },
];

const CANCEL_REASONS = [
  { value: "error", label: "Erreur de caisse" },
  { value: "customer_left", label: "Client parti" },
  { value: "breakage", label: "Casse" },
  { value: "mistake", label: "Erreur de commande" },
  { value: "other", label: "Autre" },
];

const POS_GUIDE_STORAGE = "pos_guide_v2_cash_ui";
const KDS_STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "En cuisine",
  READY: "Prêt",
  SERVED: "Servi",
};

const HEADER_H = 64;
const DOCK_H = 96;
const CATALOG_LIMIT = 24;

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const parseNumber = (value) => {
  const raw = String(value ?? "").replace(",", ".").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const clamp2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function computeLineTotals(item) {
  const qty = parseNumber(item.qty);
  const unitPrice = parseNumber(item.unit_price);
  const subtotal = qty * unitPrice;

  const discountValue = parseNumber(item.discount);
  const discountAmount =
    item.discount_type === "percent" ? (subtotal * discountValue) / 100 : discountValue;

  const safeDiscount = Math.min(Math.max(discountAmount, 0), subtotal);
  const total = Math.max(subtotal - safeDiscount, 0);

  return {
    subtotal,
    discount: safeDiscount,
    total,
  };
}

function normalizeNumericString(input) {
  let v = String(input ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  // keep only first dot
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v =
      v.slice(0, firstDot + 1) +
      v
        .slice(firstDot + 1)
        .replace(/\./g, "");
  }
  // avoid leading zeros like 0002
  if (v.length > 1 && v[0] === "0" && v[1] !== ".") {
    v = String(Number(v));
    if (v === "0") v = "0";
  }
  return v;
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
      // ignore (Safari/iOS souvent)
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
          Pour une expérience “vraie caisse”, passe l’écran en paysage.
        </div>
        <button
          onClick={onTry}
          className="mt-4 w-full rounded-2xl bg-white/20 border border-white/20 px-4 py-3 text-white font-semibold"
        >
          Passer en paysage
        </button>
        <div className="mt-3 text-xs text-white/70">
          Si ton navigateur bloque, installe la PWA (POS) pour un verrouillage plus fiable.
        </div>
      </div>
    </div>
  );
}

const PosLogo = () => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="font-black tracking-tight text-lg text-[var(--text)]">
        StockScan POS
      </div>
    );
  }

  return (
    <img
      src={posLogo}
      alt="StockScan POS"
      className="h-10 w-10 rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
};

function Keypad({ onKey, onClear, onBackspace, onExact, onFillRemaining }) {
  const keys = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    [".", "0", "⌫"],
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((k) => {
          const isBack = k === "⌫";
          return (
            <button
              key={k}
              type="button"
              onClick={() => (isBack ? onBackspace?.() : onKey?.(k))}
              className="h-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl text-lg font-extrabold text-[var(--text)] active:scale-[0.99]"
            >
              {k}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onClear}
          className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl text-sm font-extrabold text-[var(--text)] active:scale-[0.99]"
        >
          C
        </button>
        <button
          type="button"
          onClick={onExact}
          className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--accent)]/15 backdrop-blur-xl text-sm font-extrabold text-[var(--text)] active:scale-[0.99]"
          title="Met le montant restant (paiement actif)"
        >
          Exact
        </button>
        <button
          type="button"
          onClick={onFillRemaining}
          className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--accent)]/15 backdrop-blur-xl text-sm font-extrabold text-[var(--text)] active:scale-[0.99]"
          title="Remplir le reste (paiement actif)"
        >
          Reste
        </button>
      </div>
    </div>
  );
}

function SegmentedPill({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-3 py-2 rounded-xl text-xs font-bold transition",
              active
                ? "bg-[var(--accent)]/20 text-[var(--text)]"
                : "text-[var(--muted)] hover:bg-[var(--accent)]/10",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function GlassPanel({ className = "", children }) {
  const glass =
    "border border-[var(--border)]/70 bg-[var(--surface)]/65 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.18)]";
  return (
    <div className={`${glass} rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function MoneyText({ value, className = "" }) {
  return <span className={className}>{formatMoney(value)} €</span>;
}

export default function Pos() {
  const { serviceId, serviceProfile, services, tenant, logout } = useAuth();
  const pushToast = useToast();

  const kdsActive = isKdsEnabled(serviceProfile);
  const isServiceSelected = Boolean(serviceId && String(serviceId) !== "all");
  const isKdsAvailable = kdsActive && isServiceSelected;

  const { isPortrait, requestLock } = useLandscapeLock(true);

  // ===== Manifest swap for PWA =====
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return undefined;
    const previousHref = manifestLink.getAttribute("href") || "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/pos.webmanifest");
    return () => {
      manifestLink.setAttribute("href", previousHref);
    };
  }, []);

  // ===== Core states =====
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);

  const [kdsOpenTables, setKdsOpenTables] = useState([]);
  const [kdsLoading, setKdsLoading] = useState(false);
  const [kdsCheckout, setKdsCheckout] = useState(null);
  const [kdsCheckoutLoading, setKdsCheckoutLoading] = useState(false);

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);

  const [cancelDrawerOpen, setCancelDrawerOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("error");
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [cancelRestock, setCancelRestock] = useState(true);
  const [cancelRestockTouched, setCancelRestockTouched] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [cashSession, setCashSession] = useState({ active: false });
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cashSessionClosing, setCashSessionClosing] = useState(false);

  const [cartItems, setCartItems] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState({ value: "", type: "amount" });
  const [payments, setPayments] = useState([{ method: "cash", amount: "" }]);
  const [note, setNote] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [missingPriceProducts, setMissingPriceProducts] = useState([]);
  const [priceEdits, setPriceEdits] = useState({});
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const [toolsOpen, setToolsOpen] = useState(false);

  const [showGuide, setShowGuide] = useState(() => {
    try {
      return localStorage.getItem(POS_GUIDE_STORAGE) !== "1";
    } catch {
      return true;
    }
  });

  const [lastTicket, setLastTicket] = useState(null);

  const searchInputRef = useRef(null);
  const catalogScrollRef = useRef(null);

  const isKdsMode = Boolean(kdsCheckout);
  const serviceLabel = serviceProfile?.name || "";
  const hasCoreAccess = Boolean(tenant && (serviceProfile || services?.length));
  const coreCta = hasCoreAccess
    ? { label: "Ouvrir StockScan", href: "/app/dashboard" }
    : { label: "Activer StockScan", href: "/app/settings" };

  // ===== Active field for keypad =====
  // type: 'payment'|'global'|'line_qty'|'line_price'|'line_disc'
  const [activeField, setActiveField] = useState({ type: "payment", idx: 0 });

  // ===== Helpers =====
  const handleLogout = () => {
    logout();
    window.location.href = "/login?next=/pos/app";
  };

  const dismissGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem(POS_GUIDE_STORAGE, "1");
    } catch {
      // noop
    }
  };

  const reopenGuide = () => {
    setShowGuide(true);
    try {
      localStorage.removeItem(POS_GUIDE_STORAGE);
    } catch {
      // noop
    }
  };

  const focusSearch = () => {
    try {
      searchInputRef.current?.focus?.();
    } catch {
      // noop
    }
  };

  // ===== Totals =====
  const totals = useMemo(() => {
    if (kdsCheckout) {
      return {
        subtotal: parseNumber(kdsCheckout.subtotal),
        lineDiscount: parseNumber(kdsCheckout.discount_total),
        globalDiscount: 0,
        total: parseNumber(kdsCheckout.total),
      };
    }
    const lines = cartItems.map((item) => computeLineTotals(item));
    const subtotal = lines.reduce((acc, line) => acc + line.subtotal, 0);
    const lineDiscount = lines.reduce((acc, line) => acc + line.discount, 0);

    const globalValue = parseNumber(globalDiscount.value);
    const globalDiscountAmount =
      globalDiscount.type === "percent" ? (subtotal * globalValue) / 100 : globalValue;
    const globalDiscountSafe = Math.min(Math.max(globalDiscountAmount, 0), subtotal);

    const discountTotal = lineDiscount + globalDiscountSafe;
    const total = Math.max(subtotal - discountTotal, 0);

    return {
      subtotal,
      lineDiscount,
      globalDiscount: globalDiscountSafe,
      total,
    };
  }, [cartItems, globalDiscount, kdsCheckout]);

  const paymentTotal = useMemo(
    () => payments.reduce((acc, p) => acc + parseNumber(p.amount), 0),
    [payments]
  );

  const remaining = useMemo(() => clamp2(totals.total - paymentTotal), [totals.total, paymentTotal]);
  const isPaidExact = Math.abs(remaining) <= 0.01;
  const isOverpaid = remaining < -0.01;

  const remainingLabel = useMemo(() => {
    if (isPaidExact) return "OK";
    if (isOverpaid) return `Rendu : ${formatMoney(Math.abs(remaining))} €`;
    return `Restant : ${formatMoney(remaining)} €`;
  }, [isPaidExact, isOverpaid, remaining]);

  // ===== Catalog fetch (lazy horizontal) =====
  const parseCatalogResponse = (data) => {
    // supports: array, {results, next}, {items, has_more}
    if (Array.isArray(data)) {
      return { items: data, hasMore: data.length >= CATALOG_LIMIT };
    }
    if (data && Array.isArray(data.results)) {
      return { items: data.results, hasMore: Boolean(data.next) || data.results.length >= CATALOG_LIMIT };
    }
    if (data && Array.isArray(data.items)) {
      return { items: data.items, hasMore: Boolean(data.has_more) || data.items.length >= CATALOG_LIMIT };
    }
    return { items: [], hasMore: false };
  };

  const fetchCatalogPage = useCallback(
    async ({ q, page, append }) => {
      const queryTrim = String(q || "").trim();
      if (!queryTrim) {
        setCatalog([]);
        setCatalogHasMore(false);
        setCatalogPage(1);
        return;
      }

      if (append) setCatalogLoadingMore(true);
      else setCatalogLoading(true);

      try {
        const url = `/api/pos/products/search/?q=${encodeURIComponent(queryTrim)}&page=${page}&limit=${CATALOG_LIMIT}`;
        const res = await api.get(url);
        const parsed = parseCatalogResponse(res.data);
        const incoming = parsed.items || [];

        setCatalog((prev) => (append ? [...prev, ...incoming] : incoming));
        setCatalogHasMore(Boolean(parsed.hasMore) && incoming.length > 0);
        setCatalogPage(page);
      } catch {
        pushToast?.({ message: "Impossible de charger le catalogue.", type: "error" });
      } finally {
        setCatalogLoading(false);
        setCatalogLoadingMore(false);
      }
    },
    [pushToast]
  );

  // debounce search
  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchCatalogPage({ q: query, page: 1, append: false });
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, fetchCatalogPage]);

  // infinite scroll (horizontal)
  useEffect(() => {
    const el = catalogScrollRef.current;
    if (!el) return;

    const onScroll = () => {
      // RTL: scrollLeft can be weird; easiest: detect near "end" by measuring absolute max
      const maxScroll = el.scrollWidth - el.clientWidth;
      const x = Math.abs(el.scrollLeft);
      const nearEnd = maxScroll - x < 220;

      if (nearEnd && catalogHasMore && !catalogLoadingMore && !catalogLoading && query.trim()) {
        fetchCatalogPage({ q: query, page: catalogPage + 1, append: true });
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [catalogHasMore, catalogLoadingMore, catalogLoading, query, catalogPage, fetchCatalogPage]);

  // ===== Report / Tickets / Session =====
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const now = new Date();
      const to = now.toISOString().slice(0, 10);
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 30);
      const from = fromDate.toISOString().slice(0, 10);
      const res = await api.get(`/api/pos/reports/summary/?from=${from}&to=${to}`);
      setReport(res.data || null);
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await api.get("/api/pos/tickets/?limit=20");
      setTickets(res.data?.tickets || []);
    } catch {
      setTickets([]);
      pushToast?.({ message: "Impossible de charger l’historique des tickets.", type: "error" });
    } finally {
      setTicketsLoading(false);
    }
  }, [pushToast]);

  const fetchTicketDetail = useCallback(
    async (ticketId) => {
      if (!ticketId) return;
      try {
        const res = await api.get(`/api/pos/tickets/${ticketId}/`);
        setTicketDetail(res.data || null);
        setTicketDrawerOpen(true);
      } catch (error) {
        pushToast?.({
          message: error?.response?.data?.detail || "Impossible d’ouvrir ce ticket.",
          type: "error",
        });
      }
    },
    [pushToast]
  );

  const fetchCashSession = useCallback(async () => {
    setCashSessionLoading(true);
    try {
      const res = await api.get("/api/pos/session/active/");
      setCashSession(res.data || { active: false });
    } catch {
      setCashSession({ active: false });
    } finally {
      setCashSessionLoading(false);
    }
  }, []);

  const handleCloseSession = async () => {
    setCashSessionClosing(true);
    try {
      const res = await api.post("/api/pos/session/close/", {});
      pushToast?.({ message: res?.data?.detail || "Caisse clôturée.", type: "success" });
      setCashSession({ active: false });
      fetchTickets();
    } catch (error) {
      pushToast?.({
        message: error?.response?.data?.detail || "Impossible de clôturer la caisse.",
        type: "error",
      });
    } finally {
      setCashSessionClosing(false);
    }
  };

  // ===== KDS tables =====
  const fetchKdsOpenTables = useCallback(async () => {
    if (!isKdsAvailable) {
      setKdsOpenTables([]);
      return;
    }
    setKdsLoading(true);
    try {
      const res = await api.get("/api/kds/pos/open-tables/");
      setKdsOpenTables(res.data || []);
    } catch {
      setKdsOpenTables([]);
    } finally {
      setKdsLoading(false);
    }
  }, [isKdsAvailable]);

  const startKdsCheckout = async (orderId) => {
    if (!orderId) return;
    setKdsCheckoutLoading(true);
    try {
      const res = await api.get(`/api/kds/pos/orders/${orderId}/for-checkout/`);
      const payload = res.data || null;

      setKdsCheckout(payload);
      setCartItems([]);
      setGlobalDiscount({ value: "", type: "amount" });
      setNote("");
      setPayments([
        {
          method: "card",
          amount: payload ? formatMoney(payload.total) : "",
        },
      ]);

      setActiveField({ type: "payment", idx: 0 });
      setQuery("");
      setCatalog([]);
      focusSearch();
    } catch (error) {
      pushToast?.({
        message: error?.response?.data?.detail || "Impossible de charger la commande.",
        type: "error",
      });
    } finally {
      setKdsCheckoutLoading(false);
    }
  };

  const resetKdsCheckout = () => {
    setKdsCheckout(null);
    setCartItems([]);
    setPayments([{ method: "cash", amount: "" }]);
    setGlobalDiscount({ value: "", type: "amount" });
    setNote("");
    setQuery("");
    setCatalog([]);
    setActiveField({ type: "payment", idx: 0 });
    focusSearch();
  };

  // ===== Init data =====
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetchKdsOpenTables();
  }, [fetchKdsOpenTables]);

  useEffect(() => {
    fetchTickets();
    fetchCashSession();
  }, [fetchTickets, fetchCashSession]);

  // ===== Cart actions =====
  const addToCart = (product) => {
    if (isKdsMode) {
      pushToast?.({
        message: "Encaissement KDS en cours : terminez ou quittez avant d’ajouter des produits.",
        type: "warn",
      });
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, qty: String(parseNumber(p.qty) + 1) } : p));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          internal_sku: product.internal_sku,
          unit: product.unit || "pcs",
          selling_price: product.selling_price,
          tva: product.tva,
          qty: "1",
          unit_price: product.selling_price ?? "",
          discount: "",
          discount_type: "amount",
        },
      ];
    });
  };

  const updateCartItem = (id, patch) => {
    setCartItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeCartItem = (id) => {
    setCartItems((prev) => prev.filter((p) => p.id !== id));
  };

  // ===== Payload / checkout =====
  const buildPayload = () => {
    return {
      items: cartItems.map((item) => ({
        product_id: item.id,
        qty: String(item.qty),
        unit_price: item.unit_price === "" ? undefined : String(item.unit_price),
        discount: item.discount === "" ? undefined : String(item.discount),
        discount_type: item.discount_type || "amount",
      })),
      payments: payments.map((p) => ({
        method: p.method,
        amount: String(p.amount),
      })),
      global_discount:
        globalDiscount.value === ""
          ? undefined
          : { value: String(globalDiscount.value), type: globalDiscount.type },
      note: note || "",
    };
  };

  const submitCheckout = async (payload) => {
    setCheckoutLoading(true);
    try {
      const res = await api.post("/api/pos/tickets/checkout/", payload);
      pushToast?.({ message: "Paiement enregistré.", type: "success" });

      setLastTicket(res.data || null);

      setCartItems([]);
      setPayments([{ method: "cash", amount: "" }]);
      setGlobalDiscount({ value: "", type: "amount" });
      setNote("");
      setQuery("");
      setCatalog([]);
      setActiveField({ type: "payment", idx: 0 });

      fetchReport();
      fetchTickets();
      fetchCashSession();
      focusSearch();

      return res.data;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const submitKdsCheckout = async () => {
    if (!kdsCheckout?.order_id) return null;
    setCheckoutLoading(true);
    try {
      const res = await api.post(`/api/kds/pos/orders/${kdsCheckout.order_id}/mark-paid/`, {
        payments: payments.map((p) => ({
          method: p.method,
          amount: String(p.amount),
        })),
      });
      pushToast?.({ message: "Commande encaissée.", type: "success" });
      resetKdsCheckout();
      fetchReport();
      fetchKdsOpenTables();
      fetchTickets();
      fetchCashSession();
      return res.data;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (isKdsMode) {
      if (!isPaidExact) {
        pushToast?.({ message: "Le total des paiements doit correspondre au total net.", type: "error" });
        return;
      }
      try {
        await submitKdsCheckout();
      } catch (error) {
        const data = error?.response?.data;
        if (data?.code === "payment_total_mismatch") {
          pushToast?.({ message: data?.detail || "Paiements incomplets.", type: "error" });
          return;
        }
        pushToast?.({ message: data?.detail || "Impossible d’encaisser la commande.", type: "error" });
      }
      return;
    }

    if (!cartItems.length) {
      pushToast?.({ message: "Ajoutez au moins un produit.", type: "warn" });
      return;
    }

    if (!isPaidExact) {
      pushToast?.({ message: "Le total des paiements doit correspondre au total net.", type: "error" });
      return;
    }

    const payload = buildPayload();
    try {
      await submitCheckout(payload);
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "missing_selling_price") {
        setMissingPriceProducts(data?.products || []);
        setPriceModalOpen(true);
        setPendingPayload(payload);
        return;
      }
      if (data?.code === "stock_insufficient") {
        pushToast?.({ message: data?.detail || "Stock insuffisant.", type: "error" });
        return;
      }
      pushToast?.({ message: data?.detail || "Impossible de valider le paiement.", type: "error" });
    }
  };

  const saveMissingPricesAndCheckout = async () => {
    if (!missingPriceProducts.length) {
      setPriceModalOpen(false);
      return;
    }
    const updates = [];
    for (const p of missingPriceProducts) {
      const raw = String(priceEdits[p.id] ?? "").replace(",", ".").trim();
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        pushToast?.({ type: "error", message: `Prix invalide pour ${p.name || "produit"}.` });
        return;
      }
      updates.push({ id: p.id, price: n });
    }

    try {
      await Promise.all(updates.map((u) => api.patch(`/api/products/${u.id}/`, { selling_price: u.price })));
      updates.forEach((u) => updateCartItem(u.id, { unit_price: u.price, selling_price: u.price }));
      setPriceModalOpen(false);
      if (pendingPayload) {
        await submitCheckout(pendingPayload);
      }
    } catch (error) {
      pushToast?.({
        type: "error",
        message: error?.response?.data?.detail || "Impossible d’enregistrer les prix.",
      });
    }
  };

  // ===== Payments UX =====
  const setPaymentAtIndex = (idx, patch) => {
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPaymentLine = () => {
    setPayments((prev) => [...prev, { method: "cash", amount: "" }]);
  };

  const removePaymentLine = (idx) => {
    setPayments((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ method: "cash", amount: "" }];
    });
    setActiveField((cur) => {
      if (cur.type !== "payment") return cur;
      if (cur.idx === idx) return { type: "payment", idx: Math.max(0, idx - 1) };
      if (cur.idx > idx) return { type: "payment", idx: cur.idx - 1 };
      return cur;
    });
  };

  const fillRemainingInto = (idx) => {
    const rest = clamp2(
      totals.total - payments.reduce((acc, p, i) => acc + (i === idx ? 0 : parseNumber(p.amount)), 0)
    );
    const safe = Math.max(rest, 0);
    setPaymentAtIndex(idx, { amount: safe ? formatMoney(safe) : "0.00" });
  };

  const ensureAtLeastOnePayment = () => {
    setPayments((prev) => (prev?.length ? prev : [{ method: "cash", amount: "" }]));
  };

  useEffect(() => {
    ensureAtLeastOnePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Keypad binding =====
  const getActiveValue = () => {
    const a = activeField;
    if (a.type === "payment") return payments[a.idx]?.amount ?? "";
    if (a.type === "global") return globalDiscount.value ?? "";
    if (a.type === "line_qty") return cartItems[a.idx]?.qty ?? "";
    if (a.type === "line_price") return cartItems[a.idx]?.unit_price ?? "";
    if (a.type === "line_disc") return cartItems[a.idx]?.discount ?? "";
    return "";
  };

  const setActiveValue = (nextRaw) => {
    const v = normalizeNumericString(nextRaw);
    const a = activeField;

    if (a.type === "payment") {
      if (!payments[a.idx]) return;
      setPaymentAtIndex(a.idx, { amount: v });
      return;
    }
    if (a.type === "global") {
      setGlobalDiscount((prev) => ({ ...prev, value: v }));
      return;
    }
    if (a.type === "line_qty") {
      const item = cartItems[a.idx];
      if (!item) return;
      // qty must be >= 1 integer-ish, but we allow numeric input then clamp
      const n = Math.max(1, Math.floor(parseNumber(v || "1")));
      updateCartItem(item.id, { qty: String(n) });
      return;
    }
    if (a.type === "line_price") {
      const item = cartItems[a.idx];
      if (!item) return;
      updateCartItem(item.id, { unit_price: v });
      return;
    }
    if (a.type === "line_disc") {
      const item = cartItems[a.idx];
      if (!item) return;
      updateCartItem(item.id, { discount: v });
      return;
    }
  };

  const appendKey = (k) => {
    if (!k) return;
    const current = String(getActiveValue() ?? "");
    if (k === ".") {
      if (current.includes(".")) return;
      const next = current ? `${current}.` : "0.";
      setActiveValue(next);
      return;
    }
    if (!/^\d$/.test(k)) return;
    const next = current === "0" ? k : `${current}${k}`;
    setActiveValue(next);
  };

  const backspace = () => {
    const current = String(getActiveValue() ?? "");
    if (!current) return;
    setActiveValue(current.slice(0, -1));
  };

  const clearActive = () => {
    setActiveValue("");
  };

  const exact = () => {
    if (activeField.type !== "payment") return;
    fillRemainingInto(activeField.idx);
  };

  const fillRemaining = () => {
    if (activeField.type !== "payment") return;
    fillRemainingInto(activeField.idx);
  };

  // ===== Ticket cancel =====
  const openCancelDrawer = () => {
    setCancelReason("error");
    setCancelReasonText("");
    setCancelRestock(true);
    setCancelRestockTouched(false);
    setCancelDrawerOpen(true);
  };

  useEffect(() => {
    if (!cancelDrawerOpen) return;
    if (cancelRestockTouched) return;
    if (cancelReason === "breakage") setCancelRestock(false);
    else setCancelRestock(true);
  }, [cancelReason, cancelDrawerOpen, cancelRestockTouched]);

  const handleCancelTicket = async () => {
    if (!ticketDetail?.id) return;
    if (cancelReason === "other" && !cancelReasonText.trim()) {
      pushToast?.({ message: "Veuillez préciser la raison de l’annulation.", type: "warn" });
      return;
    }
    setCancelLoading(true);
    try {
      const res = await api.post(`/api/pos/tickets/${ticketDetail.id}/cancel/`, {
        reason_code: cancelReason,
        reason_text: cancelReasonText,
        restock: cancelRestock,
      });
      pushToast?.({ message: res?.data?.detail || "Ticket annulé.", type: "success" });
      setCancelDrawerOpen(false);
      setTicketDrawerOpen(false);
      setTicketDetail(null);
      fetchTickets();
      fetchReport();
      fetchCashSession();
    } catch (error) {
      pushToast?.({
        message: error?.response?.data?.detail || "Impossible d’annuler le ticket.",
        type: "error",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const printTicket = (ticket) => {
    if (!ticket) return;
    const printWindow = window.open("", "pos-ticket", "width=420,height=720");
    if (!printWindow) {
      pushToast?.({ message: "Autorisez l’ouverture de la fenêtre d’impression.", type: "warn" });
      return;
    }
    const linesHtml = (ticket.lines || [])
      .map(
        (line) => `
          <tr>
            <td>${line.product_name || "Produit"}</td>
            <td style="text-align:center;">${line.qty}</td>
            <td style="text-align:right;">${formatMoney(line.unit_price)} €</td>
            <td style="text-align:right;">${formatMoney(line.line_total)} €</td>
          </tr>`
      )
      .join("");
    const paymentsHtml = (ticket.payments || [])
      .map(
        (pay) => `
          <tr>
            <td>${METHODS.find((m) => m.value === pay.method)?.label || pay.method}</td>
            <td style="text-align:right;">${formatMoney(pay.amount)} €</td>
          </tr>`
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>Ticket ${ticket.reference || ticket.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            h2 { font-size: 14px; margin: 18px 0 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 6px 0; border-bottom: 1px solid #ddd; }
            .totals { margin-top: 12px; font-weight: 700; text-align: right; }
            .muted { color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>StockScan POS</h1>
          <div class="muted">Ticket ${ticket.reference || ticket.id}</div>
          <div class="muted">${ticket.created_at ? new Date(ticket.created_at).toLocaleString("fr-FR") : ""}</div>
          <h2>Produits</h2>
          <table>
            <thead>
              <tr>
                <th style="text-align:left;">Produit</th>
                <th style="text-align:center;">Qté</th>
                <th style="text-align:right;">PU</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
          <h2>Paiements</h2>
          <table>
            <tbody>${paymentsHtml}</tbody>
          </table>
          <div class="totals">Total: ${formatMoney(ticket.total_amount ?? ticket.total)} €</div>
        </body>
      </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // ===== Layout classes =====
  const root = "h-[100dvh] overflow-hidden";
  const header = "h-16 px-4 flex items-center justify-between gap-3";
  const main = `h-[calc(100dvh-${HEADER_H}px-${DOCK_H}px)] grid grid-cols-[420px_minmax(0,1fr)_380px] gap-3 p-3`;
  const dock = "fixed left-0 right-0 bottom-0 z-40";

  // ===== UI small components =====
  const SmallStat = ({ label, value }) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="text-sm font-extrabold text-[var(--text)]">{value}</div>
    </div>
  );

  const QtyButton = ({ onClick, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-9 w-9 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl flex items-center justify-center text-[var(--text)] active:scale-[0.99]"
    >
      {children}
    </button>
  );

  return (
    <PageTransition>
      <Helmet>
        <title>POS | StockScan</title>
        <meta name="description" content="Caisse StockScan POS — interface caisse tablette, rapide et touch-friendly." />
      </Helmet>

      <LandscapeOverlay open={isPortrait} onTry={requestLock} />

      <div className={root}>
        {/* HEADER FIXE */}
        <div className="sticky top-0 z-50">
          <GlassPanel className={header}>
            <div className="flex items-center gap-3 min-w-0">
              <PosLogo />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] truncate">
                  Caisse · {serviceLabel ? `Service : ${serviceLabel}` : "Sélectionnez un service"}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-lg font-black text-[var(--text)] truncate">StockScan POS</div>
                  <Badge variant={isKdsMode ? "info" : "success"}>{isKdsMode ? "KDS" : "POS"}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setToolsOpen(true)}
                title="Rapport, tickets, session caisse…"
              >
                <Wrench className="h-4 w-4" />
                Outils
              </Button>

              {isKdsAvailable ? (
                <Button as={Link} to="/kds/app" size="sm" variant="secondary" title="Aller au KDS">
                  <LayoutGrid className="h-4 w-4" />
                  KDS
                </Button>
              ) : null}

              <Button as={Link} to={coreCta.href} size="sm" variant="secondary" title="Ouvrir StockScan">
                <Store className="h-4 w-4" />
                {coreCta.label}
              </Button>

              <Button size="sm" variant="ghost" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </div>
          </GlassPanel>
        </div>

        {/* MAIN GRID */}
        <div className={main}>
          {/* LEFT: TABLEUR PANIER */}
          <GlassPanel className="overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-[var(--muted)]" />
                <div className="font-extrabold text-[var(--text)]">Panier</div>
              </div>

              <div className="flex items-center gap-2">
                <SmallStat label="Total" value={`${formatMoney(totals.total)} €`} />
                <SmallStat label="Reste" value={remainingLabel} />
              </div>
            </div>

            {showGuide ? (
              <div className="px-4 py-3 border-b border-[var(--border)]/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-[var(--muted)] leading-relaxed">
                    <span className="font-semibold text-[var(--text)]">Astuce :</span>{" "}
                    tape sur un champ (qté, prix, remise, paiement) puis utilise le{" "}
                    <span className="font-semibold text-[var(--text)]">clavier</span>.
                  </div>
                  <button
                    type="button"
                    onClick={dismissGuide}
                    className="text-xs font-bold text-[var(--text)] opacity-80 hover:opacity-100"
                    title="Masquer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 border-b border-[var(--border)]/70 flex justify-end">
                <button
                  type="button"
                  onClick={reopenGuide}
                  className="text-xs font-semibold text-[var(--text)] underline underline-offset-4 opacity-80 hover:opacity-100"
                >
                  Relancer l’astuce
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {isKdsMode ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-[var(--text)]">Encaissement KDS</div>
                    <Button variant="ghost" size="sm" onClick={resetKdsCheckout}>
                      Quitter
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(kdsCheckout?.lines || []).map((line, idx) => (
                      <div
                        key={`${line.menu_item_name}-${idx}`}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--text)] truncate">
                              {line.menu_item_name}
                            </div>
                            {line.notes ? (
                              <div className="text-xs text-[var(--muted)] truncate">
                                Note : {line.notes}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {formatMoney(line.line_total)} €
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-[var(--muted)]">Qté : {line.qty}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2 text-xs text-[var(--muted)]">
                    Stock mis à jour uniquement à l’encaissement.
                  </div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="p-6 text-sm text-[var(--muted)]">
                  Ajoute des produits avec les touches (centre) ou recherche/scanner.
                </div>
              ) : (
                <div className="p-3">
                  <div className="min-w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--surface)]/80 backdrop-blur-xl">
                        <tr className="text-xs text-[var(--muted)]">
                          <th className="text-left py-2 px-2 font-bold">Produit</th>
                          <th className="text-center py-2 px-2 font-bold">Qté</th>
                          <th className="text-right py-2 px-2 font-bold">PU</th>
                          <th className="text-right py-2 px-2 font-bold">Remise</th>
                          <th className="text-right py-2 px-2 font-bold">Total</th>
                          <th className="text-right py-2 px-2 font-bold"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item, idx) => {
                          const line = computeLineTotals(item);
                          const sku = item.internal_sku || item.barcode || "";
                          return (
                            <tr
                              key={item.id}
                              className="border-b border-[var(--border)]/50"
                            >
                              <td className="py-2 px-2">
                                <div className="font-semibold text-[var(--text)] leading-tight">
                                  {item.name}
                                </div>
                                {sku ? (
                                  <div className="text-[11px] text-[var(--muted)] truncate">{sku}</div>
                                ) : null}
                              </td>

                              <td className="py-2 px-2">
                                <div className="flex items-center justify-center gap-2">
                                  <QtyButton
                                    title="Moins"
                                    onClick={() =>
                                      updateCartItem(item.id, {
                                        qty: String(Math.max(parseNumber(item.qty) - 1, 1)),
                                      })
                                    }
                                  >
                                    <Minus className="h-4 w-4" />
                                  </QtyButton>

                                  <button
                                    type="button"
                                    onClick={() => setActiveField({ type: "line_qty", idx })}
                                    className={[
                                      "h-9 min-w-[56px] px-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl font-extrabold text-[var(--text)]",
                                      activeField.type === "line_qty" && activeField.idx === idx
                                        ? "ring-2 ring-[var(--accent)]/35"
                                        : "",
                                    ].join(" ")}
                                    title="Taper pour saisir via clavier"
                                  >
                                    {parseNumber(item.qty)}
                                  </button>

                                  <QtyButton
                                    title="Plus"
                                    onClick={() =>
                                      updateCartItem(item.id, { qty: String(parseNumber(item.qty) + 1) })
                                    }
                                  >
                                    <Plus className="h-4 w-4" />
                                  </QtyButton>
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setActiveField({ type: "line_price", idx })}
                                  className={[
                                    "inline-flex items-center justify-end h-9 min-w-[92px] px-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl font-extrabold text-[var(--text)]",
                                    activeField.type === "line_price" && activeField.idx === idx
                                      ? "ring-2 ring-[var(--accent)]/35"
                                      : "",
                                  ].join(" ")}
                                  title="Taper pour saisir via clavier"
                                >
                                  {item.unit_price === "" ? "—" : formatMoney(item.unit_price)}
                                </button>
                              </td>

                              <td className="py-2 px-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveField({ type: "line_disc", idx })}
                                    className={[
                                      "inline-flex items-center justify-end h-9 min-w-[92px] px-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl font-extrabold text-[var(--text)]",
                                      activeField.type === "line_disc" && activeField.idx === idx
                                        ? "ring-2 ring-[var(--accent)]/35"
                                        : "",
                                    ].join(" ")}
                                    title="Taper pour saisir via clavier"
                                  >
                                    {item.discount === "" ? "—" : normalizeNumericString(item.discount)}
                                  </button>

                                  <SegmentedPill
                                    value={item.discount_type}
                                    onChange={(v) => updateCartItem(item.id, { discount_type: v })}
                                    options={DISCOUNT_TYPES}
                                  />
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right font-extrabold text-[var(--text)]">
                                {formatMoney(line.total)} €
                              </td>

                              <td className="py-2 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeCartItem(item.id)}
                                  className="h-9 w-9 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Global discount inline (no scroll) */}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BadgePercent className="h-4 w-4 text-[var(--muted)]" />
                        <div className="text-sm font-bold text-[var(--text)]">Remise globale</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveField({ type: "global", idx: 0 })}
                          className={[
                            "h-9 min-w-[120px] px-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl font-extrabold text-[var(--text)] text-right",
                            activeField.type === "global" ? "ring-2 ring-[var(--accent)]/35" : "",
                          ].join(" ")}
                          title="Taper pour saisir via clavier"
                        >
                          {globalDiscount.value === "" ? "—" : normalizeNumericString(globalDiscount.value)}
                        </button>

                        <SegmentedPill
                          value={globalDiscount.type}
                          onChange={(v) => setGlobalDiscount((prev) => ({ ...prev, type: v }))}
                          options={DISCOUNT_TYPES}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* CENTER: CATALOG TOUCHES (RTL horizontal, lazy) */}
          <GlassPanel className="overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[var(--muted)]" />
                <div className="font-extrabold text-[var(--text)]">Touches produits</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-[var(--muted)] hidden md:block">
                  Tape / scan → résultats. Scroll horizontal (droite → gauche).
                </div>
                <Badge variant="info">
                  <span className="font-extrabold">{formatMoney(totals.total)} €</span>
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-[var(--border)]/70">
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2.5">
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCatalogPage(1);
                  }}
                  placeholder={isKdsMode ? "Mode KDS : recherche désactivée" : "Nom, code-barres ou SKU"}
                  className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none"
                  disabled={isKdsMode}
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  disabled={isKdsMode}
                  className="rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-extrabold text-[var(--text)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
                  title="Scanner"
                >
                  <span className="inline-flex items-center gap-2">
                    <ScanLine className="h-4 w-4" />
                    Scanner
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCatalog([]);
                    focusSearch();
                  }}
                  disabled={isKdsMode}
                  className="rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-extrabold text-[var(--text)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
                  title="Effacer"
                >
                  Clear
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>
                  {query.trim()
                    ? catalogLoading
                      ? "Recherche…"
                      : `${catalog.length} résultat(s)`
                    : "Lance une recherche (ou scan) pour afficher des touches."}
                </span>
                <span className="inline-flex items-center gap-2">
                  {catalogLoadingMore ? "Chargement…" : null}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div
                ref={catalogScrollRef}
                dir="rtl"
                className="h-full overflow-x-auto overflow-y-hidden"
              >
                <div className="h-full flex gap-3 p-3" dir="ltr">
                  {!query.trim() ? (
                    <div className="h-full w-full grid place-items-center text-sm text-[var(--muted)]">
                      Recherche un produit pour afficher les touches.
                    </div>
                  ) : catalogLoading && catalog.length === 0 ? (
                    <div className="h-full w-full grid place-items-center text-sm text-[var(--muted)]">
                      Chargement…
                    </div>
                  ) : catalog.length === 0 ? (
                    <div className="h-full w-full grid place-items-center text-sm text-[var(--muted)]">
                      Aucun résultat.
                    </div>
                  ) : (
                    catalog.map((p) => {
                      const price = p.selling_price ? formatMoney(p.selling_price) : null;
                      const disabled = isKdsMode;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            addToCart(p);
                            // keep query for fast multi adds; optional: clear if you want
                          }}
                          className={[
                            "w-[210px] min-w-[210px] h-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl p-4 text-left",
                            "active:scale-[0.99] transition",
                            disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]",
                          ].join(" ")}
                          title={disabled ? "Mode KDS : touches désactivées" : "Ajouter"}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-[var(--text)] truncate">
                                {p.name}
                              </div>
                              <div className="mt-1 text-xs text-[var(--muted)] truncate">
                                {p.category || "Sans catégorie"}
                              </div>
                            </div>
                            <Badge variant={price ? "success" : "danger"}>
                              {price ? `${price} €` : "Prix?"}
                            </Badge>
                          </div>

                          <div className="mt-3 text-xs text-[var(--muted)]">
                            Stock : {p.quantity} {p.unit}
                          </div>

                          <div className="mt-4">
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--accent)]/10 px-3 py-2 text-xs font-extrabold text-[var(--text)]">
                              <Plus className="h-4 w-4" />
                              Ajouter
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}

                  {/* loading tile */}
                  {catalogLoadingMore ? (
                    <div className="w-[210px] min-w-[210px] h-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl grid place-items-center text-sm text-[var(--muted)]">
                      Chargement…
                    </div>
                  ) : null}

                  {/* end hint */}
                  {query.trim() && !catalogHasMore && catalog.length > 0 ? (
                    <div className="w-[210px] min-w-[210px] h-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/35 backdrop-blur-xl grid place-items-center text-xs text-[var(--muted)]">
                      Fin des résultats
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* RIGHT: PAYMENTS + KEYPAD */}
          <GlassPanel className="overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[var(--muted)]" />
                <div className="font-extrabold text-[var(--text)]">Paiements</div>
              </div>

              <div
                className={[
                  "rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-extrabold",
                  isPaidExact
                    ? "bg-[var(--accent)]/12 text-[var(--text)]"
                    : isOverpaid
                    ? "bg-[var(--danger)]/10 text-[var(--text)]"
                    : "bg-[var(--surface)]/60 text-[var(--text)]",
                ].join(" ")}
                title="Restant / rendu"
              >
                {isPaidExact ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> OK
                  </span>
                ) : (
                  remainingLabel
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-3">
              {isKdsMode ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3 text-xs text-[var(--muted)]">
                  Mode KDS : paiements uniquement (pas de remise / pas d’ajout produits).
                </div>
              ) : null}

              <div className="space-y-2">
                {payments.map((payment, idx) => (
                  <div
                    key={idx}
                    className={[
                      "rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3",
                      activeField.type === "payment" && activeField.idx === idx ? "ring-2 ring-[var(--accent)]/35" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Paiement {idx + 1}
                      </div>

                      {payments.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs font-extrabold text-[var(--muted)] hover:text-[var(--text)]"
                          onClick={() => removePaymentLine(idx)}
                          title="Supprimer"
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-[1fr_140px] gap-2 items-end">
                      <Select
                        value={payment.method}
                        onChange={(value) => setPaymentAtIndex(idx, { method: value })}
                        options={METHODS}
                      />

                      <button
                        type="button"
                        onClick={() => setActiveField({ type: "payment", idx })}
                        className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl px-3 text-right text-sm font-black text-[var(--text)]"
                        title="Taper pour saisir via clavier"
                      >
                        {payment.amount === "" ? "—" : normalizeNumericString(payment.amount)}
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveField({ type: "payment", idx });
                          fillRemainingInto(idx);
                        }}
                        className="text-xs font-extrabold text-[var(--text)] underline underline-offset-4 opacity-80 hover:opacity-100"
                        disabled={isPaidExact}
                        title="Remplir ce paiement avec le montant restant"
                      >
                        Remplir le reste ici
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveField({ type: "payment", idx });
                          clearActive();
                        }}
                        className="text-xs font-extrabold text-[var(--muted)] hover:text-[var(--text)]"
                        title="Effacer le montant"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={addPaymentLine}>
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const idx = Math.max(payments.length - 1, 0);
                    setActiveField({ type: "payment", idx });
                    fillRemainingInto(idx);
                  }}
                  disabled={isPaidExact || remaining <= 0.01}
                >
                  <Sparkles className="h-4 w-4" />
                  Remplir le reste
                </Button>
              </div>

              <div className="pt-2">
                <div className="text-xs font-extrabold text-[var(--muted)] uppercase tracking-wide mb-2">
                  Clavier tactile
                </div>
                <Keypad
                  onKey={appendKey}
                  onClear={clearActive}
                  onBackspace={backspace}
                  onExact={exact}
                  onFillRemaining={fillRemaining}
                />
              </div>

              <div className="pt-2">
                <div className="text-xs font-extrabold text-[var(--muted)] uppercase tracking-wide mb-2">
                  Note
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optionnel"
                    className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none resize-none"
                    disabled={isKdsMode}
                  />
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* BOTTOM DOCK FIXE */}
        <div className={dock}>
          <GlassPanel className="rounded-none border-x-0 border-b-0 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  Total net
                </div>
                <div className="text-3xl font-black text-[var(--text)] leading-none">
                  <MoneyText value={totals.total} />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Paiements : {formatMoney(paymentTotal)} € · {remainingLabel}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {lastTicket ? (
                  <Button
                    variant="secondary"
                    onClick={() => printTicket(lastTicket)}
                    title="Imprimer le dernier ticket"
                  >
                    <Printer className="h-4 w-4" />
                    Ticket
                  </Button>
                ) : null}

                <Button
                  onClick={handleCheckout}
                  loading={checkoutLoading}
                  disabled={!isPaidExact || checkoutLoading}
                  className="min-w-[220px]"
                  title={!isPaidExact ? "Les paiements doivent être exacts" : "Valider le paiement"}
                >
                  <Check className="h-4 w-4" />
                  Valider
                </Button>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Scanner */}
        <BarcodeScannerModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={(code) => {
            setQuery(code);
            setScanOpen(false);
            focusSearch();
          }}
        />

        {/* Outils drawer (rapport / session / tickets / KDS tables) */}
        <Drawer
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          title="Outils POS"
          footer={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={fetchReport} disabled={reportLoading}>
                Rafraîchir rapport
              </Button>
              <Button variant="secondary" onClick={fetchTickets} disabled={ticketsLoading}>
                Rafraîchir tickets
              </Button>
              <Button variant="ghost" onClick={() => setToolsOpen(false)}>
                Fermer
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* KDS open tables */}
            {isKdsAvailable ? (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Tables ouvertes (KDS)</div>
                    <div className="text-xs text-[var(--muted)]">Encaisser une commande en 1 clic.</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={fetchKdsOpenTables} disabled={kdsLoading}>
                    Actualiser
                  </Button>
                </div>

                {kdsLoading ? (
                  <div className="text-sm text-[var(--muted)]">Chargement…</div>
                ) : kdsOpenTables.length === 0 ? (
                  <div className="text-sm text-[var(--muted)]">Aucune table ouverte.</div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {kdsOpenTables.map((row) => (
                      <Card key={row.order_id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-[var(--text)]">{row.table_name}</div>
                          <Badge variant="info">{KDS_STATUS_LABELS[row.status] || row.status}</Badge>
                        </div>
                        <div className="text-sm text-[var(--muted)]">Total : {formatMoney(row.total)} €</div>
                        <Button size="sm" onClick={() => startKdsCheckout(row.order_id)} loading={kdsCheckoutLoading}>
                          Encaisser
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            {/* Rapport */}
            <Card className="p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--text)]">Résumé POS (30 jours)</div>
              {reportLoading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : report ? (
                <div className="space-y-2 text-sm text-[var(--text)]">
                  <div className="flex justify-between">
                    <span>Total net</span>
                    <span>{formatMoney(report.total_net)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remises</span>
                    <span>{formatMoney(report.total_remises)} €</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Paiements
                  </div>
                  <div className="space-y-1 text-xs text-[var(--muted)]">
                    {Array.isArray(report.payments_by_method) && report.payments_by_method.length ? (
                      report.payments_by_method.map((row) => (
                        <div key={row.method} className="flex justify-between">
                          <span>{METHODS.find((m) => m.value === row.method)?.label || row.method}</span>
                          <span>{formatMoney(row.total)} €</span>
                        </div>
                      ))
                    ) : (
                      <div>Aucun paiement enregistré.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">Aucune donnée disponible.</div>
              )}
            </Card>

            {/* Session caisse */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Session de caisse</div>
                  <div className="text-xs text-[var(--muted)]">Clôture = récap session.</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCloseSession}
                  disabled={!cashSession?.active || cashSessionClosing}
                  loading={cashSessionClosing}
                >
                  Clôturer
                </Button>
              </div>

              {cashSessionLoading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : cashSession?.active && cashSession.summary ? (
                <div className="space-y-2 text-sm text-[var(--text)]">
                  <div className="flex justify-between">
                    <span>Total net</span>
                    <span>{formatMoney(cashSession.summary.total_net)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remises</span>
                    <span>{formatMoney(cashSession.summary.total_remises)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tickets</span>
                    <span>{cashSession.summary.total_tickets}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Par moyen
                  </div>
                  <div className="space-y-1 text-xs text-[var(--muted)]">
                    {(cashSession.summary.payments_by_method || []).map((row) => (
                      <div key={row.method} className="flex justify-between">
                        <span>{METHODS.find((m) => m.value === row.method)?.label || row.method}</span>
                        <span>{formatMoney(row.total)} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  Aucune caisse ouverte. Le prochain encaissement ouvrira une session.
                </div>
              )}
            </Card>

            {/* Tickets */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Historique tickets</div>
                <Button size="sm" variant="secondary" onClick={fetchTickets} disabled={ticketsLoading}>
                  Rafraîchir
                </Button>
              </div>

              {ticketsLoading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : tickets.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun ticket.</div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => fetchTicketDetail(ticket.id)}
                      className="w-full text-left"
                    >
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[var(--text)] truncate">{ticket.reference}</div>
                          <div className="text-xs text-[var(--muted)] truncate">
                            {ticket.created_at ? new Date(ticket.created_at).toLocaleString("fr-FR") : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {formatMoney(ticket.total_amount)} €
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {ticket.status === "PAID" ? "Payé" : "Annulé"}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </Drawer>

        {/* Modal prix manquants */}
        <Drawer
          open={priceModalOpen}
          onClose={() => setPriceModalOpen(false)}
          title="Prix de vente manquants"
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPriceModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={saveMissingPricesAndCheckout}>Enregistrer &amp; encaisser</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="text-sm text-[var(--muted)]">
              Certains produits n’ont pas de prix de vente. Renseignez-les pour continuer.
            </div>
            {missingPriceProducts.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="text-sm font-semibold text-[var(--text)]">{p.name || "Produit"}</div>
                <input
                  value={priceEdits[p.id] ?? ""}
                  onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="Prix de vente"
                  className="w-full h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur px-3 text-sm text-[var(--text)] outline-none"
                />
              </div>
            ))}
          </div>
        </Drawer>

        {/* Drawer détail ticket */}
        <Drawer
          open={ticketDrawerOpen}
          onClose={() => {
            setTicketDrawerOpen(false);
            setTicketDetail(null);
          }}
          title="Détail du ticket"
          footer={
            ticketDetail ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => printTicket(ticketDetail)}>
                  <Printer className="h-4 w-4" />
                  Imprimer
                </Button>
                {ticketDetail.status === "PAID" ? (
                  <Button variant="danger" onClick={openCancelDrawer}>
                    <RotateCcw className="h-4 w-4" />
                    Annuler
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => setTicketDrawerOpen(false)}>
                  Fermer
                </Button>
              </div>
            ) : null
          }
        >
          {ticketDetail ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{ticketDetail.reference}</div>
                <div className="text-xs text-[var(--muted)]">{new Date(ticketDetail.created_at).toLocaleString("fr-FR")}</div>
                <div className="text-xs text-[var(--muted)]">
                  Statut : {ticketDetail.status === "PAID" ? "Payé" : "Annulé"}
                </div>
              </div>

              <div className="space-y-2">
                {(ticketDetail.lines || []).map((line) => (
                  <div
                    key={line.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur p-3 space-y-1"
                  >
                    <div className="font-semibold text-[var(--text)]">{line.product_name}</div>
                    <div className="text-xs text-[var(--muted)]">{line.internal_sku || line.barcode || ""}</div>
                    <div className="flex justify-between text-sm text-[var(--text)]">
                      <span>Qté {line.qty}</span>
                      <span>{formatMoney(line.line_total)} €</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-[var(--text)]">Paiements</div>
                {(ticketDetail.payments || []).map((pay) => (
                  <div key={pay.id} className="flex justify-between text-sm text-[var(--text)]">
                    <span>{METHODS.find((m) => m.value === pay.method)?.label || pay.method}</span>
                    <span>{formatMoney(pay.amount)} €</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-sm text-[var(--text)]">
                <div className="flex justify-between">
                  <span>Total brut</span>
                  <span>{formatMoney(ticketDetail.subtotal_amount)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Remises</span>
                  <span>{formatMoney(ticketDetail.discount_total)} €</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total net</span>
                  <span>{formatMoney(ticketDetail.total_amount)} €</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">Chargement…</div>
          )}
        </Drawer>

        {/* Drawer annulation */}
        <Drawer
          open={cancelDrawerOpen}
          onClose={() => setCancelDrawerOpen(false)}
          title="Annuler le ticket"
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCancelDrawerOpen(false)}>
                Fermer
              </Button>
              <Button variant="danger" onClick={handleCancelTicket} loading={cancelLoading}>
                Confirmer l’annulation
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="text-sm text-[var(--muted)]">
              Indiquez la raison et choisissez si le stock peut être réintégré.
            </div>

            <Select
              label="Raison"
              value={cancelReason}
              onChange={(val) => setCancelReason(val)}
              options={CANCEL_REASONS}
            />

            {cancelReason === "other" ? (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--text)]">Précision</div>
                <input
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  placeholder="Ex. erreur de saisie"
                  className="w-full h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur px-3 text-sm text-[var(--text)] outline-none"
                />
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={cancelRestock}
                onChange={(e) => {
                  setCancelRestock(e.target.checked);
                  setCancelRestockTouched(true);
                }}
                className="h-4 w-4"
              />
              Produits revendables : réintégrer le stock
            </label>

            {cancelReason === "breakage" ? (
              <div className="text-xs text-[var(--muted)]">
                En cas de casse, laissez décoché pour enregistrer la perte (stock non réintégré).
              </div>
            ) : null}
          </div>
        </Drawer>
      </div>
    </PageTransition>
  );
}