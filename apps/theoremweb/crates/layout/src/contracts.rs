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
}
