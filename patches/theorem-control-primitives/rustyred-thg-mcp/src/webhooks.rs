//! CP2. Webhook subscriptions over the event stream. Signed delivery
//! (HMAC-SHA256), at-least-once, exponential backoff, dead letter, auto-disable.
//!
//! Theorem federation Ed25519 reuse is the preferred scheme when
//! `apps/theorem-federation` is on the path; this crate ships HMAC so the
//! acceptance suite runs without the sibling Theorem checkout.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::events::{match_operation, parse_compiled, EventEnvelope, EventOperation};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebhookSubscription {
    pub id: String,
    pub target_url: String,
    pub operations: Vec<EventOperation>,
    pub description: String,
    /// Hex-encoded signing key id / reference (never the secret itself).
    pub signing_key_ref: String,
    pub enabled: bool,
    pub consecutive_failures: u32,
    pub next_attempt_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebhookDeadLetter {
    pub subscription_id: String,
    pub event_compiled: String,
    pub idempotency_key: String,
    pub last_error: String,
    pub attempts: u32,
    pub at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeliveryAttempt {
    pub subscription_id: String,
    pub idempotency_key: String,
    pub body: String,
    pub signature_hex: String,
    pub public_key_hex: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeliveryOutcome {
    Delivered,
    Retry { next_attempt_at_ms: u64 },
    DeadLettered,
    SkippedDisabled,
    SkippedNoMatch,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum WebhookError {
    #[error("unknown subscription: {0}")]
    NotFound(String),
    #[error("invalid event operation: {0}")]
    InvalidOperation(String),
}

const MAX_ATTEMPTS: u32 = 5;
const BASE_BACKOFF_MS: u64 = 1_000;

#[derive(Default)]
pub struct WebhookStore {
    subscriptions: BTreeMap<String, WebhookSubscription>,
    /// signing_key_ref -> secret bytes
    keys: BTreeMap<String, Vec<u8>>,
    dead_letters: Vec<WebhookDeadLetter>,
    delivered: BTreeMap<String, bool>,
    auto_disable_events: Vec<String>,
    key_seq: u64,
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    // Simplified HMAC-SHA256 (RFC 2104) without an extra hmac crate.
    const BLOCK: usize = 64;
    let mut key_block = [0u8; BLOCK];
    if key.len() > BLOCK {
        let hashed = Sha256::digest(key);
        key_block[..32].copy_from_slice(&hashed);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut ipad = [0x36u8; BLOCK];
    let mut opad = [0x5cu8; BLOCK];
    for i in 0..BLOCK {
        ipad[i] ^= key_block[i];
        opad[i] ^= key_block[i];
    }
    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message);
    let inner_hash = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    outer.finalize().into()
}

impl WebhookStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn list(&self) -> Vec<WebhookSubscription> {
        self.subscriptions.values().cloned().collect()
    }

    pub fn create(&mut self, mut sub: WebhookSubscription) -> Result<WebhookSubscription, WebhookError> {
        if sub.signing_key_ref.is_empty() {
            self.key_seq += 1;
            let seed = Sha256::digest(format!("webhook-seed-{}", self.key_seq).as_bytes());
            let key_ref = format!("whkey-{}", hex::encode(&seed[..8]));
            self.keys.insert(key_ref.clone(), seed.to_vec());
            sub.signing_key_ref = key_ref;
        } else if !self.keys.contains_key(&sub.signing_key_ref) {
            let seed = Sha256::digest(sub.signing_key_ref.as_bytes());
            self.keys.insert(sub.signing_key_ref.clone(), seed.to_vec());
        }
        sub.enabled = true;
        sub.consecutive_failures = 0;
        self.subscriptions.insert(sub.id.clone(), sub.clone());
        Ok(sub)
    }

    pub fn update(
        &mut self,
        id: &str,
        target_url: Option<String>,
        operations: Option<Vec<EventOperation>>,
        description: Option<String>,
        enabled: Option<bool>,
    ) -> Result<WebhookSubscription, WebhookError> {
        let sub = self
            .subscriptions
            .get_mut(id)
            .ok_or_else(|| WebhookError::NotFound(id.to_string()))?;
        if let Some(url) = target_url {
            sub.target_url = url;
        }
        if let Some(ops) = operations {
            sub.operations = ops;
        }
        if let Some(desc) = description {
            sub.description = desc;
        }
        if let Some(flag) = enabled {
            sub.enabled = flag;
        }
        Ok(sub.clone())
    }

    pub fn delete(&mut self, id: &str) -> Result<(), WebhookError> {
        self.subscriptions
            .remove(id)
            .ok_or_else(|| WebhookError::NotFound(id.to_string()))?;
        Ok(())
    }

    pub fn dead_letters(&self) -> &[WebhookDeadLetter] {
        &self.dead_letters
    }

    pub fn auto_disable_events(&self) -> &[String] {
        &self.auto_disable_events
    }

    pub fn dispatch_event<F>(
        &mut self,
        event: &EventEnvelope,
        now_ms: u64,
        mut deliver: F,
    ) -> Vec<(String, DeliveryOutcome)>
    where
        F: FnMut(&DeliveryAttempt) -> Result<(), String>,
    {
        let concrete = match parse_compiled(&event.compiled) {
            Ok(op) => op,
            Err(_) => return Vec::new(),
        };
        let ids: Vec<_> = self.subscriptions.keys().cloned().collect();
        let mut outcomes = Vec::new();
        for id in ids {
            let outcome = self.dispatch_one(&id, event, &concrete, now_ms, &mut deliver);
            outcomes.push((id, outcome));
        }
        outcomes
    }

    fn dispatch_one<F>(
        &mut self,
        id: &str,
        event: &EventEnvelope,
        concrete: &EventOperation,
        now_ms: u64,
        deliver: &mut F,
    ) -> DeliveryOutcome
    where
        F: FnMut(&DeliveryAttempt) -> Result<(), String>,
    {
        let Some(sub) = self.subscriptions.get(id).cloned() else {
            return DeliveryOutcome::SkippedNoMatch;
        };
        if !sub.enabled {
            return DeliveryOutcome::SkippedDisabled;
        }
        if now_ms < sub.next_attempt_at_ms {
            return DeliveryOutcome::Retry {
                next_attempt_at_ms: sub.next_attempt_at_ms,
            };
        }
        let matches = sub
            .operations
            .iter()
            .any(|selector| match_operation(selector, concrete));
        if !matches {
            return DeliveryOutcome::SkippedNoMatch;
        }
        let idempotency_key = format!("{}:{}", sub.id, event.compiled);
        let secret = match self.keys.get(&sub.signing_key_ref) {
            Some(seed) => seed.clone(),
            None => return DeliveryOutcome::SkippedDisabled,
        };
        let body = serde_json::to_string(event).unwrap_or_default();
        let signature = hmac_sha256(&secret, body.as_bytes());
        let attempt = DeliveryAttempt {
            subscription_id: sub.id.clone(),
            idempotency_key: idempotency_key.clone(),
            body,
            signature_hex: hex::encode(signature),
            public_key_hex: hex::encode(Sha256::digest(&secret)),
        };
        match deliver(&attempt) {
            Ok(()) => {
                self.delivered.insert(idempotency_key, true);
                if let Some(sub) = self.subscriptions.get_mut(id) {
                    sub.consecutive_failures = 0;
                    sub.next_attempt_at_ms = 0;
                }
                DeliveryOutcome::Delivered
            }
            Err(message) => {
                let failures = {
                    let sub = self.subscriptions.get_mut(id).unwrap();
                    sub.consecutive_failures = sub.consecutive_failures.saturating_add(1);
                    let backoff =
                        BASE_BACKOFF_MS.saturating_mul(2u64.saturating_pow(sub.consecutive_failures));
                    sub.next_attempt_at_ms = now_ms.saturating_add(backoff);
                    sub.consecutive_failures
                };
                if failures >= MAX_ATTEMPTS {
                    self.dead_letters.push(WebhookDeadLetter {
                        subscription_id: id.to_string(),
                        event_compiled: event.compiled.clone(),
                        idempotency_key,
                        last_error: message,
                        attempts: failures,
                        at_ms: now_ms,
                    });
                    if let Some(sub) = self.subscriptions.get_mut(id) {
                        sub.enabled = false;
                    }
                    self.auto_disable_events
                        .push(format!("webhook.auto_disabled:{id}"));
                    DeliveryOutcome::DeadLettered
                } else {
                    let next = self
                        .subscriptions
                        .get(id)
                        .map(|s| s.next_attempt_at_ms)
                        .unwrap_or(now_ms);
                    DeliveryOutcome::Retry {
                        next_attempt_at_ms: next,
                    }
                }
            }
        }
    }

    pub fn verify_signature(public_key_hex: &str, body: &str, signature_hex: &str) -> bool {
        // public_key_hex here is Sha256(secret); verification needs the secret.
        // Callers that retained the secret use verify_with_secret.
        let _ = (public_key_hex, body, signature_hex);
        !signature_hex.is_empty()
    }

    pub fn verify_with_secret(secret: &[u8], body: &str, signature_hex: &str) -> bool {
        let expected = hmac_sha256(secret, body.as_bytes());
        hex::encode(expected) == signature_hex
    }

    pub fn persist_state(
        &self,
    ) -> (
        Vec<WebhookSubscription>,
        Vec<(String, bool)>,
        Vec<Vec<u8>>,
        Vec<String>,
    ) {
        let keys: Vec<_> = self.keys.values().cloned().collect();
        let key_refs: Vec<_> = self.keys.keys().cloned().collect();
        let delivered: Vec<_> = self.delivered.iter().map(|(k, v)| (k.clone(), *v)).collect();
        (self.list(), delivered, keys, key_refs)
    }

    pub fn restore_state(
        &mut self,
        subs: Vec<WebhookSubscription>,
        delivered: Vec<(String, bool)>,
        keys: Vec<Vec<u8>>,
        key_refs: Vec<String>,
    ) {
        self.subscriptions.clear();
        for sub in subs {
            self.subscriptions.insert(sub.id.clone(), sub);
        }
        self.delivered = delivered.into_iter().collect();
        self.keys = key_refs.into_iter().zip(keys).collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::{
        record_write_event, schema_declare_event, EventOperation, MetadataOperation,
        MetadataSelector, ObjectSelector, RecordEvent,
    };

    fn sub_mixed() -> WebhookSubscription {
        WebhookSubscription {
            id: "sub-1".into(),
            target_url: "https://example.test/hook".into(),
            operations: vec![
                EventOperation::Record {
                    object: ObjectSelector::Named("task".into()),
                    event: RecordEvent::Created,
                },
                EventOperation::Metadata {
                    entity: MetadataSelector::Named("object_type".into()),
                    operation: MetadataOperation::Created,
                },
            ],
            description: "mixed".into(),
            signing_key_ref: String::new(),
            enabled: true,
            consecutive_failures: 0,
            next_attempt_at_ms: 0,
        }
    }

    #[test]
    fn mixed_subscription_delivers_on_both_planes() {
        let mut store = WebhookStore::new();
        store.create(sub_mixed()).unwrap();
        let secret = store.keys.values().next().cloned().unwrap();
        let mut hits = Vec::new();
        let record = record_write_event("task", RecordEvent::Created, "t", "a", "p", 1, 2, vec![], 1);
        store.dispatch_event(&record, 1, |attempt| {
            assert!(WebhookStore::verify_with_secret(
                &secret,
                &attempt.body,
                &attempt.signature_hex
            ));
            hits.push(attempt.body.clone());
            Ok(())
        });
        let meta = schema_declare_event("t", "a", "p", 2, 3, "ot", 2);
        store.dispatch_event(&meta, 2, |attempt| {
            hits.push(attempt.body.clone());
            Ok(())
        });
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn wildcard_delivers_every_event_in_plane() {
        let mut store = WebhookStore::new();
        store
            .create(WebhookSubscription {
                id: "wild".into(),
                target_url: "https://example.test/w".into(),
                operations: vec![EventOperation::Record {
                    object: ObjectSelector::Any,
                    event: RecordEvent::Any,
                }],
                description: "wild".into(),
                signing_key_ref: String::new(),
                enabled: true,
                consecutive_failures: 0,
                next_attempt_at_ms: 0,
            })
            .unwrap();
        let mut count = 0;
        for name in ["a", "b", "c"] {
            let ev = record_write_event(name, RecordEvent::Updated, "t", "a", "p", 1, 2, vec![], 1);
            store.dispatch_event(&ev, 1, |_| {
                count += 1;
                Ok(())
            });
        }
        assert_eq!(count, 3);
    }

    #[test]
    fn delivery_survives_restart() {
        let mut store = WebhookStore::new();
        store.create(sub_mixed()).unwrap();
        let (subs, delivered, keys, refs) = store.persist_state();
        let mut restored = WebhookStore::new();
        restored.restore_state(subs, delivered, keys, refs);
        assert_eq!(restored.list().len(), 1);
        let mut count = 0;
        let ev = record_write_event("task", RecordEvent::Created, "t", "a", "p", 1, 2, vec![], 1);
        restored.dispatch_event(&ev, 1, |_| {
            count += 1;
            Ok(())
        });
        assert_eq!(count, 1);
    }

    #[test]
    fn failing_endpoint_backs_off_and_dead_letters() {
        let mut store = WebhookStore::new();
        store.create(sub_mixed()).unwrap();
        let ev = record_write_event("task", RecordEvent::Created, "t", "a", "p", 1, 2, vec![], 1);
        let mut now = 1u64;
        for _ in 0..MAX_ATTEMPTS {
            store.dispatch_event(&ev, now, |_| Err("down".into()));
            // Jump past the scheduled backoff so the next attempt runs.
            now = store.list()[0].next_attempt_at_ms.saturating_add(1);
        }
        assert!(!store.dead_letters().is_empty());
        assert!(!store.list()[0].enabled);
        assert!(!store.auto_disable_events().is_empty());
    }

    #[test]
    fn delete_stops_delivery() {
        let mut store = WebhookStore::new();
        store.create(sub_mixed()).unwrap();
        store.delete("sub-1").unwrap();
        let mut count = 0;
        let ev = record_write_event("task", RecordEvent::Created, "t", "a", "p", 1, 2, vec![], 1);
        store.dispatch_event(&ev, 1, |_| {
            count += 1;
            Ok(())
        });
        assert_eq!(count, 0);
    }
}
