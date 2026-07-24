//! `saveUrl`: fetch a page through RustyWeb, then file it through the ingest
//! pipeline. SPEC-COMMONPLACE-SEARCH-STACK B7, surfaced by F4.
//!
//! Save is ingest. The page is fetched and extracted by
//! [`web_consume_to_graph`], and the resulting item is filed, embedded,
//! classified, and linked by [`IngestPipeline`] exactly like any other capture.
//! That is what makes the acceptance criterion hold: after `saveUrl`, a `find`
//! at Corpus scope and the existing `briefing` query both return the page,
//! because it is a real `Item` in the same store and not a special case.
//!
//! ## Why the crawl graph lands in a scratch store first
//!
//! `web_consume_to_graph` is async and takes `&mut S: GraphStore`. The consumer
//! store lives behind a `std::sync::Mutex`, whose guard is not `Send`, so it
//! cannot be held across the fetch await. The fetch therefore writes into a
//! scratch [`InMemoryGraphStore`], and the resulting nodes and edges are merged
//! into the consumer store under a single short lock afterwards. Nothing is
//! discarded: the page node, its extracted facts, and the `CrawlReceipt` all
//! arrive in the same graph the find lanes read.

use commonplace::{
    BlobStore, Commonplace, EmbeddingGraphStore, IngestBody, IngestInput, IngestPipeline,
    Residency,
};
use rustyred_thg_core::{GraphStoreResult, InMemoryGraphStore};
use rustyred_web::browser_engine::{web_consume_to_graph, WebConsumeRequest};
use rustyred_web::fetch_cascade::{FetchCascade, FetchCascadeOptions};


/// Namespace crawl nodes are written under. Matches the RustyWeb default for
/// unverified open-web content.
const SAVE_NAMESPACE: &str = "open_web_unverified";
const SAVE_USER_AGENT: &str = "CommonPlace/0.1 save-url";
const SAVE_TIMEOUT_SECONDS: u64 = 20;
const SAVE_MAX_BYTES: usize = 5 * 1024 * 1024;

/// What `saveUrl` gives back. `collection_name` is the real name the ingest
/// pipeline chose, never a placeholder: the F4 confirmation renders it verbatim.
#[derive(Clone, Debug, PartialEq)]
pub struct SaveUrlReceipt {
    pub item_id: String,
    pub collection_id: String,
    pub collection_name: String,
    pub title: String,
    pub url: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SaveUrlError {
    pub code: String,
    pub message: String,
}

impl SaveUrlError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for SaveUrlError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for SaveUrlError {}

/// One fetched page, plus the graph the fetch produced.
pub struct FetchedPage {
    pub url: String,
    pub title: String,
    pub text: String,
    /// Crawl graph written by the fetch, to be merged into the consumer store.
    pub graph: Option<InMemoryGraphStore>,
}

/// Where a page comes from.
///
/// An enum rather than a trait because the live path is async and adding
/// `async-trait` to carry one method would be a dependency for nothing. Tests
/// use [`PageSource::fixture`], production uses [`PageSource::live`].
pub enum PageSource {
    Live(Box<FetchCascade>),
    Fixture(std::collections::BTreeMap<String, (String, String)>),
}

impl PageSource {
    /// Live fetch cascade with the RustyWeb defaults for a single-page save.
    pub fn live() -> Result<Self, SaveUrlError> {
        let cascade = FetchCascade::new(FetchCascadeOptions::http2_only(
            SAVE_USER_AGENT.to_string(),
            SAVE_TIMEOUT_SECONDS,
        ))
        .map_err(|error| SaveUrlError::new("fetch_cascade_unavailable", error.to_string()))?;
        Ok(Self::Live(Box::new(cascade)))
    }

    /// Offline source: url to (title, text). Used by the acceptance tests so
    /// they never reach the network.
    pub fn fixture<I, U, T, X>(pages: I) -> Self
    where
        I: IntoIterator<Item = (U, T, X)>,
        U: Into<String>,
        T: Into<String>,
        X: Into<String>,
    {
        Self::Fixture(
            pages
                .into_iter()
                .map(|(url, title, text)| (url.into(), (title.into(), text.into())))
                .collect(),
        )
    }

