//! Live navigation projection for `TheoremWeb`.
//!
//! The graph is the only durable authority. This crate decodes `navigation_list`
//! responses and constructs typed MCP calls for mutations; it deliberately has
//! no local-storage or file persistence path.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NavScope {
    User(String),
    Workspace,
}

/// Forward-compatible navigation discriminator.
///
/// The backend's current variants are exposed through accessors while the raw
/// object remains intact for variants introduced after this frontend build.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct NavKind(Value);

impl NavKind {
    #[must_use]
    pub fn folder(name: impl Into<String>) -> Self {
        Self(json!({"kind": "folder", "name": name.into()}))
    }

    #[must_use]
    pub fn link(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self(json!({"kind": "link", "name": name.into(), "url": url.into()}))
    }

    #[must_use]
    pub fn object(object_type_id: impl Into<String>, name: Option<String>) -> Self {
        Self(with_optional_name(
            "object",
            "object_type_id",
            object_type_id.into(),
            name,
        ))
    }

    #[must_use]
    pub fn view(view_id: impl Into<String>, name: Option<String>) -> Self {
        Self(with_optional_name("view", "view_id", view_id.into(), name))
    }

    #[must_use]
    pub fn record(
        object_type_id: impl Into<String>,
        record_id: impl Into<String>,
        name: Option<String>,
    ) -> Self {
        let mut object = Map::from_iter([
            ("kind".into(), Value::String("record".into())),
            (
                "object_type_id".into(),
                Value::String(object_type_id.into()),
            ),
            ("record_id".into(), Value::String(record_id.into())),
        ]);
        if let Some(name) = name {
            object.insert("name".into(), Value::String(name));
        }
        Self(Value::Object(object))
    }

    #[must_use]
    pub fn discriminator(&self) -> Option<&str> {
        self.0.get("kind").and_then(Value::as_str)
    }

    #[must_use]
    pub fn field(&self, name: &str) -> Option<&str> {
        self.0.get(name).and_then(Value::as_str)
    }

    #[must_use]
    pub fn label(&self) -> String {
        self.field("name")
            .or_else(|| self.field("object_type_id"))
            .or_else(|| self.field("view_id"))
            .or_else(|| self.field("record_id"))
            .or_else(|| self.discriminator())
            .unwrap_or("Navigation item")
            .to_owned()
    }

    #[must_use]
    pub const fn wire(&self) -> &Value {
        &self.0
    }
}

