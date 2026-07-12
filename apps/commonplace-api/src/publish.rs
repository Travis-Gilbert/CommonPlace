//! Publish pipeline (HANDOFF-PUBLISH D1/D3/D5, native model).
//!
//! A published artifact is a block hosted at a stable URL. Rather than couple to
//! the inert cross-repo `theorem-blocks` noun layer, publish is modelled on the
//! RustyRed graph that `commonplace-api` already owns: a `published_block` item
//! carries the version hash, shape id, visibility Grant, alias, and view counter,
//! and links to the origin artifact via a `PUBLISHES` edge.
//!
//! - **Content addressing** (immutable version): `content_hash` over the origin's
//!   canonical bytes. Re-publish re-points the same alias and pushes the old
//!   version onto `history`; the version-addressed hash resolves permanently.
//! - **Publish floor**: Tenon L1 (shape) — the origin's shape must resolve, else
//!   publish is refused with the conformance result named. L0 (identity) is a
//!   precondition; L3 (grant) is attached, not gated.
//! - **Attestation signing** (HANDOFF-PUBLISH FD-P1, `keystore.rs`): at publish
//!   the block's content identity (version hash + shape + origin) is signed with
//!   the tenant's Ed25519 key and attached as a `BlockAttestation`. The public
//!   host verifies it and surfaces a genuine signature-verified state, degrading
//!   to identity + conformance if verification fails. Provenance is now the
//!   content-hash identity, the conformance result, **and** the signature.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use async_graphql::{Enum, SimpleObject};
use commonplace::{
    content_hash, BlobStore, Commonplace, EmbeddingGraphStore, Item, ItemBody, ItemKind,
};

use crate::keystore::{self, BlockAttestation};
use rustyred_thg_core::GraphStoreResult;
use serde_json::{json, Value};

/// Item kind for the public projection record.
pub const PUBLISHED_BLOCK_KIND: &str = "published_block";
/// Item kind for a doorway reference into a visitor's space.
pub const REFERENCE_KIND: &str = "block_reference";
/// Edge from a published block to the origin artifact it projects.
pub const PUBLISHES_EDGE: &str = "PUBLISHES";
/// Edge from a doorway reference (or fork) to the origin block.
pub const REFERENCES_EDGE: &str = "REFERENCES";

/// Shapes that clear the L1 publish floor. Custom shapes register via type-defs
/// later; for now an unknown shape with no renderer is refused.
// ponytail: static allowlist is the L1 floor; widen to type-def lookup when
// custom publishable shapes land.
const PUBLISHABLE_SHAPES: &[&str] = &[
    "doc",
    "note",
    "link",
    "image",
    "table",
    "chart",
    "dashboard",
    "scene",
    "evidence_board",
    "graph_neighborhood",
    "mechanism_diagram",
    "patent_diagram",
    "model_3d",
];

/// The three visibilities, expressed over the Grant machinery. public/unlisted
/// differ only in indexability; private is grant-gated.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Enum)]
pub enum Visibility {
    Public,
    Unlisted,
    Private,
}

impl Visibility {
    pub fn as_str(self) -> &'static str {
        match self {
            Visibility::Public => "public",
            Visibility::Unlisted => "unlisted",
            Visibility::Private => "private",
        }
    }
    pub fn from_str(value: &str) -> Self {
        match value {
            "public" => Visibility::Public,
            "private" => Visibility::Private,
            _ => Visibility::Unlisted,
        }
    }
    /// public and unlisted differ only here: public is indexable.
    pub fn is_indexable(self) -> bool {
        matches!(self, Visibility::Public)
    }
}

/// One conformance check line, surfaced as quiet provenance.
#[derive(Clone, Debug, SimpleObject)]
pub struct ConformanceCheck {
    pub level: String,
    pub name: String,
    pub passed: bool,
    pub detail: String,
}

/// The conformance result attached to a publish attempt.
#[derive(Clone, Debug, SimpleObject)]
pub struct ConformanceReport {
    /// Highest level reached (the publish floor is L1).
    pub level: String,
    pub passed: bool,
    pub checks: Vec<ConformanceCheck>,
}

/// The receipt returned by `publish`.
#[derive(Clone, Debug, SimpleObject)]
pub struct PublishReceipt {
    /// Stable alias URL path, e.g. `/p/<alias>`.
    pub url: String,
    pub alias: String,
    /// The published block record id.
    pub block_id: String,
    /// Content hash of the origin's canonical bytes (immutable version).
    pub version_hash: String,
    pub shape_id: String,
    pub visibility: Visibility,
    pub conformance: ConformanceReport,
    /// Ed25519 attestation over the block content identity (FD-P1).
    pub attestation: Option<BlockAttestation>,
}

