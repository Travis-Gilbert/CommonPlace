import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for CommonPlace interaction traces
 * (SPEC-UX-PHYSICS D7.3 / plan UX-D7.3 + WL-5).
 *
 * These specs drive the REAL product surfaces on the running Next.js app (no
 * mock routes): capture submit, object open, and approve. `trace: 'on'`
 * records a trace for every test so CI can upload them as artifacts and a
 * regression is inspectable. The 200ms INP budget gate (D7) and the 10s
 * indeterminate-spinner rule (WL-5) are asserted inside the specs.
 *
 * Dependency note: `@playwright/test` is a devDependency but is not resolvable
 * from the warm offline pnpm store this worktree installs from. This file and
 * everything under `e2e/` are excluded from the app tsconfig, so `tsc` does not
 * typecheck them; `npx playwright test` runs in CI where install has network.
 */

const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // The dev server is heavy (single Next app), so keep tests serial and give
  // first-compile navigations room. A budget gate must not be masked by
  // retries, so do not retry.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Chromium only: the Event Timing API (used to measure INP-style
      // interaction latency against the 200ms budget) is implemented there.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
