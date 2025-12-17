export function getDemoMonth() {
  return new Date().toISOString().slice(0, 7);
}

export const demoTenant = { name: "Camping de la Plage", domain: "food" };

export const demoServices = [
  { id: "101", name: "Salle", service_type: "restaurant_dining" },
  { id: "102", name: "Cuisine", service_type: "kitchen" },
];

export const demoMe = { username: "demo-owner" };

// Produits réalistes (mix entamé / non entamé)
export const demoInventoryItems = [
  { id: 1, name: "Coca 33cl", category: "Boissons", inventory_month: getDemoMonth(), quantity: 48, unit: "pcs", barcode: "5449000000996" },
  { id: 2, name: "Bière pression (fût)", category: "Boissons", inventory_month: getDemoMonth(), quantity: 1, unit: "pcs", internal_sku: "FUT-HEINEKEN" },
  { id: 3, name: "Steak haché 125g", category: "Viandes", inventory_month: getDemoMonth(), quantity: 60, unit: "pcs", barcode: "3700000000001", dlc: "2025-12-20" },
  { id: 4, name: "Farine 25kg", category: "Épicerie", inventory_month: getDemoMonth(), quantity: 2, unit: "pcs", internal_sku: "FAR-25" },
  { id: 5, name: "Gin (bouteille 70cl)", category: "Spiritueux", inventory_month: getDemoMonth(), quantity: 6, unit: "pcs", barcode: "5000281001206" },
];

export const demoCategories = [
  { id: "c1", name: "Boissons" },
  { id: "c2", name: "Épicerie" },
  { id: "c3", name: "Viandes" },
  { id: "c4", name: "Spiritueux" },
];

export const demoLosses = [
  { id: 9001, product_name: "Steak haché 125g", quantity: 6, unit: "pcs", reason: "expired", occurred_at: "2025-12-12T18:10", note: "DLC dépassée" },
  { id: 9002, product_name: "Coca 33cl", quantity: 3, unit: "pcs", reason: "breakage", occurred_at: "2025-12-05T21:03", note: "Casse en réserve" },
];

export const demoStats = {
  total_value: 612.35,
  total_selling_value: 1290.9,
  losses_total_cost: 24.6,
  losses_total_qty: 9,
  by_category: [
    { category: "Boissons", total_quantity: 49, total_purchase_value: 180, total_selling_value: 450, losses_qty: 3 },
    { category: "Viandes", total_quantity: 60, total_purchase_value: 210, total_selling_value: 480, losses_qty: 6 },
    { category: "Épicerie", total_quantity: 2, total_purchase_value: 100, total_selling_value: 160, losses_qty: 0 },
    { category: "Spiritueux", total_quantity: 6, total_purchase_value: 122.35, total_selling_value: 200.9, losses_qty: 0 },
  ],
  losses_by_reason: [
    { reason: "DLC dépassée", total_qty: 6, total_cost: 18.0 },
    { reason: "Casse", total_qty: 3, total_cost: 6.6 },
  ],
  by_product: [
    { name: "Coca 33cl", category: "Boissons", stock_final: 48, unit: "pcs", purchase_value_current: 24, selling_value_current: 72, losses_qty: 3, notes: ["EAN ok"] },
    { name: "Steak haché 125g", category: "Viandes", stock_final: 60, unit: "pcs", purchase_value_current: 210, selling_value_current: 480, losses_qty: 6, notes: ["DLC proche"] },
  ],
};