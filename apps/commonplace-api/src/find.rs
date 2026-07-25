//! Universal Find over the consumer store (plan unit B7).
//!
//! The retrieval itself is not implemented here. `rustyred-thg-find` already
//! carries the composed executor (match, expand, admit) with lane attribution,
//! scope widening, graph-relation annotation, and MMR selection under a lambda.
//! This module is the adapter that hands that executor real CommonPlace data.
//!
//! ## Why a projection, and what it costs
//!
//! [`FindContext`] needs three things `Commonplace` does not hold: a
//! [`TrigramIndex`], a [`LexicalLane`] (BM25), and an edge list. It also needs
//! document text to live in a *flat* string property, because the exact lane
//! verifies byte offsets against `properties.body_text` (or one of its
//! fallbacks) and reads nothing else.
//!
//! CommonPlace item nodes do not carry such a property. An item's body is the
//! serde form of [`ItemBody`], so the text sits nested at
//! `properties.body.text` and every flat lookup misses it. The honest fix is
//! not to pretend the lane found something; it is to build the index the lane
//! needs.
//!
//! [`FindIndex::build`] therefore projects the live store once per request:
//! every node is copied verbatim (so relation annotation still reads the real
//! labels, embeddings, and neighbors), item nodes gain a flat
//! [`DEFAULT_TEXT_PROPERTY`] holding title + body + source, and every edge is
//! copied so the structural lane and the classifier see the real graph. The
//! trigram and BM25 indexes are built over the same text in the same pass.
//!
//! The projection is **maintained, not rebuilt**. [`FindIndexCache`] holds it
//! across requests and [`FindIndex::refresh`] brings it up to date through two
//! gates: the store's global version decides whether anything changed at all,
//! and each node's own version decides whether that node needs re-tokenizing.
//! Repeated queries between writes cost one integer compare. A write costs a
//! re-index of what the write touched, not of the corpus.
//!
//! The residual O(corpus) cost after a write is the snapshot clone and the
//! version scan: pointer walks and integer compares, not text processing. That
//! floor is `GraphStore`'s, not this module's, because there is no changefeed
//! and no version-filtered node query to ask instead. Closing it means emitting
//! changes from the store.
//!
//! Persisting a flat text property at write time remains a separate improvement
//! and belongs in `crates/commonplace`: it would remove the projection's need to
//! flatten item bodies at all.

use std::collections::{HashMap, HashSet};

use std::sync::Mutex;

use commonplace::{BlobStore, Commonplace, EmbeddingGraphStore, Item, ITEM_LABEL};
use rustyred_thg_core::fulltext::FullTextDesignation;
use rustyred_thg_core::index::TrigramIndex;
use rustyred_thg_core::{
    EdgeRecord, GraphStoreResult, InMemoryGraphStore, NodeQuery, NodeRecord,
};
use rustyred_thg_find::lanes::node_text;
use rustyred_thg_find::{
    find as run_find, FindContext, FindRequest, FindResponse, LexicalLane, DEFAULT_TEXT_PROPERTY,
};
use serde_json::json;

/// Tuning for the projection. The lane dials themselves live on
/// [`FindRequest`], which is the caller's contract.
#[derive(Clone, Debug)]
pub struct FindConfig {
    /// Cap on nodes pulled into the projection, so one enormous store cannot
    /// turn a single query into an unbounded copy.
    pub node_limit: usize,
}

impl Default for FindConfig {
    fn default() -> Self {
        Self { node_limit: 20_000 }
    }
}

/// The retrieval projection: a flat-text copy of the store plus the trigram and
/// BM25 indexes built over it.
///
/// The projection is maintained, not rebuilt. `indexed` records the graph
/// version each node was last indexed at, which is what makes
/// [`FindIndex::refresh`] able to touch only what moved.
pub struct FindIndex {
    store: InMemoryGraphStore,
    trigram: TrigramIndex,
    edges: Vec<EdgeRecord>,
    lexical: LexicalLane,
    /// Node id to the `NodeRecord.version` it was last indexed at.
    indexed: HashMap<String, u64>,
    /// Graph version this projection was last brought up to date with.
    /// `None` means nothing has been indexed yet.
    graph_version: Option<u64>,
}

/// What one [`FindIndex::refresh`] actually did. Returned so the cost is
/// observable rather than assumed, and asserted in tests.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct RefreshStats {
    /// Nodes whose version was compared. Zero when the global version gate
    /// short-circuited before taking a snapshot.
    pub scanned: usize,
    /// Nodes re-projected and re-indexed.
    pub reindexed: usize,
    /// Nodes dropped from the projection because they left the store.
    pub removed: usize,
}

