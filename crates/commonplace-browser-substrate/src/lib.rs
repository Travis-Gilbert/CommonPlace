//! Servo-free browser page capture seam for CommonPlace.
//!
//! Theorem keeps its harness-native browser. This crate ports the product-facing
//! seam into CommonPlace: a browser, clipper, desktop shell, or crawler can hand
//! over loaded pages and receive deterministic graph deltas plus receipts. The
//! RustyRed write adapter is intentionally outside this crate until the shared
//! RustyRed crates are published or vendored behind a stable package boundary.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

/// A browser-callable capability exposed by the CommonPlace browser seam.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrowserAffordance {
    pub id: &'static str,
    pub provider: &'static str,
    pub label: &'static str,
    pub detail: &'static str,
}

const BROWSER_AFFORDANCES: &[BrowserAffordance] = &[
    BrowserAffordance {
        id: "commonplace.browser.page_capture",
        provider: "commonplace",
        label: "Capture loaded pages",
        detail: "Accepts browser-loaded pages without binding CommonPlace to a browser engine.",
    },
    BrowserAffordance {
        id: "commonplace.browser.page_to_graph_delta",
        provider: "commonplace",
        label: "Turn loaded pages into graph deltas",
        detail: "Emits Page, Domain, ContentSnapshot, FetchAttempt, and LINKS_TO/HAS_SNAPSHOT/ON_DOMAIN edges.",
    },
    BrowserAffordance {
        id: "commonplace.browser.substrate_adapter_ready",
        provider: "rustyred",
        label: "Ready for RustyRed substrate writes",
        detail: "Produces deterministic deltas that a RustyRed adapter can persist through the product contract.",
    },
];

pub fn browser_affordances() -> &'static [BrowserAffordance] {
    BROWSER_AFFORDANCES
}

/// A page the browser has loaded, decoupled from any specific browser engine.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoadedPage {
    pub url: String,
    pub body: String,
    pub status: u16,
    pub content_type: String,
}

impl LoadedPage {
    pub fn new(
        url: impl Into<String>,
        body: impl Into<String>,
        status: u16,
        content_type: impl Into<String>,
    ) -> Self {
        Self {
            url: url.into(),
            body: body.into(),
            status,
            content_type: content_type.into(),
        }
    }

