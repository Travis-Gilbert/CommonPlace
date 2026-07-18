# Block Attestation Signing + Per-Tenant Keystore

Status: **IMPLEMENTED** (2026-07-12). Un-deferred and built the same session, at
the user's direction ("everything that was deferred should now be done this
session"). Originally deferred with consent; the subsystem below now ships.

Implementation:
- `apps/commonplace-api/src/keystore.rs`: per-tenant Ed25519. Secret never leaves
  the module; only the verifying key + signature are exposed. Honest
  `signing_mode` (`tenant` when `COMMONPLACE_ED25519_SEED` is set, else `dev`).
  Keys are stable per tenant (derived, not random), so a signature verifies
  across restarts and re-publishes. Unit tests cover sign/verify roundtrip,
  wrong-content-identity, tampered signature, per-tenant stability.
- `apps/commonplace-api/src/publish.rs`: `publish_block` signs the content
  identity (version hash + shape + origin) at the P1.2 plug-in point and attaches
  a `BlockAttestation`. `to_published_block` verifies against the stored identity
  and exposes `signature_verified`. Tests: `published_block_carries_verifiable_attestation`,
  `tampering_the_stored_block_breaks_verification`.
- Public host: `PublishedBlockGql.attestation` + `signatureVerified` on the wire;
  `VerifiedBlock.tsx` shows the three honest provenance tiers (signed+tenant,
  signed+dev, identity+conformance fallback).

The remaining history below is the original deferral spec, kept for context.

## Why deferred

HANDOFF-PUBLISH says published artifacts are "signed with the Ed25519 identity"
and renders attestation as **quiet provenance … never the headline.** Recon of
the live workspaces found:

- `theorem-blocks` (`Theorem/rustyredcore_THG/crates/theorem-blocks`) declares
  `ed25519-dalek` as a dependency but **never imports or uses it**.
  `BlockAttestation.signature` / `.public_key` are opaque `Vec<u8>` bags with no
  producing or verifying function. `DelegationChain` explicitly defers signature
  verification to "block-level attestations" that do not exist.
- **No per-tenant key-management home exists** in either workspace. The only
  real Ed25519 code, `rustyred-thg-checkpoint/src/signing.rs`
  (`sign_bom_ed25519` / `verify_bom_ed25519`), takes a raw `secret_key_hex` on
  every call — no vault, no keystore, unrelated domain (AIBOM artifacts).

Cryptographic signing plus a tenant keystore is a greenfield **security
subsystem**. Because the spec relegates attestation to quiet provenance, publish
ships now with a non-cryptographic provenance basis and signing lands later
without reshaping the pipeline.

## What ships instead (in the publish slice)

The verified-block affordance on the public page shows:
- **Block identity** = the content hash (SHA-256 over canonical shape + payload
  + origin), which is real and already computed for the version hash.
- **Conformance result** = the real L1 (shape) check, plus L0 (identity) and L3
  (grant) where applicable.

This is honest provenance ("this is exactly this content, and it passed these
checks") without claiming a cryptographic signature that does not exist.

## Design sketch for when built

1. **Per-tenant keystore** (`theorem-harness-runtime` or a new
   `theorem-keystore` crate): generate/store an Ed25519 keypair per tenant;
   never expose the secret over the API; expose `sign(tenant, bytes) ->
   Signature` and `verifying_key(tenant)`. Reuse the message-format and hex
   conventions from `rustyred-thg-checkpoint/src/signing.rs`.
2. **Sign at publish**: in the publish pipeline (HANDOFF-PUBLISH task **P1.2**,
   after the L1 gate, before recording the alias), produce a `BlockAttestation`
   over the canonical block bytes with the tenant key and attach it to the
   block.
3. **Verify on the public host**: the projection resolver validates the
   attestation against the tenant `verifying_key` and surfaces the result in the
   verified-block affordance; failures degrade to "identity + conformance only,"
   never block rendering.
4. **Delegation**: once attestations are real, `DelegationChain` verification
   upgrades from structural-only to signature-checked.

## Acceptance (when this subsystem is built)

- A published block carries a `BlockAttestation` whose signature verifies
  against the tenant's Ed25519 verifying key.
- The public verified-block affordance shows a genuine signature-verified state,
  distinct from the identity+conformance fallback.
- Tampering with the payload fails verification; the page degrades gracefully.
- Tenant secret keys are never returned by any API.

## Plug-in point

Pipeline hook is HANDOFF-PUBLISH `P1.2` (publish op). No other task changes. The
verified-block affordance (part of D2) already renders provenance; it gains one
extra "signature verified" state.