impl RefreshStats {
    /// True when the projection was already current and no work was done.
    pub fn was_noop(&self) -> bool {
        self.scanned == 0 && self.reindexed == 0 && self.removed == 0
    }
}

impl Default for FindIndex {
    fn default() -> Self {
        Self::empty()
    }
}

impl FindIndex {
    /// An empty projection. Bring it up to date with [`FindIndex::refresh`].
    pub fn empty() -> Self {
        Self {
            store: InMemoryGraphStore::new(),
            trigram: TrigramIndex::new(),
            edges: Vec::new(),
            lexical: LexicalLane::new(FullTextDesignation {
                label: ITEM_LABEL.to_string(),
                property: DEFAULT_TEXT_PROPERTY.to_string(),
            }),
            indexed: HashMap::new(),
            graph_version: None,
        }
    }

    /// Project the live store into a searchable index, from cold.
    pub fn build<S, B>(cp: &Commonplace<S, B>, config: &FindConfig) -> GraphStoreResult<Self>
    where
        S: EmbeddingGraphStore,
        B: BlobStore,
    {
        let mut index = Self::empty();
        index.refresh(cp, config)?;
        Ok(index)
    }

    /// Bring the projection up to date with the store, touching only what moved.
    ///
    /// Two gates, coarse then fine:
    ///
    /// 1. The store's global version. If it has not moved, nothing in the graph
    ///    has changed and there is nothing to do, so this returns without even
    ///    taking a snapshot. Repeated queries between writes cost one integer
    ///    compare, which is the case a search box spends its life in.
    /// 2. Each node's own version. Only nodes whose version differs from the one
    ///    recorded in `indexed` are re-projected, re-tokenized, and re-indexed.
    ///    Tokenizing text is the expensive part and it is now proportional to the
    ///    write, not to the corpus.
    ///
    /// The residual O(corpus) work after a write is the snapshot clone and the
    /// version scan, both of which are pointer walks and integer compares. That
    /// floor exists because `GraphStore` has no changefeed and no
    /// version-filtered query; closing it means emitting changes from the store,
    /// not doing anything smarter here.
    ///
    /// ## What the global gate cannot see
    ///
    /// `evict_node`, `readmit_node`, `evict_edge`, and `readmit_edge` are
    /// **deliberately version-neutral**: they are the cold-tier parking path, and
    /// their contract is to move a record between tiers without making it look
    /// like an edit. A store that parks a subgraph therefore does not advance
    /// `stats().version`, and gate one will short-circuit past it.
    ///
    /// This is correct for the consumer API, which never parks: every mutation it
    /// makes goes through `upsert_node` or `upsert_edge`, and a delete is a
    /// tombstoned upsert, all of which bump the version. If the find projection
    /// is ever pointed at a store that uses the cold tier, this gate needs a
    /// second signal and the caller must not assume otherwise.
    pub fn refresh<S, B>(
        &mut self,
        cp: &Commonplace<S, B>,
        config: &FindConfig,
    ) -> GraphStoreResult<RefreshStats>
    where
        S: EmbeddingGraphStore,
        B: BlobStore,
    {
        let graph_version = cp.store().stats().version;
        if self.graph_version == Some(graph_version) {
            return Ok(RefreshStats::default());
        }

        let (nodes, edges) = match cp.store().graph_snapshot() {
            Ok(snapshot) => (snapshot.nodes, snapshot.edges),
            Err(_) => (
                cp.store().query_nodes(NodeQuery {
                    limit: Some(config.node_limit),
                    ..NodeQuery::default()
                }),
                Vec::new(),
            ),
        };

        let nodes: Vec<NodeRecord> = nodes.into_iter().take(config.node_limit).collect();
        let mut stats = RefreshStats {
            scanned: nodes.len(),
            ..RefreshStats::default()
        };

        // Which nodes actually moved. A tombstoned node counts as a removal.
        let live: HashSet<String> = nodes
            .iter()
            .filter(|node| !node.tombstone)
            .map(|node| node.id.clone())
            .collect();
        let changed: Vec<&NodeRecord> = nodes
            .iter()
            .filter(|node| !node.tombstone)
            .filter(|node| self.indexed.get(&node.id) != Some(&node.version))
            .collect();

        // Hydrating items is O(items), so it is paid only when something moved.
        let items: HashMap<String, Item> = if changed.is_empty() {
            HashMap::new()
        } else {
            cp.all_items()?
                .into_iter()
                .map(|item| (item.id.clone(), item))
                .collect()
        };

        for node in changed {
            let mut node = node.clone();
            if let Some(text) = projected_text(&node, items.get(&node.id)) {
                if let Some(properties) = node.properties.as_object_mut() {
                    properties.insert(DEFAULT_TEXT_PROPERTY.to_string(), json!(text));
                }
                // Both indexes replace on insert, so a re-index is an update.
                self.trigram.insert(node.id.clone(), &text);
                self.lexical.upsert(&node.id, &text);
            } else {
                // A node that lost its text must lose its postings too.
                self.trigram.remove(node.id.clone());
                self.lexical.remove(&node.id);
            }
            self.indexed.insert(node.id.clone(), node.version);
            self.store.upsert_node(node)?;
            stats.reindexed += 1;
        }

        // Nodes that left the store, or were tombstoned, leave the indexes.
        let departed: Vec<String> = self
            .indexed
            .keys()
            .filter(|id| !live.contains(*id))
            .cloned()
            .collect();
        for id in departed {
            self.trigram.remove(id.clone());
            self.lexical.remove(&id);
            self.indexed.remove(&id);
            self.store.evict_node(&id)?;
            stats.removed += 1;
        }

        // Edges carry no text, so they are taken wholesale: the cost is a record
        // clone, not tokenization, and the structural lane and the classifier
        // both need the current set.
        //
        // An edge whose endpoint left the store is dropped rather than carried.
        // The projected store enforces referential integrity, so re-upserting a
        // dangling edge is refused outright; and a classifier that walked one
        // would be citing evidence that no longer exists.
        let edges: Vec<EdgeRecord> = edges
            .into_iter()
            .filter(|edge| live.contains(&edge.from_id) && live.contains(&edge.to_id))
            .collect();
        for edge in &edges {
            self.store.upsert_edge(edge.clone())?;
        }
        self.edges = edges;
        self.graph_version = Some(graph_version);
        Ok(stats)
    }

