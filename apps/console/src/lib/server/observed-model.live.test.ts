// @vitest-environment node
// SOURCING: none. Deployed read-only oracle for the Console Models data door.
//
// Run with an authenticated CommonPlace session cookie:
//   CONSOLE_LIVE_MODELS_SMOKE=1 \
//   CONSOLE_LIVE_MODELS_COOKIE='...' \
//   corepack pnpm@10.30.1 --dir apps/console exec vitest run \
//     src/lib/server/observed-model.live.test.ts

import { describe, expect, it } from 'vitest';

const LIVE = process.env.CONSOLE_LIVE_MODELS_SMOKE === '1';
const BASE = (process.env.CONSOLE_LIVE_MODELS_BASE
  ?? 'https://v2.theoremharness.com').replace(/\/$/, '');
const COOKIE = process.env.CONSOLE_LIVE_MODELS_COOKIE ?? '';
const TOPIC_ID = process.env.CONSOLE_LIVE_MODELS_TOPIC_ID ?? 'models-live-smoke';

describe.skipIf(!LIVE)('deployed Console Models data door', () => {
  it('reads observed and declared models from the canonical CommonPlace route', async () => {
    if (!COOKIE) {
      throw new Error('CONSOLE_LIVE_MODELS_COOKIE is required for the deployed smoke test');
    }

    const url = new URL('/api/observed-model', BASE);
    url.searchParams.set('topicId', TOPIC_ID);
    const response = await fetch(url, {
      headers: { cookie: COOKIE },
      redirect: 'manual',
    });
    const payload = await response.json().catch(() => null) as {
      readonly error?: unknown;
      readonly observed?: unknown;
      readonly declared?: { readonly objectTypes?: unknown };
    } | null;

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload?.error).toBeUndefined();
    expect(payload?.observed).toBeTypeOf('object');
    expect(payload?.declared?.objectTypes).toBeInstanceOf(Array);
  }, 60_000);
});
