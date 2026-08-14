// SOURCING: Theorem theorem-blocks principal_request canonical string + vectors.
// HANDOFF-SIGNED-PRINCIPAL-IDENTITY D2/D3: one canon defined in Rust; this
// client must pass the checked-in vectors. Server-only: never import from
// client components.

import 'server-only';

import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Must match `SIGNED_REQUEST_CANON_VERSION` in theorem-blocks. */
export const SIGNED_REQUEST_CANON_VERSION = 'theorem-signed-request-v1';

/** Must match `SIGNED_REQUEST_REPLAY_WINDOW_MS` in theorem-blocks (five minutes). */
export const SIGNED_REQUEST_REPLAY_WINDOW_MS = 300_000;

export type SignedRequestTestVector = {
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly body_hex: string;
  readonly key_id: string;
  readonly timestamp_ms: number;
  readonly nonce: string;
  readonly secret_key_hex: string;
  readonly public_key_hex: string;
  readonly canonical_string: string;
  readonly signature_hex: string;
};

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function assertSeed(seed: Buffer): void {
  if (seed.length !== 32) {
    throw new Error(`ed25519 seed must be 32 bytes, got ${seed.length}`);
  }
}

export function seedFromHex(secretKeyHex: string): Buffer {
  const hex = secretKeyHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error('ed25519 secret key must be 64 lowercase hex characters');
  }
  return Buffer.from(hex, 'hex');
}

function privateKeyFromSeed(seed: Buffer) {
  assertSeed(seed);
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
}

export function publicKeyHexFromSeed(seed: Buffer): string {
  const publicKey = createPublicKey(privateKeyFromSeed(seed));
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return spki.subarray(spki.length - 32).toString('hex');
}

export function bodyContentHash(body: string | Uint8Array): string {
  const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
  return createHash('sha256').update(bytes).digest('hex');
}

export function keyIdForPublicKeyHex(publicKeyHex: string): string {
  const bytes = Buffer.from(publicKeyHex.trim().toLowerCase(), 'hex');
  if (bytes.length !== 32) {
    throw new Error('public key must be 32 bytes');
  }
  const digest = createHash('sha256').update(bytes).digest();
  return `spk:${digest.subarray(0, 16).toString('hex')}`;
}

export function canonicalSigningString(parts: {
  method: string;
  path: string;
  body: string | Uint8Array;
  keyId: string;
  timestampMs: number;
  nonce: string;
}): string {
  return [
    SIGNED_REQUEST_CANON_VERSION,
    parts.method.toUpperCase(),
    parts.path,
    bodyContentHash(parts.body),
    parts.keyId,
    String(parts.timestampMs),
    parts.nonce,
    '',
  ].join('\n');
}

export function signCanonicalString(secretKeyHex: string, canonical: string): string {
  const seed = seedFromHex(secretKeyHex);
  const signature = sign(null, Buffer.from(canonical, 'utf8'), privateKeyFromSeed(seed));
  return signature.toString('hex');
}

export function signRequest(parts: {
  secretKeyHex: string;
  method: string;
  path: string;
  body: string | Uint8Array;
  keyId: string;
  timestampMs: number;
  nonce: string;
}): string {
  const canonical = canonicalSigningString(parts);
  return signCanonicalString(parts.secretKeyHex, canonical);
}

export function newRequestNonce(): string {
  return randomBytes(16).toString('hex');
}

export function loadCheckedInSignedRequestVectors(): readonly SignedRequestTestVector[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, 'signed-request-vectors.json');
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as SignedRequestTestVector[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('signed-request-vectors.json is empty');
  }
  return parsed;
}
