import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import Landing from "../../pages/Landing";

describe("Landing page", () => {
  it("affiche le titre principal", () => {
    render(
      <HelmetProvider>
        <BrowserRouter>
          <Landing />
        </BrowserRouter>
      </HelmetProvider>
    );
    expect(screen.getByText(/inventaire moderne/i)).toBeInTheDocument();
  });
});
