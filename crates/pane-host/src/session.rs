//! B3 — the session graph.
//!
//! `Pane { id, created_at, closed_at }` and `Visit { pane, url_canon, title,
//! at }` nodes, with `NEXT` edges chaining a pane's visits in order.
//!
//! # Why this goes over HTTP and not through the store
//!
//! RedCore takes an exclusive lock on its data directory and
//! `commonplace-desktop-runtime` already holds it — it starts the node itself
//! on 127.0.0.1:17888. Two processes cannot open one data dir, so the pane host
//! and the plugin both talk to the node that is already running. This is a
//! constraint, not a preference.
//!
//! # Who writes what
//!
//! The chrome owns pane lifecycle (it mints the ids, it knows when a tab opens
//! and closes) and writes `Pane`. The host owns navigation (it is the only
//! thing that sees a load settle) and writes `Visit` + `NEXT`. Both sides link
//! this module so the node shapes cannot drift apart.
//!
//! A visit write is on the navigation path, so `record_visit` puts the `Visit`
//! and its `NEXT` edge in ONE `/v1/batch` request rather than two round trips.

use std::collections::BTreeMap;
use std::time::Duration;

use pane_protocol::PaneId;
use serde_json::{json, Value};

/// Where the already-running local node listens. Matches
/// `commonplace-desktop-runtime`'s `LOCAL_NODE_PORT`.
pub const DEFAULT_LOCAL_NODE: &str = "http://127.0.0.1:17888";

/// A graph write or read failed. Never fatal to navigation: a page still loads
/// when its visit could not be filed.
#[derive(Debug)]
pub enum SessionError {
    Transport(String),
    /// The node answered, but a command in the batch was refused.
    Command(String),
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::Transport(reason) => write!(formatter, "session graph unreachable: {reason}"),
            SessionError::Command(reason) => write!(formatter, "session graph refused a write: {reason}"),
        }
    }
}

impl std::error::Error for SessionError {}

/// The seam that lets everything below be tested without a running node.
pub trait GraphTransport {
    /// POST one `/v1/batch` body and return the parsed response.
    fn batch(&self, body: Value) -> Result<Value, SessionError>;
}

/// The real transport: blocking HTTP to the node the desktop runtime started.
pub struct LocalNode {
    client: reqwest::blocking::Client,
    endpoint: String,
    tenant: Option<String>,
    bearer: Option<String>,
}

impl LocalNode {
    /// Read the node's address, tenant, and bearer from the environment.
    ///
    /// Environment rather than arguments because the pane host is spawned as a
    /// sidecar: the plugin already has these values and passing them as env is
    /// the one channel that survives the supervisor restarting the process.
    pub fn from_env() -> Self {
        Self::new(
            std::env::var("THEOREM_LOCAL_NODE")
                .unwrap_or_else(|_| DEFAULT_LOCAL_NODE.to_string()),
            std::env::var("THEOREM_TENANT").ok(),
            std::env::var("THEOREM_HARNESS_TOKEN").ok(),
        )
    }

    pub fn new(endpoint: String, tenant: Option<String>, bearer: Option<String>) -> Self {
        Self {
            client: reqwest::blocking::Client::builder()
                // A slow graph must not stall the engine thread; the write is
                // dropped with a log instead.
                .timeout(Duration::from_secs(5))
                .build()
                .expect("blocking http client"),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            tenant,
            bearer,
        }
    }
}

impl GraphTransport for LocalNode {
    fn batch(&self, mut body: Value) -> Result<Value, SessionError> {
        if let Some(tenant) = &self.tenant {
            body["tenant_id"] = json!(tenant);
        }
        let mut request = self.client.post(format!("{}/v1/batch", self.endpoint)).json(&body);
        if let Some(bearer) = &self.bearer {
            request = request.bearer_auth(bearer);
        }
        let response = request
            .send()
            .map_err(|error| SessionError::Transport(error.to_string()))?;
        let status = response.status();
        let payload: Value = response
            .json()
            .map_err(|error| SessionError::Transport(error.to_string()))?;
        if !status.is_success() {
            return Err(SessionError::Command(format!("{status}: {payload}")));
        }
        Ok(payload)
    }
}

/// Per-pane bookkeeping the visit chain needs: which visit is currently the
/// tail, and what sequence number the next one gets.
#[derive(Clone, Debug, Default)]
struct Chain {
    next_seq: u64,
    tail: Option<String>,
}