/// A resolved published block for the public host (projection + provenance).
#[derive(Clone, Debug, SimpleObject)]
pub struct PublishedBlock {
    pub block_id: String,
    pub alias: String,
    pub origin_id: String,
    pub shape_id: String,
    pub title: String,
    /// The renderable payload the public host hands to the view registry.
    pub payload: async_graphql::Json<Value>,
    pub version_hash: String,
    pub visibility: Visibility,
    /// `published` or `gone` (unpublished but preserved).
    pub state: String,
    pub view_count: i64,
    pub conformance: ConformanceReport,
    /// Ed25519 attestation over the block content identity (FD-P1).
    pub attestation: Option<BlockAttestation>,
    /// True when the stored attestation verifies against this block's content
    /// identity. The host shows a genuine signature-verified state; false
    /// degrades to identity + conformance provenance.
    pub signature_verified: bool,
}

/// Error a publish refusal or resolution failure produces.
#[derive(Clone, Debug)]
pub enum PublishError {
    OriginNotFound,
    Refused(ConformanceReport),
    AliasNotFound,
    VersionNotFound,
    /// Alias exists but was unpublished — the host renders the designed gone state.
    Gone,
    Forbidden,
}

/// Public-host resolution outcome: distinguishes ok / gone / forbidden /
/// not_found so the host renders the right designed state.
#[derive(Clone, Debug, SimpleObject)]
pub struct PublishResolution {
    /// One of `ok`, `gone`, `forbidden`, `not_found`.
    pub status: String,
    pub block: Option<PublishedBlock>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// A stable, URL-safe alias derived from the origin id (same origin → same
/// alias across every re-publish).
fn alias_for(origin_id: &str) -> String {
    let full = content_hash(origin_id.as_bytes());
    full.trim_start_matches("sha256:")
        .chars()
        .take(12)
        .collect()
}

/// Canonical bytes for the version hash: kind + title + body + extra, with
/// deterministic key ordering, excluding the origin's own publish bookkeeping.
fn canonical_version_hash(item: &Item) -> String {
    let extra: BTreeMap<&String, &Value> = item
        .extra
        .iter()
        .filter(|(k, _)| k.as_str() != "publish")
        .collect();
    let body = serde_json::to_value(&item.body).unwrap_or(Value::Null);
    let canonical = json!({
        "kind": item.kind.as_str(),
        "title": item.title,
        "body": body,
        "extra": extra,
    });
    content_hash(serde_json::to_vec(&canonical).unwrap_or_default().as_slice())
}

/// Run the conformance ladder to the publish floor (L1). L0 = identity present,
/// L1 = shape resolves. Returns the report; `passed` false means publish is refused.
fn check_conformance(item: &Item) -> ConformanceReport {
    let mut checks = Vec::new();

    // L0 Identity: a non-empty id and some content.
    let has_identity = !item.id.trim().is_empty()
        && (!item.title.trim().is_empty() || !matches!(item.body, ItemBody::Empty));
    checks.push(ConformanceCheck {
        level: "L0".into(),
        name: "identity".into(),
        passed: has_identity,
        detail: if has_identity {
            "block has an id and content".into()
        } else {
            "block is missing an id or is empty".into()
        },
    });

    // L1 Shape: the shape id must resolve in the publishable-shape registry.
    let shape = item.kind.as_str();
    let shape_ok = PUBLISHABLE_SHAPES.contains(&shape);
    checks.push(ConformanceCheck {
        level: "L1".into(),
        name: "shape".into(),
        passed: shape_ok,
        detail: if shape_ok {
            format!("shape '{shape}' resolves")
        } else {
            format!("unknown shape '{shape}' — not publishable")
        },
    });

    let passed = has_identity && shape_ok;
    ConformanceReport {
        level: "L1".into(),
        passed,
        checks,
    }
}

fn published_kind() -> ItemKind {
    ItemKind::from(PUBLISHED_BLOCK_KIND.to_string())
}

/// Find the published-block record for an origin, if one exists.
fn find_by_origin<S, B>(
    cp: &Commonplace<S, B>,
    origin_id: &str,
) -> GraphStoreResult<Option<Item>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    Ok(cp
        .items_by_kind(&published_kind())?
        .into_iter()
        .find(|it| it.extra.get("origin_id").and_then(Value::as_str) == Some(origin_id)))
}

/// Find the published-block record for an alias.
fn find_by_alias<S, B>(cp: &Commonplace<S, B>, alias: &str) -> GraphStoreResult<Option<Item>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    Ok(cp
        .items_by_kind(&published_kind())?
        .into_iter()
        .find(|it| it.extra.get("alias").and_then(Value::as_str) == Some(alias)))
}

fn renderable_payload(origin: &Item) -> Value {
    let text = match &origin.body {
        ItemBody::Inline { text } => Some(text.clone()),
        _ => None,
    };
    json!({
        "kind": origin.kind.as_str(),
        "title": origin.title,
        "text": text,
        "extra": origin.extra,
    })
}

