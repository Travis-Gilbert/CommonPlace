//! The consumer GraphQL profile (plan unit F3).
//!
//! Exposes the CommonPlace object model as a typed schema: queries for items,
//! collections, and similarity search; mutations for ingest and edit. Every
//! resolver authorizes the request's API key before touching the store, so an
//! invalid key is rejected before any data access.
//!
//! The store is fixed to the in-memory backing here so the seam is fully
//! testable in-process; the identical schema runs over the durable
//! `RedCoreGraphStore` + `DiskObjectStore` backing (both impl the traits this
//! needs) by swapping the type alias, which is the named follow-up for the
//! durable self-hosted binary.

use std::collections::HashMap;
use std::marker::PhantomData;
use std::sync::{Arc, Mutex};

use async_graphql::{
    Context, EmptySubscription, Enum, Error, InputObject, Json as GqlJson, Object, Result, Schema,
    SimpleObject,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use commonplace::{
    BlobStore, Collection, CollectionKind, Commonplace, EmbeddingGraphStore, InMemoryBlobStore,
    IngestInput, IngestPipeline, Item, ItemBody, ItemKind, Residency, SourceRef, COLLECTION_LABEL,
    ITEM_EMBEDDING_PROPERTY,
};
use rustyred_thg_core::{DiskObjectStore, InMemoryGraphStore, NodeQuery, RedCoreGraphStore};
use serde_json::{json, Value};
use theorem_harness_core::GroundedClaim;
use theorem_harness_runtime::{
    run_configured_composed_agent, run_configured_composed_agent_with_claims,
    ComposedAgentRunResult, ProviderHeadInvoker, DEFAULT_BINDING_ID,
};
use yrs::updates::decoder::Decode;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update};

use crate::auth::{ApiKeyRegistry, ApiKeyToken, Principal};
use crate::briefing::{briefing as run_briefing, Briefing, BriefingConfig, ConnectedItem};
use crate::discover::{discover as run_discover, CandidateLink, DiscoverConfig};
use crate::organize::{
    organize as run_organize, DailyProgress, OrganizeConfig, OrganizeFiled, OrganizeGroup,
    OrganizeItem, OrganizeSnapshot, OrganizedToday, Subtask, Timeframe,
};
use crate::portability::{self, ExportDocument};
use crate::retrieve::{
    answer_from_provenance, retrieve_grounding, AnswerKind, AnswerModel, AskConfig, AskResult,
    NoModel, RetrievedItem,
};

/// The default in-memory store backing (tests + the no-data-dir binary path).
pub type ApiStore = Commonplace<InMemoryGraphStore, InMemoryBlobStore>;
/// A shared, lockable instance store, generic over the backing.
pub type SharedStore<S, B> = Arc<Mutex<Commonplace<S, B>>>;
/// The in-memory shared store.
pub type InMemoryShared = SharedStore<InMemoryGraphStore, InMemoryBlobStore>;
/// The durable shared store (RedCore + disk) for a self-hosted instance.
pub type DurableShared = SharedStore<RedCoreGraphStore, DiskObjectStore>;
/// The consumer schema over the in-memory backing (default / tests).
pub type ConsumerSchema = Schema<
    Query<InMemoryGraphStore, InMemoryBlobStore>,
    Mutation<InMemoryGraphStore, InMemoryBlobStore>,
    EmptySubscription,
>;
/// The consumer schema over the durable RedCore + disk backing.
pub type DurableSchema = Schema<
    Query<RedCoreGraphStore, DiskObjectStore>,
    Mutation<RedCoreGraphStore, DiskObjectStore>,
    EmptySubscription,
>;

const PAGE_CRDT_SOURCE: &str = "commonplace.page_crdt_snapshot";
const PAGE_CRDT_ROLE: &str = "page_crdt_snapshot";
const PAGE_CRDT_ENCODING: &str = "yjs-update-v1";
const PAGE_CRDT_MIME: &str = "application/vnd.commonplace.yjs-update-v1";

