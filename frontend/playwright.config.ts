import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";
const hasExternalBase = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: hasExternalBase
    ? undefined
    : {
        command: "npm run dev -- --host 0.0.0.0 --port 5173",
        url: baseURL,
        reuseExistingServer: true,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["iPhone 13"] } },
  ],
});
