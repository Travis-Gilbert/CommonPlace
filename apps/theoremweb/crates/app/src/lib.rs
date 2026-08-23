//! The registry-driven `TheoremWeb` shell.
//!
//! `SurfaceSpec` rows and scope bindings travel together through intent
//! resolution and history. The shell has no route match-arm table: a new graph
//! row is mountable as soon as its renderer contract is understood.

mod contracts;
mod ide;

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use theoremweb_navigation::{McpCall as NavigationCall, NavItem, NavigationState};
use theoremweb_record_table::ViewMetadata;

pub use contracts::{
    RecordRef, Renderer, ScopeBinding, ScopeContext, SurfaceListResponse, SurfaceSpec,
};
pub use ide::{
    code_server_surface, degrade_to_fallback, IdeDegradation, IdeError, IdeSurface,
    IdeSurfaceState, ServoIdePreferences, CODE_SERVER_SURFACE_ID,
};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SurfaceMount {
    pub surface: SurfaceSpec,
    pub binding: ScopeBinding,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IntentError {
    Empty,
    InvalidRecord,
    MissingBody(String),
    Unknown(String),
}

impl std::fmt::Display for IntentError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Empty => formatter.write_str("intent is empty"),
            Self::InvalidRecord => {
                formatter.write_str("record intent must be record:<object-type>:<record-id>")
            }
            Self::MissingBody(body) => write!(formatter, "no registered surface renders {body}"),
            Self::Unknown(intent) => write!(formatter, "no surface matches {intent:?}"),
        }
    }
}

impl std::error::Error for IntentError {}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct SurfaceCatalog {
    surfaces: Vec<SurfaceSpec>,
}

impl SurfaceCatalog {
    #[must_use]
    pub fn from_live(response: SurfaceListResponse) -> Self {
        Self {
            surfaces: response.surfaces,
        }
    }

    #[must_use]
    pub fn surfaces(&self) -> &[SurfaceSpec] {
        &self.surfaces
    }

    /// Compose an omnibox intent into the inseparable surface/scope pair.
    ///
    /// Body kinds are contract data, so this does not encode surface IDs or
    /// application routes. A tenant may rename or replace any surface row.
    ///
    /// # Errors
    ///
    /// Returns an intent error when the input is empty or malformed, or when
    /// no live registry row can satisfy the requested surface/body contract.
    pub fn resolve(&self, raw: &str) -> Result<SurfaceMount, IntentError> {
        let intent = raw.trim();
        if intent.is_empty() {
            return Err(IntentError::Empty);
        }
        if let Some(rest) = intent.strip_prefix("record:") {
            let (object_type, record_id) = rest
                .split_once(':')
                .filter(|(object_type, record_id)| !object_type.is_empty() && !record_id.is_empty())
                .ok_or(IntentError::InvalidRecord)?;
            return self.mount_body(
                "record_table",
                ScopeBinding::Record {
                    object_type: object_type.to_owned(),
                    record_id: record_id.to_owned(),
                },
            );
        }
        if is_question(intent) {
            return self.mount_body("thread", ScopeBinding::Workspace);
        }
        self.surfaces
            .iter()
            .find(|surface| {
                surface.surface_id.eq_ignore_ascii_case(intent)
                    || surface.title.eq_ignore_ascii_case(intent)
            })
            .cloned()
            .map(|surface| SurfaceMount {
                binding: surface.default_scope.clone(),
                surface,
            })
            .ok_or_else(|| IntentError::Unknown(intent.to_owned()))
    }

    /// Compose a view favorite with the live records surface.
    ///
    /// # Errors
    ///
    /// Returns an intent error when the item is not a matching view favorite
    /// or the catalog has no records body.
    pub fn open_saved_view(
        &self,
        nav_item: &NavItem,
        view: ViewMetadata,
    ) -> Result<SavedViewMount, IntentError> {
        let nav_view_id = nav_item
            .kind
            .field("view_id")
            .ok_or_else(|| IntentError::Unknown(nav_item.label()))?;
        if nav_view_id != view.view_id {
            return Err(IntentError::Unknown(nav_view_id.to_owned()));
        }
        Ok(SavedViewMount {
            mount: self.mount_body("record_table", ScopeBinding::Workspace)?,
            view,
        })
    }

    fn mount_body(
        &self,
        body_kind: &str,
        binding: ScopeBinding,
    ) -> Result<SurfaceMount, IntentError> {
        self.surfaces
            .iter()
            .find(|surface| surface.renderer.body_kind() == Some(body_kind))
            .cloned()
            .map(|surface| SurfaceMount { surface, binding })
            .ok_or_else(|| IntentError::MissingBody(body_kind.to_owned()))
    }
}

fn is_question(intent: &str) -> bool {
    intent.ends_with('?')
        || intent.split_whitespace().next().is_some_and(|word| {
            matches!(
                word.to_ascii_lowercase().as_str(),
                "ask" | "how" | "what" | "when" | "where" | "which" | "who" | "why"
            )
        })
}