    async fn fetch(&self, url: &str, run_id: &str) -> Result<FetchedPage, SaveUrlError> {
        match self {
            Self::Live(cascade) => {
                let mut scratch = InMemoryGraphStore::default();
                let request = WebConsumeRequest {
                    run_id: run_id.to_string(),
                    url: url.to_string(),
                    actor_id: String::new(),
                    namespace: SAVE_NAMESPACE.to_string(),
                    max_bytes: SAVE_MAX_BYTES,
                    ingest: true,
                    respect_robots: true,
                };
                let receipt = web_consume_to_graph(&mut scratch, cascade, request)
                    .await
                    .map_err(|error| {
                        SaveUrlError::new("web_consume_failed", format!("{error:?}"))
                    })?;
                let title = if receipt.extract.title.trim().is_empty() {
                    title_from_url(&receipt.url)
                } else {
                    receipt.extract.title.clone()
                };
                Ok(FetchedPage {
                    url: receipt.url,
                    title,
                    text: receipt.extract.text,
                    graph: Some(scratch),
                })
            }
            Self::Fixture(pages) => {
                let (title, text) = pages.get(url).cloned().ok_or_else(|| {
                    SaveUrlError::new("page_not_found", format!("no fixture page for {url}"))
                })?;
                Ok(FetchedPage {
                    url: url.to_string(),
                    title,
                    text,
                    graph: None,
                })
            }
        }
    }
}

/// Last path segment of a url, humanized. Only used when the page carried no
/// title of its own.
fn title_from_url(url: &str) -> String {
    let trimmed = url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(url)
        .replace(['-', '_'], " ");
    if trimmed.trim().is_empty() {
        url.to_string()
    } else {
        trimmed
    }
}

/// Fetch `url` and file it. Returns the item id and the collection it landed in.
///
/// The fetch happens before the store is locked; the graph merge and the ingest
/// happen together under one lock, so a reader never sees a page node without
/// its item.
pub async fn save_url<S, B>(
    store: &crate::schema::SharedStore<S, B>,
    source: &PageSource,
    url: &str,
    run_id: &str,
) -> Result<SaveUrlReceipt, SaveUrlError>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let url = url.trim();
    if url.is_empty() {
        return Err(SaveUrlError::new("invalid_url", "saveUrl requires a url"));
    }
    let page = source.fetch(url, run_id).await?;

    let mut guard = store
        .lock()
        .map_err(|_| SaveUrlError::new("store_lock_poisoned", "store lock poisoned"))?;
    apply_page(&mut guard, page)
}

/// Merge the crawl graph and file the item. Synchronous, so it is the whole of
/// the locked section.
fn apply_page<S, B>(
    cp: &mut Commonplace<S, B>,
    page: FetchedPage,
) -> Result<SaveUrlReceipt, SaveUrlError>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    if let Some(graph) = page.graph {
        merge_graph(cp, &graph)
            .map_err(|error| SaveUrlError::new("graph_merge_failed", format!("{error:?}")))?;
    }
    let input = IngestInput {
        title: page.title.clone(),
        body: IngestBody::Link {
            url: page.url.clone(),
            text: page.text,
        },
        source: Some(page.url.clone()),
        source_ref: None,
        residency: Residency::default(),
        tags: Vec::new(),
        task: None,
        remind_at_ms: None,
        due_at_ms: None,
    };
    let receipt = IngestPipeline::default()
        .ingest(cp, input)
        .map_err(|error| SaveUrlError::new("ingest_failed", format!("{error:?}")))?;
    Ok(SaveUrlReceipt {
        item_id: receipt.item.id,
        collection_id: receipt.collection.id,
        collection_name: receipt.collection.name,
        title: page.title,
        url: page.url,
    })
}

/// Copy every live node and edge from the scratch crawl graph into the consumer
/// store, so page facts and the crawl receipt are readable by the find lanes.
fn merge_graph<S, B>(cp: &mut Commonplace<S, B>, graph: &InMemoryGraphStore) -> GraphStoreResult<()>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let snapshot = graph.graph_snapshot()?;
    let store = cp.store_mut();
    for node in snapshot.nodes.into_iter().filter(|node| !node.tombstone) {
        store.upsert_node(node)?;
    }
    for edge in snapshot.edges.into_iter().filter(|edge| !edge.tombstone) {
        store.upsert_edge(edge)?;
    }
    Ok(())
}
