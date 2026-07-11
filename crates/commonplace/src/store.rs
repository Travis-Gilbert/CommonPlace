//! [`Commonplace`]: the store facade over a [`GraphStore`] plus a [`BlobStore`]
//! (plan unit F1).
//!
//! It maps the consumer object model onto graph records:
//! - an `Item` is an `Item`-labelled node;
//! - a `Collection` is a `Collection`-labelled node;
//! - membership is an `IN_COLLECTION` edge (Item -> Collection), so a collection
//!   enumerates its members by reverse traversal;
//! - each tag is a `Tag`-labelled node joined by a `HAS_TAG` edge (Item -> Tag),
//!   and also kept on the item as a label array for cheap reads;
//! - a `File` item's bytes live in the blob store, addressed by the item body's
//!   content hash.
//!
//! Residency changes (per-item field) and the `SIMILAR_TO` edge (written by F2)
//! ride the same model.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rustyred_thg_core::{
    now_ms, EdgeRecord, GraphStore, GraphStoreError, GraphStoreResult, NeighborQuery, NodeQuery,
    NodeRecord,
};
use serde_json::{json, Value};

use crate::blob::BlobStore;
use crate::collection::{Collection, CollectionKind};
use crate::item::{Item, ItemBody, ItemKind};
use crate::stamp::{build_stamp_snapshot, ExplicitEdge, ExplicitEdgeClass, StampSnapshot};
use crate::tag::{tag_id, Tag};

/// Node label for items.
pub const ITEM_LABEL: &str = "Item";
/// Node label for collections.
pub const COLLECTION_LABEL: &str = "Collection";
/// Node label for tags.
pub const TAG_LABEL: &str = "Tag";
/// Edge type for collection membership (Item -> Collection).
pub const IN_COLLECTION_EDGE: &str = "IN_COLLECTION";
/// Edge type for tag attachment (Item -> Tag).
pub const HAS_TAG_EDGE: &str = "HAS_TAG";
/// Edge type for item-to-item similarity (written by the F2 ingest pipeline).
pub const SIMILAR_TO_EDGE: &str = "SIMILAR_TO";
// Entity label + mention edge are owned by `ingest` (`ENTITY_LABEL` /
// `MENTIONS_ENTITY_EDGE`, value "MENTIONS_ENTITY"); the old store-local
// `MENTIONS`/`Entity` duplicates were dead and are removed so entity traversals
// are not split across two edge types (spec cleanup note).

/// Edge: a subtask points at its parent task (Task -> Task). Parent rollup is a
/// reverse traversal (Layer C).
pub const SUBTASK_OF_EDGE: &str = "SUBTASK_OF";
/// Edge: a task depends on another (Task -> Task), so "what blocks this" is a
/// forward traversal (Layer C).
pub const DEPENDS_ON_EDGE: &str = "DEPENDS_ON";
/// Edge: a task is about an item or entity it concerns (Task -> Item|Entity), so
/// "what is this task about" walks for free (Layer C, the load-bearing one).
pub const ABOUT_EDGE: &str = "ABOUT";
/// Edge: a delegated task points at the agent-run node working it (Task -> Run).
pub const WORKED_BY_EDGE: &str = "WORKED_BY";
/// Edge: a PM object is scoped to a project (Item|Collection -> Project).
pub const IN_PROJECT_EDGE: &str = "IN_PROJECT";
/// Edge: a work item has exactly one current workflow state (Task -> State).
pub const HAS_STATE_EDGE: &str = "HAS_STATE";
/// Edge: a work item belongs to a cycle (Task -> Cycle).
pub const IN_CYCLE_EDGE: &str = "IN_CYCLE";
/// Edge: a work item belongs to a module (Task -> Module).
pub const IN_MODULE_EDGE: &str = "IN_MODULE";
/// Edge: a work item advances a milestone (Task -> Milestone).
pub const TOWARD_MILESTONE_EDGE: &str = "TOWARD_MILESTONE";
/// Edge: a child item belongs to an epic (Task -> Epic).
pub const PART_OF_EPIC_EDGE: &str = "PART_OF_EPIC";
/// Edge: a work item blocks another work item (Task -> Task).
pub const BLOCKS_EDGE: &str = "BLOCKS";
/// Edge: a work item is a duplicate of another work item (Task -> Task).
pub const DUPLICATE_OF_EDGE: &str = "DUPLICATE_OF";
/// Edge: a work item is related to another work item without stronger semantics.
pub const RELATES_TO_EDGE: &str = "RELATES_TO";
/// Edge: a work item points at an external link item.
pub const LINKS_TO_EDGE: &str = "LINKS_TO";
/// Edge: a comment item annotates an item.
pub const COMMENT_ON_EDGE: &str = "COMMENT_ON";
/// Edge: a file item is attached to another item.
pub const ATTACHED_TO_EDGE: &str = "ATTACHED_TO";
/// Edge: a worklog item records time against a task.
pub const LOGGED_ON_EDGE: &str = "LOGGED_ON";
/// Edge: a member belongs to a project/workspace collection.
pub const MEMBER_OF_EDGE: &str = "MEMBER_OF";
/// Edge: a higher-level collection contains a project.
pub const CONTAINS_PROJECT_EDGE: &str = "CONTAINS_PROJECT";
/// Property holding a collection's label embedding (centroid / name embedding).
pub const LABEL_EMBEDDING_PROPERTY: &str = "label_embedding";
/// Property holding an item's or entity's embedding vector.
pub const EMBEDDING_PROPERTY: &str = "embedding";
/// Derived property holding `"{source}:{external_id}"` for exact-match lookup (A3).
pub const SOURCE_REF_KEY_PROPERTY: &str = "source_ref_key";
/// Item extra property containing the write-time Growth Stamp projection.
pub const GROWTH_STAMP_PROPERTY: &str = "growth_stamp";

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The CommonPlace store: a graph store for structure plus a blob store for
/// file bodies. Generic over both so it runs in-memory, on disk, or remotely.
pub struct Commonplace<S, B> {
    store: S,
    blobs: B,
}

