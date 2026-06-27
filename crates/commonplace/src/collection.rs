//! Collections: named groupings of items (plan unit F1).
//!
//! A [`Collection`] is a first-class graph node (so it can enumerate its members
//! by reverse `IN_COLLECTION` traversal). It may be `Manual` (user-made) or
//! `Auto` (coined by the F2 ingest pipeline when a cluster forms).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// How a collection came to exist.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(into = "String", from = "String")]
pub enum CollectionKind {
    #[default]
    Manual,
    Auto,
    Project,
    Cycle,
    Module,
    Initiative,
    Teamspace,
}

impl CollectionKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            CollectionKind::Manual => "manual",
            CollectionKind::Auto => "auto",
            CollectionKind::Project => "project",
            CollectionKind::Cycle => "cycle",
            CollectionKind::Module => "module",
            CollectionKind::Initiative => "initiative",
            CollectionKind::Teamspace => "teamspace",
        }
    }
}

impl From<CollectionKind> for String {
    fn from(kind: CollectionKind) -> Self {
        kind.as_str().to_string()
    }
}

impl From<String> for CollectionKind {
    fn from(value: String) -> Self {
        match value.as_str() {
            "auto" => CollectionKind::Auto,
            "project" => CollectionKind::Project,
            "cycle" => CollectionKind::Cycle,
            "module" => CollectionKind::Module,
            "initiative" => CollectionKind::Initiative,
            "teamspace" => CollectionKind::Teamspace,
            _ => CollectionKind::Manual,
        }
    }
}

/// A named grouping of items.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Collection {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub kind: CollectionKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_at_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_at_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<i64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub feature_flags: BTreeMap<String, bool>,
    #[serde(default)]
    pub created_at_ms: i64,
}

impl Collection {
    pub fn new(name: impl Into<String>, kind: CollectionKind) -> Self {
        Self {
            id: String::new(),
            name: name.into(),
            kind,
            identifier: None,
            description: None,
            start_at_ms: None,
            end_at_ms: None,
            color: None,
            sort_order: None,
            feature_flags: BTreeMap::new(),
            created_at_ms: 0,
        }
    }

    pub fn with_identifier(mut self, identifier: impl Into<String>) -> Self {
        self.identifier = Some(identifier.into());
        self
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_timebox(mut self, start_at_ms: i64, end_at_ms: i64) -> Self {
        self.start_at_ms = Some(start_at_ms);
        self.end_at_ms = Some(end_at_ms);
        self
    }

    pub fn with_color(mut self, color: impl Into<String>) -> Self {
        self.color = Some(color.into());
        self
    }

    pub fn with_sort_order(mut self, sort_order: i64) -> Self {
        self.sort_order = Some(sort_order);
        self
    }

    pub fn with_feature_flag(mut self, key: impl Into<String>, enabled: bool) -> Self {
        self.feature_flags.insert(key.into(), enabled);
        self
    }
}