/// An item, in the consumer API shape.
#[derive(SimpleObject)]
pub struct ItemGql {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub body_text: Option<String>,
    pub blob_hash: Option<String>,
    pub mime: Option<String>,
    pub source: Option<String>,
    pub residency: String,
    pub tags: Vec<String>,
    pub collections: Vec<String>,
    pub classification: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_at_ms: Option<i64>,
    pub path: Option<String>,
    pub extra: GqlJson<Value>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

impl From<Item> for ItemGql {
    fn from(item: Item) -> Self {
        let (body_text, blob_hash, mime) = match item.body {
            ItemBody::Inline { text } => (Some(text), None, None),
            ItemBody::Blob {
                content_hash, mime, ..
            } => (None, Some(content_hash), mime),
            ItemBody::Empty => (None, None, None),
        };
        let path = item
            .extra
            .get("path")
            .or_else(|| item.extra.get("folder_path"))
            .and_then(|value| value.as_str())
            .map(str::to_string);
        Self {
            id: item.id,
            kind: item.kind.as_str().to_string(),
            title: item.title,
            body_text,
            blob_hash,
            mime,
            source: item.source,
            residency: item.residency.as_str().to_string(),
            tags: item.tags,
            collections: item.collections,
            classification: item.classification,
            status: item.status,
            priority: item.priority,
            due_at_ms: item.due_at_ms,
            path,
            extra: GqlJson(Value::Object(item.extra)),
            created_at_ms: item.created_at_ms,
            updated_at_ms: item.updated_at_ms,
        }
    }
}

/// A collection, in the consumer API shape.
#[derive(SimpleObject)]
pub struct CollectionGql {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub start_at_ms: Option<i64>,
    pub end_at_ms: Option<i64>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
    pub feature_flags: GqlJson<Value>,
    pub created_at_ms: i64,
}

impl From<Collection> for CollectionGql {
    fn from(collection: Collection) -> Self {
        Self {
            id: collection.id,
            name: collection.name,
            kind: collection.kind.as_str().to_string(),
            identifier: collection.identifier,
            description: collection.description,
            start_at_ms: collection.start_at_ms,
            end_at_ms: collection.end_at_ms,
            color: collection.color,
            sort_order: collection.sort_order,
            feature_flags: GqlJson(json!(collection.feature_flags)),
            created_at_ms: collection.created_at_ms,
        }
    }
}

#[derive(SimpleObject)]
pub struct PmLabelGql {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(SimpleObject)]
pub struct PmStateGql {
    pub id: String,
    pub name: String,
    pub group: String,
    pub sort_order: i32,
}

impl From<Item> for PmStateGql {
    fn from(item: Item) -> Self {
        let group = extra_str(&item, "group").unwrap_or_else(|| "unstarted".to_string());
        let sort_order = extra_i64(&item, "sort_order").unwrap_or(0) as i32;
        Self {
            id: item.id,
            name: item.title,
            group,
            sort_order,
        }
    }
}

#[derive(SimpleObject)]
pub struct PmWorkItemGql {
    pub item: ItemGql,
    pub sequence_id: Option<String>,
    pub state: Option<PmStateGql>,
    pub estimate_point: Option<i32>,
    pub project_ids: Vec<String>,
    pub cycle_ids: Vec<String>,
    pub module_ids: Vec<String>,
    pub about_ids: Vec<String>,
    pub comment_count: i32,
    pub worklog_count: i32,
    pub total_worklog_duration_ms: i64,
}

#[derive(SimpleObject)]
pub struct PmProjectGql {
    pub collection: CollectionGql,
    pub states: Vec<PmStateGql>,
    pub cycles: Vec<CollectionGql>,
    pub modules: Vec<CollectionGql>,
    pub labels: Vec<PmLabelGql>,
    pub work_item_count: i32,
    pub open_item_count: i32,
}

#[derive(SimpleObject)]
pub struct PmOverviewGql {
    pub projects: Vec<PmProjectGql>,
    pub work_items: Vec<PmWorkItemGql>,
    pub stickies: Vec<ItemGql>,
    pub pages: Vec<ItemGql>,
}

#[derive(SimpleObject)]
pub struct PageCrdtSnapshotGql {
    pub page_id: String,
    pub item: ItemGql,
    pub update_base64: String,
    pub encoding: String,
    pub blob_hash: String,
    pub byte_len: i32,
    pub stored_at_ms: i64,
}

/// A similarity-search hit.
#[derive(SimpleObject)]
pub struct SearchHitGql {
    pub item: ItemGql,
    pub score: f64,
}

/// One row in the client-side `embedding_space` table consumed by Embedding Atlas.
#[derive(Clone, SimpleObject)]
pub struct EmbeddingSpaceRowGql {
    pub identifier: String,
    pub x: f64,
    pub y: f64,
    /// Integer category id, because Embedding Atlas expects 0-indexed categories.
    pub category: i32,
    pub category_label: String,
    pub text: String,
    pub created_ms: i64,
    pub community_id: String,
    pub epistemic_status: String,
}

/// The server-side embedding projection plus metadata for the frontend table.
#[derive(SimpleObject)]
pub struct EmbeddingSpaceGql {
    pub table: String,
    pub projection: String,
    pub total: i32,
    pub rows: Vec<EmbeddingSpaceRowGql>,
}

/// A nearest-neighbor hit for object-seeded vector navigation.
#[derive(SimpleObject)]
pub struct VectorNeighborGql {
    pub row: EmbeddingSpaceRowGql,
    pub score: f64,
}

/// Input for the auto-structuring ingest mutation.
#[derive(InputObject)]
pub struct IngestInputGql {
    pub title: String,
    pub text: String,
    /// One of file/note/link/image/doc, or any custom kind. Defaults to note.
    pub kind: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
    pub residency: Option<String>,
}

#[derive(InputObject)]
pub struct CreateProjectInputGql {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub default_states: Option<bool>,
}

#[derive(InputObject)]
pub struct CreateStateInputGql {
    pub project_id: String,
    pub name: String,
    pub group: String,
    pub sort_order: Option<i32>,
}

#[derive(InputObject)]
pub struct CreateWorkItemInputGql {
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub state_id: Option<String>,
    pub priority: Option<String>,
    pub due_at_ms: Option<i64>,
    pub estimate_point: Option<i32>,
    pub sequence_id: Option<String>,
    pub kind: Option<String>,
}

#[derive(InputObject)]
pub struct CreateCycleInputGql {
    pub project_id: String,
    pub name: String,
    pub start_at_ms: i64,
    pub end_at_ms: i64,
}

#[derive(InputObject)]
pub struct CreateModuleInputGql {
    pub project_id: String,
    pub name: String,
}

#[derive(InputObject)]
pub struct CreateCommentInputGql {
    pub item_id: String,
    pub body: String,
    pub author_id: Option<String>,
}

#[derive(InputObject)]
pub struct LogWorkInputGql {
    pub task_id: String,
    pub duration_ms: i64,
    pub logged_by: Option<String>,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct CreateStickyInputGql {
    pub owner_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub background_color: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(InputObject)]
pub struct CreatePageInputGql {
    pub project_id: Option<String>,
    pub about_item_id: Option<String>,
    pub title: String,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(InputObject)]
pub struct SavePageInputGql {
    pub id: String,
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(InputObject)]
pub struct StorePageCrdtSnapshotInputGql {
    pub page_id: String,
    pub update_base64: String,
    pub encoding: Option<String>,
}

/// How an ask answer was produced.
#[derive(Enum, Copy, Clone, Debug, Eq, PartialEq)]
pub enum AnswerKindGql {
    /// Synthesized by a configured generative model.
    Model,
    /// Extracted from the retrieved items (no generative model configured).
    Extractive,
    /// No matching items were found.
    Empty,
}

impl From<AnswerKind> for AnswerKindGql {
    fn from(kind: AnswerKind) -> Self {
        match kind {
            AnswerKind::Model => AnswerKindGql::Model,
            AnswerKind::Extractive => AnswerKindGql::Extractive,
            AnswerKind::Empty => AnswerKindGql::Empty,
        }
    }
}

/// One grounding item behind an answer.
#[derive(SimpleObject)]
pub struct ProvenanceGql {
    pub item: ItemGql,
    pub score: f64,
    /// Which retrieval arms surfaced this item (vector / lexical / graph).
    pub arms: Vec<String>,
}

impl From<RetrievedItem> for ProvenanceGql {
    fn from(hit: RetrievedItem) -> Self {
        Self {
            item: ItemGql::from(hit.item),
            score: hit.score,
            arms: hit.arms,
        }
    }
}

/// An answer grounded in the user's items, each traceable to its source.
#[derive(SimpleObject)]
pub struct AskResultGql {
    pub answer: String,
    pub answer_kind: AnswerKindGql,
    pub provenance: Vec<ProvenanceGql>,
}

impl From<AskResult> for AskResultGql {
    fn from(result: AskResult) -> Self {
        Self {
            answer: result.answer,
            answer_kind: AnswerKindGql::from(result.answer_kind),
            provenance: result
                .provenance
                .into_iter()
                .map(ProvenanceGql::from)
                .collect(),
        }
    }
}

/// Evidence handed to the composed Theorem agent.
#[derive(Clone, InputObject)]
pub struct TheoremAgentClaimInput {
    pub text: String,
    pub provenance: String,
}

/// A published claim from the composed Theorem agent.
#[derive(Clone, SimpleObject)]
pub struct TheoremAgentClaimGql {
    pub text: String,
    pub provenance: String,
}

impl From<GroundedClaim> for TheoremAgentClaimGql {
    fn from(claim: GroundedClaim) -> Self {
        Self {
            text: claim.text,
            provenance: claim.provenance,
        }
    }
}

/// A composed Theorem agent run over the configured API heads.
#[derive(SimpleObject)]
pub struct TheoremAgentRunGql {
    pub answer: String,
    pub answer_kind: AnswerKindGql,
    pub binding_id: String,
    pub run_id: String,
    pub heads: Vec<String>,
    pub claims: Vec<TheoremAgentClaimGql>,
    pub alignment_verdict: GqlJson<Value>,
    pub evidence_count: i32,
}

impl TheoremAgentRunGql {
    fn from_composed(result: ComposedAgentRunResult, evidence_count: i32) -> Self {
        let claims: Vec<TheoremAgentClaimGql> = result
            .published_claims
            .iter()
            .cloned()
            .map(TheoremAgentClaimGql::from)
            .collect();
        let answer = theorem_agent_answer(&result, &claims);
        Self {
            answer_kind: if answer.is_empty() {
                AnswerKindGql::Empty
            } else {
                AnswerKindGql::Model
            },
            answer,
            binding_id: result.binding_id,
            run_id: result.run_id,
            heads: result.consensus_head_set,
            claims,
            alignment_verdict: GqlJson(result.alignment_verdict),
            evidence_count,
        }
    }
}

fn normalize_theorem_agent_claims(claims: Vec<TheoremAgentClaimInput>) -> Vec<GroundedClaim> {
    claims
        .into_iter()
        .filter_map(|claim| {
            let text = claim.text.trim();
            let provenance = claim.provenance.trim();
            if text.is_empty() || provenance.is_empty() {
                None
            } else {
                Some(GroundedClaim::new(text, provenance))
            }
        })
        .collect()
}

fn theorem_agent_answer(
    result: &ComposedAgentRunResult,
    claims: &[TheoremAgentClaimGql],
) -> String {
    if !claims.is_empty() {
        return claims
            .iter()
            .map(|claim| claim.text.as_str())
            .collect::<Vec<_>>()
            .join("\n\n")
            .trim()
            .to_string();
    }

    let Some(receipt) = result.invocation_receipts.last() else {
        return String::new();
    };
    if let Some(text) = receipt.payload.get("text").and_then(Value::as_str) {
        let text = strip_claims_json(text);
        if !text.is_empty() {
            return text;
        }
    }
    strip_claims_json(&receipt.output_summary)
}

fn strip_claims_json(value: &str) -> String {
    let lowered = value.to_ascii_lowercase();
    match lowered.find("claims json:") {
        Some(marker) => {
            let prefix = value[..marker].trim();
            if prefix.is_empty() {
                value.trim().to_string()
            } else {
                prefix.to_string()
            }
        }
        None => value.trim().to_string(),
    }
}

/// An item plus how it connects to the rest of the store.
#[derive(SimpleObject)]
pub struct ConnectedItemGql {
    pub item: ItemGql,
    pub connections: i32,
    pub related: Vec<ItemGql>,
}

impl From<ConnectedItem> for ConnectedItemGql {
    fn from(connected: ConnectedItem) -> Self {
        Self {
            item: ItemGql::from(connected.item),
            connections: connected.connections as i32,
            related: connected.related.into_iter().map(ItemGql::from).collect(),
        }
    }
}

/// Proactive briefing over the store: what is new, what connects, what is open.
#[derive(SimpleObject)]
pub struct BriefingGql {
    pub recent: Vec<ItemGql>,
    pub newly_connected: Vec<ConnectedItemGql>,
    pub open_threads: Vec<ItemGql>,
}

impl From<Briefing> for BriefingGql {
    fn from(briefing: Briefing) -> Self {
        Self {
            recent: briefing.recent.into_iter().map(ItemGql::from).collect(),
            newly_connected: briefing
                .newly_connected
                .into_iter()
                .map(ConnectedItemGql::from)
                .collect(),
            open_threads: briefing
                .open_threads
                .into_iter()
                .map(ItemGql::from)
                .collect(),
        }
    }
}

/// A proposed connection between two not-yet-linked items.
#[derive(SimpleObject)]
pub struct CandidateLinkGql {
    pub a: ItemGql,
    pub b: ItemGql,
    pub similarity: f64,
    pub reason: String,
}

impl From<CandidateLink> for CandidateLinkGql {
    fn from(link: CandidateLink) -> Self {
        Self {
            a: ItemGql::from(link.a),
            b: ItemGql::from(link.b),
            similarity: link.similarity,
            reason: link.reason,
        }
    }
}

/// Serialization format for export.
#[derive(Enum, Copy, Clone, Debug, Eq, PartialEq)]
pub enum ExportFormat {
    /// Lossless JSON (reimports without loss).
    Json,
    /// Human-readable markdown (one-way rendering).
    Markdown,
}

/// What an import wrote.
#[derive(SimpleObject)]
pub struct ImportResultGql {
    pub imported: i32,
    pub collections: i32,
}

/// A next-best candidate collection for an item.
#[derive(SimpleObject)]
pub struct OrganizeAlternativeGql {
    pub collection_id: String,
    pub label: String,
}

/// The engine's classification verdict for an organize item.
#[derive(SimpleObject)]
pub struct OrganizeClassificationGql {
    pub target_collection_id: Option<String>,
    pub target_collection_label: Option<String>,
    pub confidence: f64,
    pub alternatives: Vec<OrganizeAlternativeGql>,
}

/// A checkbox subtask parsed from a task item's body.
#[derive(SimpleObject)]
pub struct SubtaskGql {
    pub text: String,
    pub done: bool,
}

impl From<Subtask> for SubtaskGql {
    fn from(subtask: Subtask) -> Self {
        Self {
            text: subtask.text,
            done: subtask.done,
        }
    }
}

/// An item in the organize surface, with its classification attached.
#[derive(SimpleObject)]
pub struct OrganizeItemGql {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub preview: String,
    pub source: String,
    /// ISO-8601 UTC of the item's updated_at_ms.
    pub arrived_at: String,
    pub classification: OrganizeClassificationGql,
    pub time_sensitive: bool,
    pub expected_action: Option<String>,
    /// Checkbox subtasks parsed from the body (empty unless the item is a task).
    pub subtasks: Vec<SubtaskGql>,
    /// The item's tags (note cards surface these).
    pub tags: Vec<String>,
}

impl From<OrganizeItem> for OrganizeItemGql {
    fn from(item: OrganizeItem) -> Self {
        let arrived_at = crate::organize::iso_from_ms(item.item.updated_at_ms);
        let alternatives = item
            .alternatives
            .into_iter()
            .map(|(collection_id, label)| OrganizeAlternativeGql {
                collection_id,
                label,
            })
            .collect();
        let subtasks = item.subtasks.into_iter().map(SubtaskGql::from).collect();
        Self {
            id: item.item.id,
            kind: item.kind,
            title: item.item.title,
            preview: item.preview,
            source: item.source,
            arrived_at,
            classification: OrganizeClassificationGql {
                target_collection_id: item.target_collection_id,
                target_collection_label: item.target_collection_label,
                confidence: item.confidence as f64,
                alternatives,
            },
            time_sensitive: item.time_sensitive,
            expected_action: item.expected_action,
            subtasks,
            tags: item.tags,
        }
    }
}

/// An item the engine filed, plus when it filed it.
#[derive(SimpleObject)]
pub struct OrganizeFiledGql {
    pub item: OrganizeItemGql,
    pub filed_at: String,
}

impl From<OrganizeFiled> for OrganizeFiledGql {
    fn from(filed: OrganizeFiled) -> Self {
        Self {
            item: OrganizeItemGql::from(filed.item),
            filed_at: filed.filed_at,
        }
    }
}

/// A filed-into collection with its member count for the timeframe.
#[derive(SimpleObject)]
pub struct OrganizeGroupGql {
    pub collection_id: String,
    pub label: String,
    pub count: i32,
}

impl From<OrganizeGroup> for OrganizeGroupGql {
    fn from(group: OrganizeGroup) -> Self {
        Self {
            collection_id: group.collection_id,
            label: group.label,
            count: group.count as i32,
        }
    }
}

/// What the engine organized in the timeframe, without a human.
#[derive(SimpleObject)]
pub struct OrganizedTodayGql {
    pub most_recent: Option<OrganizeFiledGql>,
    pub groups: Vec<OrganizeGroupGql>,
    pub total_count: i32,
}

impl From<OrganizedToday> for OrganizedTodayGql {
    fn from(today: OrganizedToday) -> Self {
        Self {
            most_recent: today.most_recent.map(OrganizeFiledGql::from),
            groups: today
                .groups
                .into_iter()
                .map(OrganizeGroupGql::from)
                .collect(),
            total_count: today.total_count as i32,
        }
    }
}

/// How much of the timeframe's intake is done vs. total.
#[derive(SimpleObject)]
pub struct DailyProgressGql {
    pub timeframe: String,
    pub done: i32,
    pub total: i32,
}

impl From<DailyProgress> for DailyProgressGql {
    fn from(progress: DailyProgress) -> Self {
        Self {
            timeframe: progress.timeframe,
            done: progress.done as i32,
            total: progress.total as i32,
        }
    }
}

/// The full organize snapshot: what needs you, what was organized, and progress.
#[derive(SimpleObject)]
pub struct OrganizeSnapshotGql {
    pub needs_you: Vec<OrganizeItemGql>,
    pub organized_today: OrganizedTodayGql,
    pub daily_progress: DailyProgressGql,
    pub needs_you_ceiling: f64,
}

impl From<OrganizeSnapshot> for OrganizeSnapshotGql {
    fn from(snapshot: OrganizeSnapshot) -> Self {
        Self {
            needs_you: snapshot
                .needs_you
                .into_iter()
                .map(OrganizeItemGql::from)
                .collect(),
            organized_today: OrganizedTodayGql::from(snapshot.organized_today),
            daily_progress: DailyProgressGql::from(snapshot.daily_progress),
            needs_you_ceiling: snapshot.needs_you_ceiling as f64,
        }
    }
}

fn principal(ctx: &Context<'_>) -> Result<Principal> {
    let token = ctx
        .data_opt::<ApiKeyToken>()
        .ok_or_else(|| Error::new("missing API key: present a key via the x-api-key header"))?;
    let registry = ctx.data::<Arc<ApiKeyRegistry>>()?;
    registry
        .resolve(&token.0)
        .cloned()
        .ok_or_else(|| Error::new("invalid API key"))
}

fn shared<S, B>(ctx: &Context<'_>) -> Result<SharedStore<S, B>>
where
    S: Send + Sync + 'static,
    B: Send + Sync + 'static,
{
    ctx.data::<SharedStore<S, B>>().cloned()
}

fn store_err(error: rustyred_thg_core::GraphStoreError) -> Error {
    Error::new(format!("{error:?}"))
}

fn extra_str(item: &Item, key: &str) -> Option<String> {
    item.extra
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn extra_i64(item: &Item, key: &str) -> Option<i64> {
    item.extra.get(key).and_then(Value::as_i64)
}

fn extra_i32(item: &Item, key: &str) -> Option<i32> {
    extra_i64(item, key).map(|value| value as i32)
}

fn item_embedding(item: &Item) -> Option<Vec<f32>> {
    if let Some(embedding) = &item.embedding {
        if !embedding.is_empty() {
            return Some(embedding.clone());
        }
    }
    let embedding = item.extra.get(ITEM_EMBEDDING_PROPERTY)?.as_array()?;
    let mut out = Vec::with_capacity(embedding.len());
    for value in embedding {
        out.push(value.as_f64()? as f32);
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

fn embedding_text(item: &Item) -> String {
    let text = item.text_for_embedding();
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.len() > 360 {
        format!("{}...", compact.chars().take(357).collect::<String>())
    } else {
        compact
    }
}

fn embedding_category_label(item: &Item) -> String {
    item.classification
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| item.kind.as_str().to_string())
}

fn embedding_community_id(item: &Item) -> String {
    item.collections
        .first()
        .cloned()
        .or_else(|| item.classification.clone())
        .unwrap_or_else(|| item.kind.as_str().to_string())
}

fn embedding_status(item: &Item) -> String {
    item.status
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| item.residency.as_str().to_string())
}

fn raw_embedding_projection(embedding: &[f32]) -> (f64, f64) {
    let mut x = 0.0_f64;
    let mut y = 0.0_f64;
    for (idx, value) in embedding.iter().enumerate() {
        let angle = (idx as f64 + 1.0) * 2.399_963_229_728_653;
        let weight = 1.0 / (1.0 + idx as f64 * 0.015);
        let v = *value as f64;
        x += v * angle.cos() * weight;
        y += v * angle.sin() * weight;
    }
    (x, y)
}

fn embedding_space_rows<S, B>(
    cp: &Commonplace<S, B>,
    kind: Option<&str>,
    limit: usize,
) -> rustyred_thg_core::GraphStoreResult<Vec<EmbeddingSpaceRowGql>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let mut projected = Vec::new();
    for item in cp.all_items()? {
        if let Some(kind) = kind {
            if item.kind.as_str() != kind {
                continue;
            }
        }
        let Some(embedding) = item_embedding(&item) else {
            continue;
        };
        let (x, y) = raw_embedding_projection(&embedding);
        projected.push((item, x, y));
    }

    if projected.is_empty() {
        return Ok(Vec::new());
    }

    let count = projected.len() as f64;
    let mean_x = projected.iter().map(|(_, x, _)| x).sum::<f64>() / count;
    let mean_y = projected.iter().map(|(_, _, y)| y).sum::<f64>() / count;
    let scale = projected
        .iter()
        .map(|(_, x, y)| (x - mean_x).abs().max((y - mean_y).abs()))
        .fold(0.0_f64, f64::max)
        .max(1.0);

    let mut labels: Vec<String> = projected
        .iter()
        .map(|(item, _, _)| embedding_category_label(item))
        .collect();
    labels.sort();
    labels.dedup();

    let mut rows = Vec::with_capacity(projected.len().min(limit));
    for (item, x, y) in projected.into_iter().take(limit) {
        let category_label = embedding_category_label(&item);
        let category = labels.binary_search(&category_label).unwrap_or_default() as i32;
        rows.push(EmbeddingSpaceRowGql {
            identifier: item.id.clone(),
            x: (x - mean_x) / scale,
            y: (y - mean_y) / scale,
            category,
            category_label,
            text: embedding_text(&item),
            created_ms: item.created_at_ms,
            community_id: embedding_community_id(&item),
            epistemic_status: embedding_status(&item),
        });
    }
    Ok(rows)
}

fn is_terminal_status(status: Option<&str>) -> bool {
    match status {
        Some(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "done" | "closed" | "complete" | "completed" | "cancelled" | "canceled"
        ),
        None => false,
    }
}

fn default_state_seed() -> [(&'static str, &'static str); 5] {
    [
        ("Backlog", "backlog"),
        ("Unstarted", "unstarted"),
        ("Started", "started"),
        ("Completed", "completed"),
        ("Cancelled", "cancelled"),
    ]
}

fn identifier_from_name(name: &str) -> String {
    let mut ident: String = name
        .split_whitespace()
        .filter_map(|part| part.chars().find(|ch| ch.is_ascii_alphanumeric()))
        .take(4)
        .collect::<String>()
        .to_ascii_uppercase();
    if ident.is_empty() {
        ident = "CP".to_string();
    }
    ident
}

fn next_sequence_id<S, B>(
    cp: &Commonplace<S, B>,
    project_id: Option<&str>,
) -> std::result::Result<Option<String>, Error>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let Some(project_id) = project_id else {
        return Ok(None);
    };
    let Some(project) = cp.get_collection(project_id).map_err(store_err)? else {
        return Ok(None);
    };
    let Some(identifier) = project.identifier else {
        return Ok(None);
    };
    let count = cp.project_work_items(project_id).map_err(store_err)?.len() + 1;
    Ok(Some(format!("{identifier}-{count}")))
}

fn pm_project_from<S, B>(
    cp: &Commonplace<S, B>,
    collection: Collection,
) -> std::result::Result<PmProjectGql, Error>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let states = cp
        .project_states(&collection.id)
        .map_err(store_err)?
        .into_iter()
        .map(PmStateGql::from)
        .collect();
    let cycles = cp
        .project_cycles(&collection.id)
        .map_err(store_err)?
        .into_iter()
        .map(CollectionGql::from)
        .collect();
    let modules = cp
        .project_modules(&collection.id)
        .map_err(store_err)?
        .into_iter()
        .map(CollectionGql::from)
        .collect();
    let labels = cp
        .project_labels(&collection.id)
        .map_err(store_err)?
        .into_iter()
        .map(|(tag, color)| PmLabelGql {
            id: tag.id,
            name: tag.name,
            color,
        })
        .collect();
    let work_items = cp.project_work_items(&collection.id).map_err(store_err)?;
    let open_item_count = work_items
        .iter()
        .filter(|item| !is_terminal_status(item.status.as_deref()))
        .count();
    Ok(PmProjectGql {
        collection: CollectionGql::from(collection),
        states,
        cycles,
        modules,
        labels,
        work_item_count: work_items.len() as i32,
        open_item_count: open_item_count as i32,
    })
}

fn pm_work_item_from<S, B>(
    cp: &Commonplace<S, B>,
    item: Item,
) -> std::result::Result<PmWorkItemGql, Error>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let state = cp
        .task_state(&item.id)
        .map_err(store_err)?
        .map(PmStateGql::from);
    let collection_ids = classify_work_item_collections(cp, &item)?;
    let about_ids = cp.task_about(&item.id).map_err(store_err)?;
    let comments = cp.comments_for(&item.id).map_err(store_err)?;
    let worklogs = cp.worklogs_for(&item.id).map_err(store_err)?;
    let total_worklog_duration_ms = cp.total_worklog_duration_ms(&item.id).map_err(store_err)?;
    Ok(PmWorkItemGql {
        sequence_id: extra_str(&item, "sequence_id"),
        estimate_point: extra_i32(&item, "estimate_point"),
        item: ItemGql::from(item),
        state,
        project_ids: collection_ids.projects,
        cycle_ids: collection_ids.cycles,
        module_ids: collection_ids.modules,
        about_ids,
        comment_count: comments.len() as i32,
        worklog_count: worklogs.len() as i32,
        total_worklog_duration_ms,
    })
}

