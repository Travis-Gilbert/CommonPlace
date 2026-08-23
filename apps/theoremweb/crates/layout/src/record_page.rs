//! The one layout renderer.
//!
//! LY4 requires a record page, a canvas, and a dashboard to come out of the
//! same renderer. Before W03 there were two: `grid.rs` positioned widgets and
//! printed each `body_kind` as bare text, while this module rendered real
//! bodies with no gestures at all. They had already drifted — only this side
//! labeled an unregistered body, so the same layout degraded gracefully in one
//! renderer and silently in the other.
//!
//! The split now runs along a different seam. This module owns the projection
//! (layout plus data becomes [`RenderedWidget`]) and the default body
//! ([`ProjectedBody`]); `grid.rs` owns placement and editing and renders every
//! widget through here. A host that owns a richer component for one kind
//! supplies it through [`BodyRequest`] rather than forking the renderer.

use std::collections::BTreeMap;

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{BodyRegistry, GridRect, LayoutObject, LayoutWidget, ScopeBinding};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct RecordData {
    pub object_type: String,
    pub record_id: String,
    #[serde(default)]
    pub fields: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct RelatedRecord {
    pub object_type: String,
    pub record_id: String,
    pub label: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderedWidget {
    pub widget_id: String,
    pub kind: String,
    pub label: String,
    pub body: String,
    /// An omnibox intent, not a URL.
    ///
    /// `record:company:globex` is what the host's surface catalog resolves. It
    /// used to be emitted into an `href`, where the browser treated it as an
    /// unknown scheme and the link did nothing; LY4 wants the target record
    /// actually opened, so the intent now travels to the host's own resolver.
    pub target: Option<String>,
    pub unavailable: bool,
    pub grid: GridRect,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderedSurface {
    pub renderer: &'static str,
    pub scope: ScopeBinding,
    pub layout_id: String,
    pub tab_id: Option<String>,
    pub widgets: Vec<RenderedWidget>,
}

/// What a host needs to decide whether it owns a body kind.
///
/// The layout crate deliberately knows no concrete body. It carries the
/// projection it would render itself, so a host that declines a request can
/// hand back [`ProjectedBody`] without recomputing anything.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BodyRequest {
    pub widget: LayoutWidget,
    pub rendered: RenderedWidget,
}

/// Project the layout's first tab.
#[must_use]
pub fn render_layout(
    layout: &LayoutObject,
    scope: ScopeBinding,
    registry: &BodyRegistry,
    record: Option<&RecordData>,
    server_values: &BTreeMap<String, Value>,
) -> RenderedSurface {
    render_tab(layout, None, scope, registry, record, server_values)
}

/// Project one named tab, or the first when `tab_id` is `None`.
///
/// A `tab_id` that no tab claims projects no widgets rather than silently
/// falling back to the first tab, because a stale tab selection showing some
/// other tab's widgets is worse than showing none.
#[must_use]
pub fn render_tab(
    layout: &LayoutObject,
    tab_id: Option<&str>,
    scope: ScopeBinding,
    registry: &BodyRegistry,
    record: Option<&RecordData>,
    server_values: &BTreeMap<String, Value>,
) -> RenderedSurface {
    let tab = tab_id.map_or_else(
        || layout.tabs.first(),
        |wanted| layout.tabs.iter().find(|tab| tab.tab_id == wanted),
    );
    RenderedSurface {
        renderer: "theorem.layout.v1",
        scope,
        layout_id: layout.layout_id.clone(),
        tab_id: tab.map(|tab| tab.tab_id.clone()),
        widgets: tab.map_or_else(Vec::new, |tab| {
            tab.widgets
                .iter()
                .map(|widget| render_widget(widget, registry, record, server_values))
                .collect()
        }),
    }
}

/// Project one widget against the canonical registry.
///
/// An unregistered kind becomes a labeled, non-destructive placeholder. LY2
/// requires the page to survive it, so this never returns an error and never
/// drops the widget.
#[must_use]
pub fn render_widget(
    widget: &LayoutWidget,
    registry: &BodyRegistry,
    record: Option<&RecordData>,
    server_values: &BTreeMap<String, Value>,
) -> RenderedWidget {
    let Some(spec) = registry.get(&widget.body_kind) else {
        return RenderedWidget {
            widget_id: widget.widget_id.clone(),
            kind: widget.body_kind.clone(),
            label: format!("Unavailable body: {}", widget.body_kind),
            body: format!("No renderer registered for {}", widget.body_kind),
            target: None,
            unavailable: true,
            grid: widget.grid,
        };
    };
    let mut rendered = RenderedWidget {
        widget_id: widget.widget_id.clone(),
        kind: widget.body_kind.clone(),
        label: spec.title.clone(),
        body: String::new(),
        target: None,
        unavailable: false,
        grid: widget.grid,
    };
    match widget.body_kind.as_str() {
        "fields" => {
            rendered.body = record.map_or_else(
                || "No record bound".into(),
                |record| visible_fields(record, widget).to_string(),
            );
        }
        "related_records" => {
            let records = widget
                .body_params
                .get("records")
                .cloned()
                .and_then(|value| serde_json::from_value::<Vec<RelatedRecord>>(value).ok())
                .unwrap_or_default();
            if let Some(first) = records.first() {
                rendered.body.clone_from(&first.label);
                rendered.target = Some(format!("record:{}:{}", first.object_type, first.record_id));
            } else {
                rendered.body = "No related records".into();
            }
        }
        "chart" | "record_table" => {
            rendered.body = server_values
                .get(&widget.widget_id)
                .map_or_else(|| "Server result unavailable".into(), Value::to_string);
        }
        _ => rendered.body = format!("Renderer: {}", spec.renderer_binding),
    }
    rendered
}

fn visible_fields(record: &RecordData, widget: &LayoutWidget) -> Value {
    let visible = widget
        .field_visibility
        .clone()
        .unwrap_or_else(|| record.fields.keys().cloned().collect());
    let fields = visible
        .into_iter()
        .filter_map(|key| record.fields.get(&key).cloned().map(|value| (key, value)))
        .collect();
    Value::Object(fields)
}

/// The default body: a label, and either navigable text or plain text.
#[component]
pub fn ProjectedBody(rendered: RenderedWidget, on_navigate: EventHandler<String>) -> Element {
    let label = rendered.label.clone();
    let body = rendered.body.clone();
    rsx! {
        h3 { class: "theorem-widget-label", "{label}" }
        if let Some(intent) = rendered.target {
            {
                let shown = intent.clone();
                rsx! {
                    button {
                        class: "theorem-widget-link",
                        "data-navigate-intent": "{shown}",
                        onclick: move |_| on_navigate.call(intent.clone()),
                        "{body}"
                    }
                }
            }
        } else {
            p { class: "theorem-widget-body", "{body}" }
        }
    }
}

/// A read-only surface: the projection with no editing affordances.
#[component]
pub fn SurfaceView(surface: RenderedSurface, on_navigate: EventHandler<String>) -> Element {
    let RenderedSurface {
        renderer,
        layout_id,
        tab_id,
        widgets,
        ..
    } = surface;
    let tab_attr = tab_id.unwrap_or_default();
    rsx! {
        section {
            class: "theorem-layout-surface",
            "data-renderer": renderer,
            "data-layout-id": "{layout_id}",
            "data-tab-id": "{tab_attr}",
            for widget in widgets {
                {
                    // `rsx!` moves the widget into `ProjectedBody`, so the
                    // attributes read from owned copies taken first.
                    let id = widget.widget_id.clone();
                    let kind = widget.kind.clone();
                    let unavailable = widget.unavailable;
                    rsx! {
                        article {
                            key: "{id}",
                            "data-widget-id": "{id}",
                            "data-body-kind": "{kind}",
                            "data-unavailable": unavailable.then_some("true"),
                            ProjectedBody { rendered: widget, on_navigate }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> LayoutObject {
        serde_json::from_str(include_str!("../fixtures/company-layout.json")).unwrap()
    }

    #[allow(non_snake_case)]
    #[component]
    fn ViewHarness(surface: RenderedSurface) -> Element {
        rsx! { SurfaceView { surface, on_navigate: move |_| {} } }
    }

    fn record() -> RecordData {
        RecordData {
            object_type: "company".into(),
            record_id: "acme".into(),
            fields: BTreeMap::from([
                ("name".into(), Value::String("Acme".into())),
                ("website".into(), Value::String("https://acme.test".into())),
                ("private_note".into(), Value::String("hidden".into())),
            ]),
        }
    }

    #[test]
    fn record_page_renders_real_visible_fields_and_related_navigation() {
        let rendered = render_layout(
            &layout(),
            ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "acme".into(),
            },
            &crate::body_registry::fixtures::canonical_stub(),
            Some(&record()),
            &BTreeMap::new(),
        );
        assert!(rendered.widgets[0].body.contains("Acme"));
        assert!(!rendered.widgets[0].body.contains("private_note"));
        assert_eq!(
            rendered.widgets[1].target.as_deref(),
            Some("record:company:globex")
        );
    }

    #[test]
    fn a_related_record_is_a_host_intent_button_not_a_dead_href() {
        // The intent used to be emitted as `href="record:company:globex"`,
        // which the browser treats as an unknown scheme: the link rendered and
        // did nothing. LY4 wants the target record opened, so the assertion is
        // that no href carries it and the host's resolver does.
        let rendered = render_layout(
            &layout(),
            ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "acme".into(),
            },
            &crate::body_registry::fixtures::canonical_stub(),
            Some(&record()),
            &BTreeMap::new(),
        );
        let html = dioxus_ssr::render_element(rsx! { ViewHarness { surface: rendered } });
        assert!(html.contains("data-navigate-intent=\"record:company:globex\""));
        assert!(!html.contains("href=\"record:company:globex\""));
    }

    #[test]
    fn same_renderer_handles_canvas_and_unknown_body_is_labeled() {
        let mut value = layout();
        value.tabs.rotate_left(1);
        let rendered = render_layout(
            &value,
            ScopeBinding::Canvas {
                canvas_id: "commands".into(),
            },
            &crate::body_registry::fixtures::canonical_stub(),
            None,
            &BTreeMap::new(),
        );
        assert_eq!(rendered.renderer, "theorem.layout.v1");
        assert_eq!(rendered.widgets[0].label, "Unavailable body: future_body");
        assert!(rendered.widgets[0].unavailable);
        let html = dioxus_ssr::render_element(rsx! { ViewHarness { surface: rendered } });
        assert!(html.contains("Unavailable body: future_body"));
    }

    #[test]
    fn a_named_tab_projects_its_own_widgets_and_an_unknown_tab_projects_none() {
        let layout = layout();
        let registry = crate::body_registry::fixtures::canonical_stub();
        let activity = render_tab(
            &layout,
            Some("activity"),
            ScopeBinding::Workspace,
            &registry,
            None,
            &BTreeMap::new(),
        );
        assert_eq!(activity.tab_id.as_deref(), Some("activity"));
        assert_eq!(activity.widgets[0].widget_id, "future");

        let stale = render_tab(
            &layout,
            Some("removed"),
            ScopeBinding::Workspace,
            &registry,
            None,
            &BTreeMap::new(),
        );
        assert_eq!(stale.tab_id, None);
        assert!(stale.widgets.is_empty());
    }

    #[test]
    fn a_projected_widget_carries_the_grid_the_placement_renderer_needs() {
        let rendered = render_layout(
            &layout(),
            ScopeBinding::Workspace,
            &crate::body_registry::fixtures::canonical_stub(),
            None,
            &BTreeMap::new(),
        );
        assert_eq!(rendered.widgets[0].grid.w, 6);
        assert_eq!(rendered.widgets[1].grid.x, 6);
    }
}
