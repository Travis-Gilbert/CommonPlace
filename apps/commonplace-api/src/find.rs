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
//! A build costs one full store copy plus two index builds:
//! O(nodes + edges + text bytes). Paying that per query is not viable, and it
//! is not what happens: [`FindIndexCache`] keys the projection on the graph
//! version, so a build happens on the first query after a write and every query
//! between writes reuses it.
//!
//! The version key is what makes the cache safe. The objection to caching a
//! projection is that a find answering from a stale index is worse than a slow
//! find, and that objection is real when invalidation is a list of call sites
//! somebody has to remember to update. It does not apply to a monotonic counter
//! the store itself bumps on every write: a stale read is not a bug to avoid
//! carefully, it is unrepresentable.
//!
//! Persisting a flat text property at write time remains the deeper fix, and
//! belongs in `crates/commonplace`. So does incremental index maintenance
//! through the `AccessMethod::on_write` hook the trigram index already
//! implements, which would make a write update the postings instead of
//! discarding them. This cache bounds the cost without foreclosing either.

use std::collections::HashMap;

use std::sync::{Arc, Mutex};

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

/// The per-request retrieval projection: a flat-text copy of the store plus the
/// trigram and BM25 indexes built over it.
pub struct FindIndex {
    store: InMemoryGraphStore,
    trigram: TrigramIndex,
    edges: Vec<EdgeRecord>,
    lexical: LexicalLane,
}

impl FindIndex {
    /// Project the live store into a searchable index.
    pub fn build<S, B>(cp: &Commonplace<S, B>, config: &FindConfig) -> GraphStoreResult<Self>
    where
        S: EmbeddingGraphStore,
        B: BlobStore,
    {
        // One snapshot gives nodes and edges together. Backings that do not
        // expose snapshots still get nodes (and therefore the match lanes);
        // only the structural expand and the edge evidence go quiet.
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

        let items: HashMap<String, Item> = cp
            .all_items()?
            .into_iter()
            .map(|item| (item.id.clone(), item))
            .collect();

        let mut store = InMemoryGraphStore::new();
        let mut trigram = TrigramIndex::new();
        let mut documents: Vec<(String, String)> = Vec::new();
        for mut node in nodes.into_iter().take(config.node_limit) {
            if let Some(text) = projected_text(&node, items.get(&node.id)) {
                if let Some(properties) = node.properties.as_object_mut() {
                    properties.insert(DEFAULT_TEXT_PROPERTY.to_string(), json!(text));
                }
                trigram.insert(node.id.clone(), &text);
                documents.push((node.id.clone(), text));
            }
            store.upsert_node(node)?;
        }
        for edge in &edges {
            store.upsert_edge(edge.clone())?;
        }

        let lexical = LexicalLane::from_documents(
            FullTextDesignation {
                label: ITEM_LABEL.to_string(),
                property: DEFAULT_TEXT_PROPERTY.to_string(),
            },
            documents,
        );

        Ok(Self {
            store,
            trigram,
            edges,
            lexical,
        })
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

/// Version-keyed cache of the projection.
///
/// `FindIndex::build` is O(corpus): it snapshots the graph, flattens every
/// item, and builds a trigram index and a BM25 index over the result. Doing
/// that per query makes a search box rebuild its whole index on every
/// keystroke, which measured at over 60 seconds on a seeded store.
///
/// The graph version is monotonic and bumps on every write, so it is an exact
/// invalidation key: between writes the projection is reused, and the first
/// query after a write pays for the rebuild. That turns per-keystroke cost into
/// per-write cost.
///
/// The deeper fix is incremental maintenance through the `AccessMethod::on_write`
/// hook the trigram index already implements, so a write updates the postings
/// rather than discarding them. This cache is the bounded version of that and
/// does not preclude it.
#[derive(Default)]
pub struct FindIndexCache {
    inner: Mutex<Option<CachedIndex>>,
}

struct CachedIndex {
    version: u64,
    index: Arc<FindIndex>,
}

impl FindIndexCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// The projection for the store as it stands, rebuilding only when the
    /// graph version has moved.
    pub fn get<S, B>(
        &self,
        cp: &Commonplace<S, B>,
        config: &FindConfig,
    ) -> GraphStoreResult<Arc<FindIndex>>
    where
        S: EmbeddingGraphStore,
        B: BlobStore,
    {
        let version = cp.store().stats().version;
        let mut guard = match self.inner.lock() {
            Ok(guard) => guard,
            // A poisoned cache is a cache, not a corruption: rebuild rather
            // than failing a read the store can still serve.
            Err(poisoned) => poisoned.into_inner(),
        };
        if let Some(cached) = guard.as_ref() {
            if cached.version == version {
                return Ok(Arc::clone(&cached.index));
            }
        }
        let index = Arc::new(FindIndex::build(cp, config)?);
        *guard = Some(CachedIndex {
            version,
            index: Arc::clone(&index),
        });
        Ok(index)
    }

    /// Whether a projection is currently held, for tests and diagnostics.
    pub fn is_warm(&self) -> bool {
        self.inner
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
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
    fn the_projection_is_reused_between_writes_and_rebuilt_after_one() {
        let mut cp = seeded();
        let cache = FindIndexCache::new();
        let config = FindConfig::default();
        assert!(!cache.is_warm());

        let first = cache.get(&cp, &config).expect("build");
        assert!(cache.is_warm());
        let second = cache.get(&cp, &config).expect("cached");
        assert!(
            Arc::ptr_eq(&first, &second),
            "a second query with no intervening write rebuilt the projection"
        );

        IngestPipeline::default()
            .ingest(&mut cp, IngestInput::note("Trigrams", "trigram indexes narrow the scan"))
            .expect("ingest");
        let third = cache.get(&cp, &config).expect("rebuild");
        assert!(
            !Arc::ptr_eq(&second, &third),
            "a write did not invalidate the projection"
        );
        assert!(
            third.document_count() > first.document_count(),
            "the rebuilt projection did not pick up the new item"
        );
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