    /// Everything the composed executor needs to reach the projected data.
    pub fn context(&self) -> FindContext<'_, InMemoryGraphStore> {
        FindContext::new(&self.store, &self.trigram, &self.edges).with_lexical(&self.lexical)
    }

    /// Documents carrying searchable text in this projection.
    pub fn document_count(&self) -> usize {
        self.lexical.document_count()
    }
}

/// Holds the projection across requests and keeps it current.
///
/// The projection is shared mutable state behind a `Mutex`, and the borrow that
/// [`FindIndex::context`] hands out cannot outlive the guard. So the cache lends
/// the index to a closure rather than returning it: the refresh and the query
/// happen inside one lock, and a caller cannot accidentally hold a stale
/// reference past the next write.
#[derive(Default)]
pub struct FindIndexCache {
    inner: Mutex<FindIndex>,
    last: Mutex<RefreshStats>,
}

impl FindIndexCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Refresh the projection, then run `f` against it.
    pub fn with<S, B, R>(
        &self,
        cp: &Commonplace<S, B>,
        config: &FindConfig,
        f: impl FnOnce(&FindIndex) -> R,
    ) -> GraphStoreResult<R>
    where
        S: EmbeddingGraphStore,
        B: BlobStore,
    {
        let mut index = match self.inner.lock() {
            Ok(guard) => guard,
            // A poisoned projection is a cache, not a corruption: carry on and
            // let the version gates bring it back into line.
            Err(poisoned) => poisoned.into_inner(),
        };
        let stats = index.refresh(cp, config)?;
        if let Ok(mut last) = self.last.lock() {
            *last = stats;
        }
        Ok(f(&index))
    }

    /// What the most recent refresh did. For tests and diagnostics.
    pub fn last_refresh(&self) -> RefreshStats {
        self.last
            .lock()
            .map(|stats| *stats)
            .unwrap_or_default()
    }
}

/// Run a composed find over the consumer store.
pub fn find<S, B>(
    cp: &Commonplace<S, B>,
    request: &FindRequest,
    config: &FindConfig,
) -> GraphStoreResult<FindResponse>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let index = FindIndex::build(cp, config)?;
    Ok(run_find(&index.context(), request))
}

