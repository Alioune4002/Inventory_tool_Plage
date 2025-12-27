import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import Exports from "../../pages/Exports";

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("../../app/AuthProvider", () => ({
  useAuth: () => ({
    serviceId: "1",
    services: [
      { id: 1, name: "Cuisine", service_type: "kitchen" },
      { id: 2, name: "Bar", service_type: "bar" },
    ],
    serviceFeatures: {
      prices: { purchase_enabled: true, selling_enabled: true },
      tva: { enabled: true },
    },
    tenant: { domain: "food" },
    serviceProfile: { service_type: "kitchen" },
  }),
}));

vi.mock("../../app/ToastContext", () => ({
  useToast: () => vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api: {
    get: (...args) => apiGet(...args),
    post: (...args) => apiPost(...args),
  },
}));

describe("Exports page", () => {
  beforeEach(() => {
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockResolvedValue({
      data: new Blob(["id;name\n1;Test"], { type: "text/csv" }),
      headers: { "content-type": "text/csv" },
    });
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("permet l'export global via Tous les services", async () => {
    const user = userEvent.setup();

    render(
      <HelmetProvider>
        <Exports />
      </HelmetProvider>
    );

    expect(
      screen.getByRole("option", { name: /tous les services/i })
    ).toBeInTheDocument();

    const select = screen.getByLabelText(/service/i);
    await user.selectOptions(select, "all");

    expect(
      screen.getByText(/export global \(tous services\)\. les catégories sont désactivées\./i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalled();
    });

    const [, payload] = apiPost.mock.calls[0];
    expect(payload.services).toEqual([1, 2]);
    expect(payload.service).toBeUndefined();
  });
});
