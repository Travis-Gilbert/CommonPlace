import { defineConfig } from '@playwright/test';

// The visual gate baseline (G8): captures at 1280 and 1440 on dark, plus the
// reduced-motion pass. Snapshots block merge through console-ci.yml.
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  // The deterministic upstream fixture is mutable and serves multi-megabyte
  // memory projections. Serial workers keep behavioral and visual gates from
  // racing the same tenant state or starving the changefeed handshake.
  workers: 1,
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
        AUTH_SECRET: 'console-e2e-secret-not-for-production',
        CONSOLE_DATA_API_URL: 'http://localhost:50591',
        CONSOLE_DATA_API_KEY: 'dev-key',
        CONSOLE_HARNESS_TENANT: 'Travis-Gilbert',
        // Explicit non-production identity fixture: same-origin proxy tests
        // exercise tenant headers without weakening the production session gate.
        CONSOLE_E2E_GITHUB_LOGIN: 'Travis-Gilbert',
        CONSOLE_E2E_HARNESS_IDENTITY: 'github:e2e-owner',
        CONSOLE_E2E_PROACTIVITY_FIXTURE: '1',
        // The filing engine lives in the Theorem repo and is not running in
        // CI, so the Index reads its non-production fixture. The flag is
        // checked only outside a production build, so this cannot ship.
        CONSOLE_E2E_FILING_FIXTURE: '1',
        THEOREM_GRAPHQL_URL: 'http://localhost:50591/graphql',
        THEOREM_ITEM_CHANGEFEED_URL: 'http://localhost:50591/v1/items/stream',
        THEOREM_API_KEY: 'dev-key',
        // The composer must be live for the /do entry (K3); the sheet's
        // interception happens before any network send.
        NEXT_PUBLIC_CONSOLE_CHAT_URL: '/api/chat/stream',
      },
    },
  ],
});