/// The flat text a node contributes to the projection.
///
/// Items are authoritative when present: their body lives in a nested enum the
/// lanes cannot read, so the projection flattens title + body and appends the
/// source so a saved page is findable by its URL. Nodes that are not items
/// (crawl pages written by `saveUrl`, extracted entities) already carry flat
/// text under one of the names the lanes know, so they are read as-is.
fn projected_text(node: &NodeRecord, item: Option<&Item>) -> Option<String> {
    let text = match item {
        Some(item) => {
            let mut text = item.text_for_embedding();
            if let Some(source) = &item.source {
                text.push('\n');
                text.push_str(source);
            }
            text
        }
        None => node_text(node)?,
    };
    let trimmed = text.trim();
    (!trimmed.is_empty()).then(|| text.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use commonplace::{InMemoryBlobStore, IngestInput, IngestPipeline};
    use rustyred_thg_find::{FindScope, Lane};

    fn seeded() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        let mut cp = Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new());
        let pipeline = IngestPipeline::default();
        for (title, body) in [
            ("Rust ownership", "ownership and borrowing govern memory safety"),
            ("Rust borrowing", "borrowing rules keep memory safety honest"),
            ("Sourdough", "a levain needs twelve hours at room temperature"),
        ] {
            pipeline
                .ingest(&mut cp, IngestInput::note(title, body))
                .expect("ingest");
        }
        cp
    }

    #[test]
    fn a_query_between_writes_reindexes_nothing() {
        let cp = seeded();
        let cache = FindIndexCache::new();
        let config = FindConfig::default();

        cache.with(&cp, &config, |index| index.document_count()).expect("cold");
        let cold = cache.last_refresh();
        assert!(
            cold.reindexed >= 3,
            "cold build indexed {} nodes, fewer than the three seeded items",
            cold.reindexed
        );

        cache.with(&cp, &config, |index| index.document_count()).expect("warm");
        let warm = cache.last_refresh();
        assert!(
            warm.was_noop(),
            "a query with no intervening write did work: {warm:?}"
        );
        assert_eq!(
            warm.scanned, 0,
            "the global version gate should short-circuit before the snapshot"
        );
    }

    #[test]
    fn a_write_reindexes_only_what_it_touched() {
        let mut cp = seeded();
        let cache = FindIndexCache::new();
        let config = FindConfig::default();
        cache.with(&cp, &config, |index| index.document_count()).expect("cold");

        IngestPipeline::default()
            .ingest(&mut cp, IngestInput::note("Trigrams", "trigram indexes narrow the scan"))
            .expect("ingest");

        let count = cache
            .with(&cp, &config, |index| index.document_count())
            .expect("refresh");
        let stats = cache.last_refresh();
        assert_eq!(count, 4, "the new item is searchable");
        assert!(
            stats.reindexed <= 2,
            "one ingest re-indexed {} nodes; it should touch the new item and at \
             most one node the ingest also rewrote",
            stats.reindexed
        );
        assert!(
            stats.scanned >= 4,
            "the version scan should still see the whole corpus"
        );
    }

    #[test]
    fn a_tombstoned_node_leaves_the_indexes() {
        let mut cp = seeded();
        let cache = FindIndexCache::new();
        let config = FindConfig::default();
        cache.with(&cp, &config, |index| index.document_count()).expect("cold");

        // A delete is a tombstoned upsert, which bumps the graph version.
        // `evict_node` deliberately does not: it is cold-tier parking, and the
        // global gate cannot see it (see `FindIndex::refresh`).
        let victim = cp.all_items().expect("items")[0].id.clone();
        let mut record = cp
            .store()
            .get_node(&victim)
            .expect("victim node")
            .clone();
        record.tombstone = true;
        cp.store_mut().upsert_node(record).expect("tombstone");

        let count = cache
            .with(&cp, &config, |index| index.document_count())
            .expect("refresh");
        let stats = cache.last_refresh();
        assert_eq!(stats.removed, 1, "the tombstoned node was not dropped");
        assert_eq!(count, 2, "the tombstoned item is still searchable");
    }

    #[test]
    fn projection_flattens_item_body_into_searchable_text() {
        let cp = seeded();
        let index = FindIndex::build(&cp, &FindConfig::default()).expect("build");
        assert_eq!(index.document_count(), 3);
    }

    #[test]
    fn find_returns_lane_and_scope_attributed_hits() {
        let cp = seeded();
        let request = FindRequest::new("borrowing").with_k(10);
        let response = find(&cp, &request, &FindConfig::default()).expect("find");
        assert!(!response.results.is_empty(), "seeded corpus returns hits");
        for result in &response.results {
            assert!(Lane::ALL.contains(&result.hit.lane));
            assert_eq!(result.hit.scope.as_str(), "corpus");
        }
        assert_eq!(response.lanes.len(), 4, "every lane reports a budget");
    }

    #[test]
    fn page_scope_narrows_to_one_document() {
        let cp = seeded();
        let item = cp
            .all_items()
            .expect("items")
            .into_iter()
            .find(|item| item.title == "Rust borrowing")
            .expect("seeded item");
        let request = FindRequest::new("borrowing")
            .with_scopes(vec![FindScope::Page(item.id.clone())])
            .with_k(10);
        let response = find(&cp, &request, &FindConfig::default()).expect("find");
        assert!(response
            .results
            .iter()
            .all(|result| result.hit.doc == item.id));
    }
}
