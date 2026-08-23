//! The layout product surface.
//!
//! W03 / obligation O03. This is the seam between a resolved surface row and
//! the layout renderer: it picks the layout that applies to the mounted scope,
//! decides which body kinds the host owns a real component for, and hands the
//! rest to the layout crate's own projection.
//!
//! Routing is data-driven rather than declared. Every seeded surface row
//! carries `layout_ref: None`, so nothing marks a surface as "a layout
//! surface"; instead, if the server publishes a layout for this scope the host
//! mounts it, and otherwise the single-body path renders. That keeps the
//! server the authority on which surfaces have layouts, which is the same rule
//! the spec applies to sorts, filters, and aggregates.

use std::collections::BTreeMap;

use dioxus::prelude::*;
use serde_json::Value;
use theoremweb_app::ScopeBinding as SurfaceScope;
use theoremweb_chrome::ColorScheme;
use theoremweb_layout::{
    BodyRegistry, BodyRequest, LayoutMcpCall, LayoutSet, LayoutSurface, ProjectedBody, RecordData,
    ScopeBinding as LayoutScope,
};
use theoremweb_record_table::{RecordPage, RecordTable};

/// Translate a mounted surface's binding into the layout crate's binding.
///
/// Three crates declare a byte-identical `ScopeBinding` today: `app`,
/// `layout`, and `agent-runtime`. Collapsing them onto one authority is
/// outside this node's declared scope, so the translation is explicit here and
/// pinned by a test rather than left to a silent structural coincidence.
#[must_use]
pub fn layout_scope(binding: &SurfaceScope) -> LayoutScope {
    match binding {
        SurfaceScope::Workspace => LayoutScope::Workspace,
        SurfaceScope::Canvas { canvas_id } => LayoutScope::Canvas {
            canvas_id: canvas_id.clone(),
        },
        SurfaceScope::Node { node_id } => LayoutScope::Node {
            node_id: node_id.clone(),
        },
        SurfaceScope::Record {
            object_type,
            record_id,
        } => LayoutScope::Record {
            object_type: object_type.clone(),
            record_id: record_id.clone(),
        },
        SurfaceScope::Document { document_id } => LayoutScope::Document {
            document_id: document_id.clone(),
        },
    }
}

/// Derive the bound record from the page the surface already fetched.
///
/// LY4 wants a record page to render real field data. The server already sent
/// the row inside the record page, so reading it here costs no second request
/// and, more importantly, cannot disagree with what the table shows: one
/// payload feeds both the grid and the fields widget.
#[must_use]
pub fn record_from_page(page: &RecordPage, object_type: &str, record_id: &str) -> Option<RecordData> {
    let row = page
        .rows
        .iter()
        .find(|row| row.record_id == record_id)?;
    Some(RecordData {
        object_type: object_type.to_owned(),
        record_id: record_id.to_owned(),
        fields: row.values.clone(),
    })
}

#[derive(Clone, PartialEq, Props)]
pub struct LayoutMountProps {
    pub layouts: LayoutSet,
    pub binding: SurfaceScope,
    pub bodies: BodyRegistry,
    /// Server-attested aggregates keyed by widget id.
    #[props(default)]
    pub server_values: BTreeMap<String, Value>,
    #[props(default)]
    pub records: Option<RecordPage>,
    pub scheme: ColorScheme,
    pub on_navigate: EventHandler<String>,
    pub on_persist: EventHandler<LayoutMcpCall>,
}

