import { test, expect } from "@playwright/test";
import path from "path";

const hasCreds = Boolean(process.env.E2E_USER && process.env.E2E_PASS);
test.skip(!hasCreds, "Définissez E2E_USER et E2E_PASS pour exécuter les tests E2E.");

const receiptPath = path.join(process.cwd(), "e2e", "fixtures", "receipt.csv");

test.describe.configure({ mode: "serial" });

test("flux principal: auth → inventaire → export → réception → étiquettes", async ({ page }) => {
  const stamp = Date.now();
  const productName = `E2E Produit ${stamp}`;

  await page.goto("/login");
  await page.getByLabel(/identifiant/i).fill(process.env.E2E_USER || "");
  await page.getByLabel(/mot de passe/i).fill(process.env.E2E_PASS || "");
  await page.getByRole("button", { name: /connexion/i }).click();
  await page.waitForURL(/\/app\/dashboard/);

  await page.goto("/app/inventory");
  await page.getByLabel(/produit|article/i).fill(productName);
  const qtyInput = page.getByRole("spinbutton").first();
  await qtyInput.fill("2");
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/products/") && res.status() === 201),
    page.getByRole("button", { name: /ajouter\s*\/\s*suivant/i }).click(),
  ]);

  await page.goto("/app/exports");
  const exportCsv = page.getByRole("button", { name: /export csv/i }).first();
  await exportCsv.click();
  await page.waitForResponse(
    (res) => res.url().includes("/api/exports/") && res.status() < 500
  );

  await page.goto("/app/receipts");
  await page.getByRole("button", { name: /importer une réception/i }).click();
  await page.setInputFiles('input[type="file"]', receiptPath);
  await page.getByRole("button", { name: /^importer$/i }).click();
  await expect(page.getByText(/mapping/i)).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/receipts/") && res.url().includes("/apply/") && res.status() === 200
    ),
    page.getByRole("button", { name: /appliquer la réception/i }).click(),
  ]);

  await page.goto("/app/labels");
  await page.getByRole("button", { name: /configurer les étiquettes/i }).click();
  await page.getByLabel(/recherche produit/i).fill(productName);
  await page.getByRole("button", { name: /rechercher/i }).click();
  await page.getByRole("button", { name: /^ajouter$/i }).first().click();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/labels/pdf") && res.status() < 500),
    page.getByRole("button", { name: /générer le pdf/i }).click(),
  ]);
});
