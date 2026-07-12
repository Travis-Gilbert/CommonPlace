//! Per-tenant Ed25519 keystore for block attestation signing (HANDOFF-PUBLISH FD-P1).
//!
//! A published block carries a [`BlockAttestation`]: an Ed25519 signature over the
//! block's **content identity** (version hash + shape + origin). Verification is
//! self-contained — the attestation embeds the public key and the exact signed
//! message — and the public host additionally checks that key against the
//! tenant's current verifying key.
//!
//! Key handling:
//! - The secret **never leaves this module** and never crosses the API. Only the
//!   verifying (public) key and a signature are ever exposed.
//! - Trust is honest, not overclaimed. With `COMMONPLACE_ED25519_SEED` set the
//!   key is derived from that tenant secret (`signing_mode = "tenant"`). Without
//!   it a deterministic dev key is used (`signing_mode = "dev"`): a real,
//!   verifiable Ed25519 signature that is honestly *not* trust-rooted. The public
//!   host surfaces the mode so a dev signature never reads as a trusted one.
//! - Keys are **stable per tenant** (derived, not random), so a signature
//!   verifies across process restarts and re-publishes without a persisted vault.
//!   Swapping in a real per-tenant vault later only changes `signing_key`.

use async_graphql::SimpleObject;
use commonplace::content_hash;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use zeroize::Zeroizing;

/// Insecure, well-known seed used only when no tenant seed is configured. The
/// resulting signature is cryptographically valid but not trust-rooted; the
/// attestation reports `signing_mode = "dev"` so the host never presents it as
/// trusted.
const DEV_SEED: &str = "commonplace-dev-insecure-attestation-seed-v1";

/// Domain separator so a block attestation can never be confused with another
/// Ed25519 message signed by the same key.
const MESSAGE_DOMAIN: &str = "commonplace-block-attestation-v1";

/// The attestation attached to a published block. Self-verifying: it carries the
/// public key, the signature, and the exact message that was signed.
#[derive(Clone, Debug, SimpleObject, serde::Serialize, serde::Deserialize)]
pub struct BlockAttestation {
    /// Always `ed25519`.
    pub algorithm: String,
    /// `tenant` (trust-rooted) or `dev` (valid but not trust-rooted).
    pub signing_mode: String,
    /// Hex-encoded Ed25519 verifying (public) key.
    pub public_key_hex: String,
    /// Hex-encoded detached Ed25519 signature over `message`.
    pub signature_hex: String,
    /// The exact content-identity message that was signed, so any verifier can
    /// reconstruct and check it.
    pub message: String,
}

/// Resolve the active signing mode and seed. `tenant` when a tenant seed is
/// configured; `dev` otherwise.
fn mode_and_seed() -> (&'static str, String) {
    match std::env::var("COMMONPLACE_ED25519_SEED") {
        // Trim before use: leading/trailing whitespace in the env value would
        // otherwise silently derive different tenant keys across deployments.
        Ok(seed) if !seed.trim().is_empty() => ("tenant", seed.trim().to_string()),
        _ => ("dev", DEV_SEED.to_string()),
    }
}

/// Derive stable 32-byte secret key material from `(seed, tenant)`. SHA-256 is
/// 32 bytes, exactly an Ed25519 secret key. Zeroized on drop.
fn secret_bytes(seed: &str, tenant: &str) -> Zeroizing<[u8; 32]> {
    let digest = content_hash(format!("{seed}\u{0}{tenant}").as_bytes());
    let hex = digest.trim_start_matches("sha256:");
    let raw = hex::decode(hex).unwrap_or_default();
    let mut out = Zeroizing::new([0u8; 32]);
    let n = raw.len().min(32);
    out[..n].copy_from_slice(&raw[..n]);
    out
}

/// The signing key for `tenant`, plus the honest mode label. Secret is dropped
/// (zeroized) once the key is constructed.
fn signing_key(tenant: &str) -> (SigningKey, &'static str) {
    let (mode, seed) = mode_and_seed();
    let bytes = secret_bytes(&seed, tenant);
    (SigningKey::from_bytes(&bytes), mode)
}

