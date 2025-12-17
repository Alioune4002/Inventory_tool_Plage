import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  demoCategories,
  demoInventoryItems,
  demoLosses,
  demoMe,
  demoServices,
  demoStats,
  demoTenant,
  getDemoMonth,
} from "../data/demoData";

const DemoContext = createContext(null);
export const useDemo = () => useContext(DemoContext);

/**
 * Orchestrateur de scénario:
 * 0 dashboard -> 1 inventory (scan) -> 2 add -> 3 loss -> 4 export -> 5 back dashboard
 */
export default function DemoProvider({ children }) {
  const [route, setRoute] = useState("dashboard"); // "inventory" | "exports" | "losses"
  const [month, setMonth] = useState(getDemoMonth());
  const [serviceId, setServiceId] = useState(demoServices[0].id);

  const [items, setItems] = useState(demoInventoryItems);
  const [losses, setLosses] = useState(demoLosses);

  const [highlight, setHighlight] = useState(null); // { area: "topbar"|"table"|"cta"..., text: "..." }
  const [toast, setToast] = useState(null);
  const [autoActive, setAutoActive] = useState(false);

  const services = demoServices;
  const currentService = services.find((s) => String(s.id) === String(serviceId));
  const tenant = demoTenant;

  const serviceFeatures = useMemo(
    () => ({
      prices: { purchase_enabled: true, selling_enabled: true, recommended: true },
      barcode: { enabled: true },
      sku: { enabled: true },
      dlc: { enabled: true, recommended: true },
      open_container_tracking: { enabled: true },
    }),
    []
  );

  const countingMode = "mixed";
  const serviceProfile = { service_type: currentService?.service_type || "other" };

  // mini-toasts (visuels)
  const pushToast = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    window.setTimeout(() => setToast(null), 2200);
  };

  // scénario auto
  useEffect(() => {
    if (!autoActive) {
      return undefined;
    }

    setRoute("dashboard");
    setItems(demoInventoryItems);
    setLosses(demoLosses);
    setHighlight(null);
    setToast(null);

    let t1, t2, t3, t4, t5;

    // Départ dashboard
    t1 = window.setTimeout(() => {
      setHighlight({ area: "kpi", text: "Vue instantanée : valeur stock, pertes, catégories." });
      pushToast("Bienvenue dans la démo (données fictives).", "success");
    }, 600);

    // Go inventory
    t2 = window.setTimeout(() => {
      setRoute("inventory");
      setHighlight({ area: "scan", text: "Scan : préremplissage EAN / SKU en 1 clic." });
    }, 2600);

    // Simuler ajout
    t3 = window.setTimeout(() => {
      setItems((prev) => [
        { id: 999, name: "Eau 1.5L", category: "Boissons", inventory_month: month, quantity: 24, unit: "pcs", barcode: "3254381023456" },
        ...prev,
      ]);
      pushToast("Produit ajouté : Eau 1.5L", "success");
      setHighlight({ area: "table", text: "Le produit apparaît immédiatement dans l’inventaire." });
    }, 5200);

    // Simuler perte
    t4 = window.setTimeout(() => {
      setRoute("losses");
      setLosses((prev) => [
        { id: 9100, product_name: "Eau 1.5L", quantity: 2, unit: "pcs", reason: "breakage", occurred_at: "2025-12-14T20:40", note: "Casse" },
        ...prev,
      ]);
      pushToast("Perte enregistrée (démo).", "warn");
      setHighlight({ area: "losses", text: "Déclarez pertes : casse, DLC, offerts… impact visible sur le dashboard." });
    }, 8200);

    // Export
    t5 = window.setTimeout(() => {
      setRoute("exports");
      setHighlight({ area: "export", text: "Export Excel + partage email en 1 action." });
      pushToast("Export Excel simulé + email simulé.", "success");
    }, 11000);

    return () => [t1, t2, t3, t4, t5].forEach((x) => x && window.clearTimeout(x));
  }, [month, autoActive]);

  const value = {
    // app-like
    me: demoMe,
    tenant,
    services,
    serviceId,
    selectService: setServiceId,
    currentService,
    isAllServices: false,
    serviceProfile,
    serviceFeatures,
    countingMode,

    // demo navigation
    route,
    setRoute,

    // demo data
    month,
    setMonth,
    items,
    setItems,
    categories: demoCategories,
    losses,
    setLosses,
    stats: demoStats,

    // UX
    highlight,
    toast,
    pushToast,
    setAutoActive,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