    pub fn html(url: impl Into<String>, body: impl Into<String>) -> Self {
        Self::new(url, body, 200, "text/html; charset=utf-8")
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageGraphNode {
    pub id: String,
    pub labels: Vec<String>,
    pub properties: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageGraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub edge_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageGraphDelta {
    pub run_id: String,
    pub seeds: Vec<String>,
    pub nodes: Vec<PageGraphNode>,
    pub edges: Vec<PageGraphEdge>,
    pub delta_hash: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrowserSessionReceipt {
    pub session_id: String,
    pub run_id: String,
    pub page_count: usize,
    pub total_page_count: usize,
    pub node_count: usize,
    pub edge_count: usize,
    pub graph_delta_hash: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrowserSearchHit {
    pub url: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrowserSearchResult {
    pub query: String,
    pub hits: Vec<BrowserSearchHit>,
}

#[derive(Debug, Eq, PartialEq)]
pub enum BrowserSubstrateError {
    EmptyUrl,
    EmptyRunId,
}

impl fmt::Display for BrowserSubstrateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyUrl => write!(f, "loaded page url is required"),
            Self::EmptyRunId => write!(f, "run id is required"),
        }
    }
}

impl std::error::Error for BrowserSubstrateError {}

pub fn loaded_pages_to_graph_delta(
    run_id: impl Into<String>,
    seeds: Vec<String>,
    pages: &[LoadedPage],
) -> Result<PageGraphDelta, BrowserSubstrateError> {
    let run_id = run_id.into();
    if run_id.trim().is_empty() {
        return Err(BrowserSubstrateError::EmptyRunId);
    }

    let mut nodes_by_id = BTreeMap::new();
    let mut edges_by_id = BTreeMap::new();

    for page in pages {
        let page_url = normalize_url(&page.url)?;
        let domain = domain_for_url(&page_url);
        let page_id = stable_id("page", &page_url);
        let domain_id = stable_id("domain", &domain);
        let snapshot_hash = stable_hash(&page.body);
        let snapshot_id = stable_id("snapshot", &format!("{page_url}:{snapshot_hash}"));
        let fetch_id = stable_id("fetch", &format!("{run_id}:{page_url}:{}", page.status));

        nodes_by_id.insert(page_id.clone(), page_node(&page_id, page, &page_url));
        nodes_by_id.insert(domain_id.clone(), domain_node(&domain_id, &domain));
        nodes_by_id.insert(
            snapshot_id.clone(),
            snapshot_node(&snapshot_id, page, &snapshot_hash),
        );
        nodes_by_id.insert(fetch_id.clone(), fetch_node(&fetch_id, page, &run_id));

        insert_edge(&mut edges_by_id, &page_id, "ON_DOMAIN", &domain_id);
        insert_edge(&mut edges_by_id, &page_id, "HAS_SNAPSHOT", &snapshot_id);
        insert_edge(&mut edges_by_id, &fetch_id, "FETCHED", &page_id);

        for href in extract_links(&page.body) {
            let target_url = resolve_link(&page_url, &href);
            let target_page_id = stable_id("page", &target_url);
            nodes_by_id
                .entry(target_page_id.clone())
                .or_insert_with(|| link_target_node(&target_page_id, &target_url));
            insert_edge(&mut edges_by_id, &page_id, "LINKS_TO", &target_page_id);
        }
    }

    let nodes: Vec<PageGraphNode> = nodes_by_id.into_values().collect();
    let edges: Vec<PageGraphEdge> = edges_by_id.into_values().collect();
    let delta_hash = delta_hash(&run_id, &seeds, &nodes, &edges);

    Ok(PageGraphDelta {
        run_id,
        seeds,
        nodes,
        edges,
        delta_hash,
    })
}

#[derive(Clone, Debug)]
pub struct BrowserSessionStore {
    session_id: String,
    ingested_pages: usize,
    run_sequence: usize,
    deltas: Vec<PageGraphDelta>,
}

impl BrowserSessionStore {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            ingested_pages: 0,
            run_sequence: 0,
            deltas: Vec::new(),
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn ingested_page_count(&self) -> usize {
        self.ingested_pages
    }

    pub fn deltas(&self) -> &[PageGraphDelta] {
        &self.deltas
    }

    pub fn ingest_loaded_page(
        &mut self,
        page: LoadedPage,
    ) -> Result<BrowserSessionReceipt, BrowserSubstrateError> {
        self.ingest_pages(std::slice::from_ref(&page))
    }

    pub fn ingest_pages(
        &mut self,
        pages: &[LoadedPage],
    ) -> Result<BrowserSessionReceipt, BrowserSubstrateError> {
        self.run_sequence += 1;
        let run_id = format!("{}-{}", self.session_id, self.run_sequence);
        let seeds = pages.iter().map(|page| page.url.clone()).collect();
        let delta = loaded_pages_to_graph_delta(run_id.clone(), seeds, pages)?;

        self.ingested_pages += pages.len();
        let receipt = BrowserSessionReceipt {
            session_id: self.session_id.clone(),
            run_id,
            page_count: pages.len(),
            total_page_count: self.ingested_pages,
            node_count: delta.nodes.len(),
            edge_count: delta.edges.len(),
            graph_delta_hash: delta.delta_hash.clone(),
        };
        self.deltas.push(delta);
        Ok(receipt)
    }

    pub fn search(&self, query: &str) -> BrowserSearchResult {
        let terms: Vec<String> = query
            .split_whitespace()
            .map(|term| term.to_ascii_lowercase())
            .filter(|term| !term.is_empty())
            .collect();
        let mut seen = BTreeSet::new();
        let mut hits = Vec::new();

        for delta in &self.deltas {
            for node in &delta.nodes {
                if !node.labels.iter().any(|label| label == "Page") {
                    continue;
                }
                let haystack = format!(
                    "{} {} {}",
                    node.properties
                        .get("url")
                        .map(String::as_str)
                        .unwrap_or_default(),
                    node.properties
                        .get("title")
                        .map(String::as_str)
                        .unwrap_or_default(),
                    node.properties
                        .get("body_preview")
                        .map(String::as_str)
                        .unwrap_or_default(),
                )
                .to_ascii_lowercase();
                if !terms.iter().all(|term| haystack.contains(term)) {
                    continue;
                }

                let url = node.properties.get("url").cloned().unwrap_or_default();
                if !seen.insert(url.clone()) {
                    continue;
                }
                hits.push(BrowserSearchHit {
                    url,
                    title: node
                        .properties
                        .get("title")
                        .cloned()
                        .unwrap_or_else(|| "Untitled page".to_string()),
                    snippet: node
                        .properties
                        .get("body_preview")
                        .cloned()
                        .unwrap_or_default(),
                });
            }
        }

        BrowserSearchResult {
            query: query.to_string(),
            hits,
        }
    }

    pub fn render_search_page(&self, query: &str) -> String {
        let result = self.search(query);
        let items = result
            .hits
            .iter()
            .map(|hit| {
                format!(
                    r#"<li><a href="{url}">{title}</a><p>{snippet}</p></li>"#,
                    url = escape_html(&hit.url),
                    title = escape_html(&hit.title),
                    snippet = escape_html(&hit.snippet),
                )
            })
            .collect::<Vec<_>>()
            .join("");
        format!(
            r#"<!doctype html><html><head><meta charset="utf-8"><title>CommonPlace browser search</title></head><body><h1>CommonPlace browser search</h1><ol>{items}</ol></body></html>"#
        )
    }
}

fn page_node(id: &str, page: &LoadedPage, url: &str) -> PageGraphNode {
    let mut properties = BTreeMap::new();
    properties.insert("url".to_string(), url.to_string());
    properties.insert("status".to_string(), page.status.to_string());
    properties.insert("content_type".to_string(), page.content_type.clone());
    properties.insert("title".to_string(), extract_title(&page.body));
    properties.insert("body_preview".to_string(), body_preview(&page.body));
    PageGraphNode {
        id: id.to_string(),
        labels: vec!["Page".to_string()],
        properties,
    }
}

fn domain_node(id: &str, domain: &str) -> PageGraphNode {
    let mut properties = BTreeMap::new();
    properties.insert("domain".to_string(), domain.to_string());
    PageGraphNode {
        id: id.to_string(),
        labels: vec!["Domain".to_string()],
        properties,
    }
}

fn snapshot_node(id: &str, page: &LoadedPage, hash: &str) -> PageGraphNode {
    let mut properties = BTreeMap::new();
    properties.insert("hash".to_string(), hash.to_string());
    properties.insert("content_type".to_string(), page.content_type.clone());
    properties.insert("byte_len".to_string(), page.body.len().to_string());
    PageGraphNode {
        id: id.to_string(),
        labels: vec!["ContentSnapshot".to_string()],
        properties,
    }
}

fn fetch_node(id: &str, page: &LoadedPage, run_id: &str) -> PageGraphNode {
    let mut properties = BTreeMap::new();
    properties.insert("run_id".to_string(), run_id.to_string());
    properties.insert("status".to_string(), page.status.to_string());
    properties.insert("url".to_string(), page.url.clone());
    PageGraphNode {
        id: id.to_string(),
        labels: vec!["FetchAttempt".to_string()],
        properties,
    }
}

fn link_target_node(id: &str, url: &str) -> PageGraphNode {
    let mut properties = BTreeMap::new();
    properties.insert("url".to_string(), url.to_string());
    properties.insert("title".to_string(), url.to_string());
    PageGraphNode {
        id: id.to_string(),
        labels: vec!["Page".to_string(), "LinkTarget".to_string()],
        properties,
    }
}

fn insert_edge(
    edges: &mut BTreeMap<String, PageGraphEdge>,
    source: &str,
    edge_type: &str,
    target: &str,
) {
    let id = stable_id("edge", &format!("{source}:{edge_type}:{target}"));
    edges.entry(id.clone()).or_insert_with(|| PageGraphEdge {
        id,
        source: source.to_string(),
        target: target.to_string(),
        edge_type: edge_type.to_string(),
    });
}

fn normalize_url(url: &str) -> Result<String, BrowserSubstrateError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(BrowserSubstrateError::EmptyUrl);
    }
    Ok(trimmed.to_string())
}

fn domain_for_url(url: &str) -> String {
    url.split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(url)
        .split('/')
        .next()
        .unwrap_or("unknown")
        .split('@')
        .last()
        .unwrap_or("unknown")
        .split(':')
        .next()
        .unwrap_or("unknown")
        .to_ascii_lowercase()
}

fn resolve_link(base_url: &str, href: &str) -> String {
    let href = href.trim();
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }
    if href.starts_with("//") {
        let scheme = base_url
            .split_once("://")
            .map(|(scheme, _)| scheme)
            .unwrap_or("https");
        return format!("{scheme}:{href}");
    }
    let origin = base_url
        .split_once("://")
        .map(|(scheme, rest)| {
            let host = rest.split('/').next().unwrap_or(rest);
            format!("{scheme}://{host}")
        })
        .unwrap_or_else(|| base_url.trim_end_matches('/').to_string());
    if href.starts_with('/') {
        format!("{origin}{href}")
    } else {
        let base_dir = base_url
            .rsplit_once('/')
            .map(|(prefix, _)| prefix)
            .unwrap_or(base_url)
            .trim_end_matches('/');
        format!("{base_dir}/{href}")
    }
}