fn with_optional_name(kind: &str, id_key: &str, id: String, name: Option<String>) -> Value {
    let mut object = Map::from_iter([
        ("kind".into(), Value::String(kind.to_owned())),
        (id_key.into(), Value::String(id)),
    ]);
    if let Some(name) = name {
        object.insert("name".into(), Value::String(name));
    }
    Value::Object(object)
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct NavItem {
    pub nav_item_id: String,
    pub tenant: String,
    pub scope: NavScope,
    pub kind: NavKind,
    pub position: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derived_label: Option<String>,
}

impl NavItem {
    #[must_use]
    pub fn label(&self) -> String {
        self.derived_label
            .clone()
            .unwrap_or_else(|| self.kind.label())
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct NavigationListResponse {
    pub items: Vec<NavItem>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct McpCall {
    pub name: &'static str,
    pub arguments: Value,
}

impl McpCall {
    const fn new(name: &'static str, arguments: Value) -> Self {
        Self { name, arguments }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NavigationNode {
    pub item: NavItem,
    pub children: Vec<Self>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct NavigationState {
    items: Vec<NavItem>,
}

impl NavigationState {
    #[must_use]
    pub fn from_live(mut response: NavigationListResponse) -> Self {
        response.items.sort_by_key(|item| item.position);
        Self {
            items: response.items,
        }
    }

    #[must_use]
    pub fn items(&self) -> &[NavItem] {
        &self.items
    }

    #[must_use]
    pub fn tree(&self) -> Vec<NavigationNode> {
        let mut children_by_parent: BTreeMap<Option<&str>, Vec<&NavItem>> = BTreeMap::new();
        for item in &self.items {
            children_by_parent
                .entry(item.parent_id.as_deref())
                .or_default()
                .push(item);
        }
        project_children(None, &children_by_parent)
    }

    #[must_use]
    pub fn reload_call() -> McpCall {
        McpCall::new("navigation_list", json!({}))
    }

    #[must_use]
    pub fn reorder_call(ordered_ids: &[String]) -> McpCall {
        McpCall::new("navigation_reorder", json!({"ordered_ids": ordered_ids}))
    }

    #[must_use]
    pub fn create_folder_call(name: &str, position: i64, parent_id: Option<&str>) -> McpCall {
        create_call(
            &NavScope::Workspace,
            &NavKind::folder(name),
            position,
            parent_id,
        )
    }

    #[must_use]
    pub fn create_link_call(name: &str, url: &str, position: i64) -> McpCall {
        create_call(
            &NavScope::Workspace,
            &NavKind::link(name, url),
            position,
            None,
        )
    }

    #[must_use]
    pub fn pin_view_call(user_id: &str, view_id: &str, name: &str, position: i64) -> McpCall {
        create_call(
            &NavScope::User(user_id.to_owned()),
            &NavKind::view(view_id, Some(name.to_owned())),
            position,
            None,
        )
    }

    #[must_use]
    pub fn hide_call(nav_item_id: &str) -> McpCall {
        McpCall::new("navigation_delete", json!({"nav_item_id": nav_item_id}))
    }

    #[must_use]
    pub fn activate_call(item: &NavItem) -> Option<McpCall> {
        match item.kind.discriminator()? {
            "view" => Some(McpCall::new(
                "view_get",
                json!({"view_id": item.kind.field("view_id")?}),
            )),
            _ => None,
        }
    }
}

fn create_call(
    scope: &NavScope,
    kind: &NavKind,
    position: i64,
    parent_id: Option<&str>,
) -> McpCall {
    let mut arguments = json!({
        "scope": scope,
        "kind": kind,
        "position": position,
    });
    if let Some(parent_id) = parent_id {
        arguments["parent_id"] = Value::String(parent_id.to_owned());
    }
    McpCall::new("navigation_create", arguments)
}

fn project_children(
    parent: Option<&str>,
    children_by_parent: &BTreeMap<Option<&str>, Vec<&NavItem>>,
) -> Vec<NavigationNode> {
    children_by_parent
        .get(&parent)
        .into_iter()
        .flat_map(|items| items.iter())
        .map(|item| NavigationNode {
            item: (*item).clone(),
            children: project_children(Some(item.nav_item_id.as_str()), children_by_parent),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, kind: NavKind, position: i64, parent_id: Option<&str>) -> NavItem {
        NavItem {
            nav_item_id: id.into(),
            tenant: "tenant-a".into(),
            scope: NavScope::Workspace,
            kind,
            position,
            parent_id: parent_id.map(str::to_owned),
            derived_label: None,
        }
    }

    #[test]
    fn fresh_live_decode_retains_persisted_reorder() {
        let wire = json!({"items": [
            item("tasks", NavKind::object("task", None), 1, None),
            item("companies", NavKind::object("company", None), 0, None),
        ]});
        let response: NavigationListResponse = serde_json::from_value(wire).unwrap();
        let fresh = NavigationState::from_live(response);
        assert_eq!(fresh.items()[0].nav_item_id, "companies");
        assert_eq!(fresh.items()[1].nav_item_id, "tasks");
    }

    #[test]
    fn folder_projects_two_object_types_as_children() {
        let state = NavigationState::from_live(NavigationListResponse {
            items: vec![
                item("folder", NavKind::folder("CRM"), 0, None),
                item(
                    "companies",
                    NavKind::object("company", None),
                    1,
                    Some("folder"),
                ),
                item("people", NavKind::object("person", None), 2, Some("folder")),
            ],
        });
        let tree = state.tree();
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 2);
    }

    #[test]
    fn hiding_nav_item_does_not_mutate_declared_models() {
        let declared_models = vec!["company", "task"];
        let call = NavigationState::hide_call("nav-company");
        assert_eq!(call.name, "navigation_delete");
        assert_eq!(declared_models, vec!["company", "task"]);
    }

    #[test]
    fn user_favorite_resolves_saved_view_through_mcp() {
        let favorite = NavItem {
            scope: NavScope::User("alice".into()),
            ..item(
                "favorite",
                NavKind::view("view:qualified", Some("Qualified".into())),
                0,
                None,
            )
        };
        let call = NavigationState::activate_call(&favorite).unwrap();
        assert_eq!(call.name, "view_get");
        assert_eq!(call.arguments["view_id"], "view:qualified");
    }

    #[test]
    fn unknown_kind_round_trips_for_future_navigation_rows() {
        let wire = json!({"kind": "automation", "recipe_id": "r1"});
        let kind: NavKind = serde_json::from_value(wire.clone()).unwrap();
        assert_eq!(kind.discriminator(), Some("automation"));
        assert_eq!(serde_json::to_value(kind).unwrap(), wire);
    }
}