/// A pane recovered from the graph after a restart.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RestoredPane {
    pub pane: PaneId,
    /// The id the chrome knows this pane by. Persisted so a restore does not
    /// depend on any in-memory map surviving.
    pub key: String,
    pub created_at: u64,
    pub url: String,
    pub title: String,
}

pub struct SessionGraph<T: GraphTransport> {
    transport: T,
    chains: BTreeMap<PaneId, Chain>,
}

impl<T: GraphTransport> SessionGraph<T> {
    pub fn new(transport: T) -> Self {
        Self {
            transport,
            chains: BTreeMap::new(),
        }
    }

    /// File a pane as open. Chrome-side.
    pub fn open_pane(&mut self, pane: PaneId, key: &str, created_at: u64) -> Result<(), SessionError> {
        self.commit(vec![pane_node(pane, key, created_at, None)])
    }

    /// Mark a pane closed, keeping the node and its visit chain intact.
    ///
    /// A node upsert replaces the record wholesale, so every property has to be
    /// re-sent — which is why `key` and `created_at` are arguments rather than
    /// something this type is expected to remember across a host restart.
    pub fn close_pane(
        &mut self,
        pane: PaneId,
        key: &str,
        created_at: u64,
        closed_at: u64,
    ) -> Result<(), SessionError> {
        self.chains.remove(&pane);
        self.commit(vec![pane_node(pane, key, created_at, Some(closed_at))])
    }

    /// Append a visit to a pane's chain. Host-side, on the navigation path.
    pub fn record_visit(
        &mut self,
        pane: PaneId,
        url_canon: &str,
        title: &str,
        at: u64,
    ) -> Result<(), SessionError> {
        let chain = match self.chains.get(&pane) {
            Some(chain) => chain.clone(),
            // First visit since this process started. The pane may still have a
            // chain in the graph from before a host restart, so pick up its tail
            // rather than starting a second chain at sequence zero.
            None => self.load_chain(pane)?,
        };

        let seq = chain.next_seq;
        let visit_id = visit_id(pane, seq);
        let mut commands = vec![json!({
            "command": "RUSTYRED_THG.GRAPH.NODE.UPSERT",
            "args": {
                "id": visit_id,
                "labels": ["Visit"],
                "properties": {
                    "pane": pane.0,
                    "seq": seq,
                    "url_canon": url_canon,
                    "title": title,
                    "at": at,
                }
            }
        })];
        if let Some(previous) = &chain.tail {
            commands.push(json!({
                "command": "RUSTYRED_THG.GRAPH.EDGE.UPSERT",
                "args": {
                    "id": format!("next:{}:{}", pane.0, seq),
                    "from_id": previous,
                    "to_id": visit_id,
                    "type": "NEXT",
                    "properties": { "pane": pane.0 }
                }
            }));
        }
        self.commit(commands)?;
        self.chains.insert(
            pane,
            Chain {
                next_seq: seq + 1,
                tail: Some(visit_id),
            },
        );
        Ok(())
    }

    /// Re-title the tail visit. A page reports its title after the load
    /// settles, so the visit is already filed by the time the title arrives.
    pub fn retitle_last_visit(
        &mut self,
        pane: PaneId,
        url_canon: &str,
        title: &str,
        at: u64,
    ) -> Result<(), SessionError> {
        let Some(chain) = self.chains.get(&pane) else {
            return Ok(());
        };
        let Some(tail) = chain.tail.clone() else {
            return Ok(());
        };
        let seq = chain.next_seq - 1;
        self.commit(vec![json!({
            "command": "RUSTYRED_THG.GRAPH.NODE.UPSERT",
            "args": {
                "id": tail,
                "labels": ["Visit"],
                "properties": {
                    "pane": pane.0,
                    "seq": seq,
                    "url_canon": url_canon,
                    "title": title,
                    "at": at,
                }
            }
        })])
    }