fn to_published_block(record: &Item) -> PublishedBlock {
    let e = &record.extra;
    let get_str = |k: &str| e.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let visibility = Visibility::from_str(&get_str("visibility"));
    let conformance = e
        .get("conformance")
        .and_then(|v| serde_json::from_value::<StoredConformance>(v.clone()).ok())
        .map(|c| c.into_report())
        .unwrap_or(ConformanceReport {
            level: "L1".into(),
            passed: true,
            checks: Vec::new(),
        });
    let version_hash = get_str("version_hash");
    let shape_id = get_str("shape_id");
    let origin_id = get_str("origin_id");
    let attestation = e
        .get("attestation")
        .and_then(|v| serde_json::from_value::<BlockAttestation>(v.clone()).ok());
    // Verify against the *stored* content identity: a tamper with the stored
    // version hash / shape / origin breaks the match even though the signature
    // itself is intact.
    let signature_verified = attestation
        .as_ref()
        .map(|a| keystore::verify_attestation(a, &version_hash, &shape_id, &origin_id))
        .unwrap_or(false);
    PublishedBlock {
        block_id: record.id.clone(),
        alias: get_str("alias"),
        origin_id,
        shape_id,
        title: record.title.clone(),
        payload: async_graphql::Json(e.get("payload").cloned().unwrap_or(Value::Null)),
        version_hash,
        visibility,
        state: {
            let s = get_str("state");
            if s.is_empty() { "published".into() } else { s }
        },
        view_count: e.get("view_count").and_then(Value::as_i64).unwrap_or(0),
        conformance,
        attestation,
        signature_verified,
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct StoredConformance {
    level: String,
    passed: bool,
    checks: Vec<StoredCheck>,
}
#[derive(serde::Serialize, serde::Deserialize)]
struct StoredCheck {
    level: String,
    name: String,
    passed: bool,
    detail: String,
}
impl StoredConformance {
    fn from_report(r: &ConformanceReport) -> Self {
        Self {
            level: r.level.clone(),
            passed: r.passed,
            checks: r
                .checks
                .iter()
                .map(|c| StoredCheck {
                    level: c.level.clone(),
                    name: c.name.clone(),
                    passed: c.passed,
                    detail: c.detail.clone(),
                })
                .collect(),
        }
    }
    fn into_report(self) -> ConformanceReport {
        ConformanceReport {
            level: self.level,
            passed: self.passed,
            checks: self
                .checks
                .into_iter()
                .map(|c| ConformanceCheck {
                    level: c.level,
                    name: c.name,
                    passed: c.passed,
                    detail: c.detail,
                })
                .collect(),
        }
    }
}

/// An immutable snapshot of a version that has been superseded at its alias.
/// Re-publishing freezes the version being replaced here so its version URL
/// keeps serving that exact content and its own per-version visibility, rather
/// than whatever the alias now points at (HANDOFF-PUBLISH D1: a version URL that
/// was ever public "is a frozen snapshot" that "resolves forever").
#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct VersionSnapshot {
    version_hash: String,
    shape_id: String,
    origin_id: String,
    title: String,
    payload: Value,
    visibility: String,
    conformance: Value,
    attestation: Option<Value>,
    published_at_ms: i64,
}

/// Freeze a published record's current version into a snapshot, before its extra
/// fields are overwritten by the next re-publish.
fn snapshot_from_record(record: &Item) -> VersionSnapshot {
    let e = &record.extra;
    let get_str = |k: &str| e.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let visibility = {
        let v = get_str("visibility");
        if v.is_empty() { "unlisted".into() } else { v }
    };
    VersionSnapshot {
        version_hash: get_str("version_hash"),
        shape_id: get_str("shape_id"),
        origin_id: get_str("origin_id"),
        title: record.title.clone(),
        payload: e.get("payload").cloned().unwrap_or(Value::Null),
        visibility,
        conformance: e.get("conformance").cloned().unwrap_or(Value::Null),
        attestation: e.get("attestation").cloned(),
        published_at_ms: e.get("published_at_ms").and_then(Value::as_i64).unwrap_or(0),
    }
}

/// Build a resolved block from a frozen snapshot. Signature verification runs
/// against the snapshot's own content identity, so an old version keeps its own
/// signed provenance independent of the alias's current version.
fn published_block_from_snapshot(record: &Item, snapshot: &VersionSnapshot) -> PublishedBlock {
    let conformance = serde_json::from_value::<StoredConformance>(snapshot.conformance.clone())
        .map(|c| c.into_report())
        .unwrap_or(ConformanceReport {
            level: "L1".into(),
            passed: true,
            checks: Vec::new(),
        });
    let attestation = snapshot
        .attestation
        .as_ref()
        .and_then(|v| serde_json::from_value::<BlockAttestation>(v.clone()).ok());
    let signature_verified = attestation
        .as_ref()
        .map(|a| {
            keystore::verify_attestation(a, &snapshot.version_hash, &snapshot.shape_id, &snapshot.origin_id)
        })
        .unwrap_or(false);
    PublishedBlock {
        block_id: record.id.clone(),
        alias: record.extra.get("alias").and_then(Value::as_str).unwrap_or_default().to_string(),
        origin_id: snapshot.origin_id.clone(),
        shape_id: snapshot.shape_id.clone(),
        title: snapshot.title.clone(),
        payload: async_graphql::Json(snapshot.payload.clone()),
        version_hash: snapshot.version_hash.clone(),
        visibility: Visibility::from_str(&snapshot.visibility),
        // A frozen snapshot is always the live content of its own hash.
        state: "published".into(),
        view_count: 0,
        conformance,
        attestation,
        signature_verified,
    }
}

/// Whether `caller` owns this published record. Records carry an `owner` (the
/// principal that first published them); a record without a recorded owner
/// (legacy) is treated as unowned and modifiable, but every fresh publish sets
/// one so this stays closed going forward.
fn owned_by(record: &Item, caller: &str) -> bool {
    match record.extra.get("owner").and_then(Value::as_str) {
        Some(owner) => owner == caller,
        None => true,
    }
}

/// Publish (or re-publish) `origin_id` at `visibility`. Runs the L1 floor; on
/// refusal returns `PublishError::Refused` with the conformance report.
pub fn publish_block<S, B>(
    cp: &mut Commonplace<S, B>,
    origin_id: &str,
    visibility: Visibility,
    owner_principal: &str,
) -> Result<PublishReceipt, PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let origin = cp
        .get_item(origin_id)
        .map_err(|_| PublishError::OriginNotFound)?
        .ok_or(PublishError::OriginNotFound)?;

    let conformance = check_conformance(&origin);
    if !conformance.passed {
        return Err(PublishError::Refused(conformance));
    }

    let version_hash = canonical_version_hash(&origin);
    let shape_id = origin.kind.as_str().to_string();
    let alias = alias_for(origin_id);
    let payload = renderable_payload(&origin);
    let now = now_ms();
    let stored_conformance =
        serde_json::to_value(StoredConformance::from_report(&conformance)).unwrap_or(Value::Null);

    // FD-P1: sign the block content identity with the tenant (owner) key. Secret
    // never leaves the keystore; only the attestation is stored and returned.
    let attestation = keystore::sign_block(owner_principal, &version_hash, &shape_id, origin_id);
    let stored_attestation = serde_json::to_value(&attestation).unwrap_or(Value::Null);

    let mut record = match find_by_origin(cp, origin_id).map_err(|_| PublishError::OriginNotFound)? {
        Some(existing) => {
            // Ownership: only the principal that first published this block may
            // re-publish it. A different caller who knows the origin id cannot
            // overwrite or re-sign someone else's published block.
            if !owned_by(&existing, owner_principal) {
                return Err(PublishError::Forbidden);
            }
            existing
        }
        None => Item::new(published_kind(), origin.title.clone()),
    };
    record.title = origin.title.clone();

    // Re-publish: freeze the version being replaced as an immutable snapshot so
    // its version URL keeps serving that exact content and visibility, then
    // re-point the alias at the new version.
    let prev_hash = record
        .extra
        .get("version_hash")
        .and_then(Value::as_str)
        .map(str::to_string);
    if let Some(prev) = prev_hash {
        if prev != version_hash {
            let snapshot = snapshot_from_record(&record);
            let mut history = record
                .extra
                .get("history")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let already = history
                .iter()
                .any(|v| v.get("version_hash").and_then(Value::as_str) == Some(prev.as_str()));
            if !already {
                history.push(serde_json::to_value(&snapshot).unwrap_or(Value::Null));
            }
            record.extra.insert("history".into(), json!(history));
        }
    }

    record.extra.insert("origin_id".into(), json!(origin_id));
    record.extra.insert("alias".into(), json!(alias));
    record.extra.insert("visibility".into(), json!(visibility.as_str()));
    record.extra.insert("version_hash".into(), json!(version_hash));
    record.extra.insert("shape_id".into(), json!(shape_id));
    record.extra.insert("payload".into(), payload);
    record.extra.insert("state".into(), json!("published"));
    record.extra.insert("conformance".into(), stored_conformance);
    record.extra.insert("attestation".into(), stored_attestation);
    record
        .extra
        .entry("view_count".to_string())
        .or_insert(json!(0));
    record.extra.entry("granted".to_string()).or_insert(json!([owner_principal]));
    // The first publisher claims ownership; subsequent re-publishes are gated on
    // this above and never reassign it.
    record.extra.entry("owner".to_string()).or_insert(json!(owner_principal));
    record
        .extra
        .entry("created_at_ms".to_string())
        .or_insert(json!(now));
    record.extra.insert("published_at_ms".into(), json!(now));

    let saved = cp.put_item(record).map_err(|_| PublishError::OriginNotFound)?;
    // Idempotent provenance edge published_block -> origin.
    let _ = cp.link_explicit(PUBLISHES_EDGE, &saved.id, origin_id, "published projection");

    Ok(PublishReceipt {
        url: format!("/p/{alias}"),
        alias,
        block_id: saved.id,
        version_hash,
        shape_id,
        visibility,
        conformance,
        attestation: Some(attestation),
    })
}

