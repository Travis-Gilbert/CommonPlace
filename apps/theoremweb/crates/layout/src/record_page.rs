use std::collections::BTreeMap;

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{BodyRegistry, LayoutObject, LayoutWidget, ScopeBinding};

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
    pub target: Option<String>,
    pub unavailable: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderedSurface {
    pub renderer: &'static str,
    pub scope: ScopeBinding,
    pub layout_id: String,
    pub widgets: Vec<RenderedWidget>,
}

#[must_use]
pub fn render_layout(
    layout: &LayoutObject,
    scope: ScopeBinding,
    registry: &BodyRegistry,
    record: Option<&RecordData>,
    server_values: &BTreeMap<String, Value>,
) -> RenderedSurface {
    let widgets = layout
        .tabs
        .first()
        .map(|tab| {
            tab.widgets
                .iter()
                .map(|widget| render_widget(widget, registry, record, server_values))
                .collect()
        })
        .unwrap_or_default();
    RenderedSurface {
        renderer: "theorem.layout.v1",
        scope,
        layout_id: layout.layout_id.clone(),
        widgets,
    }
}

fn render_widget(
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
        };
    };
    let mut rendered = RenderedWidget {
        widget_id: widget.widget_id.clone(),
        kind: widget.body_kind.clone(),
        label: spec.title.clone(),
        body: String::new(),
        target: None,
        unavailable: false,
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

#[component]
pub fn SurfaceView(surface: RenderedSurface) -> Element {
    rsx! {
        section {
            class: "theorem-layout-surface",
            "data-renderer": surface.renderer,
            "data-layout-id": "{surface.layout_id}",
            for widget in &surface.widgets {
                article {
                    key: "{widget.widget_id}",
                    "data-body-kind": "{widget.kind}",
                    "data-unavailable": widget.unavailable.then_some("true"),
                    h3 { "{widget.label}" }
                    if let Some(target) = &widget.target {
                        a { href: "{target}", "{widget.body}" }
                    } else {
                        p { "{widget.body}" }
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
            &BodyRegistry::initial(),
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
    fn same_renderer_handles_canvas_and_unknown_body_is_labeled() {
        let mut value = layout();
        value.tabs.rotate_left(1);
        let rendered = render_layout(
            &value,
            ScopeBinding::Canvas {
                canvas_id: "commands".into(),
            },
            &BodyRegistry::initial(),
            None,
            &BTreeMap::new(),
        );
        assert_eq!(rendered.renderer, "theorem.layout.v1");
        assert_eq!(rendered.widgets[0].label, "Unavailable body: future_body");
        assert!(rendered.widgets[0].unavailable);
        let html = dioxus_ssr::render_element(rsx! { SurfaceView { surface: rendered } });
        assert!(html.contains("Unavailable body: future_body"));
    }
}
