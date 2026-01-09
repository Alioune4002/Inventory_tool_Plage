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

const POS_GUIDE_STORAGE = "pos_guide_v1";

const KDS_STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "En cuisine",
  READY: "Prêt",
  SERVED: "Servi",
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const parseNumber = (value) => {
  const raw = String(value || "").replace(",", ".").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const clamp2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

export default function Pos() {
  const { serviceId, serviceProfile, services, tenant, logout } = useAuth();
  const pushToast = useToast();

  const kdsActive = isKdsEnabled(serviceProfile);
  const isServiceSelected = Boolean(serviceId && String(serviceId) !== "all");
  const isKdsAvailable = kdsActive && isServiceSelected;

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
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
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return localStorage.getItem(POS_GUIDE_STORAGE) !== "1";
    } catch {
      return true;
    }
  });

  const searchInputRef = useRef(null);

  const isKdsMode = Boolean(kdsCheckout);
  const serviceLabel = serviceProfile?.name || "";
  const hasCoreAccess = Boolean(tenant && (serviceProfile || services?.length));
  const coreCta = hasCoreAccess
    ? { label: "Ouvrir StockScan", href: "/app/dashboard" }
    : { label: "Activer StockScan", href: "/app/settings" };

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

  const focusSearch = () => {
    try {
      searchInputRef.current?.focus?.();
    } catch {
      // noop
    }
  };

  const fetchProducts = useCallback(
    async (value) => {
      const q = String(value || "").trim();
      if (!q) {
        setProducts([]);
        return [];
      }
      setSearchLoading(true);
      try {
        const res = await api.get(`/api/pos/products/search/?q=${encodeURIComponent(q)}`);
        setProducts(res.data || []);
        return res.data || [];
      } catch {
        pushToast?.({ message: "Impossible de charger les produits.", type: "error" });
        return [];
      } finally {
        setSearchLoading(false);
      }
    },
    [pushToast]
  );

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

  const openCancelDrawer = () => {
    setCancelReason("error");
    setCancelReasonText("");
    setCancelRestock(true);
    setCancelDrawerOpen(true);
  };

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
          <div class="muted">${new Date(ticket.created_at).toLocaleString("fr-FR")}</div>
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
          <div class="totals">Total: ${formatMoney(ticket.total_amount)} €</div>
        </body>
      </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const resetKdsCheckout = () => {
    setKdsCheckout(null);
    setCartItems([]);
    setPayments([{ method: "cash", amount: "" }]);
    setGlobalDiscount({ value: "", type: "amount" });
    setNote("");
    setQuery("");
    setProducts([]);
    focusSearch();
  };

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
      setQuery("");
      setProducts([]);
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

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchProducts(query);
    }, 240);
    return () => window.clearTimeout(handle);
  }, [query, fetchProducts]);

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

  const addToCart = (product) => {
    if (isKdsMode) {
      pushToast?.({
        message: "Encaissement KDS en cours : terminez ou annulez avant d’ajouter des produits.",
        type: "warn",
      });
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, qty: parseNumber(p.qty) + 1 } : p));
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
          qty: 1,
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

  const handleSearchEnter = async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (isKdsMode) return;
    const results = await fetchProducts(query);
    if (results.length === 1) {
      addToCart(results[0]);
      setQuery("");
      setProducts([]);
      focusSearch();
    }
  };

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

      setCartItems([]);
      setPayments([{ method: "cash", amount: "" }]);
      setGlobalDiscount({ value: "", type: "amount" });
      setNote("");
      setQuery("");
      setProducts([]);

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

  // --- UX Paiements ---
  const setPaymentAtIndex = (idx, patch) => {
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const fillRemainingInto = (idx) => {
    const rest = clamp2(totals.total - payments.reduce((acc, p, i) => acc + (i === idx ? 0 : parseNumber(p.amount)), 0));
    const safe = Math.max(rest, 0);
    setPaymentAtIndex(idx, { amount: safe ? formatMoney(safe) : "0.00" });
  };

  const fillRemainingIntoLast = () => {
    const idx = Math.max(payments.length - 1, 0);
    fillRemainingInto(idx);
  };

  const ensureAtLeastOnePayment = () => {
    setPayments((prev) => (prev?.length ? prev : [{ method: "cash", amount: "" }]));
  };

  const addPaymentLine = () => {
    setPayments((prev) => [...prev, { method: "cash", amount: "" }]);
  };

  const removePaymentLine = (idx) => {
    setPayments((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ method: "cash", amount: "" }];
    });
  };

  useEffect(() => {
    ensureAtLeastOnePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glassCard = "bg-[var(--surface)]/65 backdrop-blur-xl border border-[var(--border)]/70";

  return (
    <PageTransition>
      <Helmet>
        <title>POS | StockScan</title>
        <meta name="description" content="Caisse StockScan POS pour gérer les ventes en boutique." />
      </Helmet>

      <div className="space-y-4">
        <Card className={`p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${glassCard}`}>
          <div className="flex items-center gap-3">
            <PosLogo />
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Caisse enregistreuse gratuite en ligne
              </div>
              <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-2">
                StockScan POS <Sparkles className="h-5 w-5 text-[var(--muted)]" />
              </h1>
              <p className="text-sm text-[var(--muted)]">
                Encaissez sur tablette, mobile ou ordinateur — rapide, clair, sans friction.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-2">
            {serviceLabel ? <div className="text-xs text-[var(--muted)]">Service actif : {serviceLabel}</div> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button as={Link} to={coreCta.href} size="sm" variant="secondary">
                {coreCta.label}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <ReceiptText className="h-4 w-4" />
              Stock mis à jour uniquement à l’encaissement.
            </div>
          </div>
        </Card>

        {showGuide ? (
          <Card className={`p-5 space-y-3 ${glassCard}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text)]">Guide express — bien démarrer la caisse</div>
              <Button size="sm" variant="ghost" onClick={dismissGuide}>
                Fermer
              </Button>
            </div>
            <ol className="list-decimal pl-5 text-sm text-[var(--muted)] space-y-1">
              <li>Recherchez ou scannez un produit pour l’ajouter au panier.</li>
              <li>Réglez en 1 paiement… ou multi-paiements si besoin.</li>
              <li>Utilisez “Remplir le reste” pour aller vite.</li>
              <li>Encaissez : stock + stats se mettent à jour à la validation.</li>
            </ol>
          </Card>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reopenGuide}
              className="text-xs font-semibold text-[var(--text)] underline underline-offset-4"
            >
              Relancer le guide POS
            </button>
          </div>
        )}

        {isKdsAvailable ? (
          <Card className={`p-5 space-y-3 ${glassCard}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Tables ouvertes</div>
                <div className="text-xs text-[var(--muted)]">Encaissez une commande KDS en un clic.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchKdsOpenTables} disabled={kdsLoading}>
                Actualiser
              </Button>
            </div>

            {kdsLoading ? (
              <div className="text-sm text-[var(--muted)]">Chargement des commandes…</div>
            ) : kdsOpenTables.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">Aucune table ouverte pour ce service.</div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {kdsOpenTables.map((row) => (
                  <Card key={row.order_id} className={`p-4 space-y-2 ${glassCard}`}>
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

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            <Card className={`p-5 space-y-4 ${glassCard}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <Search className="h-4 w-4" />
                  Recherche rapide
                </div>
                {!isKdsMode ? (
                  <div className="text-xs text-[var(--muted)]">Entrée = ajout auto si 1 résultat</div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                {isKdsMode ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur px-3 py-2.5 text-sm text-[var(--muted)]">
                    Encaissement KDS en cours. Terminez ou quittez pour reprendre la caisse classique.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur px-3 py-2.5">
                      <input
                        ref={searchInputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearchEnter}
                        placeholder="Nom, code-barres ou SKU"
                        className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setScanOpen(true)}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text)] hover:bg-[var(--accent)]/10"
                      >
                        Scanner
                      </button>
                    </div>
                    {products.length > 0 ? (
                      <div className="text-xs text-[var(--muted)]">
                        {searchLoading ? "Recherche…" : `${products.length} résultat(s)`}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--muted)]">Tapez un nom, scannez, puis validez.</div>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="text-sm font-semibold text-[var(--text)]">Produits</div>
              {isKdsMode ? (
                <div className="text-sm text-[var(--muted)]">Le catalogue POS est désactivé pendant l’encaissement KDS.</div>
              ) : searchLoading ? (
                <div className="text-sm text-[var(--muted)]">Recherche en cours…</div>
              ) : products.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Recherchez un produit pour l’ajouter au panier.</div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <Card key={product.id} className={`p-4 space-y-2 ${glassCard}`}>
                      <div className="font-semibold text-[var(--text)]">{product.name}</div>
                      <div className="text-xs text-[var(--muted)]">{product.category || "Sans catégorie"}</div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {product.selling_price ? `${formatMoney(product.selling_price)} €` : "Prix manquant"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Stock: {product.quantity} {product.unit}
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          addToCart(product);
                          // micro boost: garder le focus et permettre de scanner en boucle
                          setQuery("");
                          setProducts([]);
                          focusSearch();
                        }}
                      >
                        Ajouter
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--text)]">Panier</div>
                {isKdsMode ? (
                  <Badge variant="info">KDS</Badge>
                ) : cartItems.length ? (
                  <Badge variant="success">{cartItems.length}</Badge>
                ) : (
                  <Badge variant="info">—</Badge>
                )}
              </div>

              {isKdsMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-[var(--muted)]">Encaissement {kdsCheckout?.table || "commande"}</div>
                    <Button variant="ghost" size="sm" onClick={resetKdsCheckout}>
                      Quitter
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(kdsCheckout?.lines || []).map((line, idx) => (
                      <div
                        key={`${line.menu_item_name}-${idx}`}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur p-3 space-y-2"
                      >
                        <div className="font-semibold text-[var(--text)]">{line.menu_item_name}</div>
                        {line.notes ? <div className="text-xs text-[var(--muted)]">Note : {line.notes}</div> : null}
                        <div className="flex justify-between text-sm text-[var(--text)]">
                          <span>Qté {line.qty}</span>
                          <span>{formatMoney(line.line_total)} €</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun article ajouté.</div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => {
                    const line = computeLineTotals(item);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[var(--text)]">{item.name}</div>
                            <div className="text-xs text-[var(--muted)]">{item.internal_sku || item.barcode || ""}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="rounded-full border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--accent)]/10"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.id, { qty: Math.max(parseNumber(item.qty) - 1, 1) })}
                            className="rounded-full border border-[var(--border)] p-1"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            min="1"
                            onChange={(e) => updateCartItem(item.id, { qty: e.target.value })}
                            className="w-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur px-2 py-1 text-sm text-[var(--text)]"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.id, { qty: parseNumber(item.qty) + 1 })}
                            className="rounded-full border border-[var(--border)] p-1"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-[var(--muted)]">{item.unit}</span>
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <Input
                            label="Prix unitaire"
                            value={item.unit_price}
                            onChange={(e) => updateCartItem(item.id, { unit_price: e.target.value })}
                            inputMode="decimal"
                          />
                          <div className="text-right text-sm font-semibold text-[var(--text)]">
                            {formatMoney(line.total)} €
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_100px] gap-2 items-end">
                          <Input
                            label="Remise ligne"
                            value={item.discount}
                            onChange={(e) => updateCartItem(item.id, { discount: e.target.value })}
                            inputMode="decimal"
                          />
                          <Select
                            value={item.discount_type}
                            onChange={(value) => updateCartItem(item.id, { discount_type: value })}
                            options={DISCOUNT_TYPES}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {!isKdsMode ? (
              <Card className={`p-5 space-y-3 ${glassCard}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <BadgePercent className="h-4 w-4" />
                  Remise globale
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-2 items-end">
                  <Input
                    label="Valeur"
                    value={globalDiscount.value}
                    onChange={(e) => setGlobalDiscount((prev) => ({ ...prev, value: e.target.value }))}
                    inputMode="decimal"
                  />
                  <Select
                    value={globalDiscount.type}
                    onChange={(value) => setGlobalDiscount((prev) => ({ ...prev, type: value }))}
                    options={DISCOUNT_TYPES}
                  />
                </div>
              </Card>
            ) : null}

            {/* Paiements - avec "Montant restant" + "Remplir le reste" */}
            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <CreditCard className="h-4 w-4" />
                  Paiements
                </div>

                <div
                  className={`rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold ${
                    isPaidExact
                      ? "text-[var(--text)] bg-[var(--accent)]/12"
                      : isOverpaid
                      ? "text-[var(--text)] bg-[var(--danger)]/10"
                      : "text-[var(--text)] bg-[var(--surface)]/60"
                  }`}
                  title="Montant restant / rendu"
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

              {isKdsMode ? (
                <div className="text-xs text-[var(--muted)]">Encaissement KDS (pas de remise supplémentaire).</div>
              ) : null}

              {!isPaidExact && remaining > 0.01 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={fillRemainingIntoLast}>
                    <Sparkles className="h-4 w-4" />
                    Remplir le reste
                  </Button>
                  <div className="text-xs text-[var(--muted)]">
                    Met le montant restant sur la dernière ligne de paiement.
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                {payments.map((payment, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="grid grid-cols-[1fr_140px] gap-2 items-end">
                      <Select
                        value={payment.method}
                        onChange={(value) => setPaymentAtIndex(idx, { method: value })}
                        options={METHODS}
                      />
                      <Input
                        label="Montant"
                        value={payment.amount}
                        onChange={(e) => setPaymentAtIndex(idx, { amount: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--text)] underline underline-offset-4"
                        onClick={() => fillRemainingInto(idx)}
                        disabled={isPaidExact}
                        title="Remplir ce paiement avec le montant restant"
                      >
                        Remplir le reste ici
                      </button>

                      {payments.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removePaymentLine(idx)}
                          className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                          title="Supprimer cette ligne"
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </div>

                    {idx !== payments.length - 1 ? (
                      <div className="h-px bg-[var(--border)]/60" />
                    ) : null}
                  </div>
                ))}

                <Button variant="secondary" size="sm" onClick={addPaymentLine}>
                  Ajouter un paiement
                </Button>
              </div>
            </Card>

            <Card className={`p-5 space-y-3 ${glassCard}`}>
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

            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Session de caisse</div>
                  <div className="text-xs text-[var(--muted)]">Résumé automatique des encaissements en cours.</div>
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
                  Aucune caisse ouverte. Le prochain encaissement ouvrira automatiquement une session.
                </div>
              )}
            </Card>

            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Historique des tickets</div>
                <Button size="sm" variant="ghost" onClick={fetchTickets}>
                  Rafraîchir
                </Button>
              </div>

              {ticketsLoading ? (
                <div className="text-sm text-[var(--muted)]">Chargement…</div>
              ) : tickets.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Aucun ticket enregistré.</div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{ticket.reference}</div>
                        <div className="text-xs text-[var(--muted)]">{new Date(ticket.created_at).toLocaleString("fr-FR")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[var(--text)]">{formatMoney(ticket.total_amount)} €</div>
                        <div className="text-xs text-[var(--muted)]">{ticket.status === "PAID" ? "Payé" : "Annulé"}</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => fetchTicketDetail(ticket.id)}>
                        Voir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Totaux + CTA encaissement */}
            <Card className={`p-5 space-y-3 ${glassCard}`}>
              <div className="text-xs text-[var(--muted)]">Totaux</div>

              <div className="flex justify-between text-sm text-[var(--text)]">
                <span>Total brut</span>
                <span>{formatMoney(totals.subtotal)} €</span>
              </div>

              <div className="flex justify-between text-sm text-[var(--text)]">
                <span>Remises</span>
                <span>-{formatMoney(totals.lineDiscount + totals.globalDiscount)} €</span>
              </div>

              <div className="flex justify-between text-base font-semibold text-[var(--text)]">
                <span>Total net</span>
                <span>{formatMoney(totals.total)} €</span>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur px-3 py-2 text-xs text-[var(--muted)] flex items-center justify-between">
                <span>Paiements saisis</span>
                <span className="font-semibold text-[var(--text)]">{formatMoney(paymentTotal)} €</span>
              </div>

              {!isKdsMode ? (
                <Input label="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
              ) : null}

              {!isPaidExact && remaining > 0.01 ? (
                <Button variant="secondary" onClick={fillRemainingIntoLast} className="w-full">
                  <Sparkles className="h-4 w-4" />
                  Remplir le reste
                </Button>
              ) : null}

              <Button
                onClick={handleCheckout}
                loading={checkoutLoading}
                className="w-full"
                disabled={!isPaidExact || checkoutLoading}
              >
                Confirmer paiement
              </Button>

              {!isPaidExact ? (
                <div className="text-xs text-[var(--muted)]">
                  {isOverpaid ? "Trop-perçu : ajustez les paiements." : "Il reste un montant à saisir."}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setQuery(code);
          setScanOpen(false);
          focusSearch();
        }}
      />

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
            <Input
              key={p.id}
              label={p.name || "Produit"}
              value={priceEdits[p.id] ?? ""}
              onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
              inputMode="decimal"
              placeholder="Prix de vente"
            />
          ))}
        </div>
      </Drawer>

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
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur p-3 space-y-1"
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
          <Select label="Raison" value={cancelReason} onChange={setCancelReason} options={CANCEL_REASONS} />
          {cancelReason === "other" ? (
            <Input
              label="Précision"
              value={cancelReasonText}
              onChange={(e) => setCancelReasonText(e.target.value)}
              placeholder="Ex. erreur de saisie"
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={cancelRestock}
              onChange={(e) => setCancelRestock(e.target.checked)}
              className="h-4 w-4"
            />
            Produits revendables : réintégrer le stock
          </label>
        </div>
      </Drawer>
    </PageTransition>
  );
}