    /// Every pane that was open when the process last stopped, with the URL it
    /// was last on. This is what the supervisor re-creates panes from.
    pub fn open_panes(&mut self) -> Result<Vec<RestoredPane>, SessionError> {
        let response = self.transport.batch(json!({
            "commands": [{
                "command": "RUSTYRED_THG.GRAPH.NODES.QUERY",
                "args": { "label": "Pane" }
            }]
        }))?;
        let mut open = Vec::new();
        for node in nodes_of(&response, 0) {
            let properties = &node["properties"];
            if !properties["closed_at"].is_null() {
                continue;
            }
            let Some(pane) = properties["pane"].as_u64().map(PaneId) else {
                continue;
            };
            open.push((
                pane,
                properties["key"].as_str().unwrap_or_default().to_string(),
                properties["created_at"].as_u64().unwrap_or_default(),
            ));
        }
        if open.is_empty() {
            return Ok(Vec::new());
        }

        // One request for every open pane's visits: the panes had to be read
        // before their visits could be asked for, but the visit reads do not
        // depend on each other.
        let commands: Vec<Value> = open
            .iter()
            .map(|(pane, _, _)| {
                json!({
                    "command": "RUSTYRED_THG.GRAPH.NODES.QUERY",
                    "args": { "label": "Visit", "properties": { "pane": pane.0 } }
                })
            })
            .collect();
        let response = self.transport.batch(json!({ "commands": commands }))?;

        let mut restored = Vec::new();
        for (index, (pane, key, created_at)) in open.into_iter().enumerate() {
            let visits = nodes_of(&response, index);
            let chain = chain_from(&visits, pane);
            let last = visits
                .iter()
                .max_by_key(|node| node["properties"]["seq"].as_u64().unwrap_or_default());
            restored.push(RestoredPane {
                pane,
                key,
                created_at,
                url: last
                    .map(|node| node["properties"]["url_canon"].as_str().unwrap_or_default())
                    .unwrap_or_default()
                    .to_string(),
                title: last
                    .map(|node| node["properties"]["title"].as_str().unwrap_or_default())
                    .unwrap_or_default()
                    .to_string(),
            });
            self.chains.insert(pane, chain);
        }
        Ok(restored)
    }

    fn load_chain(&mut self, pane: PaneId) -> Result<Chain, SessionError> {
        let response = self.transport.batch(json!({
            "commands": [{
                "command": "RUSTYRED_THG.GRAPH.NODES.QUERY",
                "args": { "label": "Visit", "properties": { "pane": pane.0 } }
            }]
        }))?;
        Ok(chain_from(&nodes_of(&response, 0), pane))
    }

    fn commit(&self, commands: Vec<Value>) -> Result<(), SessionError> {
        let response = self.transport.batch(json!({ "commands": commands }))?;
        let results = response["results"].as_array().cloned().unwrap_or_default();
        for result in results {
            if result["ok"] != json!(true) {
                return Err(SessionError::Command(result.to_string()));
            }
        }
        Ok(())
    }
}

fn pane_node(pane: PaneId, key: &str, created_at: u64, closed_at: Option<u64>) -> Value {
    json!({
        "command": "RUSTYRED_THG.GRAPH.NODE.UPSERT",
        "args": {
            "id": format!("pane:{}", pane.0),
            "labels": ["Pane"],
            "properties": {
                "pane": pane.0,
                "key": key,
                "created_at": created_at,
                "closed_at": closed_at,
            }
        }
    })
}

fn visit_id(pane: PaneId, seq: u64) -> String {
    format!("visit:{}:{}", pane.0, seq)
}

fn chain_from(visits: &[Value], pane: PaneId) -> Chain {
    match visits
        .iter()
        .filter_map(|node| node["properties"]["seq"].as_u64())
        .max()
    {
        Some(highest) => Chain {
            next_seq: highest + 1,
            tail: Some(visit_id(pane, highest)),
        },
        None => Chain::default(),
    }
}