/// The canonical content-identity message a block attestation signs. Binding the
/// version hash makes the signature payload-specific: any content edit changes
/// the version hash and therefore the message.
pub fn attestation_message(version_hash: &str, shape_id: &str, origin_id: &str) -> String {
    format!("{MESSAGE_DOMAIN}\nversion:{version_hash}\nshape:{shape_id}\norigin:{origin_id}")
}

/// Sign a block's content identity for `tenant`. The secret never leaves here.
pub fn sign_block(
    tenant: &str,
    version_hash: &str,
    shape_id: &str,
    origin_id: &str,
) -> BlockAttestation {
    let (key, mode) = signing_key(tenant);
    let message = attestation_message(version_hash, shape_id, origin_id);
    let signature = key.sign(message.as_bytes());
    BlockAttestation {
        algorithm: "ed25519".into(),
        signing_mode: mode.into(),
        public_key_hex: hex::encode(key.verifying_key().as_bytes()),
        signature_hex: hex::encode(signature.to_bytes()),
        message,
    }
}

/// The tenant's current verifying (public) key, hex-encoded. Safe to expose; the
/// secret is never returned.
pub fn verifying_key_hex(tenant: &str) -> String {
    let (key, _) = signing_key(tenant);
    hex::encode(key.verifying_key().as_bytes())
}

/// Verify an attestation against a block's content identity. Returns true only
/// when the signature is valid over its message **and** that message binds
/// exactly this `(version_hash, shape_id, origin_id)`. Any tamper — to the stored
/// version hash, the shape, or the origin — breaks the match and fails.
pub fn verify_attestation(
    att: &BlockAttestation,
    version_hash: &str,
    shape_id: &str,
    origin_id: &str,
) -> bool {
    if att.algorithm != "ed25519" {
        return false;
    }
    if att.message != attestation_message(version_hash, shape_id, origin_id) {
        return false;
    }
    let public: Option<[u8; 32]> = hex::decode(&att.public_key_hex)
        .ok()
        .and_then(|b| b.try_into().ok());
    let Some(public) = public else {
        return false;
    };
    let Ok(verifying_key) = VerifyingKey::from_bytes(&public) else {
        return false;
    };
    let signature: Option<[u8; 64]> = hex::decode(&att.signature_hex)
        .ok()
        .and_then(|b| b.try_into().ok());
    let Some(signature) = signature else {
        return false;
    };
    let signature = Signature::from_bytes(&signature);
    verifying_key
        .verify(att.message.as_bytes(), &signature)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_then_verify_roundtrips() {
        let att = sign_block("owner", "sha256:abc", "doc", "origin-1");
        assert_eq!(att.algorithm, "ed25519");
        assert!(verify_attestation(&att, "sha256:abc", "doc", "origin-1"));
    }

    #[test]
    fn wrong_content_identity_fails() {
        let att = sign_block("owner", "sha256:abc", "doc", "origin-1");
        // A different version hash (a payload edit) must not verify.
        assert!(!verify_attestation(&att, "sha256:xyz", "doc", "origin-1"));
        // A different shape or origin must not verify.
        assert!(!verify_attestation(&att, "sha256:abc", "note", "origin-1"));
        assert!(!verify_attestation(&att, "sha256:abc", "doc", "origin-2"));
    }

    #[test]
    fn tampered_signature_fails() {
        let mut att = sign_block("owner", "sha256:abc", "doc", "origin-1");
        att.signature_hex.replace_range(0..2, "00");
        assert!(!verify_attestation(&att, "sha256:abc", "doc", "origin-1"));
    }

    #[test]
    fn verifying_key_is_stable_per_tenant() {
        // Stable across calls (so it verifies across restarts and re-publishes).
        assert_eq!(verifying_key_hex("owner"), verifying_key_hex("owner"));
        // Distinct tenants get distinct keys.
        assert_ne!(verifying_key_hex("owner"), verifying_key_hex("stranger"));
        // The signing key's public half matches the exposed verifying key.
        let att = sign_block("owner", "sha256:abc", "doc", "origin-1");
        assert_eq!(att.public_key_hex, verifying_key_hex("owner"));
    }

    #[test]
    fn dev_mode_is_labelled_honestly() {
        // Without COMMONPLACE_ED25519_SEED the mode is the honest "dev".
        let att = sign_block("owner", "sha256:abc", "doc", "origin-1");
        assert_eq!(att.signing_mode, "dev");
    }
}