/// Structured publish result for the in-product publish moment: on refusal the
/// conformance report travels so the UI can name the failed check.
#[derive(Clone, Debug, SimpleObject)]
pub struct PublishOutcome {
    pub ok: bool,
    pub receipt: Option<PublishReceipt>,
    pub conformance: ConformanceReport,
    pub error: Option<String>,
}

/// `publish_block` wrapped into a `PublishOutcome` (never errors on refusal).
pub fn publish_block_outcome<S, B>(
    cp: &mut Commonplace<S, B>,
    origin_id: &str,
    visibility: Visibility,
    owner_principal: &str,
) -> PublishOutcome
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    match publish_block(cp, origin_id, visibility, owner_principal) {
        Ok(receipt) => PublishOutcome {
            ok: true,
            conformance: receipt.conformance.clone(),
            receipt: Some(receipt),
            error: None,
        },
        Err(PublishError::Refused(report)) => {
            let named = report
                .checks
                .iter()
                .filter(|c| !c.passed)
                .map(|c| format!("{} {}: {}", c.level, c.name, c.detail))
                .collect::<Vec<_>>()
                .join("; ");
            PublishOutcome {
                ok: false,
                receipt: None,
                conformance: report,
                error: Some(format!("publish refused: {named}")),
            }
        }
        Err(PublishError::OriginNotFound) => PublishOutcome {
            ok: false,
            receipt: None,
            conformance: ConformanceReport {
                level: "L0".into(),
                passed: false,
                checks: Vec::new(),
            },
            error: Some("origin artifact not found".into()),
        },
        Err(PublishError::Forbidden) => PublishOutcome {
            ok: false,
            receipt: None,
            conformance: ConformanceReport {
                level: "L0".into(),
                passed: false,
                checks: Vec::new(),
            },
            error: Some("not authorized to publish over this block".into()),
        },
        Err(_) => PublishOutcome {
            ok: false,
            receipt: None,
            conformance: ConformanceReport {
                level: "L0".into(),
                passed: false,
                checks: Vec::new(),
            },
            error: Some("publish failed".into()),
        },
    }
}

