import { defineConfig } from '@playwright/test';

const storageState = process.env.THEOREM_CANVAS_LIVE_STORAGE_STATE?.trim();

export default defineConfig({
  testDir: './e2e',
  testMatch: 'model-program-canvas.live.spec.ts',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.THEOREM_CANVAS_LIVE_URL ?? 'https://v2.theoremharness.com',
    colorScheme: 'dark',
    ...(storageState ? { storageState } : {}),
  },
});
