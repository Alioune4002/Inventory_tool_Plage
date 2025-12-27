import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import Products from "../../pages/Products";

const apiGet = vi.fn();

vi.mock("../../app/AuthProvider", () => ({
  useAuth: () => ({
    serviceId: "1",
    services: [
      { id: 1, name: "Cuisine", service_type: "kitchen" },
      { id: 2, name: "Bar", service_type: "bar" },
    ],
    selectService: vi.fn(),
    serviceFeatures: {
      prices: { purchase_enabled: true, selling_enabled: true },
      tva: { enabled: true },
      barcode: { enabled: true },
      sku: { enabled: true },
      variants: { enabled: true },
      lot: { enabled: true },
      dlc: { enabled: true },
      multi_unit: { enabled: true },
      open_container_tracking: { enabled: true },
    },
    countingMode: "unit",
    tenant: { name: "StockScan Demo", domain: "food" },
    serviceProfile: { service_type: "kitchen" },
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

    expect(await screen.findByText(/catalogue pdf/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /générer le pdf/i })).toBeInTheDocument();
  });

  it("affiche une erreur claire quand la limite PDF est atteinte", async () => {
    apiGet.mockImplementation((url) => {
      if (url.startsWith("/api/catalog/pdf/")) {
        return Promise.reject({
          response: {
            status: 403,
            data: new Blob(
              [JSON.stringify({ code: "LIMIT_PDF_CATALOG_MONTH", detail: "Limite mensuelle du catalogue PDF atteinte." })],
              { type: "application/json" }
            ),
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

    const user = userEvent.setup();

    render(
      <HelmetProvider>
        <Products />
      </HelmetProvider>
    );

    await user.click(screen.getByRole("button", { name: /générer le pdf/i }));

    expect(
      await screen.findByText(/limite mensuelle du catalogue pdf atteinte/i)
    ).toBeInTheDocument();
  });
});