impl<S, B> Commonplace<S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    /// Build a store over an existing graph store and blob store.
    pub fn new(store: S, blobs: B) -> Self {
        Self { store, blobs }
    }

    /// Borrow the underlying graph store (for graph algorithms / retrieval).
    pub fn store(&self) -> &S {
        &self.store
    }

    /// Mutably borrow the underlying graph store.
    pub fn store_mut(&mut self) -> &mut S {
        &mut self.store
    }

    /// Borrow the blob store.
    pub fn blobs(&self) -> &B {
        &self.blobs
    }

    /// Decompose into the two backing stores.
    pub fn into_parts(self) -> (S, B) {
        (self.store, self.blobs)
    }

    // ---- Items -------------------------------------------------------------

    /// Write an item (create or replace by id) and return the stored item with
    /// assigned id/timestamps and reconstructed collection membership.
    pub fn put_item(&mut self, mut item: Item) -> GraphStoreResult<Item> {
        let now = now_ms();
        if item.id.trim().is_empty() {
            item.id = new_id("item");
        }
        if item.created_at_ms == 0 {
            item.created_at_ms = now;
        }
        item.updated_at_ms = now;
        item.tags = dedup_nonempty(item.tags);
        let requested_collections = dedup_nonempty(std::mem::take(&mut item.collections));

        let record = NodeRecord::new(item.id.clone(), [ITEM_LABEL], item_props(&item)?);
        self.store.upsert_node(record)?;

        for tag in &item.tags {
            self.write_tag_projection(&item.id, tag)?;
        }
        for collection_id in &requested_collections {
            self.add_to_collection(&item.id, collection_id)?;
        }

        item.collections = self.read_member_collections(&item.id);
        if item.kind == ItemKind::Note {
            let stamp = self.build_growth_stamp(&item.id, now)?;
            item.extra.insert(
                GROWTH_STAMP_PROPERTY.to_string(),
                serde_json::to_value(stamp).map_err(serde_err)?,
            );
            self.store.upsert_node(NodeRecord::new(
                item.id.clone(),
                [ITEM_LABEL],
                item_props(&item)?,
            ))?;
        }
        Ok(item)
    }

    /// Write a `File` item: store the bytes in the blob store, then persist an
    /// item whose body is the resulting content-addressed blob reference.
    pub fn put_file(
        &mut self,
        title: impl Into<String>,
        bytes: &[u8],
        mime: Option<String>,
    ) -> GraphStoreResult<Item> {
        let content_hash = self.blobs.put(bytes)?;
        let item = Item::new(ItemKind::File, title).with_body(ItemBody::Blob {
            content_hash,
            byte_len: bytes.len() as u64,
            mime,
        });
        self.put_item(item)
    }

    /// Read an item by id, with its collection membership reconstructed from
    /// edges. Returns `Ok(None)` if the id is absent or not an item node.
    pub fn get_item(&self, id: &str) -> GraphStoreResult<Option<Item>> {
        let node = match self.store.get_node(id) {
            Some(node) if node.labels.iter().any(|label| label == ITEM_LABEL) => node.clone(),
            _ => return Ok(None),
        };
        self.hydrate_item(&node).map(Some)
    }

    /// Resolve a `File` item's bytes from the blob store. Returns `Ok(None)` for
    /// non-file items or a missing blob.
    pub fn read_blob(&self, item: &Item) -> GraphStoreResult<Option<Vec<u8>>> {
        match &item.body {
            ItemBody::Blob { content_hash, .. } => self.blobs.get(content_hash),
            _ => Ok(None),
        }
    }

    /// All items of a given kind.
    pub fn items_by_kind(&self, kind: &ItemKind) -> GraphStoreResult<Vec<Item>> {
        let nodes = self.store.query_nodes(
            NodeQuery::label(ITEM_LABEL)
                .with_property("kind", json!(kind.as_str()))
                .with_limit(usize::MAX),
        );
        nodes.iter().map(|node| self.hydrate_item(node)).collect()
    }

    /// Every item in the store.
    pub fn all_items(&self) -> GraphStoreResult<Vec<Item>> {
        let nodes = self
            .store
            .query_nodes(NodeQuery::label(ITEM_LABEL).with_limit(usize::MAX));
        nodes.iter().map(|node| self.hydrate_item(node)).collect()
    }

    /// The item that came from this exact source record, if one exists (A3). A
    /// single exact-match property filter on the derived `source_ref_key`, so a
    /// re-fetched record updates in place instead of minting a duplicate.
    pub fn item_by_source_ref(
        &self,
        source: &str,
        external_id: &str,
    ) -> GraphStoreResult<Option<Item>> {
        // Reuse SourceRef::key so the lookup key matches what put_item wrote.
        let key = crate::item::SourceRef::new(source, external_id).key();
        let nodes = self.store.query_nodes(
            NodeQuery::label(ITEM_LABEL)
                .with_property(SOURCE_REF_KEY_PROPERTY, json!(key))
                .with_limit(1),
        );
        match nodes.first() {
            Some(node) => self.hydrate_item(node).map(Some),
            None => Ok(None),
        }
    }

    // ---- Collections -------------------------------------------------------

    /// Find a collection by exact name, or `Ok(None)`. Used by source routing to
    /// resolve a rule's target collection (create-or-get).
    pub fn collection_by_name(&self, name: &str) -> GraphStoreResult<Option<Collection>> {
        for node in self
            .store
            .query_nodes(NodeQuery::label(COLLECTION_LABEL).with_limit(usize::MAX))
        {
            if prop_str(&node.properties, "name").as_deref() == Some(name) {
                return self.get_collection(&node.id);
            }
        }
        Ok(None)
    }

    /// Get a collection by name, creating it (as `kind`) if absent. Idempotent on
    /// name.
    pub fn get_or_create_collection(
        &mut self,
        name: &str,
        kind: CollectionKind,
    ) -> GraphStoreResult<Collection> {
        if let Some(existing) = self.collection_by_name(name)? {
            return Ok(existing);
        }
        self.create_collection(name, kind)
    }

    /// Create a new collection and return it with its assigned id.
    pub fn create_collection(
        &mut self,
        name: impl Into<String>,
        kind: CollectionKind,
    ) -> GraphStoreResult<Collection> {
        self.put_collection(Collection::new(name, kind))
    }

    /// Write a collection with metadata. Used by PM constructs where a
    /// collection has project identifiers, timeboxes, colors, or feature flags.
    pub fn put_collection(&mut self, mut collection: Collection) -> GraphStoreResult<Collection> {
        if collection.id.trim().is_empty() {
            collection.id = new_id("coll");
        }
        if collection.created_at_ms == 0 {
            collection.created_at_ms = now_ms();
        }
        let record = NodeRecord::new(
            collection.id.clone(),
            [COLLECTION_LABEL],
            collection_props(&collection)?,
        );
        self.store.upsert_node(record)?;
        Ok(collection)
    }

    /// Read a collection by id, or `Ok(None)` if absent / not a collection.
    pub fn get_collection(&self, id: &str) -> GraphStoreResult<Option<Collection>> {
        let node = match self.store.get_node(id) {
            Some(node) if node.labels.iter().any(|label| label == COLLECTION_LABEL) => node,
            _ => return Ok(None),
        };
        self.hydrate_collection(node).map(Some)
    }

    /// Add an item to a collection (idempotent).
    pub fn add_to_collection(
        &mut self,
        item_id: &str,
        collection_id: &str,
    ) -> GraphStoreResult<()> {
        let edge = EdgeRecord::new(
            format!("incol:{item_id}:{collection_id}"),
            item_id,
            IN_COLLECTION_EDGE,
            collection_id,
            json!({}),
        );
        self.store.upsert_edge(edge)?;
        self.refresh_growth_stamp_if_note(item_id, now_ms())?;
        Ok(())
    }

    /// Link two items as semantically similar. The F2 ingest pipeline writes
    /// these edges after embedding a new item; callers may also use it when
    /// importing known related material.
    pub fn add_similarity(
        &mut self,
        from_item_id: &str,
        to_item_id: &str,
        score: f32,
    ) -> GraphStoreResult<()> {
        let edge = EdgeRecord::new(
            format!("similar:{from_item_id}:{to_item_id}"),
            from_item_id,
            SIMILAR_TO_EDGE,
            to_item_id,
            json!({
                "score": score,
                "method": "commonplace_embedding_v1",
            }),
        )
        .with_confidence(score as f64);
        self.store.upsert_edge(edge)?;
        Ok(())
    }

    /// Write an explicit typed relationship that may appear in a note Stamp.
    pub fn link_explicit(
        &mut self,
        edge_type: &str,
        from_item_id: &str,
        to_item_id: &str,
        callout: impl Into<String>,
    ) -> GraphStoreResult<()> {
        self.upsert_link_with_props(
            edge_type,
            from_item_id,
            to_item_id,
            json!({ "callout": callout.into() }),
        )
    }

    /// All items that belong to a collection.
    pub fn collection_items(&self, collection_id: &str) -> GraphStoreResult<Vec<Item>> {
        let item_ids: Vec<String> = self
            .store
            .neighbors(NeighborQuery::in_(collection_id).with_edge_type(IN_COLLECTION_EDGE))
            .into_iter()
            .map(|hit| hit.node_id)
            .collect();
        let mut items = Vec::with_capacity(item_ids.len());
        for id in item_ids {
            if let Some(item) = self.get_item(&id)? {
                items.push(item);
            }
        }
        Ok(items)
    }

    /// All collections of a given kind.
    pub fn collections_by_kind(&self, kind: CollectionKind) -> GraphStoreResult<Vec<Collection>> {
        let nodes = self.store.query_nodes(
            NodeQuery::label(COLLECTION_LABEL)
                .with_property("kind", json!(kind.as_str()))
                .with_limit(usize::MAX),
        );
        nodes
            .iter()
            .map(|node| self.hydrate_collection(node))
            .collect()
    }

    // ---- Plane-parity PM primitives ---------------------------------------

    /// Create a first-class project collection. The identifier is the human
    /// work-item prefix (`CP`, `API`, `PROJ`) used to mint sequence ids.
    pub fn create_project(
        &mut self,
        name: impl Into<String>,
        identifier: impl Into<String>,
    ) -> GraphStoreResult<Collection> {
        let mut collection = Collection::new(name, CollectionKind::Project)
            .with_identifier(identifier)
            .with_feature_flag("states", true)
            .with_feature_flag("cycles", true)
            .with_feature_flag("modules", true)
            .with_feature_flag("worklogs", true);
        collection.sort_order = Some(now_ms());
        self.put_collection(collection)
    }

    /// All project collections.
    pub fn projects(&self) -> GraphStoreResult<Vec<Collection>> {
        self.collections_by_kind(CollectionKind::Project)
    }

    /// Create a workflow state scoped to a project.
    pub fn create_state(
        &mut self,
        project_id: &str,
        name: impl Into<String>,
        group: impl Into<String>,
        sort_order: i64,
    ) -> GraphStoreResult<Item> {
        let name = name.into();
        let group = group.into();
        let state = Item::new(ItemKind::State, name)
            .with_extra("group", json!(group))
            .with_extra("sort_order", json!(sort_order))
            .with_extra("project_id", json!(project_id));
        let state = self.put_item(state)?;
        self.upsert_link_with_props(
            IN_PROJECT_EDGE,
            &state.id,
            project_id,
            json!({ "scope": "workflow_state" }),
        )?;
        Ok(state)
    }

    /// Workflow states for a project, ordered by their declared sort order.
    pub fn project_states(&self, project_id: &str) -> GraphStoreResult<Vec<Item>> {
        let mut states: Vec<Item> = self
            .items_for(NeighborQuery::in_(project_id).with_edge_type(IN_PROJECT_EDGE))?
            .into_iter()
            .filter(|item| item.kind == ItemKind::State)
            .collect();
        states.sort_by_key(|item| extra_i64(item, "sort_order").unwrap_or(0));
        Ok(states)
    }

    /// Assign a task's current workflow state. The edge id is stable per task so
    /// a new assignment replaces the prior current-state target.
    pub fn set_task_state(&mut self, task_id: &str, state_id: &str) -> GraphStoreResult<()> {
        let state = self.get_item(state_id)?;
        if let Some(mut task) = self.get_item(task_id)? {
            task.status = state.as_ref().map(|state| state.title.clone());
            self.put_item(task)?;
        }
        let edge = EdgeRecord::new(
            format!("has_state:{task_id}"),
            task_id,
            HAS_STATE_EDGE,
            state_id,
            json!({}),
        );
        self.store.upsert_edge(edge)?;
        Ok(())
    }

    /// Current workflow state for a task, if assigned.
    pub fn task_state(&self, task_id: &str) -> GraphStoreResult<Option<Item>> {
        let hit = self
            .store
            .neighbors(NeighborQuery::out(task_id).with_edge_type(HAS_STATE_EDGE))
            .into_iter()
            .next();
        match hit {
            Some(hit) => self.get_item(&hit.node_id),
            None => Ok(None),
        }
    }

    /// Scope a work item to a project. This writes the PM-specific edge and the
    /// generic collection membership edge so legacy collection views continue
    /// to work.
    pub fn add_to_project(&mut self, item_id: &str, project_id: &str) -> GraphStoreResult<()> {
        self.add_to_collection(item_id, project_id)?;
        self.upsert_link(IN_PROJECT_EDGE, item_id, project_id)
    }

    /// Work items owned by a project.
    pub fn project_work_items(&self, project_id: &str) -> GraphStoreResult<Vec<Item>> {
        let mut items: Vec<Item> = self
            .items_for(NeighborQuery::in_(project_id).with_edge_type(IN_PROJECT_EDGE))?
            .into_iter()
            .filter(|item| matches!(item.kind, ItemKind::Task | ItemKind::Epic))
            .collect();
        items.sort_by_key(|item| std::cmp::Reverse(item.updated_at_ms));
        Ok(items)
    }

    /// Create a cycle scoped to a project.
    pub fn create_cycle(
        &mut self,
        project_id: &str,
        name: impl Into<String>,
        start_at_ms: i64,
        end_at_ms: i64,
    ) -> GraphStoreResult<Collection> {
        let cycle = self.put_collection(
            Collection::new(name, CollectionKind::Cycle).with_timebox(start_at_ms, end_at_ms),
        )?;
        self.upsert_link_with_props(
            IN_PROJECT_EDGE,
            &cycle.id,
            project_id,
            json!({ "scope": "cycle" }),
        )?;
        Ok(cycle)
    }

    /// Cycles scoped to a project.
    pub fn project_cycles(&self, project_id: &str) -> GraphStoreResult<Vec<Collection>> {
        self.collections_for(NeighborQuery::in_(project_id).with_edge_type(IN_PROJECT_EDGE))
            .map(|mut collections| {
                collections.retain(|collection| collection.kind == CollectionKind::Cycle);
                collections.sort_by_key(|collection| collection.start_at_ms.unwrap_or(0));
                collections
            })
    }

    /// Add a work item to a cycle.
    pub fn add_to_cycle(&mut self, item_id: &str, cycle_id: &str) -> GraphStoreResult<()> {
        self.add_to_collection(item_id, cycle_id)?;
        self.upsert_link(IN_CYCLE_EDGE, item_id, cycle_id)
    }

    /// Create a module scoped to a project.
    pub fn create_module(
        &mut self,
        project_id: &str,
        name: impl Into<String>,
    ) -> GraphStoreResult<Collection> {
        let module = self.put_collection(Collection::new(name, CollectionKind::Module))?;
        self.upsert_link_with_props(
            IN_PROJECT_EDGE,
            &module.id,
            project_id,
            json!({ "scope": "module" }),
        )?;
        Ok(module)
    }

    /// Modules scoped to a project.
    pub fn project_modules(&self, project_id: &str) -> GraphStoreResult<Vec<Collection>> {
        self.collections_for(NeighborQuery::in_(project_id).with_edge_type(IN_PROJECT_EDGE))
            .map(|mut collections| {
                collections.retain(|collection| collection.kind == CollectionKind::Module);
                collections.sort_by(|a, b| a.name.cmp(&b.name));
                collections
            })
    }

    /// Add a work item to a module.
    pub fn add_to_module(&mut self, item_id: &str, module_id: &str) -> GraphStoreResult<()> {
        self.add_to_collection(item_id, module_id)?;
        self.upsert_link(IN_MODULE_EDGE, item_id, module_id)
    }

    /// Add Plane-style relation semantics between work items.
    pub fn link_work_items(
        &mut self,
        from_item_id: &str,
        to_item_id: &str,
        relation: &str,
    ) -> GraphStoreResult<()> {
        let edge_type = match relation.trim().to_ascii_lowercase().as_str() {
            "blocks" | "blocked_by" | "blocked-by" => BLOCKS_EDGE,
            "duplicate" | "duplicate_of" | "duplicate-of" => DUPLICATE_OF_EDGE,
            "depends" | "depends_on" | "depends-on" => DEPENDS_ON_EDGE,
            _ => RELATES_TO_EDGE,
        };
        self.upsert_link(edge_type, from_item_id, to_item_id)
    }

    /// Attach an external URL to a work item as a graph-native `Link` item.
    pub fn link_work_item_url(
        &mut self,
        item_id: &str,
        title: impl Into<String>,
        url: impl Into<String>,
    ) -> GraphStoreResult<Item> {
        let url = url.into();
        let link = Item::new(ItemKind::Link, title).with_source(url.clone());
        let link = self.put_item(link)?;
        self.upsert_link_with_props(LINKS_TO_EDGE, item_id, &link.id, json!({ "url": url }))?;
        Ok(link)
    }

    /// Create an item comment.
    pub fn create_comment(
        &mut self,
        item_id: &str,
        author_id: Option<String>,
        body: impl Into<String>,
    ) -> GraphStoreResult<Item> {
        let body = body.into();
        let mut comment = Item::new(ItemKind::Comment, "Comment")
            .with_text(body)
            .with_extra("target_id", json!(item_id));
        if let Some(author_id) = author_id {
            comment = comment.with_extra("author_id", json!(author_id));
        }
        let comment = self.put_item(comment)?;
        self.upsert_link(COMMENT_ON_EDGE, &comment.id, item_id)?;
        Ok(comment)
    }

    /// Comments on an item, newest first.
    pub fn comments_for(&self, item_id: &str) -> GraphStoreResult<Vec<Item>> {
        let mut comments =
            self.items_for(NeighborQuery::in_(item_id).with_edge_type(COMMENT_ON_EDGE))?;
        comments.sort_by_key(|item| std::cmp::Reverse(item.created_at_ms));
        Ok(comments)
    }

    /// Create an annotation (SPEC-PREVIEW-COANNOTATION D4): a Comment item
    /// carrying an [`Anchor`](crate::annotation::Anchor) payload and author
    /// provenance, linked `COMMENT_ON` the target (a file item in dev mode, a
    /// page item in general). Builds on the same Comment/`COMMENT_ON` primitives
    /// as [`create_comment`](Self::create_comment); the anchor and author kind
    /// ride `extra`. Returns the comment item.
    pub fn create_annotation(
        &mut self,
        target_id: &str,
        author: Option<&str>,
        author_kind: crate::annotation::AuthorKind,
        body: impl Into<String>,
        anchor: &crate::annotation::Anchor,
    ) -> GraphStoreResult<Item> {
        let anchor_value = serde_json::to_value(anchor).unwrap_or(serde_json::Value::Null);
        let mut comment = Item::new(ItemKind::Comment, "Annotation")
            .with_text(body.into())
            .with_extra(crate::annotation::TARGET_ID_KEY, json!(target_id))
            .with_extra(
                crate::annotation::AUTHOR_KIND_KEY,
                json!(author_kind.as_str()),
            )
            .with_extra(crate::annotation::ANCHOR_KEY, anchor_value);
        if let Some(author) = author {
            comment = comment.with_extra(crate::annotation::AUTHOR_ID_KEY, json!(author));
        }
        let comment = self.put_item(comment)?;
        self.upsert_link(COMMENT_ON_EDGE, &comment.id, target_id)?;
        Ok(comment)
    }

    /// Reply to an annotation (or another reply): a Comment `COMMENT_ON` the
    /// parent comment. Replies carry no anchor (they inherit the annotation's);
    /// the thread is read via [`thread_for`](Self::thread_for).
    pub fn reply_to_annotation(
        &mut self,
        parent_comment_id: &str,
        author: Option<&str>,
        author_kind: crate::annotation::AuthorKind,
        body: impl Into<String>,
    ) -> GraphStoreResult<Item> {
        let mut reply = Item::new(ItemKind::Comment, "Reply")
            .with_text(body.into())
            .with_extra(crate::annotation::TARGET_ID_KEY, json!(parent_comment_id))
            .with_extra(
                crate::annotation::AUTHOR_KIND_KEY,
                json!(author_kind.as_str()),
            );
        if let Some(author) = author {
            reply = reply.with_extra(crate::annotation::AUTHOR_ID_KEY, json!(author));
        }
        let reply = self.put_item(reply)?;
        self.upsert_link(COMMENT_ON_EDGE, &reply.id, parent_comment_id)?;
        Ok(reply)
    }

    /// Mark an annotation resolved with a receipt (D6): the head resolved it
    /// in-thread, or a commit touched its anchored lines. `put_item` upserts by
    /// id, so this updates the existing comment. Returns the updated item, or
    /// `None` if the id is unknown.
    pub fn resolve_annotation(
        &mut self,
        comment_id: &str,
        resolved_by: &str,
        receipt: Option<&str>,
    ) -> GraphStoreResult<Option<Item>> {
        let Some(item) = self.get_item(comment_id)? else {
            return Ok(None);
        };
        let item = item
            .with_extra(crate::annotation::RESOLVED_KEY, json!(true))
            .with_extra(
                crate::annotation::RESOLUTION_KEY,
                json!({ "by": resolved_by, "receipt": receipt }),
            );
        Ok(Some(self.put_item(item)?))
    }

    /// The annotations on a target (projected to [`Annotation`](crate::annotation::Annotation)),
    /// newest first. These are the top-level annotations; each one's reply thread
    /// is read via [`thread_for`](Self::thread_for).
    pub fn annotations_for(
        &self,
        target_id: &str,
    ) -> GraphStoreResult<Vec<crate::annotation::Annotation>> {
        Ok(self
            .comments_for(target_id)?
            .iter()
            .filter_map(crate::annotation::annotation_from_item)
            .collect())
    }

    /// The reply thread under an annotation (projected), newest first.
    pub fn thread_for(
        &self,
        annotation_id: &str,
    ) -> GraphStoreResult<Vec<crate::annotation::Annotation>> {
        self.annotations_for(annotation_id)
    }

    /// Attach a file/blob item to another item.
    pub fn attach_item(&mut self, item_id: &str, file_item_id: &str) -> GraphStoreResult<()> {
        self.upsert_link(ATTACHED_TO_EDGE, file_item_id, item_id)
    }

    /// Create a worklog entry for a task.
    pub fn log_work(
        &mut self,
        task_id: &str,
        duration_ms: i64,
        logged_by: Option<String>,
        description: Option<String>,
    ) -> GraphStoreResult<Item> {
        let mut worklog = Item::new(ItemKind::Worklog, "Worklog")
            .with_extra("duration_ms", json!(duration_ms.max(0)))
            .with_extra("logged_at_ms", json!(now_ms()))
            .with_extra("task_id", json!(task_id));
        if let Some(logged_by) = logged_by {
            worklog = worklog.with_extra("logged_by", json!(logged_by));
        }
        if let Some(description) = description {
            worklog = worklog
                .with_text(description.clone())
                .with_extra("description", json!(description));
        }
        let worklog = self.put_item(worklog)?;
        self.upsert_link(LOGGED_ON_EDGE, &worklog.id, task_id)?;
        Ok(worklog)
    }

    /// Worklogs for a task, newest first.
    pub fn worklogs_for(&self, task_id: &str) -> GraphStoreResult<Vec<Item>> {
        let mut worklogs =
            self.items_for(NeighborQuery::in_(task_id).with_edge_type(LOGGED_ON_EDGE))?;
        worklogs.sort_by_key(|item| {
            std::cmp::Reverse(extra_i64(item, "logged_at_ms").unwrap_or(item.created_at_ms))
        });
        Ok(worklogs)
    }

    /// Total logged work for a task, in milliseconds.
    pub fn total_worklog_duration_ms(&self, task_id: &str) -> GraphStoreResult<i64> {
        Ok(self
            .worklogs_for(task_id)?
            .iter()
            .filter_map(|worklog| extra_i64(worklog, "duration_ms"))
            .sum())
    }

    /// Create a Plane-style sticky note.
    pub fn create_sticky(
        &mut self,
        owner_id: Option<String>,
        title: impl Into<String>,
        description: impl Into<String>,
        color: Option<String>,
        background_color: Option<String>,
        sort_order: Option<i64>,
    ) -> GraphStoreResult<Item> {
        let mut sticky = Item::sticky(title, description);
        if let Some(owner_id) = owner_id {
            sticky = sticky.with_extra("owner_id", json!(owner_id));
        }
        if let Some(color) = color {
            sticky = sticky.with_extra("color", json!(color));
        }
        if let Some(background_color) = background_color {
            sticky = sticky.with_extra("background_color", json!(background_color));
        }
        if let Some(sort_order) = sort_order {
            sticky = sticky.with_extra("sort_order", json!(sort_order));
        }
        self.put_item(sticky)
    }

    /// Scope an existing tag as a project label, carrying color on the scope
    /// edge so tag identity remains unified.
    pub fn scope_label_to_project(
        &mut self,
        project_id: &str,
        name: &str,
        color: Option<String>,
    ) -> GraphStoreResult<Tag> {
        let id = tag_id(name);
        let clean = name.trim().to_string();
        let record = NodeRecord::new(id.clone(), [TAG_LABEL], json!({ "name": clean }));
        self.store.upsert_node(record)?;
        self.upsert_link_with_props(
            IN_PROJECT_EDGE,
            &id,
            project_id,
            json!({ "scope": "label", "color": color }),
        )?;
        Ok(Tag { id, name: clean })
    }

    /// Project-scoped labels with their edge color, if any.
    pub fn project_labels(&self, project_id: &str) -> GraphStoreResult<Vec<(Tag, Option<String>)>> {
        let hits = self
            .store
            .neighbors(NeighborQuery::in_(project_id).with_edge_type(IN_PROJECT_EDGE));
        let mut labels = Vec::new();
        for hit in hits {
            let Some(node) = self.store.get_node(&hit.node_id) else {
                continue;
            };
            if !node.labels.iter().any(|label| label == TAG_LABEL) {
                continue;
            }
            let color = self
                .store
                .get_edge(&hit.edge_id)
                .and_then(|edge| edge.properties.get("color"))
                .and_then(Value::as_str)
                .map(str::to_string);
            labels.push((
                Tag {
                    id: node.id.clone(),
                    name: prop_str(&node.properties, "name").unwrap_or_default(),
                },
                color,
            ));
        }
        labels.sort_by(|a, b| a.0.name.cmp(&b.0.name));
        Ok(labels)
    }

    // ---- Tags --------------------------------------------------------------

    /// Attach a tag (create-or-get by stable slug) to an item.
    pub fn tag_item(&mut self, item_id: &str, name: &str) -> GraphStoreResult<Tag> {
        let tag = self.write_tag_projection(item_id, name)?;
        self.refresh_growth_stamp_if_note(item_id, now_ms())?;
        Ok(tag)
    }

    /// All tags attached to an item, as graph nodes.
    pub fn item_tags(&self, item_id: &str) -> GraphStoreResult<Vec<Tag>> {
        let tag_ids: Vec<String> = self
            .store
            .neighbors(NeighborQuery::out(item_id).with_edge_type(HAS_TAG_EDGE))
            .into_iter()
            .map(|hit| hit.node_id)
            .collect();
        let mut tags = Vec::with_capacity(tag_ids.len());
        for id in tag_ids {
            if let Some(node) = self.store.get_node(&id) {
                tags.push(Tag {
                    id: node.id.clone(),
                    name: prop_str(&node.properties, "name").unwrap_or_default(),
                });
            }
        }
        Ok(tags)
    }

    // ---- Tasks (Layer C) ---------------------------------------------------

    /// Mark `child` a subtask of `parent` (edge child -SUBTASK_OF-> parent).
    pub fn add_subtask(&mut self, parent_id: &str, child_id: &str) -> GraphStoreResult<()> {
        self.upsert_link(SUBTASK_OF_EDGE, child_id, parent_id)
    }

    /// Record that `task` depends on `depends_on` (edge task -DEPENDS_ON-> dep).
    pub fn add_dependency(&mut self, task_id: &str, depends_on_id: &str) -> GraphStoreResult<()> {
        self.upsert_link(DEPENDS_ON_EDGE, task_id, depends_on_id)
    }

    /// Link a task to an item or entity it concerns (edge task -ABOUT-> target).
    pub fn link_about(&mut self, task_id: &str, target_id: &str) -> GraphStoreResult<()> {
        self.upsert_link(ABOUT_EDGE, task_id, target_id)
    }

    /// Bind a delegated task to the agent-run node working it
    /// (edge task -WORKED_BY-> run).
    pub fn link_worked_by(&mut self, task_id: &str, run_id: &str) -> GraphStoreResult<()> {
        self.upsert_link(WORKED_BY_EDGE, task_id, run_id)
    }

    /// The subtasks of a parent task (reverse `SUBTASK_OF` traversal).
    pub fn subtasks(&self, parent_id: &str) -> GraphStoreResult<Vec<Item>> {
        self.items_for(NeighborQuery::in_(parent_id).with_edge_type(SUBTASK_OF_EDGE))
    }

    /// The tasks/items this task depends on (forward `DEPENDS_ON` traversal).
    pub fn task_dependencies(&self, task_id: &str) -> GraphStoreResult<Vec<Item>> {
        self.items_for(NeighborQuery::out(task_id).with_edge_type(DEPENDS_ON_EDGE))
    }

    /// The node ids a task is about (forward `ABOUT` traversal). Returns ids
    /// rather than items because an `ABOUT` target may be an `Entity`, not an
    /// `Item`.
    pub fn task_about(&self, task_id: &str) -> GraphStoreResult<Vec<String>> {
        Ok(self
            .store
            .neighbors(NeighborQuery::out(task_id).with_edge_type(ABOUT_EDGE))
            .into_iter()
            .map(|hit| hit.node_id)
            .collect())
    }

    /// Open tasks: `Task` items whose `status` is not a terminal one
    /// (done/closed/cancelled/complete). A missing status counts as open.
    pub fn open_tasks(&self) -> GraphStoreResult<Vec<Item>> {
        Ok(self
            .items_by_kind(&ItemKind::Task)?
            .into_iter()
            .filter(|item| !is_terminal_status(item.status.as_deref()))
            .collect())
    }

    /// Tasks whose `due_at_ms` falls in `[from_ms, to_ms]` (inclusive). The
    /// "due today" range query.
    pub fn tasks_due_between(&self, from_ms: i64, to_ms: i64) -> GraphStoreResult<Vec<Item>> {
        Ok(self
            .items_by_kind(&ItemKind::Task)?
            .into_iter()
            .filter(|item| matches!(item.due_at_ms, Some(due) if due >= from_ms && due <= to_ms))
            .collect())
    }

    /// Subtask progress rollup for a parent task: `(done, total)` over its
    /// `SUBTASK_OF` children.
    pub fn subtask_progress(&self, parent_id: &str) -> GraphStoreResult<(usize, usize)> {
        let children = self.subtasks(parent_id)?;
        let total = children.len();
        let done = children
            .iter()
            .filter(|child| is_terminal_status(child.status.as_deref()))
            .count();
        Ok((done, total))
    }

    // ---- internals ---------------------------------------------------------

    fn upsert_link(&mut self, edge_type: &str, from: &str, to: &str) -> GraphStoreResult<()> {
        self.upsert_link_with_props(edge_type, from, to, json!({}))
    }

    fn upsert_link_with_props(
        &mut self,
        edge_type: &str,
        from: &str,
        to: &str,
        properties: Value,
    ) -> GraphStoreResult<()> {
        let edge = EdgeRecord::new(
            format!("{}:{from}:{to}", edge_type.to_ascii_lowercase()),
            from,
            edge_type,
            to,
            properties,
        );
        self.store.upsert_edge(edge)?;
        if edge_type != SIMILAR_TO_EDGE {
            self.refresh_growth_stamp_if_note(from, now_ms())?;
            self.refresh_growth_stamp_if_note(to, now_ms())?;
        }
        Ok(())
    }

    /// Read the precomputed Growth Stamp stored with a note.
    pub fn growth_stamp(&self, note_id: &str) -> GraphStoreResult<Option<StampSnapshot>> {
        let Some(item) = self.get_item(note_id)? else {
            return Ok(None);
        };
        if item.kind != ItemKind::Note {
            return Ok(None);
        }
        item.extra
            .get(GROWTH_STAMP_PROPERTY)
            .cloned()
            .map(serde_json::from_value)
            .transpose()
            .map_err(serde_err)
    }

    fn refresh_growth_stamp_if_note(
        &mut self,
        item_id: &str,
        saved_at_ms: i64,
    ) -> GraphStoreResult<()> {
        let Some(mut item) = self.get_item(item_id)? else {
            return Ok(());
        };
        if item.kind != ItemKind::Note {
            return Ok(());
        }
        let stamp = self.build_growth_stamp(item_id, saved_at_ms)?;
        item.extra.insert(
            GROWTH_STAMP_PROPERTY.to_string(),
            serde_json::to_value(stamp).map_err(serde_err)?,
        );
        self.store.upsert_node(NodeRecord::new(
            item.id.clone(),
            [ITEM_LABEL],
            item_props(&item)?,
        ))?;
        Ok(())
    }

    fn build_growth_stamp(
        &self,
        note_id: &str,
        saved_at_ms: i64,
    ) -> GraphStoreResult<StampSnapshot> {
        let hits = self
            .store
            .neighbors(NeighborQuery::out(note_id))
            .into_iter()
            .chain(self.store.neighbors(NeighborQuery::in_(note_id)));
        let mut explicit_edges = Vec::new();
        for hit in hits {
            let Some(edge) = self.store.get_edge(&hit.edge_id) else {
                continue;
            };
            if edge.edge_type == SIMILAR_TO_EDGE {
                continue;
            }
            let other_id = if edge.from_id == note_id {
                &edge.to_id
            } else {
                &edge.from_id
            };
            let other_label = self
                .get_item(other_id)?
                .map(|item| item.title)
                .filter(|title| !title.trim().is_empty())
                .unwrap_or_else(|| other_id.clone());
            let callout = edge
                .properties
                .get("callout")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("{}: {other_label}", edge.edge_type));
            let edge_type_lower = edge.edge_type.to_ascii_lowercase();
            let class = if edge_type_lower.contains("support")
                || edge_type_lower.contains("contradict")
                || edge_type_lower.contains("refute")
                || edge_type_lower.contains("evidence")
            {
                ExplicitEdgeClass::Epistemic
            } else {
                ExplicitEdgeClass::Reference
            };
            explicit_edges.push(ExplicitEdge {
                edge_id: edge.id.clone(),
                from_id: edge.from_id.clone(),
                to_id: edge.to_id.clone(),
                edge_type: edge.edge_type.clone(),
                class,
                callout,
            });
        }
        Ok(build_stamp_snapshot(note_id, saved_at_ms, explicit_edges))
    }

    fn items_for(&self, query: NeighborQuery) -> GraphStoreResult<Vec<Item>> {
        let ids: Vec<String> = self
            .store
            .neighbors(query)
            .into_iter()
            .map(|hit| hit.node_id)
            .collect();
        let mut items = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(item) = self.get_item(&id)? {
                items.push(item);
            }
        }
        Ok(items)
    }

    fn collections_for(&self, query: NeighborQuery) -> GraphStoreResult<Vec<Collection>> {
        let ids: Vec<String> = self
            .store
            .neighbors(query)
            .into_iter()
            .map(|hit| hit.node_id)
            .collect();
        let mut collections = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(collection) = self.get_collection(&id)? {
                collections.push(collection);
            }
        }
        Ok(collections)
    }

    fn write_tag_projection(&mut self, item_id: &str, name: &str) -> GraphStoreResult<Tag> {
        let id = tag_id(name);
        let clean = name.trim().to_string();
        let record = NodeRecord::new(id.clone(), [TAG_LABEL], json!({ "name": clean }));
        self.store.upsert_node(record)?;
        let edge = EdgeRecord::new(
            format!("hastag:{item_id}:{id}"),
            item_id,
            HAS_TAG_EDGE,
            &id,
            json!({}),
        );
        self.store.upsert_edge(edge)?;
        Ok(Tag { id, name: clean })
    }

    pub(crate) fn read_member_collections(&self, item_id: &str) -> Vec<String> {
        self.store
            .neighbors(NeighborQuery::out(item_id).with_edge_type(IN_COLLECTION_EDGE))
            .into_iter()
            .map(|hit| hit.node_id)
            .collect()
    }

    pub(crate) fn hydrate_item(&self, node: &NodeRecord) -> GraphStoreResult<Item> {
        let mut props = node.properties.clone();
        if let Some(object) = props.as_object_mut() {
            object.insert("id".to_string(), json!(node.id));
            // collections are edge-canonical; never trust a stored copy.
            object.remove("collections");
        }
        let mut item: Item = serde_json::from_value(props).map_err(serde_err)?;
        item.id = node.id.clone();
        item.collections = self.read_member_collections(&node.id);
        Ok(item)
    }

    pub(crate) fn hydrate_collection(&self, node: &NodeRecord) -> GraphStoreResult<Collection> {
        let mut props = node.properties.clone();
        if let Some(object) = props.as_object_mut() {
            object.insert("id".to_string(), json!(node.id));
        }
        let mut collection: Collection = serde_json::from_value(props).map_err(serde_err)?;
        collection.id = node.id.clone();
        Ok(collection)
    }
}