struct WorkItemCollectionIds {
    projects: Vec<String>,
    cycles: Vec<String>,
    modules: Vec<String>,
}

fn classify_work_item_collections<S, B>(
    cp: &Commonplace<S, B>,
    item: &Item,
) -> std::result::Result<WorkItemCollectionIds, Error>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let mut projects = Vec::new();
    let mut cycles = Vec::new();
    let mut modules = Vec::new();
    for collection_id in &item.collections {
        let Some(collection) = cp.get_collection(collection_id).map_err(store_err)? else {
            continue;
        };
        match collection.kind {
            CollectionKind::Project => projects.push(collection.id),
            CollectionKind::Cycle => cycles.push(collection.id),
            CollectionKind::Module => modules.push(collection.id),
            _ => {}
        }
    }
    Ok(WorkItemCollectionIds {
        projects,
        cycles,
        modules,
    })
}

fn page_crdt_snapshot_path(page_id: &str) -> String {
    format!(".commonplace/pages/{page_id}/content.yjs")
}

fn latest_page_crdt_snapshot_item<S, B>(
    cp: &Commonplace<S, B>,
    page_id: &str,
) -> rustyred_thg_core::GraphStoreResult<Option<Item>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    if let Some(item) = cp.item_by_source_ref(PAGE_CRDT_SOURCE, page_id)? {
        return Ok(Some(item));
    }

    let mut snapshots: Vec<Item> = cp
        .items_by_kind(&ItemKind::File)?
        .into_iter()
        .filter(|item| {
            extra_str(item, "content_role").as_deref() == Some(PAGE_CRDT_ROLE)
                && extra_str(item, "page_id").as_deref() == Some(page_id)
        })
        .collect();
    snapshots.sort_by_key(|item| std::cmp::Reverse(item.updated_at_ms));
    Ok(snapshots.into_iter().next())
}