fn extract_links(body: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut rest = body;
    while let Some(index) = rest.to_ascii_lowercase().find("href") {
        rest = &rest[index + 4..];
        let Some(eq_index) = rest.find('=') else {
            continue;
        };
        rest = rest[eq_index + 1..].trim_start();
        let Some(quote) = rest.chars().next().filter(|ch| *ch == '"' || *ch == '\'') else {
            continue;
        };
        rest = &rest[quote.len_utf8()..];
        let Some(end_index) = rest.find(quote) else {
            break;
        };
        let href = &rest[..end_index];
        if !href.trim().is_empty() && !href.starts_with('#') && !href.starts_with("javascript:") {
            links.push(href.to_string());
        }
        rest = &rest[end_index + quote.len_utf8()..];
    }
    links
}

fn extract_title(body: &str) -> String {
    let lower = body.to_ascii_lowercase();
    let Some(start) = lower.find("<title>") else {
        return "Untitled page".to_string();
    };
    let after = start + "<title>".len();
    let Some(end) = lower[after..].find("</title>") else {
        return "Untitled page".to_string();
    };
    collapse_ws(strip_tags(&body[after..after + end]))
}

fn body_preview(body: &str) -> String {
    let text = collapse_ws(strip_tags(body));
    if text.chars().count() <= 180 {
        text
    } else {
        format!("{}...", text.chars().take(177).collect::<String>())
    }
}

