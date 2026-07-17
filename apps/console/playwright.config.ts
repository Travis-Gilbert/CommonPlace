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
  webServer: [
    {
      // The stub object-seam upstream (e2e fixture; R2.1 keeps the record
      // fixture in tests). The console proxy points at it via env below, so
      // e2e exercises the real browser -> proxy -> upstream wire.
      command: 'node e2e/stub-data-api.mjs',
      port: 50591,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run dev',
      port: 3010,
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        CONSOLE_DATA_API_URL: 'http://localhost:50591',
        CONSOLE_DATA_API_KEY: 'dev-key',
      },
    },
  ],
});
