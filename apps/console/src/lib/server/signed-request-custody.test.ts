import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

vi.mock('server-only', () => ({}));

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import {
  loadSigningCustodyForKeyId,
  lookupSignedRequestSeed,
  resolveSigningCustodyForPrincipal,
  signedRequestSeedMapFromEnv,
} from './signed-request-custody';
import { loadCheckedInSignedRequestVectors } from './signed-request';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path);
  }
  return out;
}

afterEach(() => {
  delete process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX;
  delete process.env.CONSOLE_SIGNED_REQUEST_SEEDS_JSON;
  delete process.env.CONSOLE_HARNESS_TENANT;
});

describe('signed request custody stays server-only', () => {
  it('does not import signed-request-custody from client component trees', () => {
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (file.includes(`${join('src', 'lib', 'server')}`)) continue;
      if (file.includes(`${join('src', 'app', 'api')}`)) continue;
      const text = readFileSync(file, 'utf8');
      if (
        text.includes('signed-request-custody')
        || text.includes('CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX')
        || text.includes('CONSOLE_SIGNED_REQUEST_SEEDS_JSON')
        || text.includes('secretKeyHex')
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('scans the client bundle when .next exists (SI-R2)', () => {
    const nextDir = join(process.cwd(), '.next');
    const script = join(process.cwd(), 'scripts/check-signed-request-client-bundle.mjs');
    if (!existsSync(nextDir)) {
      if (process.env.CONSOLE_REQUIRE_BUNDLE_SCAN === '1') {
        throw new Error('CONSOLE_REQUIRE_BUNDLE_SCAN=1 but .next is missing; run next build first');
      }
      expect(existsSync(script)).toBe(true);
      return;
    }
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});

describe('signed request principal binding', () => {
  const owner: HarnessPrincipal = {
    tenant: 'Travis-Gilbert',
    githubLogin: 'Travis-Gilbert',
    harnessIdentity: 'github:123',
  };
  const other: HarnessPrincipal = {
    tenant: 'Other-Tenant',
    githubLogin: 'other',
    harnessIdentity: 'github:999',
  };

  it('maps seeds by harnessIdentity', () => {
    const vector = loadCheckedInSignedRequestVectors()[0];
    process.env.CONSOLE_SIGNED_REQUEST_SEEDS_JSON = JSON.stringify({
      'github:123': vector.secret_key_hex,
    });
    expect(signedRequestSeedMapFromEnv()['github:123']).toBe(vector.secret_key_hex);
    expect(lookupSignedRequestSeed(owner)).toBe(vector.secret_key_hex);
    const custody = resolveSigningCustodyForPrincipal(owner);
    expect(custody?.keyId).toBe(vector.key_id);
    expect(resolveSigningCustodyForPrincipal(other)).toBeNull();
    expect(loadSigningCustodyForKeyId(vector.key_id)?.secretKeyHex).toBe(
      vector.secret_key_hex,
    );
  });

  it('does not give a foreign principal the global seed', () => {
    const vector = loadCheckedInSignedRequestVectors()[0];
    process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX = vector.secret_key_hex;
    process.env.CONSOLE_HARNESS_TENANT = 'Travis-Gilbert';
    expect(resolveSigningCustodyForPrincipal(owner)?.keyId).toBe(vector.key_id);
    expect(resolveSigningCustodyForPrincipal(other)).toBeNull();
  });
});