fn item_props(item: &Item) -> GraphStoreResult<Value> {
    let mut value = serde_json::to_value(item).map_err(serde_err)?;
    if let Some(object) = value.as_object_mut() {
        object.remove("id"); // node.id is the single source of truth
        object.remove("collections"); // edge-canonical (IN_COLLECTION)
        if let Some(embedding) = item.extra.get(crate::ingest::ITEM_EMBEDDING_PROPERTY) {
            object.insert(
                crate::ingest::ITEM_EMBEDDING_PROPERTY.to_string(),
                embedding.clone(),
            );
        }
        // Derived single-string key for an O(1) exact-match source-ref lookup (A3).
        if let Some(key) = item.source_ref_key() {
            object.insert(SOURCE_REF_KEY_PROPERTY.to_string(), json!(key));
        }
    }
    Ok(value)
}

fn collection_props(collection: &Collection) -> GraphStoreResult<Value> {
    let mut value = serde_json::to_value(collection).map_err(serde_err)?;
    if let Some(object) = value.as_object_mut() {
        object.remove("id");
    }
    Ok(value)
}

fn extra_i64(item: &Item, key: &str) -> Option<i64> {
    item.extra.get(key).and_then(Value::as_i64)
}

fn prop_str(properties: &Value, key: &str) -> Option<String> {
    properties
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Whether a task `status` is terminal (the task is finished). A missing status
/// is treated as open. Case-insensitive over the common done/closed vocabulary.
fn is_terminal_status(status: Option<&str>) -> bool {
    match status {
        Some(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "done" | "closed" | "complete" | "completed" | "cancelled" | "canceled"
        ),
        None => false,
    }
}

fn dedup_nonempty(values: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    values
        .into_iter()
        .filter(|value| !value.trim().is_empty())
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

pub(crate) fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}:{nanos:x}-{counter:x}")
}

fn serde_err(error: serde_json::Error) -> GraphStoreError {
    GraphStoreError::new("commonplace_serde", error.to_string())
}
