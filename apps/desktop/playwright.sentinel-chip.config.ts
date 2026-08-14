import { defineConfig } from "@playwright/test";

const port = Number(process.env.PET_E2E_PORT ?? 4_179);
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "sentinel-chip.spec.ts",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: origin,
    viewport: { width: 380, height: 292 },
    colorScheme: "light",
  },
  webServer: {
    command: `corepack pnpm exec vite --port ${port} --strictPort`,
    url: `${origin}/pet.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
