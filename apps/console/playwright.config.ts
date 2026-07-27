import { defineConfig } from '@playwright/test';

const portSeed = process.pid % 10_000;
const stubPort = Number(process.env.STUB_DATA_API_PORT ?? 40_000 + portSeed);
const consolePort = Number(process.env.CONSOLE_E2E_PORT ?? 30_000 + portSeed);
const stubOrigin = `http://localhost:${stubPort}`;
const consoleOrigin = `http://localhost:${consolePort}`;
const reuseServers = process.env.PLAYWRIGHT_REUSE_SERVERS === '1';

// Tests call the stub directly for fixture setup. Publish the selected port to
// worker processes so the fixture and the Console proxy always share one fresh
// upstream instead of attaching to mutable state from an older test run.
process.env.STUB_DATA_API_PORT = String(stubPort);
process.env.CONSOLE_E2E_PORT = String(consolePort);

// The visual gate baseline (G8): captures at 1280 and 1440 on dark, plus the
// reduced-motion pass. Snapshots block merge through console-ci.yml.
export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  retries: 0,
  // The deterministic upstream fixture is mutable and serves multi-megabyte
  // memory projections. Serial workers keep behavioral and visual gates from
  // racing the same tenant state or starving the changefeed handshake.
  workers: 1,
  use: {
    colorScheme: 'dark',
    baseURL: consoleOrigin,
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
      port: stubPort,
      reuseExistingServer: reuseServers,
      timeout: 30000,
    },
    {
      command: `pnpm exec next dev --webpack --port ${consolePort}`,
      url: `${consoleOrigin}/workspace`,
      reuseExistingServer: reuseServers,
      timeout: 120000,
      env: {
        AUTH_SECRET: 'console-e2e-secret-not-for-production',
        CONSOLE_DATA_API_URL: stubOrigin,
        CONSOLE_DATA_API_KEY: 'dev-key',
        CONSOLE_HARNESS_URL: stubOrigin,
        CONSOLE_HARNESS_TOKEN: 'dev-key',
        CONSOLE_HARNESS_TENANT: 'Travis-Gilbert',
        // Explicit non-production identity fixture: same-origin proxy tests
        // exercise tenant headers without weakening the production session gate.
        CONSOLE_E2E_GITHUB_LOGIN: 'Travis-Gilbert',
        CONSOLE_E2E_HARNESS_IDENTITY: 'github:e2e-owner',
        CONSOLE_PRINCIPAL_TOKENS_JSON: JSON.stringify({
          'Travis-Gilbert': 'dev-key',
        }),
        CONSOLE_E2E_PROACTIVITY_FIXTURE: '1',
        // The filing engine lives in the Theorem repo and is not running in
        // CI, so the Index reads its non-production fixture. The flag is
        // checked only outside a production build, so this cannot ship.
        CONSOLE_E2E_FILING_FIXTURE: '1',
        THEOREM_GRAPHQL_URL: `${stubOrigin}/graphql`,
        THEOREM_ITEM_CHANGEFEED_URL: `${stubOrigin}/v1/items/stream`,
        THEOREM_API_KEY: 'dev-key',
        // The composer must be live for the /do entry (K3); the sheet's
        // interception happens before any network send.
        NEXT_PUBLIC_CONSOLE_CHAT_URL: '/api/chat/stream',
      },
    },
  ],
});