fn page_crdt_snapshot_from<S, B>(
    cp: &Commonplace<S, B>,
    page_id: String,
    item: Item,
) -> Result<PageCrdtSnapshotGql>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let (blob_hash, byte_len) = match &item.body {
        ItemBody::Blob {
            content_hash,
            byte_len,
            ..
        } => (content_hash.clone(), *byte_len),
        _ => {
            return Err(Error::new(
                "page CRDT snapshot item does not reference a blob",
            ))
        }
    };
    let bytes = cp
        .read_blob(&item)
        .map_err(store_err)?
        .ok_or_else(|| Error::new(format!("missing page CRDT blob {blob_hash}")))?;
    let encoding = extra_str(&item, "encoding").unwrap_or_else(|| PAGE_CRDT_ENCODING.to_string());
    Ok(PageCrdtSnapshotGql {
        page_id,
        item: ItemGql::from(item.clone()),
        update_base64: BASE64_STANDARD.encode(bytes),
        encoding,
        blob_hash,
        byte_len: byte_len.min(i32::MAX as u64) as i32,
        stored_at_ms: item.updated_at_ms,
    })
}

fn store_page_crdt_snapshot_bytes<S, B>(
    cp: &mut Commonplace<S, B>,
    page_id: &str,
    bytes: &[u8],
    compacted: bool,
) -> Result<PageCrdtSnapshotGql>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let page = cp
        .get_item(page_id)
        .map_err(store_err)?
        .ok_or_else(|| Error::new("page not found"))?;
    if page.kind != ItemKind::Doc {
        return Err(Error::new("page CRDT snapshots only accept doc pages"));
    }

    let content_hash = cp.blobs().put(bytes).map_err(store_err)?;
    let mut snapshot = cp
        .item_by_source_ref(PAGE_CRDT_SOURCE, page_id)
        .map_err(store_err)?
        .unwrap_or_else(|| {
            Item::new(ItemKind::File, format!("CRDT snapshot for {}", page.title))
                .with_source_ref(SourceRef::new(PAGE_CRDT_SOURCE, page_id.to_string()))
        });
    snapshot.title = format!("CRDT snapshot for {}", page.title);
    snapshot.body = ItemBody::Blob {
        content_hash,
        byte_len: bytes.len() as u64,
        mime: Some(PAGE_CRDT_MIME.to_string()),
    };
    snapshot.source = Some(PAGE_CRDT_SOURCE.to_string());
    snapshot.source_ref = Some(SourceRef::new(PAGE_CRDT_SOURCE, page_id.to_string()));
    snapshot.extra.insert("page_id".to_string(), json!(page_id));
    snapshot
        .extra
        .insert("content_role".to_string(), json!(PAGE_CRDT_ROLE));
    snapshot
        .extra
        .insert("encoding".to_string(), json!(PAGE_CRDT_ENCODING));
    snapshot
        .extra
        .insert("path".to_string(), json!(page_crdt_snapshot_path(&page.id)));
    snapshot.extra.insert(
        "folder_path".to_string(),
        json!(format!(".commonplace/pages/{}", page.id)),
    );
    snapshot.extra.insert("hidden".to_string(), json!(true));
    if compacted {
        snapshot.extra.insert("compacted".to_string(), json!(true));
    }

    let snapshot = cp.put_item(snapshot).map_err(store_err)?;
    cp.attach_item(&page.id, &snapshot.id).map_err(store_err)?;
    page_crdt_snapshot_from(cp, page.id, snapshot)
}

