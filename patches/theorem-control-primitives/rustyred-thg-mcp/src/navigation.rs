//! CP3. Navigation items as data, scoped to user or workspace.
//! Declaring an object type creates a workspace Object item; retiring removes it.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NavItemKind {
    Folder { name: String },
    Link { name: String, url: String },
    Object {
        object_type_id: String,
        name: Option<String>,
    },
    View {
        view_id: String,
        name: Option<String>,
    },
    Record {
        object_type_id: String,
        record_id: String,
        name: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NavScope {
    User(String),
    Workspace,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct NavItem {
    pub id: String,
    pub kind: NavItemKind,
    pub scope: NavScope,
    pub position: i64,
    pub parent_id: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum NavigationError {
    #[error("layout capability required for workspace scope")]
    LayoutCapabilityRequired,
    #[error("unknown navigation item: {0}")]
    NotFound(String),
    #[error("kind and target are immutable; delete and create instead")]
    ImmutableKind,
}

#[derive(Clone, Debug, Default)]
pub struct NavigationRegistry {
    items: Vec<NavItem>,
}

impl NavigationRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn list_for(
        &self,
        viewer_user_id: &str,
        include_workspace: bool,
    ) -> Vec<NavItem> {
        let mut out: Vec<_> = self
            .items
            .iter()
            .filter(|item| match &item.scope {
                NavScope::Workspace => include_workspace,
                NavScope::User(uid) => uid == viewer_user_id,
            })
            .cloned()
            .collect();
        out.sort_by_key(|item| item.position);
        out
    }

    pub fn insert(
        &mut self,
        item: NavItem,
        has_layout_capability: bool,
    ) -> Result<(), NavigationError> {
        if matches!(item.scope, NavScope::Workspace) && !has_layout_capability {
            return Err(NavigationError::LayoutCapabilityRequired);
        }
        self.items.retain(|existing| existing.id != item.id);
        self.items.push(item);
        Ok(())
    }

    pub fn update_position(
        &mut self,
        id: &str,
        position: i64,
        has_layout_capability: bool,
    ) -> Result<(), NavigationError> {
        let item = self
            .items
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| NavigationError::NotFound(id.to_string()))?;
        if matches!(item.scope, NavScope::Workspace) && !has_layout_capability {
            return Err(NavigationError::LayoutCapabilityRequired);
        }
        item.position = position;
        Ok(())
    }

    pub fn delete(
        &mut self,
        id: &str,
        has_layout_capability: bool,
    ) -> Result<(), NavigationError> {
        let Some(item) = self.items.iter().find(|item| item.id == id).cloned() else {
            return Err(NavigationError::NotFound(id.to_string()));
        };
        if matches!(item.scope, NavScope::Workspace) && !has_layout_capability {
            return Err(NavigationError::LayoutCapabilityRequired);
        }
        // Deleting a folder deletes its contents.
        let mut remove = vec![id.to_string()];
        let mut grew = true;
        while grew {
            grew = false;
            let children: Vec<_> = self
                .items
                .iter()
                .filter(|candidate| {
                    candidate
                        .parent_id
                        .as_ref()
                        .is_some_and(|parent| remove.iter().any(|id| id == parent))
                        && !remove.iter().any(|id| id == &candidate.id)
                })
                .map(|candidate| candidate.id.clone())
                .collect();
            if !children.is_empty() {
                grew = true;
                remove.extend(children);
            }
        }
        self.items.retain(|item| !remove.iter().any(|id| id == &item.id));
        Ok(())
    }

    /// Generation rule: schema_declare creates a workspace Object item.
    pub fn on_schema_declare(
        &mut self,
        object_type_id: &str,
        plural_label: &str,
        position: i64,
    ) -> Result<NavItem, NavigationError> {
        let item = NavItem {
            id: format!("nav.object.{object_type_id}"),
            kind: NavItemKind::Object {
                object_type_id: object_type_id.to_string(),
                name: Some(plural_label.to_string()),
            },
            scope: NavScope::Workspace,
            position,
            parent_id: None,
        };
        self.insert(item.clone(), true)?;
        Ok(item)
    }

    /// Generation rule: schema_retire retires the Object item.
    pub fn on_schema_retire(&mut self, object_type_id: &str) -> Result<(), NavigationError> {
        let id = format!("nav.object.{object_type_id}");
        self.delete(&id, true)
    }
}

/// Labels auto-derive unless `name` overrides.
pub fn derive_label(
    kind: &NavItemKind,
    type_plural: Option<&str>,
    view_name: Option<&str>,
    record_identifier: Option<&str>,
) -> String {
    match kind {
        NavItemKind::Folder { name } | NavItemKind::Link { name, .. } => name.clone(),
        NavItemKind::Object {
            object_type_id,
            name,
        } => name
            .clone()
            .or_else(|| type_plural.map(str::to_string))
            .unwrap_or_else(|| format!("{object_type_id}s")),
        NavItemKind::View { view_id, name } => name
            .clone()
            .or_else(|| view_name.map(str::to_string))
            .unwrap_or_else(|| view_id.clone()),
        NavItemKind::Record {
            record_id, name, ..
        } => name
            .clone()
            .or_else(|| record_identifier.map(str::to_string))
            .unwrap_or_else(|| record_id.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_declare_creates_workspace_object_item() {
        let mut registry = NavigationRegistry::new();
        registry
            .on_schema_declare("gclba_property", "Properties", 10)
            .unwrap();
        let items = registry.list_for("user-a", true);
        assert_eq!(items.len(), 1);
        assert!(matches!(
            items[0].kind,
            NavItemKind::Object {
                ref object_type_id,
                ..
            } if object_type_id == "gclba_property"
        ));
    }

    #[test]
    fn schema_retire_removes_item() {
        let mut registry = NavigationRegistry::new();
        registry.on_schema_declare("task", "Tasks", 1).unwrap();
        registry.on_schema_retire("task").unwrap();
        assert!(registry.list_for("u", true).is_empty());
    }

    #[test]
    fn user_scoped_item_invisible_to_other_member() {
        let mut registry = NavigationRegistry::new();
        registry
            .insert(
                NavItem {
                    id: "u1".into(),
                    kind: NavItemKind::Link {
                        name: "Mine".into(),
                        url: "/mine".into(),
                    },
                    scope: NavScope::User("alice".into()),
                    position: 0,
                    parent_id: None,
                },
                false,
            )
            .unwrap();
        assert_eq!(registry.list_for("alice", true).len(), 1);
        assert!(registry.list_for("bob", true).is_empty());
    }

    #[test]
    fn workspace_scope_requires_layout_capability() {
        let mut registry = NavigationRegistry::new();
        let err = registry.insert(
            NavItem {
                id: "w1".into(),
                kind: NavItemKind::Folder {
                    name: "Shared".into(),
                },
                scope: NavScope::Workspace,
                position: 0,
                parent_id: None,
            },
            false,
        );
        assert_eq!(err, Err(NavigationError::LayoutCapabilityRequired));
    }

    #[test]
    fn deleting_folder_deletes_contents() {
        let mut registry = NavigationRegistry::new();
        registry
            .insert(
                NavItem {
                    id: "folder".into(),
                    kind: NavItemKind::Folder {
                        name: "Folder".into(),
                    },
                    scope: NavScope::User("a".into()),
                    position: 0,
                    parent_id: None,
                },
                false,
            )
            .unwrap();
        registry
            .insert(
                NavItem {
                    id: "child".into(),
                    kind: NavItemKind::Link {
                        name: "Child".into(),
                        url: "/c".into(),
                    },
                    scope: NavScope::User("a".into()),
                    position: 1,
                    parent_id: Some("folder".into()),
                },
                false,
            )
            .unwrap();
        registry.delete("folder", false).unwrap();
        assert!(registry.list_for("a", true).is_empty());
    }

    #[test]
    fn reordering_persists_by_position() {
        let mut registry = NavigationRegistry::new();
        registry.on_schema_declare("a", "As", 2).unwrap();
        registry.on_schema_declare("b", "Bs", 1).unwrap();
        let items = registry.list_for("u", true);
        assert_eq!(
            items[0].id, "nav.object.b",
            "lower position sorts first"
        );
        registry.update_position("nav.object.a", 0, true).unwrap();
        let items = registry.list_for("u", true);
        assert_eq!(items[0].id, "nav.object.a");
    }
}
