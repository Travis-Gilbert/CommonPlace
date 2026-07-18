//! Stable block/view contract over the CommonPlace object model.
//!
//! Blocks depend on this seam instead of depending on RustyRed, the harness, the
//! router, or theme internals. The host owns query compilation, action execution,
//! view matching, provenance, and live binding strategy.

use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};

use rustyred_thg_core::{EdgeRecord, GraphStore, GraphStoreError, GraphStoreResult, NeighborQuery};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::blob::BlobStore;
use crate::item::{Item, ItemBody, ItemKind};
use crate::renderable::{item_object_type_slug, renderable_from_item};
use crate::store::Commonplace;

pub const BLOCK_VIEW_CONTRACT_VERSION: &str = "block-view-contract/v1";
pub const DEFAULT_RECORD_POLL_INTERVAL_MS: u64 = 2_500;

pub type TypeRef = String;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PropType {
    String,
    Text,
    Number,
    Integer,
    Boolean,
    Json,
    Id,
    TimestampMs,
    Vector,
    StringList,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Constraint {
    Required,
    Enum { values: Vec<String> },
    Min { value: f64 },
    Max { value: f64 },
    Pattern { regex: String },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PropertyDef {
    pub name: String,
    #[serde(rename = "type")]
    pub prop_type: PropType,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub constraints: Vec<Constraint>,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeDirection {
    In,
    Out,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RelationDef {
    pub edge: String,
    pub dir: EdgeDirection,
    pub target: TypeRef,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct TypeAxes {
    #[serde(default)]
    pub spatial: bool,
    #[serde(default)]
    pub temporal: bool,
    #[serde(default)]
    pub embeddable: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TypeDef {
    pub name: TypeRef,
    #[serde(default)]
    pub properties: Vec<PropertyDef>,
    #[serde(default)]
    pub relations: Vec<RelationDef>,
    #[serde(default)]
    pub axes: TypeAxes,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_ms: Option<i64>,
}

impl TimeRange {
    pub fn instant(ms: i64) -> Self {
        Self {
            from_ms: Some(ms),
            to_ms: Some(ms),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct H3Window {
    pub cells: Vec<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectAxes {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub h3: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid: Option<TimeRange>,
    #[serde(default)]
    pub embeddable: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ObjectRef {
    pub id: String,
    #[serde(rename = "type")]
    pub type_ref: TypeRef,
    #[serde(default)]
    pub properties: Map<String, Value>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub relations: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub axes: ObjectAxes,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectCardinality {
    Empty,
    One,
    Many,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShapeRelation {
    pub edge: String,
    pub dir: EdgeDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<TypeRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectShape {
    #[serde(default)]
    pub types: Vec<TypeRef>,
    #[serde(default)]
    pub fields: Vec<String>,
    #[serde(default)]
    pub relations: Vec<ShapeRelation>,
    #[serde(default)]
    pub axes: TypeAxes,
    pub cardinality: ObjectCardinality,
}

impl ObjectShape {
    pub fn from_objects(objects: &[ObjectRef]) -> Self {
        let mut types = BTreeSet::new();
        let mut fields = BTreeSet::new();
        let mut relations =
            BTreeMap::<(String, EdgeDirection, Option<String>), ShapeRelation>::new();
        let mut axes = TypeAxes::default();

        for object in objects {
            types.insert(normalize_type_ref(&object.type_ref));
            for field in object.properties.keys() {
                fields.insert(field.clone());
            }
            for edge in object.relations.keys() {
                let relation = ShapeRelation {
                    edge: edge.clone(),
                    dir: EdgeDirection::Out,
                    target: None,
                };
                relations.insert((edge.clone(), EdgeDirection::Out, None), relation);
            }
            axes.spatial |= object.axes.h3.is_some();
            axes.temporal |= object.axes.valid.is_some();
            axes.embeddable |= object.axes.embeddable;
        }

        Self {
            types: types.into_iter().collect(),
            fields: fields.into_iter().collect(),
            relations: relations.into_values().collect(),
            axes,
            cardinality: match objects.len() {
                0 => ObjectCardinality::Empty,
                1 => ObjectCardinality::One,
                _ => ObjectCardinality::Many,
            },
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Predicate {
    Eq {
        field: String,
        value: Value,
    },
    NotEq {
        field: String,
        value: Value,
    },
    Contains {
        field: String,
        value: Value,
    },
    Exists {
        field: String,
    },
    RelationExists {
        edge: String,
        dir: EdgeDirection,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
    },
    And {
        all: Vec<Predicate>,
    },
    Or {
        any: Vec<Predicate>,
    },
    Not {
        predicate: Box<Predicate>,
    },
}

impl Predicate {
    pub fn not_eq(field: impl Into<String>, value: Value) -> Self {
        Self::NotEq {
            field: field.into(),
            value,
        }
    }

    pub fn relation_exists(edge: impl Into<String>, dir: EdgeDirection) -> Self {
        Self::RelationExists {
            edge: edge.into(),
            dir,
            target: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct EdgeWalk {
    pub edge: String,
    pub dir: EdgeDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<TypeRef>,
}

impl EdgeWalk {
    pub fn out(edge: impl Into<String>) -> Self {
        Self {
            edge: edge.into(),
            dir: EdgeDirection::Out,
            target: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RankDirection {
    Asc,
    Desc,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Ranker {
    Field {
        field: String,
        direction: RankDirection,
    },
    VectorKnn {
        field: String,
        vector: Vec<f32>,
        k: usize,
    },
    Fulltext {
        query: String,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        fields: Vec<String>,
    },
    Graph {
        seeds: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        edge: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        direction: Option<EdgeDirection>,
    },
}

impl Ranker {
    pub fn field(field: impl Into<String>, direction: RankDirection) -> Self {
        Self::Field {
            field: field.into(),
            direction,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ObjectFusionPolicy {
    Rrf { k: u32 },
    Weighted { weights: BTreeMap<String, f32> },
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectQuerySlice {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid: Option<TimeRange>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tx: Option<TimeRange>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub space: Option<H3Window>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectedRelation {
    pub edge: String,
    pub dir: EdgeDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<TypeRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Projection {
    #[serde(default)]
    pub fields: Vec<String>,
    #[serde(default)]
    pub relations: Vec<ProjectedRelation>,
    #[serde(default = "default_true")]
    pub include_body_preview: bool,
    #[serde(default = "default_true")]
    pub include_metadata: bool,
}

impl Default for Projection {
    fn default() -> Self {
        Self {
            fields: Vec::new(),
            relations: Vec::new(),
            include_body_preview: true,
            include_metadata: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PageRequest {
    pub limit: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ObjectQuery {
    pub types: Vec<TypeRef>,
    #[serde(default, rename = "where", skip_serializing_if = "Option::is_none")]
    pub where_clause: Option<Predicate>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub traverse: Vec<EdgeWalk>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rank: Vec<Ranker>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fuse: Option<ObjectFusionPolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slice: Option<ObjectQuerySlice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<Projection>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<PageRequest>,
    #[serde(default = "default_true")]
    pub live: bool,
}

impl ObjectQuery {
    pub fn new(types: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            types: types.into_iter().map(Into::into).collect(),
            where_clause: None,
            traverse: Vec::new(),
            rank: Vec::new(),
            fuse: None,
            slice: None,
            project: None,
            page: None,
            live: true,
        }
    }

    pub fn with_where(mut self, predicate: Predicate) -> Self {
        self.where_clause = Some(predicate);
        self
    }

    pub fn with_traverse(mut self, walk: EdgeWalk) -> Self {
        self.traverse.push(walk);
        self
    }

    pub fn with_rank(mut self, ranker: Ranker) -> Self {
        self.rank.push(ranker);
        self
    }

    pub fn with_page(mut self, limit: usize, cursor: Option<String>) -> Self {
        self.page = Some(PageRequest { limit, cursor });
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LiveBinding {
    ChangeFeed { stream: String },
    Poll { interval_ms: u64 },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ObjectSet {
    pub objects: Vec<ObjectRef>,
    pub shape: ObjectShape,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub live: Option<LiveBinding>,
    /// Out-of-band note channel: how the set was ranked, and any degraded path
    /// (e.g. a hybrid ranker that fell back to the in-memory scorer because the
    /// relational planner was unavailable). `None` when nothing needs saying.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentTier {
    Simple,
    Difficult,
    Max,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectPointer {
    pub id: String,
    #[serde(default, rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_ref: Option<TypeRef>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ObjectActionTarget {
    Object(ObjectPointer),
    Query(ObjectQuery),
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct JobSpec {
    pub name: String,
    #[serde(default)]
    pub args: Map<String, Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idempotency_key: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ObjectAction {
    Create {
        #[serde(rename = "type")]
        type_ref: TypeRef,
        props: Map<String, Value>,
    },
    Update {
        id: String,
        patch: Map<String, Value>,
    },
    Delete {
        id: String,
    },
    Link {
        from: String,
        edge: String,
        to: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        confidence: Option<f64>,
    },
    Unlink {
        from: String,
        edge: String,
        to: String,
    },
    RunAgent {
        target: ObjectActionTarget,
        tier: AgentTier,
    },
    InvokeTool {
        tool: String,
        #[serde(default)]
        args: Map<String, Value>,
    },
    Dispatch {
        job: JobSpec,
    },
    Open {
        id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        view: Option<String>,
    },
    Select {
        ids: Vec<String>,
    },
    /// Re-home an object under a new parent at a fractional `order`. Reordering
    /// within the same parent is a single ordered-CONTAINS edge patch; moving
    /// across parents detaches the old CONTAINS edge and attaches a new one.
    Move {
        id: String,
        new_parent: String,
        order: f64,
    },
    /// Undo a tombstone written by `Delete` or `Unlink`: clears the
    /// `{"detached": true}` marker on `node_id` (if any) and on every id in
    /// `edge_ids`, making the object and/or edge visible again. This is the
    /// inverse descriptor carried on the `Delete`/`Unlink` receipt's
    /// `inverse` field, so client undo replays it through the same `emit`
    /// entry point that applied the forward action.
    Restore {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        node_id: Option<String>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        edge_ids: Vec<String>,
    },
}

impl ObjectAction {
    pub fn action_kind(&self) -> ActionKind {
        match self {
            Self::Create { .. } => ActionKind::Create,
            Self::Update { .. } => ActionKind::Update,
            Self::Delete { .. } => ActionKind::Delete,
            Self::Link { .. } => ActionKind::Link,
            Self::Unlink { .. } => ActionKind::Unlink,
            Self::RunAgent { .. } => ActionKind::RunAgent,
            Self::InvokeTool { .. } => ActionKind::InvokeTool,
            Self::Dispatch { .. } => ActionKind::Dispatch,
            Self::Open { .. } => ActionKind::Open,
            Self::Select { .. } => ActionKind::Select,
            Self::Move { .. } => ActionKind::Move,
            Self::Restore { .. } => ActionKind::Restore,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    Create,
    Update,
    Delete,
    Link,
    Unlink,
    RunAgent,
    InvokeTool,
    Dispatch,
    Open,
    Select,
    Move,
    Restore,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectActionStatus {
    Accepted,
    Applied,
    Deferred,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ObjectActionReceipt {
    pub action_kind: ActionKind,
    pub status: ObjectActionStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub target_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub graph_transform: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// The inverse operation, when the action is reversible. Applying this
    /// through `emit` restores the exact prior state (e.g. `Delete` and
    /// `Unlink` carry a `Restore` that clears the tombstone markers they
    /// wrote). `None` for actions with nothing to undo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inverse: Option<ObjectAction>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ThemeTokens {
    #[serde(default)]
    pub color: Map<String, Value>,
    #[serde(default)]
    pub space: Map<String, Value>,
    #[serde(default)]
    pub typography: Map<String, Value>,
    #[serde(default)]
    pub radius: Map<String, Value>,
    #[serde(default)]
    pub raw: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardinalityRequirement {
    Any,
    One,
    Many,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShapeRelationMatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dir: Option<EdgeDirection>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<TypeRef>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObjectShapeMatch {
    #[serde(default)]
    pub required_types: Vec<TypeRef>,
    #[serde(default)]
    pub required_fields: Vec<String>,
    #[serde(default)]
    pub required_axes: TypeAxes,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cardinality: Option<CardinalityRequirement>,
    #[serde(default)]
    pub requires_relation: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_edge: Option<ShapeRelationMatch>,
}

impl ObjectShapeMatch {
    pub fn matches(&self, shape: &ObjectShape) -> bool {
        shape_matches(self, shape)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewDescriptor {
    pub id: String,
    pub name: String,
    pub accepts: ObjectShapeMatch,
    #[serde(default)]
    pub emits: Vec<ActionKind>,
    pub renderer: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ViewRegistry {
    descriptors: Vec<ViewDescriptor>,
}

impl ViewRegistry {
    pub fn new(descriptors: impl IntoIterator<Item = ViewDescriptor>) -> Self {
        Self {
            descriptors: descriptors.into_iter().collect(),
        }
    }

    pub fn default_commonplace() -> Self {
        Self::new([
            ViewDescriptor {
                id: "table".to_string(),
                name: "Table".to_string(),
                accepts: ObjectShapeMatch {
                    required_fields: vec!["title".to_string()],
                    cardinality: Some(CardinalityRequirement::Many),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Open, ActionKind::Select],
                renderer: "table".to_string(),
            },
            ViewDescriptor {
                id: "board".to_string(),
                name: "Board".to_string(),
                accepts: ObjectShapeMatch {
                    required_fields: vec!["status".to_string()],
                    required_axes: TypeAxes {
                        temporal: true,
                        ..TypeAxes::default()
                    },
                    cardinality: Some(CardinalityRequirement::Many),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Update, ActionKind::Open, ActionKind::Select],
                renderer: "board".to_string(),
            },
            ViewDescriptor {
                id: "card".to_string(),
                name: "Card".to_string(),
                accepts: ObjectShapeMatch {
                    required_fields: vec!["title".to_string()],
                    cardinality: Some(CardinalityRequirement::Any),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Open, ActionKind::Select],
                renderer: "card".to_string(),
            },
            ViewDescriptor {
                id: "timeline".to_string(),
                name: "Timeline".to_string(),
                accepts: ObjectShapeMatch {
                    required_axes: TypeAxes {
                        temporal: true,
                        ..TypeAxes::default()
                    },
                    cardinality: Some(CardinalityRequirement::Many),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Open, ActionKind::Select],
                renderer: "timeline".to_string(),
            },
            ViewDescriptor {
                id: "graph".to_string(),
                name: "Graph".to_string(),
                accepts: ObjectShapeMatch {
                    requires_relation: true,
                    cardinality: Some(CardinalityRequirement::Many),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Link, ActionKind::Unlink, ActionKind::Open],
                renderer: "graph".to_string(),
            },
            ViewDescriptor {
                id: "patch-review".to_string(),
                name: "PatchReviewPanel".to_string(),
                accepts: ObjectShapeMatch {
                    required_types: vec!["patch".to_string()],
                    cardinality: Some(CardinalityRequirement::One),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Dispatch, ActionKind::RunAgent, ActionKind::Open],
                renderer: "patch-review".to_string(),
            },
            ViewDescriptor {
                id: "file-tree".to_string(),
                name: "FileTreePanel".to_string(),
                accepts: ObjectShapeMatch {
                    required_types: vec!["file".to_string()],
                    required_edge: Some(ShapeRelationMatch {
                        edge: Some("CONTAINS".to_string()),
                        dir: Some(EdgeDirection::Out),
                        target: None,
                    }),
                    ..ObjectShapeMatch::default()
                },
                emits: vec![ActionKind::Open, ActionKind::Select],
                renderer: "file-tree".to_string(),
            },
        ])
    }

    pub fn register(&mut self, descriptor: ViewDescriptor) {
        self.descriptors.retain(|entry| entry.id != descriptor.id);
        self.descriptors.push(descriptor);
    }

    pub fn views_for(&self, shape: &ObjectShape) -> Vec<ViewDescriptor> {
        self.descriptors
            .iter()
            .filter(|descriptor| descriptor.accepts.matches(shape))
            .cloned()
            .collect()
    }

    pub fn descriptors(&self) -> &[ViewDescriptor] {
        &self.descriptors
    }
}

pub trait BlockHost {
    fn query(&self, query: ObjectQuery) -> GraphStoreResult<ObjectSet>;
    fn emit(&mut self, action: ObjectAction) -> GraphStoreResult<ObjectActionReceipt>;
    fn views_for(&self, shape: &ObjectShape) -> Vec<ViewDescriptor>;
    fn tokens(&self) -> &ThemeTokens;
}

pub struct CommonplaceBlockHost<'a, S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    commonplace: &'a mut Commonplace<S, B>,
    registry: ViewRegistry,
    tokens: ThemeTokens,
    actor_id: Option<String>,
}

impl<'a, S, B> CommonplaceBlockHost<'a, S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    pub fn new(commonplace: &'a mut Commonplace<S, B>) -> Self {
        Self {
            commonplace,
            registry: ViewRegistry::default_commonplace(),
            tokens: ThemeTokens::default(),
            actor_id: None,
        }
    }

    pub fn with_actor(mut self, actor_id: impl Into<String>) -> Self {
        self.actor_id = Some(actor_id.into());
        self
    }

    pub fn with_tokens(mut self, tokens: ThemeTokens) -> Self {
        self.tokens = tokens;
        self
    }

    pub fn registry_mut(&mut self) -> &mut ViewRegistry {
        &mut self.registry
    }
}

impl<S, B> BlockHost for CommonplaceBlockHost<'_, S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    fn query(&self, query: ObjectQuery) -> GraphStoreResult<ObjectSet> {
        self.commonplace.query_object_set(query)
    }

    fn emit(&mut self, action: ObjectAction) -> GraphStoreResult<ObjectActionReceipt> {
        self.commonplace
            .emit_object_action(action, self.actor_id.clone())
    }

    fn views_for(&self, shape: &ObjectShape) -> Vec<ViewDescriptor> {
        self.registry.views_for(shape)
    }

    fn tokens(&self) -> &ThemeTokens {
        &self.tokens
    }
}

impl<S, B> Commonplace<S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    pub fn query_object_set(&self, query: ObjectQuery) -> GraphStoreResult<ObjectSet> {
        let mut items = self.items_for_query_types(&query.types)?;
        if let Some(predicate) = &query.where_clause {
            items.retain(|item| predicate_matches_item(self, item, predicate));
        }
        let note = self.rank_items(&mut items, &query.rank);

        let total = items.len();
        let start = query
            .page
            .as_ref()
            .and_then(|page| page.cursor.as_ref())
            .and_then(|cursor| cursor.parse::<usize>().ok())
            .unwrap_or(0)
            .min(total);
        let limit = query
            .page
            .as_ref()
            .map(|page| page.limit)
            .filter(|limit| *limit > 0)
            .unwrap_or(total);
        let end = start.saturating_add(limit).min(total);
        let next_cursor = (end < total).then(|| end.to_string());
        let requested_relations = requested_relations(&query);
        let objects: Vec<ObjectRef> = items[start..end]
            .iter()
            .map(|item| object_ref_from_item(self, item, &query.project, &requested_relations))
            .collect::<GraphStoreResult<Vec<_>>>()?;
        let mut shape = ObjectShape::from_objects(&objects);
        merge_query_shape_relations(&mut shape, &query);

        Ok(ObjectSet {
            objects,
            shape,
            next_cursor,
            live: query.live.then_some(LiveBinding::Poll {
                interval_ms: DEFAULT_RECORD_POLL_INTERVAL_MS,
            }),
            note,
        })
    }

    pub fn emit_object_action(
        &mut self,
        action: ObjectAction,
        actor_id: Option<String>,
    ) -> GraphStoreResult<ObjectActionReceipt> {
        let action_kind = action.action_kind();
        match action {
            ObjectAction::Create { type_ref, props } => {
                let item = item_from_props(&type_ref, props)?;
                let item = self.put_item(item)?;
                // Incremental mention detection (K5): a new text-bearing item
                // is an atom; evaluate it once, never a full rescan.
                self.evaluate_mentions_for_atom(&item.id)?;
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![item.id],
                    graph_transform: Some("Item".to_string()),
                    actor_id,
                    note: None,
                    inverse: None,
                })
            }
            ObjectAction::Update { id, patch } => {
                let mut item = self.get_item(&id)?.ok_or_else(|| {
                    GraphStoreError::new(
                        "commonplace_object_missing",
                        format!("object not found: {id}"),
                    )
                })?;
                apply_item_patch(&mut item, patch)?;
                let item = self.put_item(item)?;
                if item_object_type_slug(&item) == crate::mentions::MENTION_CANDIDATE_KIND {
                    // The confirm hook (K6): patching a candidate to
                    // confirmed writes the identity edge with its basis; a
                    // dismissal needs no extra write (the candidate is the
                    // negative signal and the suppression record).
                    if item.status.as_deref() == Some("confirmed") {
                        self.apply_mention_confirmation(&item)?;
                    }
                } else {
                    // An edited atom re-evaluates incrementally; existing
                    // candidate ids (any status) stay untouched.
                    self.evaluate_mentions_for_atom(&item.id)?;
                }
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![item.id],
                    graph_transform: Some("Item.patch".to_string()),
                    actor_id,
                    note: None,
                    inverse: None,
                })
            }
            ObjectAction::Link {
                from,
                edge,
                to,
                confidence,
            } => {
                let mut edge_record = EdgeRecord::new(
                    object_edge_id(&edge, &from, &to),
                    from.clone(),
                    edge.clone(),
                    to.clone(),
                    json!({}),
                );
                if let Some(confidence) = confidence {
                    edge_record = edge_record.with_confidence(confidence);
                }
                self.store_mut().upsert_edge(edge_record)?;
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![from, to],
                    graph_transform: Some(edge),
                    actor_id,
                    note: None,
                    inverse: None,
                })
            }
            ObjectAction::Delete { id } => {
                // The core GraphStore has no hard delete, so a delete is a
                // soft, reversible tombstone: every currently-live edge
                // incident to `id` (either direction, any type) is marked
                // `{"detached": true}` with the same mechanism Move uses on
                // stale CONTAINS edges, then the object's own node gets the
                // same marker. Edges that were already detached (e.g. by an
                // earlier delete/unlink) are left untouched so undo never
                // resurrects a tombstone this action didn't write.
                let mut node = self.store().get_node(&id).cloned().ok_or_else(|| {
                    GraphStoreError::new(
                        "commonplace_object_missing",
                        format!("object not found: {id}"),
                    )
                })?;

                let mut incident = self.store().neighbors(NeighborQuery::out(&id));
                incident.extend(self.store().neighbors(NeighborQuery::in_(&id)));
                let mut seen_edges = BTreeSet::new();
                let mut detached_edges = Vec::new();
                for hit in incident {
                    if !seen_edges.insert(hit.edge_id.clone()) {
                        continue;
                    }
                    let Some(mut edge) = self.store().get_edge(&hit.edge_id).cloned() else {
                        continue;
                    };
                    if is_detached(&edge.properties) {
                        continue;
                    }
                    set_detached(&mut edge.properties, true);
                    self.store_mut().upsert_edge(edge)?;
                    detached_edges.push(hit.edge_id);
                }

                set_detached(&mut node.properties, true);
                self.store_mut().upsert_node(node)?;

                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![id.clone()],
                    graph_transform: Some("Item.tombstone".to_string()),
                    actor_id,
                    note: None,
                    inverse: Some(ObjectAction::Restore {
                        node_id: Some(id),
                        edge_ids: detached_edges,
                    }),
                })
            }
            ObjectAction::Unlink { from, edge, to } => {
                // Same soft-tombstone mechanism as Delete, scoped to the one
                // edge. The edge id is deterministic from (edge, from, to),
                // so no traversal is needed to find it.
                let edge_id = object_edge_id(&edge, &from, &to);
                let mut edge_record = self.store().get_edge(&edge_id).cloned().ok_or_else(|| {
                    GraphStoreError::new(
                        "commonplace_edge_missing",
                        format!("edge not found: {edge_id}"),
                    )
                })?;
                let already_detached = is_detached(&edge_record.properties);
                let inverse = if already_detached {
                    None
                } else {
                    set_detached(&mut edge_record.properties, true);
                    self.store_mut().upsert_edge(edge_record)?;
                    Some(ObjectAction::Restore {
                        node_id: None,
                        edge_ids: vec![edge_id],
                    })
                };
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![from, to],
                    graph_transform: Some(edge),
                    actor_id,
                    note: already_detached.then(|| "edge already detached".to_string()),
                    inverse,
                })
            }
            ObjectAction::Restore { node_id, edge_ids } => {
                let mut target_ids = Vec::new();
                if let Some(node_id) = &node_id {
                    if let Some(mut node) = self.store().get_node(node_id).cloned() {
                        set_detached(&mut node.properties, false);
                        self.store_mut().upsert_node(node)?;
                    }
                    target_ids.push(node_id.clone());
                }
                for edge_id in &edge_ids {
                    if let Some(mut edge) = self.store().get_edge(edge_id).cloned() {
                        set_detached(&mut edge.properties, false);
                        let (from, to) = (edge.from_id.clone(), edge.to_id.clone());
                        self.store_mut().upsert_edge(edge)?;
                        if !target_ids.contains(&from) {
                            target_ids.push(from);
                        }
                        if !target_ids.contains(&to) {
                            target_ids.push(to);
                        }
                    }
                }
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids,
                    graph_transform: Some("Tombstone.restore".to_string()),
                    actor_id,
                    note: None,
                    inverse: None,
                })
            }
            ObjectAction::Move {
                id,
                new_parent,
                order,
            } => {
                // The core GraphStore has no edge deletion, so a re-home marks
                // any stale CONTAINS edge `detached` (ordered_children skips
                // those) and writes the fresh ordered edge. Reordering within
                // the same parent is exactly one edge upsert.
                let previous: Vec<String> = self
                    .store()
                    .neighbors(NeighborQuery::in_(&id).with_edge_type(CONTAINS_EDGE))
                    .into_iter()
                    .map(|hit| hit.node_id)
                    .collect();
                for parent in previous.iter().filter(|parent| *parent != &new_parent) {
                    self.store_mut().upsert_edge(EdgeRecord::new(
                        contains_edge_id(parent, &id),
                        parent.clone(),
                        CONTAINS_EDGE,
                        id.clone(),
                        json!({ "detached": true }),
                    ))?;
                }
                self.store_mut().upsert_edge(EdgeRecord::new(
                    contains_edge_id(&new_parent, &id),
                    new_parent.clone(),
                    CONTAINS_EDGE,
                    id.clone(),
                    json!({ "order": order }),
                ))?;
                Ok(ObjectActionReceipt {
                    action_kind,
                    status: ObjectActionStatus::Applied,
                    target_ids: vec![new_parent, id],
                    graph_transform: Some("CONTAINS.move".to_string()),
                    actor_id,
                    note: None,
                    inverse: None,
                })
            }
            ObjectAction::RunAgent { .. }
            | ObjectAction::InvokeTool { .. }
            | ObjectAction::Dispatch { .. }
            | ObjectAction::Open { .. }
            | ObjectAction::Select { .. } => Ok(ObjectActionReceipt {
                action_kind,
                status: ObjectActionStatus::Accepted,
                target_ids: Vec::new(),
                graph_transform: None,
                actor_id,
                note: Some("intent accepted for the shell or harness resolver".to_string()),
                inverse: None,
            }),
        }
    }

    fn items_for_query_types(&self, types: &[TypeRef]) -> GraphStoreResult<Vec<Item>> {
        if types.is_empty() {
            return self.all_items();
        }

        let mut seen = BTreeSet::new();
        let mut items = Vec::new();
        for type_ref in types {
            let type_slug = normalize_type_ref(type_ref);
            let candidates = if type_slug == "item" || type_slug == "*" {
                self.all_items()?
            } else {
                self.items_by_kind(&ItemKind::from(type_slug))?
            };
            for item in candidates {
                if seen.insert(item.id.clone()) {
                    items.push(item);
                }
            }
        }
        Ok(items)
    }
}

impl<S, B> Commonplace<S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    /// Children of `parent` under CONTAINS, sorted by their fractional `order`
    /// edge prop. Edges marked `detached` by a Move are skipped, so a re-homed
    /// object shows up under exactly one parent.
    pub fn ordered_children(&self, parent: &str) -> Vec<String> {
        let mut children: Vec<(String, f64)> = self
            .store()
            .neighbors(NeighborQuery::out(parent).with_edge_type(CONTAINS_EDGE))
            .into_iter()
            .filter_map(|hit| {
                let edge = self
                    .store()
                    .get_edge(&contains_edge_id(parent, &hit.node_id))?;
                if is_detached(&edge.properties) {
                    return None;
                }
                let order = edge
                    .properties
                    .get("order")
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0);
                Some((hit.node_id, order))
            })
            .collect();
        children.sort_by(|left, right| {
            left.1
                .partial_cmp(&right.1)
                .unwrap_or(Ordering::Equal)
                .then_with(|| left.0.cmp(&right.0))
        });
        children.into_iter().map(|(id, _)| id).collect()
    }

    /// Apply the query's rankers in priority order (the last ranker is the
    /// primary key, preserving v1's stable-sort layering). Field ranking is
    /// exact; the previously-dead VectorKnn / Fulltext / Graph rankers now score
    /// in-memory. Returns an optional note for the ObjectSet note channel when a
    /// hybrid ranker used the fallback path.
    fn rank_items(&self, items: &mut [Item], rankers: &[Ranker]) -> Option<String> {
        let mut note = None;
        for ranker in rankers.iter().rev() {
            match ranker {
                Ranker::Field { field, direction } => {
                    items.sort_by(|left, right| {
                        let ordering = compare_optional_values(
                            item_field_value(left, field).as_ref(),
                            item_field_value(right, field).as_ref(),
                        );
                        match direction {
                            RankDirection::Asc => ordering,
                            RankDirection::Desc => ordering.reverse(),
                        }
                    });
                }
                Ranker::Fulltext { query, fields } => {
                    let scores = fulltext_scores(items, query, fields);
                    sort_by_score(items, &scores);
                    note = Some(planner_fallback_note("fulltext"));
                }
                Ranker::VectorKnn { vector, .. } => {
                    let scores = vector_scores(items, vector);
                    sort_by_score(items, &scores);
                    note = Some(planner_fallback_note("vector_knn"));
                }
                Ranker::Graph {
                    seeds,
                    edge,
                    direction,
                } => {
                    let scores = self.graph_scores(items, seeds, edge.as_deref(), *direction);
                    sort_by_score(items, &scores);
                    note = Some(planner_fallback_note("graph"));
                }
            }
        }
        note
    }

    /// Score items by proximity to `seeds` via a bounded BFS over the graph:
    /// closer objects rank higher, unreachable objects score zero.
    fn graph_scores(
        &self,
        items: &[Item],
        seeds: &[String],
        edge: Option<&str>,
        direction: Option<EdgeDirection>,
    ) -> BTreeMap<String, f64> {
        let dir = direction.unwrap_or(EdgeDirection::Out);
        let mut distance: BTreeMap<String, usize> = BTreeMap::new();
        let mut frontier: Vec<String> = Vec::new();
        for seed in seeds {
            if distance.insert(seed.clone(), 0).is_none() {
                frontier.push(seed.clone());
            }
        }
        let mut hop = 0usize;
        while !frontier.is_empty() && hop < 6 {
            hop += 1;
            let mut next = Vec::new();
            for node in &frontier {
                let mut query = neighbor_query_for(node, dir);
                if let Some(edge) = edge {
                    query = query.with_edge_type(edge.to_string());
                }
                for hit in self.store().neighbors(query) {
                    if !distance.contains_key(&hit.node_id) {
                        distance.insert(hit.node_id.clone(), hop);
                        next.push(hit.node_id);
                    }
                }
            }
            frontier = next;
        }
        items
            .iter()
            .map(|item| {
                let score = distance
                    .get(&item.id)
                    .map(|hops| 1.0 / (1.0 + *hops as f64))
                    .unwrap_or(0.0);
                (item.id.clone(), score)
            })
            .collect()
    }

    /// Persist the hardcoded view registry into the graph as `view-descriptor`
    /// objects — the OC1 seed migration. Idempotent: descriptor ids already in
    /// the store are left untouched, so user- or pack-registered views survive
    /// re-seeding. Returns how many descriptors were written.
    pub fn seed_view_descriptors(&mut self) -> GraphStoreResult<usize> {
        let existing: BTreeSet<String> = self
            .items_by_kind(&ItemKind::from(VIEW_DESCRIPTOR_KIND.to_string()))?
            .into_iter()
            .filter_map(|item| {
                item.extra
                    .get("descriptor_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .collect();
        let mut written = 0;
        for descriptor in ViewRegistry::default_commonplace().descriptors() {
            if existing.contains(&descriptor.id) {
                continue;
            }
            let value = serde_json::to_value(descriptor).map_err(|error| {
                GraphStoreError::new("commonplace_view_descriptor", error.to_string())
            })?;
            let item = Item::new(
                ItemKind::from(VIEW_DESCRIPTOR_KIND.to_string()),
                descriptor.name.clone(),
            )
            .with_extra("descriptor_id", json!(descriptor.id))
            .with_extra("descriptor", value);
            self.put_item(item)?;
            written += 1;
        }
        Ok(written)
    }

    /// Hydrate a ViewRegistry from persisted `view-descriptor` objects. A fresh
    /// workspace holds none, so it falls back to the hardcoded seed and matches
    /// v1 behavior exactly.
    pub fn load_view_registry(&self) -> GraphStoreResult<ViewRegistry> {
        let descriptors: Vec<ViewDescriptor> = self
            .items_by_kind(&ItemKind::from(VIEW_DESCRIPTOR_KIND.to_string()))?
            .into_iter()
            .filter_map(|item| {
                item.extra
                    .get("descriptor")
                    .and_then(|value| serde_json::from_value::<ViewDescriptor>(value.clone()).ok())
            })
            .collect();
        if descriptors.is_empty() {
            Ok(ViewRegistry::default_commonplace())
        } else {
            Ok(ViewRegistry::new(descriptors))
        }
    }
}

fn object_ref_from_item<S, B>(
    commonplace: &Commonplace<S, B>,
    item: &Item,
    projection: &Option<Projection>,
    requested_relations: &[ProjectedRelation],
) -> GraphStoreResult<ObjectRef>
where
    S: GraphStore,
    B: BlobStore,
{
    let renderable = renderable_from_item(item);
    let mut properties = renderable.metadata.clone();
    properties.insert("title".to_string(), json!(renderable.title));
    properties.insert("summary".to_string(), json!(renderable.summary));
    properties.insert("body_preview".to_string(), json!(renderable.body_preview));
    properties.insert("source".to_string(), json!(renderable.source));
    properties.insert("tags".to_string(), json!(renderable.tags));
    properties.insert("collections".to_string(), json!(renderable.collections));
    properties.insert("created_at_ms".to_string(), json!(renderable.created_at_ms));
    properties.insert("updated_at_ms".to_string(), json!(renderable.updated_at_ms));
    properties.insert(
        "object_type_slug".to_string(),
        json!(renderable.object_type_slug),
    );

    if let Some(projection) = projection {
        if !projection.include_body_preview {
            properties.remove("body_preview");
        }
        if !projection.include_metadata {
            let keep: BTreeSet<String> = projection.fields.iter().cloned().collect();
            properties.retain(|field, _| keep.contains(field));
        } else if !projection.fields.is_empty() {
            let keep: BTreeSet<String> = projection.fields.iter().cloned().collect();
            properties.retain(|field, _| keep.contains(field));
        }
    }

    let mut relations = BTreeMap::new();
    for relation in requested_relations {
        // CONTAINS is the ordered-children edge: honor the fractional `order`
        // prop so a surface's regions and a region's view-instances round-trip
        // in the arrangement the user set, not in raw adjacency order.
        let ids = if relation.edge == CONTAINS_EDGE && relation.dir == EdgeDirection::Out {
            commonplace.ordered_children(&item.id)
        } else {
            let query =
                neighbor_query_for(&item.id, relation.dir).with_edge_type(relation.edge.clone());
            commonplace
                .store()
                .neighbors(query)
                .into_iter()
                .map(|hit| hit.node_id)
                .collect::<Vec<_>>()
        };
        if !ids.is_empty() {
            relations.insert(relation.edge.clone(), ids);
        }
    }

    let axes = ObjectAxes {
        h3: item
            .extra
            .get("h3")
            .or_else(|| item.extra.get("h3_cell"))
            .and_then(Value::as_str)
            .map(str::to_string),
        valid: item.due_at_ms.map(TimeRange::instant),
        embeddable: item.embedding.is_some() || item.embedding_ref.is_some(),
    };

    Ok(ObjectRef {
        id: item.id.clone(),
        type_ref: item_object_type_slug(item),
        properties,
        relations,
        axes,
    })
}

fn requested_relations(query: &ObjectQuery) -> Vec<ProjectedRelation> {
    let mut seen = BTreeSet::new();
    let mut relations = Vec::new();

    for walk in &query.traverse {
        let key = (walk.edge.clone(), walk.dir, walk.target.clone());
        if seen.insert(key) {
            relations.push(ProjectedRelation {
                edge: walk.edge.clone(),
                dir: walk.dir,
                target: walk.target.clone(),
            });
        }
    }
    if let Some(projection) = &query.project {
        for relation in &projection.relations {
            let key = (relation.edge.clone(), relation.dir, relation.target.clone());
            if seen.insert(key) {
                relations.push(relation.clone());
            }
        }
    }
    relations
}

fn merge_query_shape_relations(shape: &mut ObjectShape, query: &ObjectQuery) {
    let mut existing = shape
        .relations
        .iter()
        .map(|relation| (relation.edge.clone(), relation.dir, relation.target.clone()))
        .collect::<BTreeSet<_>>();

    for relation in requested_relations(query) {
        let key = (relation.edge.clone(), relation.dir, relation.target.clone());
        if existing.insert(key) {
            shape.relations.push(ShapeRelation {
                edge: relation.edge,
                dir: relation.dir,
                target: relation.target,
            });
        }
    }
    shape.relations.sort_by(|left, right| {
        left.edge
            .cmp(&right.edge)
            .then_with(|| format!("{:?}", left.dir).cmp(&format!("{:?}", right.dir)))
            .then_with(|| left.target.cmp(&right.target))
    });
}

fn predicate_matches_item<S, B>(
    commonplace: &Commonplace<S, B>,
    item: &Item,
    predicate: &Predicate,
) -> bool
where
    S: GraphStore,
    B: BlobStore,
{
    match predicate {
        Predicate::Eq { field, value } => item_field_value(item, field).as_ref() == Some(value),
        Predicate::NotEq { field, value } => item_field_value(item, field).as_ref() != Some(value),
        Predicate::Contains { field, value } => {
            contains_value(item_field_value(item, field), value)
        }
        Predicate::Exists { field } => item_field_value(item, field).is_some(),
        Predicate::RelationExists { edge, dir, target } => {
            let query = neighbor_query_for(&item.id, *dir).with_edge_type(edge.clone());
            commonplace
                .store()
                .neighbors(query)
                .into_iter()
                .any(|hit| target.as_ref().map(|id| id == &hit.node_id).unwrap_or(true))
        }
        Predicate::And { all } => all
            .iter()
            .all(|predicate| predicate_matches_item(commonplace, item, predicate)),
        Predicate::Or { any } => any
            .iter()
            .any(|predicate| predicate_matches_item(commonplace, item, predicate)),
        Predicate::Not { predicate } => !predicate_matches_item(commonplace, item, predicate),
    }
}

fn item_field_value(item: &Item, field: &str) -> Option<Value> {
    let value = serde_json::to_value(item).ok()?;
    value.get(field).cloned()
}

fn contains_value(haystack: Option<Value>, needle: &Value) -> bool {
    match haystack {
        Some(Value::String(text)) => needle
            .as_str()
            .map(|needle| text.contains(needle))
            .unwrap_or(false),
        Some(Value::Array(values)) => values.iter().any(|value| value == needle),
        Some(value) => value == *needle,
        None => false,
    }
}

fn sort_by_score(items: &mut [Item], scores: &BTreeMap<String, f64>) {
    items.sort_by(|left, right| {
        let left_score = scores.get(&left.id).copied().unwrap_or(f64::MIN);
        let right_score = scores.get(&right.id).copied().unwrap_or(f64::MIN);
        right_score
            .partial_cmp(&left_score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.id.cmp(&right.id))
    });
}

fn fulltext_haystack(item: &Item, fields: &[String]) -> String {
    if fields.is_empty() {
        let mut parts = vec![item.title.clone()];
        if let ItemBody::Inline { text } = &item.body {
            parts.push(text.clone());
        }
        for value in item.extra.values() {
            if let Some(text) = value.as_str() {
                parts.push(text.to_string());
            }
        }
        parts.join(" ")
    } else {
        fields
            .iter()
            .filter_map(|field| item_field_value(item, field))
            .map(|value| match value {
                Value::String(text) => text,
                other => other.to_string(),
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn fulltext_scores(items: &[Item], query: &str, fields: &[String]) -> BTreeMap<String, f64> {
    let tokens: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .map(str::to_string)
        .collect();
    let mut scores = BTreeMap::new();
    for item in items {
        let haystack = fulltext_haystack(item, fields).to_lowercase();
        let score = tokens
            .iter()
            .map(|token| haystack.matches(token.as_str()).count() as f64)
            .sum();
        scores.insert(item.id.clone(), score);
    }
    scores
}

fn vector_scores(items: &[Item], vector: &[f32]) -> BTreeMap<String, f64> {
    let mut scores = BTreeMap::new();
    for item in items {
        let score = item
            .embedding
            .as_ref()
            .map(|embedding| cosine_similarity(embedding, vector))
            .unwrap_or(f64::MIN);
        scores.insert(item.id.clone(), score);
    }
    scores
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f64 {
    let width = left.len().min(right.len());
    let mut dot = 0.0f64;
    let mut left_norm = 0.0f64;
    let mut right_norm = 0.0f64;
    for index in 0..width {
        let x = left[index] as f64;
        let y = right[index] as f64;
        dot += x * y;
        left_norm += x * x;
        right_norm += y * y;
    }
    if left_norm == 0.0 || right_norm == 0.0 {
        return 0.0;
    }
    dot / (left_norm.sqrt() * right_norm.sqrt())
}

fn planner_fallback_note(ranker: &str) -> String {
    format!(
        "ranked in-memory via the {ranker} scorer; the relational planner (QueryIr) is unavailable, so hybrid retrieval used the fallback path"
    )
}

fn compare_optional_values(left: Option<&Value>, right: Option<&Value>) -> Ordering {
    match (left, right) {
        (Some(left), Some(right)) => compare_values(left, right),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

fn compare_values(left: &Value, right: &Value) -> Ordering {
    match (left, right) {
        (Value::Number(left), Value::Number(right)) => left
            .as_f64()
            .partial_cmp(&right.as_f64())
            .unwrap_or(Ordering::Equal),
        (Value::String(left), Value::String(right)) => left.cmp(right),
        (Value::Bool(left), Value::Bool(right)) => left.cmp(right),
        _ => left.to_string().cmp(&right.to_string()),
    }
}

fn item_from_props(type_ref: &str, mut props: Map<String, Value>) -> GraphStoreResult<Item> {
    let title = take_string(&mut props, "title").unwrap_or_else(|| "Untitled".to_string());
    let mut item = Item::new(ItemKind::from(normalize_type_ref(type_ref)), title);

    if let Some(text) = take_string(&mut props, "body").or_else(|| take_string(&mut props, "text"))
    {
        item = item.with_text(text);
    }
    if let Some(source) = take_string(&mut props, "source") {
        item = item.with_source(source);
    }
    if let Some(status) = take_string(&mut props, "status") {
        item = item.with_status(status);
    }
    if let Some(priority) = take_string(&mut props, "priority") {
        item = item.with_priority(priority);
    }
    if let Some(due_at_ms) = take_i64(&mut props, "due_at_ms") {
        item = item.with_due_at(due_at_ms);
    }
    if let Some(tags) = take_string_vec(&mut props, "tags")? {
        item = item.with_tags(tags);
    }
    for (key, value) in props {
        item = item.with_extra(key, value);
    }
    Ok(item)
}

fn apply_item_patch(item: &mut Item, mut patch: Map<String, Value>) -> GraphStoreResult<()> {
    if let Some(title) = take_string(&mut patch, "title") {
        item.title = title;
    }
    if let Some(text) = take_string(&mut patch, "body").or_else(|| take_string(&mut patch, "text"))
    {
        item.body = ItemBody::Inline { text };
    }
    if let Some(source) = take_string(&mut patch, "source") {
        item.source = Some(source);
    }
    if patch.contains_key("source") && patch.get("source").and_then(Value::as_str).is_none() {
        item.source = None;
        patch.remove("source");
    }
    if let Some(status) = take_optional_string(&mut patch, "status") {
        item.status = status;
    }
    if let Some(priority) = take_optional_string(&mut patch, "priority") {
        item.priority = priority;
    }
    if let Some(due_at_ms) = take_optional_i64(&mut patch, "due_at_ms") {
        item.due_at_ms = due_at_ms;
    }
    if let Some(tags) = take_string_vec(&mut patch, "tags")? {
        item.tags = tags;
    }
    for (key, value) in patch {
        item.extra.insert(key, value);
    }
    Ok(())
}

fn take_string(props: &mut Map<String, Value>, key: &str) -> Option<String> {
    props
        .remove(key)
        .and_then(|value| value.as_str().map(str::to_string))
}

fn take_optional_string(props: &mut Map<String, Value>, key: &str) -> Option<Option<String>> {
    props.remove(key).map(|value| match value {
        Value::Null => None,
        value => value.as_str().map(str::to_string),
    })
}

fn take_i64(props: &mut Map<String, Value>, key: &str) -> Option<i64> {
    props.remove(key).and_then(|value| value.as_i64())
}

fn take_optional_i64(props: &mut Map<String, Value>, key: &str) -> Option<Option<i64>> {
    props.remove(key).map(|value| match value {
        Value::Null => None,
        value => value.as_i64(),
    })
}

fn take_string_vec(
    props: &mut Map<String, Value>,
    key: &str,
) -> GraphStoreResult<Option<Vec<String>>> {
    match props.remove(key) {
        Some(value) => serde_json::from_value(value)
            .map(Some)
            .map_err(|error| GraphStoreError::new("commonplace_object_patch", error.to_string())),
        None => Ok(None),
    }
}

fn neighbor_query_for(id: &str, dir: EdgeDirection) -> NeighborQuery {
    match dir {
        EdgeDirection::Out => NeighborQuery::out(id),
        EdgeDirection::In => NeighborQuery::in_(id),
    }
}

fn shape_matches(accepts: &ObjectShapeMatch, shape: &ObjectShape) -> bool {
    let shape_types = shape
        .types
        .iter()
        .map(|type_ref| normalize_type_ref(type_ref))
        .collect::<BTreeSet<_>>();
    if accepts
        .required_types
        .iter()
        .map(|type_ref| normalize_type_ref(type_ref))
        .any(|type_ref| !shape_types.contains(&type_ref))
    {
        return false;
    }

    let shape_fields = shape.fields.iter().cloned().collect::<BTreeSet<_>>();
    if accepts
        .required_fields
        .iter()
        .any(|field| !shape_fields.contains(field))
    {
        return false;
    }

    if accepts.required_axes.spatial && !shape.axes.spatial {
        return false;
    }
    if accepts.required_axes.temporal && !shape.axes.temporal {
        return false;
    }
    if accepts.required_axes.embeddable && !shape.axes.embeddable {
        return false;
    }

    if let Some(cardinality) = accepts.cardinality {
        let matches = match cardinality {
            CardinalityRequirement::Any => true,
            CardinalityRequirement::One => shape.cardinality == ObjectCardinality::One,
            CardinalityRequirement::Many => shape.cardinality == ObjectCardinality::Many,
        };
        if !matches {
            return false;
        }
    }

    if accepts.requires_relation && shape.relations.is_empty() {
        return false;
    }

    if let Some(required_edge) = &accepts.required_edge {
        return shape
            .relations
            .iter()
            .any(|relation| relation_matches(required_edge, relation));
    }

    true
}

fn relation_matches(required: &ShapeRelationMatch, relation: &ShapeRelation) -> bool {
    if required
        .edge
        .as_ref()
        .map(|edge| edge != &relation.edge)
        .unwrap_or(false)
    {
        return false;
    }
    if required.dir.map(|dir| dir != relation.dir).unwrap_or(false) {
        return false;
    }
    if required
        .target
        .as_ref()
        .map(|target| relation.target.as_ref() != Some(target))
        .unwrap_or(false)
    {
        return false;
    }
    true
}

fn object_edge_id(edge: &str, from: &str, to: &str) -> String {
    format!("object:{}:{from}:{to}", normalize_type_ref(edge))
}

/// The ordered-children edge. A surface CONTAINS regions; a region CONTAINS
/// regions or view-instances. The child's rank rides on the edge as a
/// fractional `order` prop so a reorder is a single edge patch.
pub const CONTAINS_EDGE: &str = "CONTAINS";

/// Item kind under which persisted `view-descriptor` objects live, so the view
/// registry is data in the graph rather than a hardcoded table.
pub const VIEW_DESCRIPTOR_KIND: &str = "view-descriptor";

fn contains_edge_id(parent: &str, child: &str) -> String {
    object_edge_id(CONTAINS_EDGE, parent, child)
}

/// Whether a node/edge properties blob carries the `Delete`/`Unlink`/`Move`
/// tombstone marker. Shared by `Delete`, `Unlink`, and `ordered_children`'s
/// inline check so the property name and shape stay in one place.
fn is_detached(properties: &Value) -> bool {
    properties
        .get("detached")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

/// Set or clear the `detached` tombstone marker on a node/edge properties
/// blob in place, preserving every other property. Used by `Delete` and
/// `Unlink` to tombstone, and by their `Restore` inverse to un-tombstone.
fn set_detached(properties: &mut Value, detached: bool) {
    if !properties.is_object() {
        *properties = json!({});
    }
    let object = properties
        .as_object_mut()
        .expect("properties coerced to an object above");
    if detached {
        object.insert("detached".to_string(), json!(true));
    } else {
        object.remove("detached");
    }
}

/// Midpoint fractional index between two ordered siblings. `before` / `after`
/// are the `order` values of the neighbours the object is dropped between;
/// `None` means "past that edge". Dropping between two children never disturbs
/// the others — only the moved child's one edge is rewritten.
pub fn fractional_index(before: Option<f64>, after: Option<f64>) -> f64 {
    match (before, after) {
        (Some(before), Some(after)) => (before + after) / 2.0,
        (Some(before), None) => before + 1.0,
        (None, Some(after)) => after - 1.0,
        (None, None) => 0.0,
    }
}

/// The four arrangement types (SPEC-OBJECT-CONTRACT-V2 OC1). They inhabit the
/// same TypeDef vocabulary as every content type — a surface is just an object
/// whose CONTAINS children are regions and view-instances, so drag-to-rearrange,
/// fork, and share are ordinary object machinery.
pub fn commonplace_surface_types() -> Vec<TypeDef> {
    let contains = |target: &str| RelationDef {
        edge: CONTAINS_EDGE.to_string(),
        dir: EdgeDirection::Out,
        target: target.to_string(),
    };
    let string = |name: &str| PropertyDef {
        name: name.to_string(),
        prop_type: PropType::String,
        constraints: Vec::new(),
    };
    let json = |name: &str| PropertyDef {
        name: name.to_string(),
        prop_type: PropType::Json,
        constraints: Vec::new(),
    };
    vec![
        TypeDef {
            name: "surface".to_string(),
            properties: vec![
                string("name"),
                PropertyDef {
                    name: "kind".to_string(),
                    prop_type: PropType::String,
                    constraints: vec![Constraint::Enum {
                        values: vec![
                            "page".to_string(),
                            "workspace".to_string(),
                            "panel".to_string(),
                        ],
                    }],
                },
            ],
            relations: vec![contains("region"), contains("view-instance")],
            axes: TypeAxes::default(),
        },
        TypeDef {
            name: "region".to_string(),
            properties: vec![
                PropertyDef {
                    name: "layout".to_string(),
                    prop_type: PropType::String,
                    constraints: vec![Constraint::Enum {
                        values: vec![
                            "split-h".to_string(),
                            "split-v".to_string(),
                            "grid".to_string(),
                            "stack".to_string(),
                        ],
                    }],
                },
                json("ratios"),
                PropertyDef {
                    name: "columns".to_string(),
                    prop_type: PropType::Integer,
                    constraints: Vec::new(),
                },
                PropertyDef {
                    name: "gap".to_string(),
                    prop_type: PropType::Number,
                    constraints: Vec::new(),
                },
            ],
            relations: vec![contains("region"), contains("view-instance")],
            axes: TypeAxes::default(),
        },
        TypeDef {
            name: "view-instance".to_string(),
            properties: vec![
                PropertyDef {
                    name: "descriptor_id".to_string(),
                    prop_type: PropType::String,
                    constraints: vec![Constraint::Required],
                },
                json("query"),
                json("config"),
                string("title"),
            ],
            relations: Vec::new(),
            axes: TypeAxes::default(),
        },
        TypeDef {
            name: VIEW_DESCRIPTOR_KIND.to_string(),
            properties: vec![PropertyDef {
                name: "descriptor".to_string(),
                prop_type: PropType::Json,
                constraints: vec![Constraint::Required],
            }],
            relations: Vec::new(),
            axes: TypeAxes::default(),
        },
    ]
}

fn normalize_type_ref(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .replace('_', "-")
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::ABOUT_EDGE;
    use crate::InMemoryBlobStore;
    use rustyred_thg_core::InMemoryGraphStore;
    use serde_json::json;

    fn fresh() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
    }

    #[test]
    fn task_board_query_infers_shape_and_views() {
        let mut cp = fresh();
        let note = cp.put_item(Item::note("Knowledge", "background")).unwrap();
        let first = cp
            .put_item(
                Item::task("First task", "ship it")
                    .with_status("todo")
                    .with_due_at(10),
            )
            .unwrap();
        let second = cp
            .put_item(
                Item::task("Second task", "ship it too")
                    .with_status("doing")
                    .with_due_at(20),
            )
            .unwrap();
        cp.put_item(
            Item::task("Done task", "ignore")
                .with_status("done")
                .with_due_at(5),
        )
        .unwrap();
        cp.link_about(&first.id, &note.id).unwrap();
        cp.link_about(&second.id, &note.id).unwrap();

        let query = ObjectQuery::new(["task"])
            .with_where(Predicate::not_eq("status", json!("done")))
            .with_traverse(EdgeWalk::out(ABOUT_EDGE))
            .with_rank(Ranker::field("due_at_ms", RankDirection::Asc));
        let set = cp.query_object_set(query).unwrap();

        assert_eq!(set.objects.len(), 2);
        assert_eq!(set.objects[0].id, first.id);
        assert_eq!(
            set.live,
            Some(LiveBinding::Poll {
                interval_ms: DEFAULT_RECORD_POLL_INTERVAL_MS
            })
        );
        assert_eq!(set.shape.types, vec!["task".to_string()]);
        assert!(set.shape.fields.contains(&"status".to_string()));
        assert!(set.shape.axes.temporal);
        assert!(set
            .shape
            .relations
            .iter()
            .any(|relation| relation.edge == ABOUT_EDGE));

        let views = ViewRegistry::default_commonplace()
            .views_for(&set.shape)
            .into_iter()
            .map(|view| view.id)
            .collect::<BTreeSet<_>>();
        assert!(views.contains("table"));
        assert!(views.contains("board"));
        assert!(views.contains("card"));
        assert!(views.contains("timeline"));
        assert!(views.contains("graph"));
    }

    #[test]
    fn object_actions_apply_mutations_and_keep_invocations_declarative() {
        let mut cp = fresh();
        let mut props = Map::new();
        props.insert("title".to_string(), json!("Investigate"));
        props.insert("status".to_string(), json!("todo"));
        let create = cp
            .emit_object_action(
                ObjectAction::Create {
                    type_ref: "task".to_string(),
                    props,
                },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(create.status, ObjectActionStatus::Applied);
        let task_id = create.target_ids[0].clone();

        let mut patch = Map::new();
        patch.insert("status".to_string(), json!("doing"));
        let update = cp
            .emit_object_action(
                ObjectAction::Update {
                    id: task_id.clone(),
                    patch,
                },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(update.graph_transform.as_deref(), Some("Item.patch"));
        assert_eq!(
            cp.get_item(&task_id).unwrap().unwrap().status.as_deref(),
            Some("doing")
        );

        let note = cp.put_item(Item::note("Context", "body")).unwrap();
        let link = cp
            .emit_object_action(
                ObjectAction::Link {
                    from: task_id.clone(),
                    edge: ABOUT_EDGE.to_string(),
                    to: note.id.clone(),
                    confidence: Some(0.8),
                },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(link.status, ObjectActionStatus::Applied);
        assert_eq!(cp.task_about(&task_id).unwrap(), vec![note.id]);

        let dispatch = cp
            .emit_object_action(
                ObjectAction::Dispatch {
                    job: JobSpec {
                        name: "applyPatch".to_string(),
                        ..JobSpec::default()
                    },
                },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(dispatch.status, ObjectActionStatus::Accepted);
    }

    #[test]
    fn delete_then_undo_restores_the_object_and_its_edges() {
        let mut cp = fresh();
        let region = create(&mut cp, "region", &[("layout", json!("stack"))]);
        let card = create(
            &mut cp,
            "view-instance",
            &[("descriptor_id", json!("card"))],
        );
        contains(&mut cp, &region, &card, 1.0);
        assert_eq!(cp.ordered_children(&region), vec![card.clone()]);

        let task_id = create(&mut cp, "task", &[("title", json!("Investigate"))]);
        cp.emit_object_action(
            ObjectAction::Link {
                from: task_id.clone(),
                edge: ABOUT_EDGE.to_string(),
                to: card.clone(),
                confidence: None,
            },
            None,
        )
        .unwrap();
        let about_edge_id = object_edge_id(ABOUT_EDGE, &task_id, &card);
        assert!(cp.store().get_edge(&about_edge_id).is_some());

        let delete = cp
            .emit_object_action(
                ObjectAction::Delete { id: card.clone() },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(delete.action_kind, ActionKind::Delete);
        assert_eq!(delete.status, ObjectActionStatus::Applied);

        // The object node and both its incident edges (CONTAINS in, ABOUT
        // in) are tombstoned.
        let node = cp.store().get_node(&card).unwrap();
        assert_eq!(node.properties.get("detached"), Some(&json!(true)));
        assert!(cp.ordered_children(&region).is_empty());
        let about_edge = cp.store().get_edge(&about_edge_id).unwrap();
        assert_eq!(about_edge.properties.get("detached"), Some(&json!(true)));

        let inverse = delete
            .inverse
            .expect("delete carries an inverse descriptor");
        let undo = cp
            .emit_object_action(inverse, Some("codex".to_string()))
            .unwrap();
        assert_eq!(undo.action_kind, ActionKind::Restore);
        assert_eq!(undo.status, ObjectActionStatus::Applied);

        // Undo restores the exact prior state: object and both edges are
        // visible again, and the CONTAINS edge kept its original order.
        let node = cp.store().get_node(&card).unwrap();
        assert!(node.properties.get("detached").is_none());
        assert_eq!(cp.ordered_children(&region), vec![card]);
        let about_edge = cp.store().get_edge(&about_edge_id).unwrap();
        assert!(about_edge.properties.get("detached").is_none());
    }

    #[test]
    fn unlink_then_undo_restores_the_edge() {
        let mut cp = fresh();
        let task_id = create(&mut cp, "task", &[("title", json!("Investigate"))]);
        let note = cp.put_item(Item::note("Context", "body")).unwrap();

        cp.emit_object_action(
            ObjectAction::Link {
                from: task_id.clone(),
                edge: ABOUT_EDGE.to_string(),
                to: note.id.clone(),
                confidence: None,
            },
            None,
        )
        .unwrap();
        assert_eq!(cp.task_about(&task_id).unwrap(), vec![note.id.clone()]);

        let edge_id = object_edge_id(ABOUT_EDGE, &task_id, &note.id);
        let unlink = cp
            .emit_object_action(
                ObjectAction::Unlink {
                    from: task_id.clone(),
                    edge: ABOUT_EDGE.to_string(),
                    to: note.id.clone(),
                },
                None,
            )
            .unwrap();
        assert_eq!(unlink.action_kind, ActionKind::Unlink);
        assert_eq!(unlink.status, ObjectActionStatus::Applied);
        let edge = cp.store().get_edge(&edge_id).unwrap();
        assert_eq!(edge.properties.get("detached"), Some(&json!(true)));

        let inverse = unlink
            .inverse
            .expect("unlink carries an inverse descriptor");
        let undo = cp.emit_object_action(inverse, None).unwrap();
        assert_eq!(undo.action_kind, ActionKind::Restore);
        assert_eq!(undo.status, ObjectActionStatus::Applied);

        // Undo restores the exact prior state: the edge is visible again.
        let edge = cp.store().get_edge(&edge_id).unwrap();
        assert!(edge.properties.get("detached").is_none());
    }

    #[test]
    fn view_matching_is_shape_based_not_task_specific() {
        let shape = ObjectShape {
            types: vec!["issue".to_string()],
            fields: vec![
                "title".to_string(),
                "status".to_string(),
                "due_at_ms".to_string(),
            ],
            relations: vec![ShapeRelation {
                edge: ABOUT_EDGE.to_string(),
                dir: EdgeDirection::Out,
                target: None,
            }],
            axes: TypeAxes {
                temporal: true,
                ..TypeAxes::default()
            },
            cardinality: ObjectCardinality::Many,
        };

        let views = ViewRegistry::default_commonplace()
            .views_for(&shape)
            .into_iter()
            .map(|view| view.id)
            .collect::<BTreeSet<_>>();

        assert!(views.contains("board"));
        assert!(views.contains("timeline"));
        assert!(views.contains("graph"));
    }

    #[test]
    fn action_protocol_serializes_stable_kind_tags() {
        let action = ObjectAction::RunAgent {
            target: ObjectActionTarget::Query(ObjectQuery::new(["patch"])),
            tier: AgentTier::Difficult,
        };
        let value = serde_json::to_value(action).unwrap();

        assert_eq!(value.get("kind"), Some(&json!("run_agent")));
        assert_eq!(value.get("tier"), Some(&json!("difficult")));
    }

    fn create(
        cp: &mut Commonplace<InMemoryGraphStore, InMemoryBlobStore>,
        type_ref: &str,
        props: &[(&str, Value)],
    ) -> String {
        let mut map = Map::new();
        for (key, value) in props {
            map.insert((*key).to_string(), value.clone());
        }
        cp.emit_object_action(
            ObjectAction::Create {
                type_ref: type_ref.to_string(),
                props: map,
            },
            None,
        )
        .unwrap()
        .target_ids[0]
            .clone()
    }

    fn contains(
        cp: &mut Commonplace<InMemoryGraphStore, InMemoryBlobStore>,
        parent: &str,
        child: &str,
        order: f64,
    ) {
        cp.emit_object_action(
            ObjectAction::Move {
                id: child.to_string(),
                new_parent: parent.to_string(),
                order,
            },
            None,
        )
        .unwrap();
    }

    #[test]
    fn surface_tree_round_trips_through_query() {
        // OC1 acceptance: a surface with two nested regions and three
        // view-instances round-trips through query_object_set, in order.
        let mut cp = fresh();
        let surface = create(
            &mut cp,
            "surface",
            &[("name", json!("Operator")), ("kind", json!("page"))],
        );
        let region_a = create(&mut cp, "region", &[("layout", json!("split-v"))]);
        let region_b = create(&mut cp, "region", &[("layout", json!("stack"))]);
        let vi_chip = create(
            &mut cp,
            "view-instance",
            &[("descriptor_id", json!("chip")), ("title", json!("Attention"))],
        );
        let vi_queue = create(
            &mut cp,
            "view-instance",
            &[("descriptor_id", json!("list")), ("title", json!("Queue"))],
        );
        let vi_board = create(
            &mut cp,
            "view-instance",
            &[("descriptor_id", json!("board")), ("title", json!("Bays"))],
        );

        contains(&mut cp, &surface, &region_a, 1.0);
        contains(&mut cp, &surface, &region_b, 2.0);
        contains(&mut cp, &region_a, &vi_chip, 1.0);
        contains(&mut cp, &region_a, &vi_queue, 2.0);
        contains(&mut cp, &region_b, &vi_board, 1.0);

        let set = cp
            .query_object_set(ObjectQuery::new(["surface"]).with_traverse(EdgeWalk::out(CONTAINS_EDGE)))
            .unwrap();
        assert_eq!(set.objects.len(), 1);
        let root = &set.objects[0];
        assert_eq!(
            root.properties.get("name").and_then(Value::as_str),
            Some("Operator")
        );
        assert_eq!(
            root.relations.get(CONTAINS_EDGE),
            Some(&vec![region_a.clone(), region_b.clone()])
        );

        assert_eq!(
            cp.ordered_children(&region_a),
            vec![vi_chip.clone(), vi_queue.clone()]
        );

        // A view-instance's descriptor_id survives the round-trip.
        let instances = cp.query_object_set(ObjectQuery::new(["view-instance"])).unwrap();
        let board = instances
            .objects
            .iter()
            .find(|object| object.id == vi_board)
            .unwrap();
        assert_eq!(
            board.properties.get("descriptor_id").and_then(Value::as_str),
            Some("board")
        );
    }

    #[test]
    fn move_reorders_with_a_single_action() {
        // OC1 acceptance: Move reorders with a single action.
        let mut cp = fresh();
        let region = create(&mut cp, "region", &[("layout", json!("stack"))]);
        let a = create(&mut cp, "view-instance", &[("descriptor_id", json!("list"))]);
        let b = create(&mut cp, "view-instance", &[("descriptor_id", json!("board"))]);
        contains(&mut cp, &region, &a, 1.0);
        contains(&mut cp, &region, &b, 2.0);
        assert_eq!(cp.ordered_children(&region), vec![a.clone(), b.clone()]);

        // Drop `b` above `a` via one fractional-index edge patch.
        let order = fractional_index(None, Some(1.0));
        let receipt = cp
            .emit_object_action(
                ObjectAction::Move {
                    id: b.clone(),
                    new_parent: region.clone(),
                    order,
                },
                Some("codex".to_string()),
            )
            .unwrap();
        assert_eq!(receipt.action_kind, ActionKind::Move);
        assert_eq!(receipt.status, ObjectActionStatus::Applied);
        assert_eq!(cp.ordered_children(&region), vec![b, a]);
    }

    #[test]
    fn move_across_parents_detaches_the_old_edge() {
        let mut cp = fresh();
        let left = create(&mut cp, "region", &[("layout", json!("stack"))]);
        let right = create(&mut cp, "region", &[("layout", json!("stack"))]);
        let card = create(&mut cp, "view-instance", &[("descriptor_id", json!("card"))]);
        contains(&mut cp, &left, &card, 1.0);
        assert_eq!(cp.ordered_children(&left), vec![card.clone()]);

        contains(&mut cp, &right, &card, 1.0);
        assert!(cp.ordered_children(&left).is_empty());
        assert_eq!(cp.ordered_children(&right), vec![card]);
    }

    #[test]
    fn view_registry_hydrates_from_store_seed() {
        // OC1 acceptance: registry hydrates from the store and matches v1.
        let mut cp = fresh();
        let v1_ids: BTreeSet<String> = ViewRegistry::default_commonplace()
            .descriptors()
            .iter()
            .map(|descriptor| descriptor.id.clone())
            .collect();

        // Fresh store holds no descriptors -> fallback matches v1.
        let fresh_ids: BTreeSet<String> = cp
            .load_view_registry()
            .unwrap()
            .descriptors()
            .iter()
            .map(|descriptor| descriptor.id.clone())
            .collect();
        assert_eq!(fresh_ids, v1_ids);

        // Seed migration persists the set as objects; reload reads the graph.
        assert_eq!(cp.seed_view_descriptors().unwrap(), v1_ids.len());
        let hydrated = cp.load_view_registry().unwrap();
        let hydrated_ids: BTreeSet<String> = hydrated
            .descriptors()
            .iter()
            .map(|descriptor| descriptor.id.clone())
            .collect();
        assert_eq!(hydrated_ids, v1_ids);

        // views_for over the hydrated registry matches v1 on a sample shape.
        let shape = ObjectShape {
            types: vec!["task".to_string()],
            fields: vec!["title".to_string(), "status".to_string()],
            relations: Vec::new(),
            axes: TypeAxes {
                temporal: true,
                ..TypeAxes::default()
            },
            cardinality: ObjectCardinality::Many,
        };
        let hydrated_views: BTreeSet<String> = hydrated
            .views_for(&shape)
            .into_iter()
            .map(|view| view.id)
            .collect();
        let v1_views: BTreeSet<String> = ViewRegistry::default_commonplace()
            .views_for(&shape)
            .into_iter()
            .map(|view| view.id)
            .collect();
        assert_eq!(hydrated_views, v1_views);

        // Re-seeding is idempotent.
        assert_eq!(cp.seed_view_descriptors().unwrap(), 0);
    }

    #[test]
    fn fulltext_ranker_ranks_and_notes_fallback() {
        // OC4 acceptance: a Fulltext-ranked query returns scored results and the
        // ObjectSet note channel reports the planner fallback.
        let mut cp = fresh();
        cp.put_item(Item::note("Alpha", "the quick brown fox")).unwrap();
        let target = cp
            .put_item(Item::note("Beta", "graph graph graph substrate"))
            .unwrap();
        cp.put_item(Item::note("Gamma", "unrelated content")).unwrap();

        let set = cp
            .query_object_set(ObjectQuery::new(["note"]).with_rank(Ranker::Fulltext {
                query: "graph".to_string(),
                fields: Vec::new(),
            }))
            .unwrap();
        assert_eq!(set.objects[0].id, target.id);
        assert!(set.note.as_deref().unwrap_or("").contains("fallback"));

        // Field ranking is exact and leaves the note channel clean.
        let plain = cp
            .query_object_set(
                ObjectQuery::new(["note"]).with_rank(Ranker::field("title", RankDirection::Asc)),
            )
            .unwrap();
        assert!(plain.note.is_none());
    }

    #[test]
    fn surface_types_cover_the_four_arrangement_objects() {
        let names: BTreeSet<String> = commonplace_surface_types()
            .into_iter()
            .map(|type_def| type_def.name)
            .collect();
        for expected in ["surface", "region", "view-instance", "view-descriptor"] {
            assert!(names.contains(expected), "missing type {expected}");
        }
    }
}
