use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

pub const CONSOLE_CORE_CONTRACT_VERSION: &str = "commonplace-console-core/v1";

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct GoldenId(pub String);

impl GoldenId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

impl fmt::Display for GoldenId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct NodeId(pub String);

impl NodeId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReadinessState {
    Ready,
    Building,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct CapabilityReadiness {
    pub capability: String,
    pub state: ReadinessState,
    pub detail: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct StoreOverview {
    pub counts_by_type: Vec<(String, u64)>,
    pub generation: u64,
    pub readiness: Vec<CapabilityReadiness>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GoldenRecord {
    pub id: GoldenId,
    pub entity_type: String,
    pub title: String,
    pub fields: BTreeMap<String, Value>,
    pub updated_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct MergeReceipt {
    pub id: String,
    pub golden_id: GoldenId,
    pub merged_ids: Vec<String>,
    pub confidence_ppm: u32,
    pub decided_at_ms: i64,
    pub basis: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct DoppelgangerCandidate {
    pub candidate_id: GoldenId,
    pub confidence_ppm: u32,
    pub shared_signals: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EntityDetail {
    pub record: GoldenRecord,
    pub merges: Vec<MergeReceipt>,
    pub receipts: Vec<Receipt>,
    pub candidates: Vec<DoppelgangerCandidate>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReceiptKind {
    Ingest,
    Merge,
    QueryFiring,
    Consent,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Receipt {
    pub id: String,
    pub kind: ReceiptKind,
    pub subject_id: String,
    pub actor: String,
    pub occurred_at_ms: i64,
    pub summary: String,
    pub evidence: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct ReceiptFilter {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<ReceiptKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Page {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    pub limit: u16,
}

impl Default for Page {
    fn default() -> Self {
        Self {
            cursor: None,
            limit: 50,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ReceiptPage {
    pub receipts: Vec<Receipt>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub total: u64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: NodeId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub golden_id: Option<GoldenId>,
    pub node_type: String,
    pub label: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub source: NodeId,
    pub target: NodeId,
    pub edge_type: String,
    pub weight: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GraphSlice {
    pub root: NodeId,
    pub depth: u8,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct StandingQueryDefinition {
    pub id: String,
    pub name: String,
    pub shape: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct StandingFiring {
    pub query_id: String,
    pub sequence: u64,
    pub occurred_at_ms: i64,
    pub matched_ids: Vec<String>,
    pub receipt_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct WatchRequest {
    pub query_id: String,
    #[serde(default)]
    pub from_sequence: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginState {
    Available,
    PendingConsent,
    Installed,
    Denied,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PluginInfo {
    pub app_id: String,
    pub version: String,
    pub state: PluginState,
    pub grants: Vec<String>,
    pub contributions: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ConsoleSnapshot {
    pub contract_version: String,
    pub overview: StoreOverview,
    pub entities: Vec<EntityDetail>,
    pub receipts: Vec<Receipt>,
    pub graph: GraphSlice,
    pub standing_queries: Vec<StandingQueryDefinition>,
    pub firings: Vec<StandingFiring>,
    pub plugin: PluginInfo,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct DoorCapabilities {
    pub authenticated: bool,
    pub read_only: bool,
    pub transport: String,
    pub grants: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct DoorReceipt {
    pub request_id: String,
    pub operation: String,
    pub authenticated: bool,
    pub read_only: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DoorRequest {
    Overview,
    Entity { id: GoldenId },
    Receipts { filter: ReceiptFilter, page: Page },
    Neighborhood { root: NodeId, depth: u8 },
    Snapshot,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum DoorResponse {
    Overview(StoreOverview),
    Entity(EntityDetail),
    Receipts(ReceiptPage),
    Neighborhood(GraphSlice),
    Snapshot(ConsoleSnapshot),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoorErrorCode {
    Unauthenticated,
    Forbidden,
    NotFound,
    InvalidRequest,
    Unavailable,
    Protocol,
}

#[derive(Clone, Debug, Error, Eq, PartialEq, Serialize, Deserialize)]
#[error("{code:?}: {message}")]
pub struct DoorError {
    pub code: DoorErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl DoorError {
    pub fn new(code: DoorErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
        }
    }

    pub fn protocol(expected: &str) -> Self {
        Self::new(
            DoorErrorCode::Protocol,
            format!("door returned a response other than {expected}"),
            false,
        )
    }
}