fn strip_tags(body: &str) -> String {
    let mut out = String::with_capacity(body.len());
    let mut in_tag = false;
    for ch in body.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

fn collapse_ws(value: String) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn stable_id(kind: &str, value: &str) -> String {
    format!("{kind}:{}", stable_hash(value))
}

fn stable_hash(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn delta_hash(
    run_id: &str,
    seeds: &[String],
    nodes: &[PageGraphNode],
    edges: &[PageGraphEdge],
) -> String {
    let mut material = String::new();
    material.push_str(run_id);
    for seed in seeds {
        material.push_str(seed);
    }
    for node in nodes {
        material.push_str(&node.id);
        for label in &node.labels {
            material.push_str(label);
        }
        for (key, value) in &node.properties {
            material.push_str(key);
            material.push_str(value);
        }
    }
    for edge in edges {
        material.push_str(&edge.id);
        material.push_str(&edge.source);
        material.push_str(&edge.target);
        material.push_str(&edge.edge_type);
    }
    stable_hash(&material)
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn affordances_keep_browser_and_rustyred_boundary_visible() {
        let ids: Vec<&str> = browser_affordances().iter().map(|item| item.id).collect();
        assert!(ids.contains(&"commonplace.browser.page_capture"));
        assert!(ids.contains(&"commonplace.browser.page_to_graph_delta"));
        assert!(ids.contains(&"commonplace.browser.substrate_adapter_ready"));
    }

    #[test]
    fn loaded_pages_emit_page_snapshot_domain_and_links() {
        let page = LoadedPage::html(
            "https://example.com/index.html",
            r#"<html><head><title>Example</title></head><body><a href="/about">About</a></body></html>"#,
        );

        let delta = loaded_pages_to_graph_delta(
            "run-1",
            vec!["https://example.com/index.html".to_string()],
            &[page],
        )
        .expect("delta");

        assert!(delta
            .nodes
            .iter()
            .any(|node| node.labels.contains(&"Page".to_string())));
        assert!(delta
            .nodes
            .iter()
            .any(|node| node.labels.contains(&"Domain".to_string())));
        assert!(delta
            .nodes
            .iter()
            .any(|node| node.labels.contains(&"ContentSnapshot".to_string())));
        assert!(delta.edges.iter().any(|edge| edge.edge_type == "LINKS_TO"));
        assert!(delta
            .edges
            .iter()
            .any(|edge| edge.edge_type == "HAS_SNAPSHOT"));
        assert_eq!(delta.delta_hash.len(), 16);
    }

    #[test]
    fn session_receipts_increment_and_search_reads_ingested_pages() {
        let mut session = BrowserSessionStore::new("browser-session");
        let first = session
            .ingest_loaded_page(LoadedPage::html(
                "https://example.com/index.html",
                "<title>Example One</title><p>CommonPlace browser substrate</p>",
            ))
            .expect("first ingest");
        let second = session
            .ingest_loaded_page(LoadedPage::html(
                "https://example.com/two.html",
                "<title>Example Two</title><p>Another page</p>",
            ))
            .expect("second ingest");

        assert_eq!(first.run_id, "browser-session-1");
        assert_eq!(second.run_id, "browser-session-2");
        assert_eq!(second.total_page_count, 2);

        let search = session.search("browser substrate");
        assert_eq!(search.hits.len(), 1);
        assert_eq!(search.hits[0].title, "Example One");

        let html = session.render_search_page("browser substrate");
        assert!(html.contains("CommonPlace browser search"));
        assert!(html.contains("Example One"));
    }
}
