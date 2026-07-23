//! Session graph: panes/tabs and visit chains.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TabId(pub Uuid);

impl TabId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for TabId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Visit {
    pub url_canon: String,
    pub title: String,
    pub at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TabNode {
    id: TabId,
    created_at_ms: u64,
    closed_at_ms: Option<u64>,
    visits: Vec<Visit>,
    cursor: usize,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SessionGraph {
    tabs: HashMap<Uuid, TabNode>,
    open_order: Vec<Uuid>,
}

impl SessionGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_tab(&mut self, created_at_ms: u64) -> TabId {
        let id = TabId::new();
        self.tabs.insert(
            id.0,
            TabNode {
                id,
                created_at_ms,
                closed_at_ms: None,
                visits: Vec::new(),
                cursor: 0,
            },
        );
        self.open_order.push(id.0);
        id
    }

    pub fn navigate(&mut self, tab: TabId, url_canon: String, title: String, at_ms: u64) {
        let Some(node) = self.tabs.get_mut(&tab.0) else {
            return;
        };
        if node.closed_at_ms.is_some() {
            return;
        }
        if node.cursor + 1 < node.visits.len() {
            node.visits.truncate(node.cursor + 1);
        }
        node.visits.push(Visit {
            url_canon,
            title,
            at_ms,
        });
        node.cursor = node.visits.len().saturating_sub(1);
    }

    pub fn back(&mut self, tab: TabId) -> Option<&Visit> {
        let node = self.tabs.get_mut(&tab.0)?;
        if node.cursor == 0 {
            return node.visits.get(0);
        }
        node.cursor -= 1;
        node.visits.get(node.cursor)
    }

    pub fn forward(&mut self, tab: TabId) -> Option<&Visit> {
        let node = self.tabs.get_mut(&tab.0)?;
        if node.cursor + 1 >= node.visits.len() {
            return node.visits.get(node.cursor);
        }
        node.cursor += 1;
        node.visits.get(node.cursor)
    }

    pub fn close_tab(&mut self, tab: TabId, closed_at_ms: u64) {
        if let Some(node) = self.tabs.get_mut(&tab.0) {
            node.closed_at_ms = Some(closed_at_ms);
        }
        self.open_order.retain(|id| *id != tab.0);
    }

    pub fn visit_chain(&self, tab: TabId) -> Vec<Visit> {
        self.tabs
            .get(&tab.0)
            .map(|n| n.visits.clone())
            .unwrap_or_default()
    }

    pub fn open_tabs(&self) -> Vec<TabId> {
        self.open_order
            .iter()
            .filter_map(|id| self.tabs.get(id).map(|n| n.id))
            .collect()
    }

    pub fn restore_open(&self) -> Vec<(TabId, Option<Visit>)> {
        self.open_tabs()
            .into_iter()
            .map(|id| {
                let last = self
                    .tabs
                    .get(&id.0)
                    .and_then(|n| n.visits.get(n.cursor).cloned());
                (id, last)
            })
            .collect()
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    pub fn from_json(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }
}