/// Unpublish by alias: flip the alias to a `gone` state and revoke the grant;
/// the block record survives in the graph.
pub fn unpublish_block<S, B>(
    cp: &mut Commonplace<S, B>,
    alias: &str,
    caller: &str,
) -> Result<(), PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let mut record = find_by_alias(cp, alias)
        .map_err(|_| PublishError::AliasNotFound)?
        .ok_or(PublishError::AliasNotFound)?;
    if !owned_by(&record, caller) {
        return Err(PublishError::Forbidden);
    }
    record.extra.insert("state".into(), json!("gone"));
    record.extra.insert("granted".into(), json!([] as [String; 0]));
    cp.put_item(record).map_err(|_| PublishError::AliasNotFound)?;
    Ok(())
}

/// Change visibility of an already-published block; takes effect on next request.
pub fn set_visibility<S, B>(
    cp: &mut Commonplace<S, B>,
    alias: &str,
    caller: &str,
    visibility: Visibility,
) -> Result<(), PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let mut record = find_by_alias(cp, alias)
        .map_err(|_| PublishError::AliasNotFound)?
        .ok_or(PublishError::AliasNotFound)?;
    if !owned_by(&record, caller) {
        return Err(PublishError::Forbidden);
    }
    record.extra.insert("visibility".into(), json!(visibility.as_str()));
    cp.put_item(record).map_err(|_| PublishError::AliasNotFound)?;
    Ok(())
}

/// Resolve an alias for the public host. `principal` is `Some(id)` for a signed-in
/// visitor. Enforces visibility: public/unlisted resolve anonymously; private
/// requires a granted principal. A `gone` block returns `AliasNotFound` so the
/// host renders the designed gone state (distinct from unknown → 404 upstream).
pub fn resolve_alias<S, B>(
    cp: &mut Commonplace<S, B>,
    alias: &str,
    principal: Option<&str>,
    count_view: bool,
) -> Result<PublishedBlock, PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let mut record = find_by_alias(cp, alias)
        .map_err(|_| PublishError::AliasNotFound)?
        .ok_or(PublishError::AliasNotFound)?;

    let state = record.extra.get("state").and_then(Value::as_str).unwrap_or("published");
    if state == "gone" {
        return Err(PublishError::Gone);
    }

    let visibility = Visibility::from_str(
        record.extra.get("visibility").and_then(Value::as_str).unwrap_or("unlisted"),
    );
    if visibility == Visibility::Private {
        let granted = record
            .extra
            .get("granted")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect::<Vec<_>>())
            .unwrap_or_default();
        match principal {
            Some(p) if granted.iter().any(|g| g == p) => {}
            _ => return Err(PublishError::Forbidden),
        }
    }

    if count_view {
        let next = record.extra.get("view_count").and_then(Value::as_i64).unwrap_or(0) + 1;
        record.extra.insert("view_count".into(), json!(next));
        record = cp.put_item(record).map_err(|_| PublishError::AliasNotFound)?;
    }

    Ok(to_published_block(&record))
}

/// Public-host resolution with a designed status for each outcome.
pub fn resolve_alias_status<S, B>(
    cp: &mut Commonplace<S, B>,
    alias: &str,
    viewer: Option<&str>,
    count_view: bool,
) -> PublishResolution
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    match resolve_alias(cp, alias, viewer, count_view) {
        Ok(block) => PublishResolution {
            status: "ok".into(),
            block: Some(block),
        },
        Err(PublishError::Gone) => PublishResolution {
            status: "gone".into(),
            block: None,
        },
        Err(PublishError::Forbidden) => PublishResolution {
            status: "forbidden".into(),
            block: None,
        },
        _ => PublishResolution {
            status: "not_found".into(),
            block: None,
        },
    }
}