#[derive(Clone, Debug, PartialEq)]
pub struct SavedViewMount {
    pub mount: SurfaceMount,
    pub view: ViewMetadata,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct SurfaceHistory {
    entries: Vec<SurfaceMount>,
    cursor: Option<usize>,
}

impl SurfaceHistory {
    pub fn push(&mut self, mount: SurfaceMount) {
        let keep = self.cursor.map_or(0, |cursor| cursor + 1);
        self.entries.truncate(keep);
        self.entries.push(mount);
        self.cursor = Some(self.entries.len() - 1);
    }

    #[must_use]
    pub fn current(&self) -> Option<&SurfaceMount> {
        self.cursor.and_then(|cursor| self.entries.get(cursor))
    }

    pub fn back(&mut self) -> Option<&SurfaceMount> {
        if let Some(cursor) = self.cursor.filter(|cursor| *cursor > 0) {
            self.cursor = Some(cursor - 1);
        }
        self.current()
    }

    pub fn forward(&mut self) -> Option<&SurfaceMount> {
        if let Some(cursor) = self.cursor.filter(|cursor| cursor + 1 < self.entries.len()) {
            self.cursor = Some(cursor + 1);
        }
        self.current()
    }

    /// Encode the complete surface/scope history for `history.state`.
    ///
    /// # Errors
    ///
    /// Returns Serde's serialization error if the wire state cannot be encoded.
    pub fn encode_browser_state(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Restore a complete surface/scope history from `history.state`.
    ///
    /// # Errors
    ///
    /// Returns Serde's decoding error for malformed or incompatible state.
    pub fn restore_browser_state(encoded: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(encoded)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MountPlan {
    Dioxus { body_kind: String },
    Servo { url: String },
    SystemWebview { url: String },
    Unavailable { label: String },
}

impl From<&SurfaceMount> for MountPlan {
    fn from(mount: &SurfaceMount) -> Self {
        match &mount.surface.renderer {
            Renderer::Dioxus(body_kind) => Self::Dioxus {
                body_kind: body_kind.clone(),
            },
            Renderer::Servo(url) => Self::Servo { url: url.clone() },
            Renderer::SystemWebview(url) => Self::SystemWebview { url: url.clone() },
            Renderer::Unavailable { variant, .. } => Self::Unavailable {
                label: format!("Unavailable renderer: {variant}"),
            },
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct McpCall {
    pub name: &'static str,
    pub arguments: Value,
}

impl McpCall {
    #[must_use]
    pub fn surface_list() -> Self {
        Self {
            name: "surface_list",
            arguments: json!({}),
        }
    }

    #[must_use]
    pub fn surface_get(surface_id: &str) -> Self {
        Self {
            name: "surface_get",
            arguments: json!({"surface_id": surface_id}),
        }
    }

    #[must_use]
    pub fn surface_write(surface: &SurfaceSpec) -> Self {
        Self {
            name: "surface_write",
            arguments: json!({"surface": surface}),
        }
    }

    #[must_use]
    pub fn scope_resolve(binding: &ScopeBinding) -> Self {
        Self {
            name: "scope_resolve",
            arguments: json!({"binding": binding}),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShellModel {
    pub navigation: NavigationState,
    pub current: Option<SurfaceMount>,
}

#[component]
pub fn TheoremWebShell(model: ShellModel) -> Element {
    let theme_css = theoremweb_chrome::emit_chrome_theme_css(&[]).unwrap_or_default();
    let title = model
        .current
        .as_ref()
        .map_or("No surface selected", |mount| mount.surface.title.as_str());
    let mount_label = model.current.as_ref().map_or_else(
        || "Choose a surface".to_owned(),
        |mount| match MountPlan::from(mount) {
            MountPlan::Dioxus { body_kind } => format!("Dioxus body: {body_kind}"),
            MountPlan::Servo { url } => format!("Servo: {url}"),
            MountPlan::SystemWebview { url } => format!("System webview: {url}"),
            MountPlan::Unavailable { label } => label,
        },
    );
    rsx! {
        style { "{theme_css}" }
        main { class: "theoremweb-shell",
            aside { class: "theoremweb-navigation",
                input {
                    r#type: "search",
                    placeholder: "Open a record or ask a question",
                    "aria-label": "TheoremWeb omnibox",
                }
                nav {
                    for item in model.navigation.items() {
                        button {
                            key: "{item.nav_item_id}",
                            "data-nav-id": "{item.nav_item_id}",
                            "{item.label()}"
                        }
                    }
                }
            }
            section { class: "theoremweb-surface",
                h1 { "{title}" }
                p { "{mount_label}" }
            }
        }
    }
}

#[must_use]
pub fn saved_view_request(item: &NavItem) -> Option<NavigationCall> {
    NavigationState::activate_call(item)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use theoremweb_navigation::{NavKind, NavScope, NavigationListResponse};
    use theoremweb_record_table::{
        schema::{FilterOperator, SortDirection, ViewColumn, ViewFilter, ViewSort},
        ViewMetadata,
    };

    use super::*;

    fn catalog() -> SurfaceCatalog {
        SurfaceCatalog::from_live(SurfaceListResponse {
            count: 2,
            surfaces: vec![
                surface("tenant-records", "Records", "record_table"),
                surface("tenant-chat", "Ask", "thread"),
            ],
        })
    }

    fn surface(id: &str, title: &str, body_kind: &str) -> SurfaceSpec {
        SurfaceSpec {
            surface_id: id.into(),
            title: title.into(),
            icon: "circle".into(),
            default_scope: ScopeBinding::Workspace,
            renderer: Renderer::Dioxus(body_kind.into()),
            fallback_renderer: None,
            layout_ref: None,
            capabilities: Vec::new(),
        }
    }

    #[test]
    fn record_and_question_intents_compose_expected_scope() {
        let catalog = catalog();
        let record = catalog.resolve("record:company:acme").unwrap();
        assert_eq!(record.surface.surface_id, "tenant-records");
        assert_eq!(
            record.binding,
            ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "acme".into()
            }
        );
        let question = catalog.resolve("What changed?").unwrap();
        assert_eq!(question.surface.surface_id, "tenant-chat");
        assert_eq!(question.binding, ScopeBinding::Workspace);
    }

    #[test]
    fn browser_history_restores_surface_and_binding_together() {
        let catalog = catalog();
        let record = catalog.resolve("record:company:acme").unwrap();
        let chat = catalog.resolve("Why now?").unwrap();
        let mut history = SurfaceHistory::default();
        history.push(record.clone());
        history.push(chat.clone());
        assert_eq!(history.back(), Some(&record));
        assert_eq!(history.forward(), Some(&chat));

        let encoded = history.encode_browser_state().unwrap();
        let restored = SurfaceHistory::restore_browser_state(&encoded).unwrap();
        assert_eq!(restored.current(), Some(&chat));
    }

    #[test]
    fn new_runtime_row_mounts_without_a_compiled_surface_route() {
        let response: SurfaceListResponse = serde_json::from_value(json!({
            "count": 1,
            "surfaces": [{
                "surface_id": "tenant-notes",
                "title": "Notes",
                "icon": "note",
                "default_scope": {"kind": "workspace"},
                "renderer": {"kind": "dioxus", "body_kind": "document"},
                "capabilities": []
            }]
        }))
        .unwrap();
        let mount = SurfaceCatalog::from_live(response)
            .resolve("Notes")
            .unwrap();
        assert_eq!(mount.surface.surface_id, "tenant-notes");
        assert_eq!(
            MountPlan::from(&mount),
            MountPlan::Dioxus {
                body_kind: "document".into()
            }
        );
    }

    #[test]
    fn future_renderer_is_labeled_unavailable_and_round_trips() {
        let wire = json!({"kind": "future_gpu", "quality": "high"});
        let renderer: Renderer = serde_json::from_value(wire.clone()).unwrap();
        assert_eq!(
            renderer.unavailable_label().as_deref(),
            Some("Unavailable renderer: future_gpu")
        );
        assert_eq!(serde_json::to_value(renderer).unwrap(), wire);
    }

    #[test]
    fn pinned_view_opens_with_graph_returned_filters_and_columns() {
        let item = NavItem {
            nav_item_id: "favorite".into(),
            tenant: "tenant-a".into(),
            scope: NavScope::User("alice".into()),
            kind: NavKind::view("view:qualified", Some("Qualified".into())),
            position: 0,
            parent_id: None,
            derived_label: None,
        };
        let view = ViewMetadata {
            view_id: "view:qualified".into(),
            tenant_id: "tenant-a".into(),
            object_type_id: "company".into(),
            name: "Qualified".into(),
            schema_version: "schema:1".into(),
            filters: vec![ViewFilter {
                field_key: "status".into(),
                operator: FilterOperator::Eq,
                value: json!("qualified"),
            }],
            sorts: vec![ViewSort {
                field_key: "name".into(),
                direction: SortDirection::Asc,
            }],
            group_by: None,
            columns: vec![ViewColumn {
                field_key: "name".into(),
                order: 0,
                width: 240,
                visible: true,
                pinned: true,
            }],
        };
        let opened = catalog().open_saved_view(&item, view.clone()).unwrap();
        assert_eq!(opened.view.filters, view.filters);
        assert_eq!(opened.view.columns, view.columns);
        assert_eq!(opened.mount.surface.surface_id, "tenant-records");
        assert_eq!(saved_view_request(&item).unwrap().name, "view_get");
    }

    #[test]
    fn shell_renders_navigation_and_mount_plan() {
        let current = catalog().resolve("record:company:acme").unwrap();
        let navigation = NavigationState::from_live(NavigationListResponse {
            items: vec![NavItem {
                nav_item_id: "companies".into(),
                tenant: "tenant-a".into(),
                scope: NavScope::Workspace,
                kind: NavKind::object("company", Some("Companies".into())),
                position: 0,
                parent_id: None,
                derived_label: None,
            }],
        });
        let html = dioxus_ssr::render_element(rsx! {
            TheoremWebShell { model: ShellModel { navigation, current: Some(current) } }
        });
        assert!(html.contains("TheoremWeb omnibox"));
        assert!(html.contains("Companies"));
        assert!(html.contains("Dioxus body: record_table"));
    }
}