fn compact_page_crdt_update_v1(update_v1: &[u8]) -> Result<Vec<u8>> {
    let update = Update::decode_v1(update_v1)
        .map_err(|error| Error::new(format!("invalid Yjs update v1: {error}")))?;
    let doc = Doc::new();
    doc.transact_mut()
        .apply_update(update)
        .map_err(|error| Error::new(format!("could not apply Yjs update: {error}")))?;
    let compacted = doc
        .transact()
        .encode_state_as_update_v1(&StateVector::default());
    Ok(compacted)
}

/// Consumer read API.
pub struct Query<S, B>(PhantomData<fn() -> (S, B)>);

#[Object(name = "Query")]
impl<S, B> Query<S, B>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    /// One item by id.
    async fn item(&self, ctx: &Context<'_>, id: String) -> Result<Option<ItemGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        Ok(cp.get_item(&id).map_err(store_err)?.map(ItemGql::from))
    }

    /// Latest RustyRed-owned Yjs snapshot for a page. The bytes are carried as
    /// base64 for GraphQL transport, but live as a content-addressed File blob.
    async fn page_crdt_snapshot(
        &self,
        ctx: &Context<'_>,
        page_id: String,
    ) -> Result<Option<PageCrdtSnapshotGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let Some(snapshot) = latest_page_crdt_snapshot_item(&cp, &page_id).map_err(store_err)?
        else {
            return Ok(None);
        };
        page_crdt_snapshot_from(&cp, page_id, snapshot).map(Some)
    }

    /// All items, optionally filtered to a kind.
    async fn items(&self, ctx: &Context<'_>, kind: Option<String>) -> Result<Vec<ItemGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let items = match kind {
            Some(kind) => cp.items_by_kind(&ItemKind::from(kind)).map_err(store_err)?,
            None => cp.all_items().map_err(store_err)?,
        };
        Ok(items.into_iter().map(ItemGql::from).collect())
    }

    /// One collection by id.
    async fn collection(&self, ctx: &Context<'_>, id: String) -> Result<Option<CollectionGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        Ok(cp
            .get_collection(&id)
            .map_err(store_err)?
            .map(CollectionGql::from))
    }

    /// All collections.
    async fn collections(&self, ctx: &Context<'_>) -> Result<Vec<CollectionGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let ids: Vec<String> = cp
            .store()
            .query_nodes(NodeQuery::label(COLLECTION_LABEL).with_limit(usize::MAX))
            .into_iter()
            .map(|node| node.id)
            .collect();
        let mut collections = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(collection) = cp.get_collection(&id).map_err(store_err)? {
                collections.push(CollectionGql::from(collection));
            }
        }
        Ok(collections)
    }

    /// Items in a collection.
    async fn collection_items(&self, ctx: &Context<'_>, id: String) -> Result<Vec<ItemGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        Ok(cp
            .collection_items(&id)
            .map_err(store_err)?
            .into_iter()
            .map(ItemGql::from)
            .collect())
    }

    /// Plane-parity PM overview over the CommonPlace graph. Projects are typed
    /// collections; work items are task/epic items; states, labels, comments,
    /// links, worklogs, and stickies remain graph-native nodes/edges.
    async fn pm_overview(
        &self,
        ctx: &Context<'_>,
        project_id: Option<String>,
    ) -> Result<PmOverviewGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;

        let projects = match project_id.as_deref() {
            Some(id) => cp
                .get_collection(id)
                .map_err(store_err)?
                .filter(|collection| collection.kind == CollectionKind::Project)
                .into_iter()
                .collect(),
            None => cp.projects().map_err(store_err)?,
        };
        let project_gql = projects
            .into_iter()
            .map(|project| pm_project_from(&cp, project))
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let work_items = match project_id.as_deref() {
            Some(id) => cp.project_work_items(id).map_err(store_err)?,
            None => {
                let mut items = cp.items_by_kind(&ItemKind::Task).map_err(store_err)?;
                items.extend(cp.items_by_kind(&ItemKind::Epic).map_err(store_err)?);
                items.sort_by_key(|item| std::cmp::Reverse(item.updated_at_ms));
                items
            }
        };
        let work_item_gql = work_items
            .into_iter()
            .map(|item| pm_work_item_from(&cp, item))
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let mut stickies = cp.items_by_kind(&ItemKind::Sticky).map_err(store_err)?;
        if let Some(project_id) = project_id.as_deref() {
            stickies.retain(|sticky| extra_str(sticky, "owner_id").as_deref() == Some(project_id));
        }
        stickies
            .sort_by_key(|sticky| extra_i64(sticky, "sort_order").unwrap_or(sticky.created_at_ms));

        let mut pages = match project_id.as_deref() {
            Some(id) => cp
                .collection_items(id)
                .map_err(store_err)?
                .into_iter()
                .filter(|item| item.kind == ItemKind::Doc)
                .collect(),
            None => cp.items_by_kind(&ItemKind::Doc).map_err(store_err)?,
        };
        pages.sort_by_key(|page| std::cmp::Reverse(page.updated_at_ms));

        Ok(PmOverviewGql {
            projects: project_gql,
            work_items: work_item_gql,
            stickies: stickies.into_iter().map(ItemGql::from).collect(),
            pages: pages.into_iter().map(ItemGql::from).collect(),
        })
    }

    /// Similarity search over items.
    async fn search(
        &self,
        ctx: &Context<'_>,
        query: String,
        k: Option<i32>,
    ) -> Result<Vec<SearchHitGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let k = k.unwrap_or(10).max(1) as usize;
        let hits = IngestPipeline::default()
            .search(&cp, &query, k)
            .map_err(store_err)?;
        let mut results = Vec::with_capacity(hits.len());
        for (id, score) in hits {
            if let Some(item) = cp.get_item(&id).map_err(store_err)? {
                results.push(SearchHitGql {
                    item: ItemGql::from(item),
                    score: score as f64,
                });
            }
        }
        Ok(results)
    }

    /// Project stored item embeddings into the `embedding_space` table contract.
    async fn embedding_space(
        &self,
        ctx: &Context<'_>,
        kind: Option<String>,
        limit: Option<i32>,
    ) -> Result<EmbeddingSpaceGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let limit = limit.unwrap_or(5_000).clamp(1, 50_000) as usize;
        let rows = embedding_space_rows(&cp, kind.as_deref(), limit).map_err(store_err)?;
        Ok(EmbeddingSpaceGql {
            table: "embedding_space".to_string(),
            projection: "server:embedding_axes_v1".to_string(),
            total: rows.len() as i32,
            rows,
        })
    }

    /// Nearest embedded items around a stored item, using the RustyRed vector index.
    async fn vector_neighbors(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        k: Option<i32>,
    ) -> Result<Vec<VectorNeighborGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let Some(seed) = cp.get_item(&item_id).map_err(store_err)? else {
            return Ok(Vec::new());
        };
        let Some(embedding) = item_embedding(&seed) else {
            return Ok(Vec::new());
        };
        let k = k.unwrap_or(12).clamp(1, 100) as usize;
        let hits = IngestPipeline::default()
            .search_embedding(&cp, &embedding, k + 1)
            .map_err(store_err)?;
        let rows = embedding_space_rows(&cp, None, usize::MAX).map_err(store_err)?;
        let by_id: HashMap<String, EmbeddingSpaceRowGql> = rows
            .into_iter()
            .map(|row| (row.identifier.clone(), row))
            .collect();
        let mut out = Vec::with_capacity(k);
        for (id, score) in hits {
            if id == item_id {
                continue;
            }
            if let Some(row) = by_id.get(&id) {
                out.push(VectorNeighborGql {
                    row: row.clone(),
                    score: score as f64,
                });
            }
            if out.len() >= k {
                break;
            }
        }
        Ok(out)
    }

    /// Ask a question over your store: unified graph + vector + lexical retrieval
    /// (reciprocal-rank fusion) with per-item provenance, answered by the
    /// configured model or an honest extractive fallback. Each provenance entry
    /// is the item a part of the answer is grounded in.
    async fn ask(
        &self,
        ctx: &Context<'_>,
        question: String,
        k: Option<i32>,
    ) -> Result<AskResultGql> {
        principal(ctx)?;
        let model = ctx.data::<Arc<dyn AnswerModel>>()?.clone();
        let store = shared::<S, B>(ctx)?;
        let config = AskConfig {
            k: k.unwrap_or(5).max(1) as usize,
            ..AskConfig::default()
        };
        let provenance = {
            let cp = store
                .lock()
                .map_err(|_| Error::new("store lock poisoned"))?;
            retrieve_grounding(&*cp, &question, &config).map_err(store_err)?
        };
        let result = answer_from_provenance(model.as_ref(), &question, provenance);
        Ok(AskResultGql::from(result))
    }

    /// Run the composed Theorem API agent through the CommonPlace GraphQL edge.
    /// The browser sends the user turn here; the resolver calls provider APIs
    /// server-side and the agent runtime reaches MCP tools internally.
    async fn theorem_agent(
        &self,
        ctx: &Context<'_>,
        task: String,
        claims: Option<Vec<TheoremAgentClaimInput>>,
        binding_id: Option<String>,
        mode: Option<String>,
        tenant: Option<String>,
    ) -> Result<TheoremAgentRunGql> {
        principal(ctx)?;
        let task = task.trim().to_string();
        if task.is_empty() {
            return Err(Error::new("Theorem agent requires a task."));
        }
        let _ = mode;
        let _ = tenant;

        let binding_id = binding_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_BINDING_ID.to_string());
        let claims = normalize_theorem_agent_claims(claims.unwrap_or_default());
        let evidence_count = claims.len() as i32;
        let store = shared::<S, B>(ctx)?.clone();

        let result = tokio::task::spawn_blocking(move || -> std::result::Result<_, String> {
            let invoker = ProviderHeadInvoker::from_env().map_err(|error| error.to_string())?;
            let mut cp = store
                .lock()
                .map_err(|_| "store lock poisoned".to_string())?;
            if claims.is_empty() {
                run_configured_composed_agent(cp.store_mut(), &binding_id, &task, &invoker)
            } else {
                run_configured_composed_agent_with_claims(
                    cp.store_mut(),
                    &binding_id,
                    &task,
                    claims,
                    &invoker,
                )
            }
            .map_err(|error| error.to_string())
        })
        .await
        .map_err(|error| Error::new(format!("Theorem agent task join failed: {error}")))?
        .map_err(Error::new)?;

        Ok(TheoremAgentRunGql::from_composed(result, evidence_count))
    }

    /// Proactive briefing: recent, newly-connected, and open-thread items
    /// surfaced from the store without being asked.
    async fn briefing(
        &self,
        ctx: &Context<'_>,
        recent_limit: Option<i32>,
        connected_limit: Option<i32>,
        open_limit: Option<i32>,
    ) -> Result<BriefingGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let config = BriefingConfig {
            recent_limit: recent_limit.unwrap_or(10).max(1) as usize,
            connected_limit: connected_limit.unwrap_or(10).max(1) as usize,
            open_limit: open_limit.unwrap_or(10).max(1) as usize,
            ..BriefingConfig::default()
        };
        let briefing = run_briefing(&*cp, &config).map_err(store_err)?;
        Ok(BriefingGql::from(briefing))
    }

    /// Discovery: propose ranked candidate links between items that are
    /// semantically similar but not yet connected.
    async fn discover(
        &self,
        ctx: &Context<'_>,
        min_similarity: Option<f64>,
        max_results: Option<i32>,
    ) -> Result<Vec<CandidateLinkGql>> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let config = DiscoverConfig {
            min_similarity: min_similarity.unwrap_or(0.5),
            max_results: max_results.unwrap_or(20).max(1) as usize,
            ..DiscoverConfig::default()
        };
        let links = run_discover(&*cp, &config).map_err(store_err)?;
        Ok(links.into_iter().map(CandidateLinkGql::from).collect())
    }

    /// Organize: the daily triage surface. Partitions the items that arrived in
    /// the timeframe into what the engine filed confidently (`organizedToday`)
    /// and what still needs a human (`needsYou`, low-confidence or
    /// time-sensitive), using the engine's classification signal for both, and
    /// reports `dailyProgress` over the intake.
    async fn organize(
        &self,
        ctx: &Context<'_>,
        needs_you_ceiling: Option<f64>,
        timeframe: Option<String>,
    ) -> Result<OrganizeSnapshotGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let config = OrganizeConfig {
            needs_you_ceiling: needs_you_ceiling.unwrap_or(0.58) as f32,
            timeframe: Timeframe::from(timeframe.as_deref().unwrap_or("day")),
            ..OrganizeConfig::default()
        };
        let pipeline = IngestPipeline::default();
        let snapshot = run_organize(&*cp, &pipeline, &config).map_err(store_err)?;
        Ok(OrganizeSnapshotGql::from(snapshot))
    }

    /// Export the whole store: lossless JSON (default) or human-readable
    /// markdown. The JSON output reimports via `importItems` without loss.
    async fn export(&self, ctx: &Context<'_>, format: Option<ExportFormat>) -> Result<String> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let output = match format.unwrap_or(ExportFormat::Json) {
            ExportFormat::Json => portability::export_json(&*cp).map_err(store_err)?,
            ExportFormat::Markdown => portability::export_markdown(&*cp).map_err(store_err)?,
        };
        Ok(output)
    }
}