fn nodes_of(response: &Value, index: usize) -> Vec<Value> {
    response["results"][index]["nodes"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    /// An in-memory node good enough to answer the two commands this module
    /// sends. It records every request so a test can assert on the batching.
    #[derive(Default)]
    struct FakeNode {
        requests: RefCell<Vec<Value>>,
        nodes: RefCell<Vec<Value>>,
    }

    impl FakeNode {
        fn requests(&self) -> Vec<Value> {
            self.requests.borrow().clone()
        }

        fn commands(&self) -> Vec<String> {
            self.requests
                .borrow()
                .iter()
                .flat_map(|body| body["commands"].as_array().cloned().unwrap_or_default())
                .map(|item| item["command"].as_str().unwrap_or_default().to_string())
                .collect()
        }

        fn node(&self, id: &str) -> Option<Value> {
            self.nodes
                .borrow()
                .iter()
                .find(|node| node["id"] == json!(id))
                .cloned()
        }

        fn edges_only(&self) -> Vec<Value> {
            self.requests
                .borrow()
                .iter()
                .flat_map(|body| body["commands"].as_array().cloned().unwrap_or_default())
                .filter(|item| item["command"] == json!("RUSTYRED_THG.GRAPH.EDGE.UPSERT"))
                .map(|item| item["args"].clone())
                .collect()
        }
    }

    impl GraphTransport for &FakeNode {
        fn batch(&self, body: Value) -> Result<Value, SessionError> {
            self.requests.borrow_mut().push(body.clone());
            let mut results = Vec::new();
            for item in body["commands"].as_array().cloned().unwrap_or_default() {
                match item["command"].as_str().unwrap_or_default() {
                    "RUSTYRED_THG.GRAPH.NODE.UPSERT" => {
                        let args = &item["args"];
                        let record = json!({
                            "id": args["id"],
                            "labels": args["labels"],
                            "properties": args["properties"],
                        });
                        let mut nodes = self.nodes.borrow_mut();
                        match nodes.iter().position(|node| node["id"] == args["id"]) {
                            Some(at) => nodes[at] = record,
                            None => nodes.push(record),
                        }
                        results.push(json!({ "ok": true, "nodes": [] }));
                    }
                    "RUSTYRED_THG.GRAPH.EDGE.UPSERT" => {
                        results.push(json!({ "ok": true, "nodes": [] }))
                    }
                    "RUSTYRED_THG.GRAPH.NODES.QUERY" => {
                        let args = &item["args"];
                        let hits: Vec<Value> = self
                            .nodes
                            .borrow()
                            .iter()
                            .filter(|node| {
                                node["labels"]
                                    .as_array()
                                    .map(|labels| labels.contains(&args["label"]))
                                    .unwrap_or(false)
                                    && args["properties"]
                                        .as_object()
                                        .map(|wanted| {
                                            wanted.iter().all(|(key, value)| {
                                                node["properties"][key] == *value
                                            })
                                        })
                                        .unwrap_or(true)
                            })
                            .cloned()
                            .collect();
                        results.push(json!({ "ok": true, "nodes": hits }));
                    }
                    other => panic!("fake node got an unexpected command: {other}"),
                }
            }
            Ok(json!({ "ok": true, "results": results, "state_hash": "fake" }))
        }
    }

    #[test]
    fn three_navigations_yield_a_three_visit_chain_in_order() {
        let node = FakeNode::default();
        let mut graph = SessionGraph::new(&node);
        graph.open_pane(PaneId(1), "pane-1", 100).expect("pane filed");
        graph.record_visit(PaneId(1), "https://a.example/", "A", 101).expect("visit");
        graph.record_visit(PaneId(1), "https://b.example/", "B", 102).expect("visit");
        graph.record_visit(PaneId(1), "https://c.example/", "C", 103).expect("visit");

        for seq in 0..3 {
            let visit = node.node(&format!("visit:1:{seq}")).expect("visit filed");
            assert_eq!(visit["properties"]["pane"], json!(1));
            assert_eq!(visit["properties"]["seq"], json!(seq));
        }
        assert_eq!(
            node.node("visit:1:0").unwrap()["properties"]["url_canon"],
            json!("https://a.example/")
        );

        let edges = node.edges_only();
        assert_eq!(edges.len(), 2, "two NEXT edges chain three visits");
        assert_eq!(edges[0]["from_id"], json!("visit:1:0"));
        assert_eq!(edges[0]["to_id"], json!("visit:1:1"));
        assert_eq!(edges[0]["type"], json!("NEXT"));
        assert_eq!(edges[1]["from_id"], json!("visit:1:1"));
        assert_eq!(edges[1]["to_id"], json!("visit:1:2"));
    }

    #[test]
    fn a_visit_and_its_edge_travel_in_one_request() {
        let node = FakeNode::default();
        let mut graph = SessionGraph::new(&node);
        graph.record_visit(PaneId(4), "https://a.example/", "A", 1).expect("visit");
        let before = node.requests().len();
        graph.record_visit(PaneId(4), "https://b.example/", "B", 2).expect("visit");

        let requests = node.requests();
        assert_eq!(requests.len(), before + 1, "one round trip on the nav path");
        let commands = requests.last().unwrap()["commands"].as_array().unwrap().clone();
        assert_eq!(commands.len(), 2);
        assert_eq!(commands[0]["command"], json!("RUSTYRED_THG.GRAPH.NODE.UPSERT"));
        assert_eq!(commands[1]["command"], json!("RUSTYRED_THG.GRAPH.EDGE.UPSERT"));
    }

    #[test]
    fn closing_a_pane_sets_closed_at_and_preserves_the_chain() {
        let node = FakeNode::default();
        let mut graph = SessionGraph::new(&node);
        graph.open_pane(PaneId(2), "pane-2", 10).expect("pane filed");
        graph.record_visit(PaneId(2), "https://a.example/", "A", 11).expect("visit");
        graph.record_visit(PaneId(2), "https://b.example/", "B", 12).expect("visit");
        graph.close_pane(PaneId(2), "pane-2", 10, 99).expect("pane closed");

        let pane = node.node("pane:2").expect("pane still present");
        assert_eq!(pane["properties"]["closed_at"], json!(99));
        assert_eq!(pane["properties"]["created_at"], json!(10));
        assert!(node.node("visit:2:0").is_some());
        assert!(node.node("visit:2:1").is_some());
        assert_eq!(node.edges_only().len(), 1);
    }

    #[test]
    fn restart_restores_open_panes_with_their_last_url() {
        let node = FakeNode::default();
        {
            let mut graph = SessionGraph::new(&node);
            graph.open_pane(PaneId(1), "pane-1", 10).expect("open");
            graph.open_pane(PaneId(2), "pane-2", 11).expect("open");
            graph.record_visit(PaneId(1), "https://a.example/", "A", 12).expect("visit");
            graph.record_visit(PaneId(1), "https://last.example/", "Last", 13).expect("visit");
            graph.record_visit(PaneId(2), "https://other.example/", "Other", 14).expect("visit");
            graph.close_pane(PaneId(2), "pane-2", 11, 15).expect("close");
        }

        // A fresh SessionGraph, exactly as the supervisor would build after the
        // host died: no in-memory state at all.
        let mut restarted = SessionGraph::new(&node);
        let restored = restarted.open_panes().expect("restore");
        assert_eq!(
            restored,
            vec![RestoredPane {
                pane: PaneId(1),
                key: "pane-1".to_string(),
                created_at: 10,
                url: "https://last.example/".to_string(),
                title: "Last".to_string(),
            }]
        );
    }

    #[test]
    fn a_restarted_host_continues_the_chain_instead_of_forking_it() {
        let node = FakeNode::default();
        {
            let mut graph = SessionGraph::new(&node);
            graph.open_pane(PaneId(7), "pane-7", 1).expect("open");
            graph.record_visit(PaneId(7), "https://a.example/", "A", 2).expect("visit");
            graph.record_visit(PaneId(7), "https://b.example/", "B", 3).expect("visit");
        }

        let mut restarted = SessionGraph::new(&node);
        restarted
            .record_visit(PaneId(7), "https://c.example/", "C", 4)
            .expect("visit");

        assert!(node.node("visit:7:2").is_some(), "next sequence, not a re-used one");
        let edges = node.edges_only();
        assert_eq!(edges.last().unwrap()["from_id"], json!("visit:7:1"));
        assert_eq!(edges.last().unwrap()["to_id"], json!("visit:7:2"));
        assert!(
            node.commands()
                .contains(&"RUSTYRED_THG.GRAPH.NODES.QUERY".to_string()),
            "the tail is read back once, not guessed"
        );
    }

    #[test]
    fn a_refused_command_surfaces_rather_than_being_swallowed() {
        struct Refusing;
        impl GraphTransport for Refusing {
            fn batch(&self, _body: Value) -> Result<Value, SessionError> {
                Ok(json!({ "ok": true, "results": [{ "ok": false, "error": "nope" }] }))
            }
        }
        let mut graph = SessionGraph::new(Refusing);
        let error = graph.open_pane(PaneId(1), "pane-1", 0).expect_err("refused");
        assert!(matches!(error, SessionError::Command(_)));
    }

    #[test]
    fn retitling_rewrites_the_tail_visit_in_place() {
        let node = FakeNode::default();
        let mut graph = SessionGraph::new(&node);
        graph.record_visit(PaneId(3), "https://a.example/", "", 1).expect("visit");
        graph
            .retitle_last_visit(PaneId(3), "https://a.example/", "Arrived", 2)
            .expect("retitle");

        let visit = node.node("visit:3:0").expect("visit");
        assert_eq!(visit["properties"]["title"], json!("Arrived"));
        assert!(node.node("visit:3:1").is_none(), "a title is not a new visit");
    }
}
