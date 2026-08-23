use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScopeBinding {
    Workspace,
    Canvas {
        canvas_id: String,
    },
    Node {
        node_id: String,
    },
    Record {
        object_type: String,
        record_id: String,
    },
    Document {
        document_id: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LayoutTarget {
    ObjectType {
        object_type: String,
    },
    Record {
        object_type: String,
        record_id: String,
    },
    Canvas {
        canvas_id: String,
    },
    Workspace,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct GridRect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

impl GridRect {
    #[must_use]
    pub fn snapped(self, columns: u32) -> Self {
        let width = self.w.clamp(1, columns);
        let max_x = columns.saturating_sub(width);
        Self {
            x: self.x.clamp(0, i32::try_from(max_x).unwrap_or(i32::MAX)),
            y: self.y.max(0),
            w: width,
            h: self.h.max(1),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct LayoutWidget {
    pub widget_id: String,
    pub body_kind: String,
    #[serde(default)]
    pub body_params: Value,
    pub grid: GridRect,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field_visibility: Option<Vec<String>>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct LayoutTab {
    pub tab_id: String,
    pub title: String,
    #[serde(default)]
    pub widgets: Vec<LayoutWidget>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct LayoutObject {
    pub layout_id: String,
    pub scope: ScopeBinding,
    pub applies_to: LayoutTarget,
    #[serde(default)]
    pub tabs: Vec<LayoutTab>,
}

impl LayoutObject {
    #[must_use]
    pub fn write_call(&self) -> LayoutMcpCall {
        LayoutMcpCall {
            tool: "layout_write".into(),
            arguments: json!({"layout": self}),
        }
    }

    #[must_use]
    pub fn get_call(&self) -> LayoutMcpCall {
        LayoutMcpCall {
            tool: "layout_get".into(),
            arguments: json!({"layout_id": self.layout_id}),
        }
    }
}

/// Every layout object visible to one host, with LY1 resolution.
///
/// LY1 requires per-object-type defaults with per-record override. Resolution
/// keys on the target alone, and nothing about a `SchemaVersion` takes part:
/// binding presentation to schema identity would turn every schema bump into a
/// layout migration, which is exactly what the spec's "no layout field appears
/// inside `SchemaVersion` identity" clause forbids.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct LayoutSet {
    #[serde(default)]
    pub layouts: Vec<LayoutObject>,
}

impl LayoutSet {
    /// Resolve the layout a scope binding should mount.
    ///
    /// Returns `None` for a binding no layout claims; the caller renders its
    /// own empty state rather than being handed a fabricated layout.
    #[must_use]
    pub fn resolve(&self, binding: &ScopeBinding) -> Option<&LayoutObject> {
        match binding {
            ScopeBinding::Record {
                object_type,
                record_id,
            } => self.resolve_record(object_type, record_id),
            ScopeBinding::Canvas { canvas_id } => self.find(|target| {
                matches!(target, LayoutTarget::Canvas { canvas_id: id } if id == canvas_id)
            }),
            ScopeBinding::Workspace => {
                self.find(|target| matches!(target, LayoutTarget::Workspace))
            }
            ScopeBinding::Node { .. } | ScopeBinding::Document { .. } => None,
        }
    }

    /// Resolve a record's layout: its own override, else its type's default.
    #[must_use]
    pub fn resolve_record(&self, object_type: &str, record_id: &str) -> Option<&LayoutObject> {
        self.find(|target| {
            matches!(
                target,
                LayoutTarget::Record { object_type: kind, record_id: id }
                    if kind == object_type && id == record_id
            )
        })
        .or_else(|| {
            self.find(|target| {
                matches!(target, LayoutTarget::ObjectType { object_type: kind } if kind == object_type)
            })
        })
    }

    fn find(&self, predicate: impl Fn(&LayoutTarget) -> bool) -> Option<&LayoutObject> {
        self.layouts
            .iter()
            .find(|layout| predicate(&layout.applies_to))
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct LayoutMcpCall {
    pub tool: String,
    pub arguments: Value,
}

impl LayoutMcpCall {
    #[must_use]
    pub fn resolve(binding: &ScopeBinding) -> Self {
        Self {
            tool: "layout_resolve".into(),
            arguments: json!({"binding": binding}),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backend_layout_fixture_round_trips_and_emits_graph_calls() {
        let raw = include_str!("../fixtures/company-layout.json");
        let expected: Value = serde_json::from_str(raw).unwrap();
        let layout: LayoutObject = serde_json::from_value(expected.clone()).unwrap();
        assert_eq!(serde_json::to_value(&layout).unwrap(), expected);
        assert_eq!(layout.write_call().tool, "layout_write");
        assert_eq!(layout.get_call().arguments["layout_id"], "layout:companies");
        assert_eq!(LayoutMcpCall::resolve(&layout.scope).tool, "layout_resolve");
    }

    #[test]
    fn grid_rect_snaps_inside_twelve_columns() {
        assert_eq!(
            GridRect {
                x: 11,
                y: -2,
                w: 5,
                h: 0,
            }
            .snapped(12),
            GridRect {
                x: 7,
                y: 0,
                w: 5,
                h: 1,
            }
        );
    }

    fn layout_for(layout_id: &str, applies_to: LayoutTarget) -> LayoutObject {
        LayoutObject {
            layout_id: layout_id.into(),
            scope: ScopeBinding::Workspace,
            applies_to,
            tabs: Vec::new(),
        }
    }

    fn set() -> LayoutSet {
        LayoutSet {
            layouts: vec![
                layout_for(
                    "layout:companies",
                    LayoutTarget::ObjectType {
                        object_type: "company".into(),
                    },
                ),
                layout_for(
                    "layout:companies:acme",
                    LayoutTarget::Record {
                        object_type: "company".into(),
                        record_id: "acme".into(),
                    },
                ),
                layout_for(
                    "layout:canvas:commands",
                    LayoutTarget::Canvas {
                        canvas_id: "commands".into(),
                    },
                ),
                layout_for("layout:workspace", LayoutTarget::Workspace),
            ],
        }
    }

    #[test]
    fn an_object_type_default_applies_to_a_record_with_no_override() {
        let resolved = set()
            .resolve(&ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "globex".into(),
            })
            .expect("the object-type default covers an un-overridden record")
            .layout_id
            .clone();
        assert_eq!(resolved, "layout:companies");
    }

    #[test]
    fn a_per_record_override_beats_its_object_type_default() {
        let resolved = set()
            .resolve(&ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "acme".into(),
            })
            .expect("acme has its own override")
            .layout_id
            .clone();
        assert_eq!(resolved, "layout:companies:acme");
    }

    #[test]
    fn canvas_and_workspace_bindings_resolve_and_unclaimed_ones_do_not() {
        let set = set();
        assert_eq!(
            set.resolve(&ScopeBinding::Canvas {
                canvas_id: "commands".into()
            })
            .map(|layout| layout.layout_id.as_str()),
            Some("layout:canvas:commands")
        );
        assert_eq!(
            set.resolve(&ScopeBinding::Workspace)
                .map(|layout| layout.layout_id.as_str()),
            Some("layout:workspace")
        );
        assert!(set
            .resolve(&ScopeBinding::Canvas {
                canvas_id: "absent".into()
            })
            .is_none());
        assert!(set
            .resolve(&ScopeBinding::Document {
                document_id: "doc".into()
            })
            .is_none());
    }

    #[test]
    fn no_layout_field_participates_in_schema_version_identity() {
        // LY1's last acceptance clause, asserted structurally rather than by
        // inspection: the persisted layout's key set is fixed, so adding a
        // schema field to layout identity fails here before it can make every
        // schema bump a layout migration.
        let layout: LayoutObject =
            serde_json::from_str(include_str!("../fixtures/company-layout.json")).unwrap();
        let value = serde_json::to_value(&layout).unwrap();
        let keys = value
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        // serde_json orders object keys alphabetically without the
        // `preserve_order` feature, so this is the sorted key set.
        assert_eq!(keys, ["applies_to", "layout_id", "scope", "tabs"]);
        let target = serde_json::to_value(&layout.applies_to).unwrap();
        assert_eq!(
            target.as_object().unwrap().keys().cloned().collect::<Vec<_>>(),
            ["kind", "object_type"]
        );
    }

}