/// Resolve a permanent version-addressed hash (current or historical). A version
/// URL is the was-ever-public citation surface (HANDOFF-PUBLISH D1): a public or
/// unlisted version resolves forever as a frozen snapshot, even after the alias
/// is unpublished or re-pointed. A private version never resolves here, even to
/// someone holding the hash.
pub fn resolve_version<S, B>(
    cp: &Commonplace<S, B>,
    version_hash: &str,
) -> Result<PublishedBlock, PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let records = cp
        .items_by_kind(&published_kind())
        .map_err(|_| PublishError::VersionNotFound)?;

    // The version currently live at an alias: serve it unless it is private.
    for record in &records {
        if record.extra.get("version_hash").and_then(Value::as_str) == Some(version_hash) {
            let visibility = Visibility::from_str(
                record.extra.get("visibility").and_then(Value::as_str).unwrap_or("unlisted"),
            );
            if visibility == Visibility::Private {
                return Err(PublishError::VersionNotFound);
            }
            return Ok(to_published_block(record));
        }
    }

    // A frozen historical snapshot, gated on its own per-version visibility so a
    // version published while public keeps resolving even after the alias flips
    // private, while a version that was private never resolves.
    for record in &records {
        let Some(history) = record.extra.get("history").and_then(Value::as_array) else {
            continue;
        };
        for entry in history {
            let Ok(snapshot) = serde_json::from_value::<VersionSnapshot>(entry.clone()) else {
                continue;
            };
            if snapshot.version_hash == version_hash {
                if Visibility::from_str(&snapshot.visibility) == Visibility::Private {
                    return Err(PublishError::VersionNotFound);
                }
                return Ok(published_block_from_snapshot(record, &snapshot));
            }
        }
    }

    Err(PublishError::VersionNotFound)
}

/// Aliases of all currently-public, live blocks, for the public sitemap (P3.2).
/// Unlisted and private blocks are excluded (they carry noindex and never enter
/// the sitemap); gone blocks are excluded too.
pub fn public_aliases<S, B>(cp: &Commonplace<S, B>) -> Vec<String>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    cp.items_by_kind(&published_kind())
        .into_iter()
        .flatten()
        .filter(|it| {
            let live = it.extra.get("state").and_then(Value::as_str).unwrap_or("published") != "gone";
            let public = Visibility::from_str(
                it.extra.get("visibility").and_then(Value::as_str).unwrap_or("unlisted"),
            ) == Visibility::Public;
            live && public
        })
        .filter_map(|it| it.extra.get("alias").and_then(Value::as_str).map(str::to_string))
        .collect()
}