/// Mount the layout that applies to this scope.
///
/// The body slot is where W02's record table stops being a whole surface and
/// becomes a widget: a `record_table` body inside a dashboard renders the same
/// virtualized grid the Records surface does, from the same component. Every
/// other kind falls through to the layout crate's projection, including kinds
/// the registry does not know, which arrive as labeled placeholders.
// Dioxus components are PascalCase; this one takes a props struct so it stays
// under the argument-count lint, which means the `#[component]` macro is not
// emitting these allows for it.
#[allow(non_snake_case, clippy::missing_errors_doc)]
pub fn LayoutMount(props: LayoutMountProps) -> Element {
    let LayoutMountProps {
        layouts,
        binding,
        bodies,
        server_values,
        records,
        scheme,
        on_navigate,
        on_persist,
    } = props;

    let scope = layout_scope(&binding);
    // Derived here rather than passed in. The binding is authoritative at this
    // point and nowhere earlier: navigation state lives inside the host
    // component, so a record derived outside it is pinned to whatever surface
    // happened to mount first and never follows the reader.
    let record = match &binding {
        SurfaceScope::Record {
            object_type,
            record_id,
        } => records
            .as_ref()
            .and_then(|page| record_from_page(page, object_type, record_id)),
        _ => None,
    };
    let Some(layout) = layouts.resolve(&scope).cloned() else {
        return rsx! {
            p {
                class: "theorem-layout-empty",
                "data-layout": "none",
                "No layout is published for this scope."
            }
        };
    };

    let layout_id = layout.layout_id.clone();
    // A fingerprint of the host data the slot reads. The record page arrives
    // after the layout does, and without this the surface would not re-render
    // when it lands: the slot would keep answering from the render where the
    // page was still absent.
    let body_epoch = records
        .as_ref()
        .map_or(0, |page| u64::try_from(page.rows.len()).unwrap_or(u64::MAX).saturating_add(1));
    let body = use_callback(move |request: BodyRequest| {
        if request.rendered.kind == "record_table" {
            if let Some(page) = records.clone() {
                return rsx! {
                    div {
                        class: "theoremweb-mount-live",
                        "data-body-kind": "record_table",
                        RecordTable { page, scheme }
                    }
                };
            }
        }
        rsx! { ProjectedBody { rendered: request.rendered, on_navigate } }
    });

    rsx! {
        LayoutSurface {
            // The key is for the reader, not for correctness: LayoutSurface
            // re-seeds itself when the layout id changes, because a key does
            // not force a remount for a component in a fixed position.
            key: "{layout_id}",
            initial: layout,
            registry: bodies,
            scope,
            record,
            server_values,
            body,
            body_epoch,
            on_persist,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_surface_and_layout_scope_bindings_still_agree() {
        // Three crates declare a byte-identical ScopeBinding: app, layout,
        // and agent-runtime. Collapsing them is outside W03's scope, so this
        // guards the seam instead. The match in `layout_scope` is exhaustive,
        // so a variant added on the app side fails to compile here; this test
        // covers the other half, that the two sides still serialize to the
        // same wire shape, since both are persisted.
        let cases = [
            (SurfaceScope::Workspace, LayoutScope::Workspace),
            (
                SurfaceScope::Canvas {
                    canvas_id: "commands".into(),
                },
                LayoutScope::Canvas {
                    canvas_id: "commands".into(),
                },
            ),
            (
                SurfaceScope::Node {
                    node_id: "node-1".into(),
                },
                LayoutScope::Node {
                    node_id: "node-1".into(),
                },
            ),
            (
                SurfaceScope::Record {
                    object_type: "company".into(),
                    record_id: "acme".into(),
                },
                LayoutScope::Record {
                    object_type: "company".into(),
                    record_id: "acme".into(),
                },
            ),
            (
                SurfaceScope::Document {
                    document_id: "doc-1".into(),
                },
                LayoutScope::Document {
                    document_id: "doc-1".into(),
                },
            ),
        ];
        for (from, want) in cases {
            assert_eq!(layout_scope(&from), want);
            assert_eq!(
                serde_json::to_value(&from).expect("surface scope serializes"),
                serde_json::to_value(&want).expect("layout scope serializes"),
            );
        }
    }

    fn page() -> RecordPage {
        crate::records::parse_page(
            br#"{
                "object_type": {
                    "object_type_id": "company", "tenant_id": "Travis-Gilbert",
                    "name_singular": "company", "name_plural": "companies",
                    "label_singular": "Company", "label_plural": "Companies",
                    "node_label": "Company", "label_identifier_field": "name",
                    "fields": [{"key": "name", "label": "Name",
                        "field_type": {"kind": "text", "raw": {}},
                        "required": true, "system": false}],
                    "enforcement": "reject", "system": false,
                    "content_anchor": "", "retired": false, "schema_version": "v1"
                },
                "rows": [
                    {"record_id": "acme", "values": {"name": "Acme"}},
                    {"record_id": "globex", "values": {"name": "Globex"}}
                ],
                "total": 2
            }"#,
        )
        .expect("fixture page decodes")
    }

    #[test]
    fn a_bound_record_comes_from_the_page_the_surface_already_fetched() {
        let record = record_from_page(&page(), "company", "globex").expect("the row is present");
        assert_eq!(record.record_id, "globex");
        assert_eq!(record.fields["name"], serde_json::json!("Globex"));
    }

    #[test]
    fn a_record_absent_from_the_page_binds_nothing_rather_than_an_empty_shell() {
        // An empty RecordData would render a fields widget full of blanks,
        // which reads as "this record has no values" instead of "this record
        // is not on the loaded page".
        assert!(record_from_page(&page(), "company", "initech").is_none());
    }

}
