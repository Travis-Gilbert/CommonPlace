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
      // The ground canvas drifts by design; allow its quiet texture.
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: {
    command: 'npm run dev',
    port: 3010,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
