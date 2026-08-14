import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const portSeed = process.pid % 10_000;
const stubPort = Number(process.env.STUB_DATA_API_PORT ?? 40_000 + portSeed);
const consolePort = Number(process.env.CONSOLE_E2E_PORT ?? 30_000 + portSeed);
const stubOrigin = `http://localhost:${stubPort}`;
const consoleOrigin = `http://localhost:${consolePort}`;

process.env.STUB_DATA_API_PORT = String(stubPort);
process.env.CONSOLE_E2E_PORT = String(consolePort);

// Oracle-only config: skip the 20-route global warmup. Interaction evidence
// for gallery Fork → canvas does not need every Console surface compiled.
export default defineConfig({
  ...base,
  globalSetup: undefined,
  testDir: './e2e',
  testMatch: 'commands-gallery-fork.spec.ts',
  timeout: 180_000,
  webServer: [
    {
      command: 'node e2e/stub-data-api.mjs',
      port: stubPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next dev --webpack --port ${consolePort}`,
      url: `${consoleOrigin}/commands`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        AUTH_SECRET: 'console-e2e-secret-not-for-production',
        CONSOLE_DATA_API_URL: stubOrigin,
        CONSOLE_DATA_API_KEY: 'dev-key',
        CONSOLE_HARNESS_URL: stubOrigin,
        CONSOLE_HARNESS_TOKEN: 'dev-key',
        CONSOLE_HARNESS_TENANT: 'Travis-Gilbert',
        CONSOLE_E2E_GITHUB_LOGIN: 'Travis-Gilbert',
        CONSOLE_E2E_HARNESS_IDENTITY: 'github:e2e-owner',
        CONSOLE_PRINCIPAL_TOKENS_JSON: JSON.stringify({
          'Travis-Gilbert': 'dev-key',
        }),
        CONSOLE_E2E_PROACTIVITY_FIXTURE: '1',
        CONSOLE_E2E_FILING_FIXTURE: '1',
        THEOREM_GRAPHQL_URL: `${stubOrigin}/graphql`,
        THEOREM_ITEM_CHANGEFEED_URL: `${stubOrigin}/v1/items/stream`,
        THEOREM_API_KEY: 'dev-key',
        NEXT_PUBLIC_CONSOLE_CHAT_URL: '/api/chat/stream',
      },
    },
  ],
});