/// Doorway: reference a published block into a visitor's space (not a copy).
/// Returns the new reference item id. `fork` makes an owned divergent copy where
/// the grant permits it.
pub fn reference_block<S, B>(
    cp: &mut Commonplace<S, B>,
    alias: &str,
    visitor_principal: &str,
    fork: bool,
) -> Result<String, PublishError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    // Authorize through the same resolution the public host uses: a gone block,
    // or a private block the visitor has no grant for, is refused here too, so a
    // caller who merely knows the alias cannot reference or fork restricted
    // content.
    let block = resolve_alias(cp, alias, Some(visitor_principal), false)?;
    let origin_id = block.origin_id.clone();
    let title = block.title.clone();

    let mut item = if fork {
        // Fork: an owned, divergent copy of the origin's renderable content.
        let text = block.payload.0.get("text").and_then(Value::as_str).unwrap_or_default();
        Item::new(ItemKind::from(REFERENCE_KIND.to_string()), format!("Fork of {title}"))
            .with_text(text)
    } else {
        Item::new(ItemKind::from(REFERENCE_KIND.to_string()), format!("Ref: {title}"))
    };
    item.extra.insert(
        "provenance".into(),
        json!({
            "origin_block_id": block.block_id,
            "origin_alias": alias,
            "origin_id": origin_id,
            "kind": if fork { "fork" } else { "reference" },
            "by": visitor_principal,
        }),
    );
    let saved = cp.put_item(item).map_err(|_| PublishError::AliasNotFound)?;
    let _ = cp.link_explicit(
        REFERENCES_EDGE,
        &saved.id,
        &block.block_id,
        if fork { "fork" } else { "reference" },
    );
    Ok(saved.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use commonplace::{Commonplace, InMemoryBlobStore};
    use rustyred_thg_core::InMemoryGraphStore;

    fn store() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
    }

    fn seed_doc(cp: &mut Commonplace<InMemoryGraphStore, InMemoryBlobStore>) -> String {
        let item = Item::new(ItemKind::Doc, "My Document").with_text("hello world");
        cp.put_item(item).unwrap().id
    }

    #[test]
    fn publish_returns_url_and_version_hash() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Unlisted, "owner").unwrap();
        assert!(receipt.url.starts_with("/p/"));
        assert!(receipt.version_hash.starts_with("sha256:"));
        assert!(receipt.conformance.passed);
        // Resolves back through the public host path.
        let block = resolve_alias(&mut cp, &receipt.alias, None, false).unwrap();
        assert_eq!(block.origin_id, id);
        assert_eq!(block.shape_id, "doc");
    }

    #[test]
    fn shape_invalid_block_is_refused_with_conformance() {
        let mut cp = store();
        let bogus = Item::new(ItemKind::from("nonsense".to_string()), "x").with_text("y");
        let id = cp.put_item(bogus).unwrap().id;
        let err = publish_block(&mut cp, &id, Visibility::Unlisted, "owner").unwrap_err();
        match err {
            PublishError::Refused(report) => {
                assert!(!report.passed);
                assert!(report.checks.iter().any(|c| c.name == "shape" && !c.passed));
            }
            _ => panic!("expected refusal"),
        }
    }

    #[test]
    fn unpublish_makes_alias_gone_but_block_survives() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        unpublish_block(&mut cp, &receipt.alias, "owner").unwrap();
        // Alias resolution now yields the gone signal.
        assert!(matches!(
            resolve_alias(&mut cp, &receipt.alias, None, false),
            Err(PublishError::Gone)
        ));
        assert_eq!(
            resolve_alias_status(&mut cp, &receipt.alias, None, false).status,
            "gone"
        );
        // But the version-addressed hash still resolves (block preserved).
        let by_version = resolve_version(&cp, &receipt.version_hash).unwrap();
        assert_eq!(by_version.origin_id, id);
    }

    #[test]
    fn republish_serves_new_version_at_alias_old_at_hash() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let first = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // Edit the origin, re-publish.
        let mut origin = cp.get_item(&id).unwrap().unwrap();
        origin.body = ItemBody::Inline { text: "hello edited".into() };
        cp.put_item(origin).unwrap();
        let second = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        assert_ne!(first.version_hash, second.version_hash);
        assert_eq!(first.alias, second.alias); // stable alias
        // Alias serves the new version and its new content.
        let at_alias = resolve_alias(&mut cp, &second.alias, None, false).unwrap();
        assert_eq!(at_alias.version_hash, second.version_hash);
        assert_eq!(
            at_alias.payload.0.get("text").and_then(Value::as_str),
            Some("hello edited")
        );
        // The old hash serves the frozen original content, not the current alias
        // content (D1: a version URL is a frozen snapshot).
        let old = resolve_version(&cp, &first.version_hash).unwrap();
        assert_eq!(old.origin_id, id);
        assert_eq!(old.version_hash, first.version_hash);
        assert_eq!(
            old.payload.0.get("text").and_then(Value::as_str),
            Some("hello world")
        );
    }

    #[test]
    fn private_requires_granted_principal() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Private, "owner").unwrap();
        // Anonymous is forbidden.
        assert!(matches!(
            resolve_alias(&mut cp, &receipt.alias, None, false),
            Err(PublishError::Forbidden)
        ));
        // A non-granted principal is forbidden.
        assert!(matches!(
            resolve_alias(&mut cp, &receipt.alias, Some("stranger"), false),
            Err(PublishError::Forbidden)
        ));
        // The owner resolves.
        assert!(resolve_alias(&mut cp, &receipt.alias, Some("owner"), false).is_ok());
    }

    #[test]
    fn flipping_public_to_private_takes_effect() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        assert!(resolve_alias(&mut cp, &receipt.alias, None, false).is_ok());
        set_visibility(&mut cp, &receipt.alias, "owner", Visibility::Private).unwrap();
        assert!(matches!(
            resolve_alias(&mut cp, &receipt.alias, None, false),
            Err(PublishError::Forbidden)
        ));
    }

    #[test]
    fn view_counter_increments() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        resolve_alias(&mut cp, &receipt.alias, None, true).unwrap();
        let block = resolve_alias(&mut cp, &receipt.alias, None, true).unwrap();
        assert!(block.view_count >= 1);
    }

    #[test]
    fn reference_and_fork_carry_provenance() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        let ref_id = reference_block(&mut cp, &receipt.alias, "visitor", false).unwrap();
        let reference = cp.get_item(&ref_id).unwrap().unwrap();
        let prov = reference.extra.get("provenance").unwrap();
        assert_eq!(prov.get("origin_alias").and_then(Value::as_str), Some(receipt.alias.as_str()));
        assert_eq!(prov.get("kind").and_then(Value::as_str), Some("reference"));

        let fork_id = reference_block(&mut cp, &receipt.alias, "visitor", true).unwrap();
        let fork = cp.get_item(&fork_id).unwrap().unwrap();
        assert_eq!(
            fork.extra.get("provenance").and_then(|p| p.get("kind")).and_then(Value::as_str),
            Some("fork")
        );
    }

    #[test]
    fn public_aliases_lists_only_public_live_blocks() {
        let mut cp = store();
        let pub_id = seed_doc(&mut cp);
        let public = publish_block(&mut cp, &pub_id, Visibility::Public, "owner").unwrap();

        // An unlisted block: excluded from the sitemap.
        let unlisted_item = Item::new(ItemKind::Doc, "Unlisted").with_text("u");
        let unlisted_id = cp.put_item(unlisted_item).unwrap().id;
        publish_block(&mut cp, &unlisted_id, Visibility::Unlisted, "owner").unwrap();

        // A public-then-unpublished block: gone, excluded.
        let gone_item = Item::new(ItemKind::Doc, "Gone").with_text("g");
        let gone_id = cp.put_item(gone_item).unwrap().id;
        let gone = publish_block(&mut cp, &gone_id, Visibility::Public, "owner").unwrap();
        unpublish_block(&mut cp, &gone.alias, "owner").unwrap();

        let aliases = public_aliases(&cp);
        assert!(aliases.contains(&public.alias));
        assert!(!aliases.iter().any(|a| a == &gone.alias));
        assert_eq!(aliases.len(), 1);
    }

    #[test]
    fn published_block_carries_verifiable_attestation() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // The receipt carries the attestation.
        let att = receipt.attestation.as_ref().expect("attestation on receipt");
        assert_eq!(att.algorithm, "ed25519");
        // It verifies against the tenant's current verifying key.
        assert_eq!(att.public_key_hex, keystore::verifying_key_hex("owner"));
        // Resolving through the public host shows a genuine signature-verified state.
        let block = resolve_alias(&mut cp, &receipt.alias, None, false).unwrap();
        assert!(block.attestation.is_some());
        assert!(block.signature_verified);
    }

    #[test]
    fn tampering_the_stored_block_breaks_verification() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // Tamper with the stored version hash (the signed content identity),
        // leaving the intact signature attached.
        let mut record = find_by_alias(&cp, &receipt.alias).unwrap().unwrap();
        record
            .extra
            .insert("version_hash".into(), json!("sha256:tampered"));
        cp.put_item(record).unwrap();
        // The signature no longer matches the stored identity: degrades honestly.
        let block = resolve_alias(&mut cp, &receipt.alias, None, false).unwrap();
        assert!(block.attestation.is_some());
        assert!(!block.signature_verified);
    }

    #[test]
    fn private_version_hash_does_not_resolve_publicly() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Private, "owner").unwrap();
        // A private block's version hash is not a public citation surface:
        // holding the hash does not resolve the content.
        assert!(matches!(
            resolve_version(&cp, &receipt.version_hash),
            Err(PublishError::VersionNotFound)
        ));
    }

    #[test]
    fn version_public_when_published_survives_a_later_private_flip() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let first = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // Edit + re-publish to push the first (public) version into history.
        let mut origin = cp.get_item(&id).unwrap().unwrap();
        origin.body = ItemBody::Inline { text: "v2".into() };
        cp.put_item(origin).unwrap();
        let second = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // Flip the alias to private.
        set_visibility(&mut cp, &second.alias, "owner", Visibility::Private).unwrap();
        // The historical version that was public still resolves as a frozen
        // snapshot; the now-private current version does not.
        assert!(resolve_version(&cp, &first.version_hash).is_ok());
        assert!(matches!(
            resolve_version(&cp, &second.version_hash),
            Err(PublishError::VersionNotFound)
        ));
    }

    #[test]
    fn republish_by_a_non_owner_is_forbidden() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        // A different principal who knows the origin id cannot overwrite it.
        assert!(matches!(
            publish_block(&mut cp, &id, Visibility::Public, "stranger"),
            Err(PublishError::Forbidden)
        ));
        // The outcome wrapper reports the refusal without erroring.
        let outcome = publish_block_outcome(&mut cp, &id, Visibility::Public, "stranger");
        assert!(!outcome.ok);
    }

    #[test]
    fn unpublish_and_set_visibility_require_ownership() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        assert!(matches!(
            unpublish_block(&mut cp, &receipt.alias, "stranger"),
            Err(PublishError::Forbidden)
        ));
        assert!(matches!(
            set_visibility(&mut cp, &receipt.alias, "stranger", Visibility::Private),
            Err(PublishError::Forbidden)
        ));
        // The stranger changed nothing; the owner still controls the block.
        assert!(resolve_alias(&mut cp, &receipt.alias, None, false).is_ok());
        assert!(set_visibility(&mut cp, &receipt.alias, "owner", Visibility::Unlisted).is_ok());
    }

    #[test]
    fn reference_of_private_block_without_grant_is_forbidden() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Private, "owner").unwrap();
        // A stranger who knows the alias cannot reference or fork a private block.
        assert!(matches!(
            reference_block(&mut cp, &receipt.alias, "stranger", false),
            Err(PublishError::Forbidden)
        ));
        assert!(matches!(
            reference_block(&mut cp, &receipt.alias, "stranger", true),
            Err(PublishError::Forbidden)
        ));
        // The granted owner can reference it.
        assert!(reference_block(&mut cp, &receipt.alias, "owner", false).is_ok());
    }

    #[test]
    fn reference_of_gone_block_is_forbidden() {
        let mut cp = store();
        let id = seed_doc(&mut cp);
        let receipt = publish_block(&mut cp, &id, Visibility::Public, "owner").unwrap();
        unpublish_block(&mut cp, &receipt.alias, "owner").unwrap();
        // An unpublished (gone) block cannot be referenced or forked.
        assert!(reference_block(&mut cp, &receipt.alias, "visitor", false).is_err());
    }
}
