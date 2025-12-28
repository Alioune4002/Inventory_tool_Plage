import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import Products from "../../pages/Products";

const apiGet = vi.fn();

const authServices = [
  { id: 1, name: "Cuisine", service_type: "kitchen" },
  { id: 2, name: "Bar", service_type: "bar" },
];
const authSelectService = vi.fn();
const authServiceFeatures = {
  prices: { purchase_enabled: true, selling_enabled: true },
  tva: { enabled: true },
  barcode: { enabled: true },
  sku: { enabled: true },
  variants: { enabled: true },
  lot: { enabled: true },
  dlc: { enabled: true },
  multi_unit: { enabled: true },
  open_container_tracking: { enabled: true },
};
const authTenant = { name: "StockScan Demo", domain: "food" };
const authProfile = { service_type: "kitchen" };

vi.mock("../../app/AuthProvider", () => ({
  useAuth: () => ({
    serviceId: "1",
    services: authServices,
    selectService: authSelectService,
    serviceFeatures: authServiceFeatures,
    countingMode: "unit",
    tenant: authTenant,
    serviceProfile: authProfile,
  }),
}));

vi.mock("../../app/ToastContext", () => ({
  useToast: () => vi.fn(),
}));

vi.mock("../../app/useEntitlements", () => ({
  useEntitlements: () => ({
    data: {
      entitlements: { pdf_catalog: true, alerts_stock: true },
      limits: { pdf_catalog_monthly_limit: 1 },
    },
  }),
}));

vi.mock("../../lib/api", () => ({
  api: {
    get: (...args) => apiGet(...args),
  },
}));

vi.mock("../../components/PageTransition", () => ({
  default: ({ children }) => children,
}));

describe("Products page (catalogue PDF)", () => {
  beforeEach(() => {
    apiGet.mockImplementation((url) => {
      if (url.startsWith("/api/products/")) {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith("/api/categories/")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("affiche le bloc Catalogue PDF", async () => {
    render(
      <HelmetProvider>
        <Products />
      </HelmetProvider>
    );

    const titles = await screen.findAllByText(/catalogue pdf/i);
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /générer le pdf/i })).toBeInTheDocument();
  });

  it("affiche une erreur claire quand la limite PDF est atteinte", async () => {
    apiGet.mockImplementation((url) => {
      if (url.startsWith("/api/catalog/pdf/")) {
        return Promise.reject({
          response: {
            status: 403,
            data: { code: "LIMIT_PDF_CATALOG_MONTH", detail: "Limite mensuelle du catalogue PDF atteinte." },
          },
        });
      }
      if (url.startsWith("/api/products/")) {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith("/api/categories/")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <HelmetProvider>
        <Products />
      </HelmetProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /générer le pdf/i }));

    expect(
      await screen.findByText(/limite mensuelle du catalogue pdf atteinte/i)
    ).toBeInTheDocument();
  });
});
