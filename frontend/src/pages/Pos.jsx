import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { CreditCard, Search, Plus, Minus, Trash2, BadgePercent, ReceiptText } from "lucide-react";

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
  const { serviceId, serviceProfile } = useAuth();
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

  const [cartItems, setCartItems] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState({ value: "", type: "amount" });
  const [payments, setPayments] = useState([{ method: "cash", amount: "" }]);
  const [note, setNote] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [missingPriceProducts, setMissingPriceProducts] = useState([]);
  const [priceEdits, setPriceEdits] = useState({});
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const isKdsMode = Boolean(kdsCheckout);

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
      } catch (error) {
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
    } catch (error) {
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

  const resetKdsCheckout = () => {
    setKdsCheckout(null);
    setCartItems([]);
    setPayments([{ method: "cash", amount: "" }]);
    setGlobalDiscount({ value: "", type: "amount" });
    setNote("");
    setQuery("");
    setProducts([]);
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
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: parseNumber(p.qty) + 1 } : p
        );
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
      fetchReport();
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
      return res.data;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (isKdsMode) {
      if (Math.abs(paymentTotal - totals.total) > 0.01) {
        pushToast?.({
          message: "Le total des paiements doit correspondre au total net.",
          type: "error",
        });
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
        pushToast?.({
          message: data?.detail || "Impossible d’encaisser la commande.",
          type: "error",
        });
      }
      return;
    }

    if (!cartItems.length) {
      pushToast?.({ message: "Ajoutez au moins un produit.", type: "warn" });
      return;
    }
    if (Math.abs(paymentTotal - totals.total) > 0.01) {
      pushToast?.({
        message: "Le total des paiements doit correspondre au total net.",
        type: "error",
      });
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
      pushToast?.({
        message: data?.detail || "Impossible de valider le paiement.",
        type: "error",
      });
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
      updates.forEach((u) => {
        updateCartItem(u.id, { unit_price: u.price, selling_price: u.price });
      });
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

  return (
    <PageTransition>
      <Helmet>
        <title>POS | StockScan</title>
        <meta name="description" content="Caisse StockScan POS pour gérer les ventes en boutique." />
      </Helmet>

      <div className="space-y-4">
        <Card className="p-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <PosLogo />
            <div>
              <div className="text-sm text-[var(--muted)]">StockScan POS</div>
              <h1 className="text-2xl font-black text-[var(--text)]">Caisse multi‑services</h1>
              <p className="text-sm text-[var(--muted)]">
                Encaissez rapidement, suivez vos ventes et mettez le stock à jour.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <ReceiptText className="h-4 w-4" />
            Transactions sécurisées, stock mis à jour à la validation.
          </div>
        </Card>

        {isKdsAvailable ? (
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Tables ouvertes</div>
                <div className="text-xs text-[var(--muted)]">
                  Encaissez une commande envoyée en cuisine en un clic.
                </div>
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
                  <Card key={row.order_id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[var(--text)]">{row.table_name}</div>
                      <Badge variant="info">
                        {KDS_STATUS_LABELS[row.status] || row.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      Total : {formatMoney(row.total)} €
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startKdsCheckout(row.order_id)}
                      loading={kdsCheckoutLoading}
                    >
                      Encaisser
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Search className="h-4 w-4" />
                Recherche rapide
              </div>
              <div className="flex flex-col gap-2">
                {isKdsMode ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--muted)]">
                    Encaissement KDS en cours. Terminez ou annulez pour reprendre la caisse classique.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearchEnter}
                        placeholder="Nom, code‑barres ou SKU"
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
                    <div className="text-xs text-[var(--muted)]">
                      Astuce : scannez un produit puis validez avec Entrée pour l’ajouter au panier.
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Produits</div>
              {isKdsMode ? (
                <div className="text-sm text-[var(--muted)]">
                  Encaissement KDS en cours. Le catalogue POS est temporairement désactivé.
                </div>
              ) : searchLoading ? (
                <div className="text-sm text-[var(--muted)]">Recherche en cours…</div>
              ) : products.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">
                  Tapez un nom ou scannez un code‑barres pour afficher des produits.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <Card key={product.id} className="p-4 space-y-2">
                      <div className="font-semibold text-[var(--text)]">{product.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {product.category || "Sans catégorie"}
                      </div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {product.selling_price ? `${formatMoney(product.selling_price)} €` : "Prix manquant"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Stock: {product.quantity} {product.unit}
                      </div>
                      <Button size="sm" className="w-full" onClick={() => addToCart(product)}>
                        Ajouter
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Panier</div>
              {isKdsMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-[var(--muted)]">
                      Encaissement {kdsCheckout?.table || "commande"}
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetKdsCheckout}>
                      Quitter
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(kdsCheckout?.lines || []).map((line, idx) => (
                      <div key={`${line.menu_item_name}-${idx}`} className="rounded-2xl border border-[var(--border)] p-3 space-y-2">
                        <div className="font-semibold text-[var(--text)]">{line.menu_item_name}</div>
                        {line.notes ? (
                          <div className="text-xs text-[var(--muted)]">Note : {line.notes}</div>
                        ) : null}
                        <div className="flex justify-between text-sm text-[var(--text)]">
                          <span>
                            Qté {line.qty}
                          </span>
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
                      <div key={item.id} className="rounded-2xl border border-[var(--border)] p-3 space-y-2">
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
                            className="w-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]"
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
              <Card className="p-5 space-y-3">
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

            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <CreditCard className="h-4 w-4" />
                Paiements
              </div>
              {isKdsMode ? (
                <div className="text-xs text-[var(--muted)]">
                  Encaissement d’une commande KDS (aucune remise supplémentaire).
                </div>
              ) : null}
              <div className="space-y-2">
                {payments.map((payment, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_120px] gap-2 items-end">
                    <Select
                      value={payment.method}
                      onChange={(value) =>
                        setPayments((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, method: value } : p))
                        )
                      }
                      options={METHODS}
                    />
                    <Input
                      label="Montant"
                      value={payment.amount}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p))
                        )
                      }
                      inputMode="decimal"
                    />
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPayments((prev) => [...prev, { method: "cash", amount: "" }])}
                >
                  Ajouter un paiement
                </Button>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
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

            <Card className="p-5 space-y-3">
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
              <div className="text-xs text-[var(--muted)]">
                Paiements saisis : {formatMoney(paymentTotal)} €
              </div>
              {!isKdsMode ? (
                <Input
                  label="Note (optionnel)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              ) : null}
              <Button onClick={handleCheckout} loading={checkoutLoading} className="w-full">
                Confirmer paiement
              </Button>
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
    </PageTransition>
  );
}