/// Consumer write API.
pub struct Mutation<S, B>(PhantomData<fn() -> (S, B)>);

#[Object(name = "Mutation")]
impl<S, B> Mutation<S, B>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    /// Auto-structuring ingest: embed, classify, file, link, resolve entities.
    async fn ingest(&self, ctx: &Context<'_>, input: IngestInputGql) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let kind = input.kind.map(ItemKind::from).unwrap_or(ItemKind::Note);
        let mut request = IngestInput::text(input.title, input.text, kind);
        if let Some(tags) = input.tags {
            request = request.with_tags(tags);
        }
        if let Some(source) = input.source {
            request = request.with_source(source);
        }
        if let Some(residency) = input.residency {
            request = request.with_residency(Residency::from(residency));
        }
        let receipt = IngestPipeline::default()
            .ingest(&mut cp, request)
            .map_err(store_err)?;
        Ok(ItemGql::from(receipt.item))
    }

    /// Create a plain note item (no auto-structuring).
    async fn put_note(
        &self,
        ctx: &Context<'_>,
        title: String,
        text: String,
        tags: Option<Vec<String>>,
    ) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let mut item = Item::note(title, text);
        if let Some(tags) = tags {
            item = item.with_tags(tags);
        }
        Ok(ItemGql::from(cp.put_item(item).map_err(store_err)?))
    }

    /// Edit an existing item's title, tags, or residency (in place by id).
    async fn edit_item(
        &self,
        ctx: &Context<'_>,
        id: String,
        title: Option<String>,
        tags: Option<Vec<String>>,
        residency: Option<String>,
    ) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let mut item = cp
            .get_item(&id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("item not found"))?;
        if let Some(title) = title {
            item.title = title;
        }
        if let Some(tags) = tags {
            item.tags = tags;
        }
        if let Some(residency) = residency {
            item.residency = Residency::from(residency);
        }
        Ok(ItemGql::from(cp.put_item(item).map_err(store_err)?))
    }

    /// Create a manual collection.
    async fn create_collection(&self, ctx: &Context<'_>, name: String) -> Result<CollectionGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        Ok(CollectionGql::from(
            cp.create_collection(name, commonplace::CollectionKind::Manual)
                .map_err(store_err)?,
        ))
    }

    /// Create a first-class PM project collection, optionally with the default
    /// Plane-style workflow states.
    async fn create_pm_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInputGql,
    ) -> Result<PmProjectGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let identifier = if input.identifier.trim().is_empty() {
            identifier_from_name(&input.name)
        } else {
            input.identifier.trim().to_ascii_uppercase()
        };
        let mut project = cp
            .create_project(input.name.trim(), identifier)
            .map_err(store_err)?;
        if let Some(description) = input.description {
            project.description = Some(description);
        }
        if let Some(color) = input.color {
            project.color = Some(color);
        }
        project = cp.put_collection(project).map_err(store_err)?;
        if input.default_states.unwrap_or(true) {
            for (index, (name, group)) in default_state_seed().into_iter().enumerate() {
                cp.create_state(&project.id, name, group, index as i64)
                    .map_err(store_err)?;
            }
        }
        pm_project_from(&cp, project)
    }

    /// Create a workflow state under a PM project.
    async fn create_pm_state(
        &self,
        ctx: &Context<'_>,
        input: CreateStateInputGql,
    ) -> Result<PmStateGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let sort_order = input.sort_order.unwrap_or(0) as i64;
        let state = cp
            .create_state(&input.project_id, input.name, input.group, sort_order)
            .map_err(store_err)?;
        Ok(PmStateGql::from(state))
    }

    /// Create a task or epic work item, with optional project/state assignment.
    async fn create_work_item(
        &self,
        ctx: &Context<'_>,
        input: CreateWorkItemInputGql,
    ) -> Result<PmWorkItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let kind = match input.kind.as_deref() {
            Some("epic") => ItemKind::Epic,
            _ => ItemKind::Task,
        };
        let mut item =
            Item::new(kind, input.title).with_text(input.description.unwrap_or_default());
        if let Some(priority) = input.priority {
            item = item.with_priority(priority);
        }
        if let Some(due_at_ms) = input.due_at_ms {
            item = item.with_due_at(due_at_ms);
        }
        if let Some(estimate_point) = input.estimate_point {
            item = item.with_extra("estimate_point", json!(estimate_point));
        }
        let sequence_id = match input.sequence_id {
            Some(value) if !value.trim().is_empty() => Some(value),
            _ => next_sequence_id(&cp, input.project_id.as_deref())?,
        };
        if let Some(sequence_id) = sequence_id {
            item = item.with_extra("sequence_id", json!(sequence_id));
        }
        let mut item = cp.put_item(item).map_err(store_err)?;
        if let Some(project_id) = input.project_id {
            cp.add_to_project(&item.id, &project_id)
                .map_err(store_err)?;
        }
        if let Some(state_id) = input.state_id {
            cp.set_task_state(&item.id, &state_id).map_err(store_err)?;
            item = cp
                .get_item(&item.id)
                .map_err(store_err)?
                .ok_or_else(|| Error::new("work item disappeared after state update"))?;
        }
        pm_work_item_from(&cp, item)
    }

    /// Assign an existing work item to a project.
    async fn add_work_item_to_project(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        project_id: String,
    ) -> Result<PmWorkItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        cp.add_to_project(&item_id, &project_id)
            .map_err(store_err)?;
        let item = cp
            .get_item(&item_id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("work item not found"))?;
        pm_work_item_from(&cp, item)
    }

    /// Assign an existing work item to a cycle.
    async fn add_work_item_to_cycle(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        cycle_id: String,
    ) -> Result<PmWorkItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        cp.add_to_cycle(&item_id, &cycle_id).map_err(store_err)?;
        let item = cp
            .get_item(&item_id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("work item not found"))?;
        pm_work_item_from(&cp, item)
    }

    /// Assign an existing work item to a module.
    async fn add_work_item_to_module(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        module_id: String,
    ) -> Result<PmWorkItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        cp.add_to_module(&item_id, &module_id).map_err(store_err)?;
        let item = cp
            .get_item(&item_id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("work item not found"))?;
        pm_work_item_from(&cp, item)
    }

    /// Assign the current workflow state for a work item.
    async fn set_work_item_state(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        state_id: String,
    ) -> Result<PmWorkItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        cp.set_task_state(&item_id, &state_id).map_err(store_err)?;
        let item = cp
            .get_item(&item_id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("work item not found"))?;
        pm_work_item_from(&cp, item)
    }

    /// Create a project-scoped colored label, reusing CommonPlace tags.
    async fn scope_project_label(
        &self,
        ctx: &Context<'_>,
        project_id: String,
        name: String,
        color: Option<String>,
    ) -> Result<PmLabelGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let tag = cp
            .scope_label_to_project(&project_id, &name, color.clone())
            .map_err(store_err)?;
        Ok(PmLabelGql {
            id: tag.id,
            name: tag.name,
            color,
        })
    }

    /// Create a dated cycle under a project.
    async fn create_pm_cycle(
        &self,
        ctx: &Context<'_>,
        input: CreateCycleInputGql,
    ) -> Result<CollectionGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let cycle = cp
            .create_cycle(
                &input.project_id,
                input.name,
                input.start_at_ms,
                input.end_at_ms,
            )
            .map_err(store_err)?;
        Ok(CollectionGql::from(cycle))
    }

    /// Create a module under a project.
    async fn create_pm_module(
        &self,
        ctx: &Context<'_>,
        input: CreateModuleInputGql,
    ) -> Result<CollectionGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let module = cp
            .create_module(&input.project_id, input.name)
            .map_err(store_err)?;
        Ok(CollectionGql::from(module))
    }

    /// Add a comment to an item.
    async fn create_work_item_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInputGql,
    ) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let comment = cp
            .create_comment(&input.item_id, input.author_id, input.body)
            .map_err(store_err)?;
        Ok(ItemGql::from(comment))
    }

    /// Log time against a task.
    async fn log_work(&self, ctx: &Context<'_>, input: LogWorkInputGql) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let worklog = cp
            .log_work(
                &input.task_id,
                input.duration_ms,
                input.logged_by,
                input.description,
            )
            .map_err(store_err)?;
        Ok(ItemGql::from(worklog))
    }

    /// Create a sticky note.
    async fn create_sticky(
        &self,
        ctx: &Context<'_>,
        input: CreateStickyInputGql,
    ) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let sticky = cp
            .create_sticky(
                input.owner_id,
                input.title,
                input.description.unwrap_or_default(),
                input.color,
                input.background_color,
                input.sort_order,
            )
            .map_err(store_err)?;
        Ok(ItemGql::from(sticky))
    }

    /// Create a graph-native project page. Pages are `Doc` items, optionally
    /// scoped to a project collection and ABOUT-linked from a work item.
    async fn create_page(&self, ctx: &Context<'_>, input: CreatePageInputGql) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let title = input.title.trim().to_string();
        if title.is_empty() {
            return Err(Error::new("page title is required"));
        }
        let mut page = Item::new(ItemKind::Doc, title).with_text(input.body.unwrap_or_default());
        if let Some(tags) = input.tags {
            page = page.with_tags(tags);
        }
        let page = cp.put_item(page).map_err(store_err)?;
        if let Some(project_id) = input.project_id {
            cp.add_to_project(&page.id, &project_id)
                .map_err(store_err)?;
        }
        if let Some(about_item_id) = input.about_item_id {
            cp.link_about(&about_item_id, &page.id).map_err(store_err)?;
        }
        cp.get_item(&page.id)
            .map_err(store_err)?
            .map(ItemGql::from)
            .ok_or_else(|| Error::new("page disappeared after create"))
    }

    /// Save a project page's editable fields in place.
    async fn save_page(&self, ctx: &Context<'_>, input: SavePageInputGql) -> Result<ItemGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let mut item = cp
            .get_item(&input.id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("page not found"))?;
        if item.kind != ItemKind::Doc {
            return Err(Error::new("savePage only accepts doc items"));
        }
        if let Some(title) = input.title {
            let title = title.trim().to_string();
            if title.is_empty() {
                return Err(Error::new("page title is required"));
            }
            item.title = title;
        }
        if let Some(body) = input.body {
            item = item.with_text(body);
        }
        if let Some(tags) = input.tags {
            item.tags = tags;
        }
        Ok(ItemGql::from(cp.put_item(item).map_err(store_err)?))
    }

    /// Persist a full Yjs page snapshot as RustyRed-owned data. The snapshot is
    /// a File item whose body points at the content-addressed blob store and is
    /// attached back to the page, so Hocuspocus is transport, not storage.
    async fn store_page_crdt_snapshot(
        &self,
        ctx: &Context<'_>,
        input: StorePageCrdtSnapshotInputGql,
    ) -> Result<PageCrdtSnapshotGql> {
        principal(ctx)?;
        let bytes = BASE64_STANDARD
            .decode(input.update_base64.trim())
            .map_err(|error| Error::new(format!("invalid base64 Yjs update: {error}")))?;
        let encoding = input
            .encoding
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(PAGE_CRDT_ENCODING)
            .to_string();
        if encoding != PAGE_CRDT_ENCODING {
            return Err(Error::new(format!(
                "unsupported page CRDT encoding: {encoding}"
            )));
        }

        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        store_page_crdt_snapshot_bytes(&mut cp, &input.page_id, &bytes, false)
    }

    /// Compact the latest page CRDT snapshot with Rust `yrs`, then write the
    /// canonical full-state update back through the same RustyRed File blob.
    async fn compact_page_crdt_snapshot(
        &self,
        ctx: &Context<'_>,
        page_id: String,
    ) -> Result<PageCrdtSnapshotGql> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let snapshot = latest_page_crdt_snapshot_item(&cp, &page_id)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("page CRDT snapshot not found"))?;
        let bytes = cp
            .read_blob(&snapshot)
            .map_err(store_err)?
            .ok_or_else(|| Error::new("page CRDT snapshot blob not found"))?;
        let compacted = compact_page_crdt_update_v1(&bytes)?;
        store_page_crdt_snapshot_bytes(&mut cp, &page_id, &compacted, true)
    }

    /// Add an item to a collection.
    async fn add_to_collection(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        collection_id: String,
    ) -> Result<bool> {
        principal(ctx)?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        cp.add_to_collection(&item_id, &collection_id)
            .map_err(store_err)?;
        Ok(true)
    }

    /// Import a JSON export document (from `export`), recreating items and
    /// collections with their original ids so memberships survive.
    async fn import_items(&self, ctx: &Context<'_>, data: String) -> Result<ImportResultGql> {
        principal(ctx)?;
        let document: ExportDocument = serde_json::from_str(&data)
            .map_err(|error| Error::new(format!("invalid export JSON: {error}")))?;
        let store = shared::<S, B>(ctx)?;
        let mut cp = store
            .lock()
            .map_err(|_| Error::new("store lock poisoned"))?;
        let summary = portability::import(&mut cp, &document).map_err(store_err)?;
        Ok(ImportResultGql {
            imported: summary.items as i32,
            collections: summary.collections as i32,
        })
    }
}

/// Build the consumer schema over an instance store and its key registry, with
/// no generative answer model (ask uses the extractive fallback).
pub fn build_schema<S, B>(
    store: SharedStore<S, B>,
    registry: Arc<ApiKeyRegistry>,
) -> Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    build_schema_with_model(store, registry, Arc::new(NoModel))
}

/// Build the schema with a specific answer model (for example local Gemma via
/// an OpenAI-compatible endpoint) for generative answers behind the same
/// retrieval.
pub fn build_schema_with_model<S, B>(
    store: SharedStore<S, B>,
    registry: Arc<ApiKeyRegistry>,
    model: Arc<dyn AnswerModel>,
) -> Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    Schema::build(Query(PhantomData), Mutation(PhantomData), EmptySubscription)
        .data(store)
        .data(registry)
        .data(model)
        .finish()
}
