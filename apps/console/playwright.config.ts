import { defineConfig } from '@playwright/test';

// The visual gate baseline (G8): captures at 1280 and 1440 on dark, plus the
// reduced-motion pass. Snapshots block merge through console-ci.yml.
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    colorScheme: 'dark',
    baseURL: 'http://localhost:3010',
  },
  expect: {
    toHaveScreenshot: {
      // Captures emulate reduced motion so the ground paints once at phase 0
      // and the pixels are deterministic; the tight ratio then catches real
      // drift (a 2 percent full-page slack was measured to swallow a whole
      // record-table layout change).
      maxDiffPixelRatio: 0.002,
    },
  },
  webServer: {
    command: 'npm run dev',
    port: 3010,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
