//! Thread scope chips share the V01 `ScopeBinding` wire shape.

use serde::{Deserialize, Serialize};

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

impl ScopeBinding {
    #[must_use]
    pub fn stable_key(&self) -> String {
        match self {
            Self::Workspace => "workspace".into(),
            Self::Canvas { canvas_id } => format!("canvas:{canvas_id}"),
            Self::Node { node_id } => format!("node:{node_id}"),
            Self::Record {
                object_type,
                record_id,
            } => format!("record:{object_type}:{record_id}"),
            Self::Document { document_id } => format!("document:{document_id}"),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScopeChip {
    pub label: String,
    pub target: ScopeBinding,
}

impl From<&ScopeBinding> for ScopeChip {
    fn from(binding: &ScopeBinding) -> Self {
        let label = match binding {
            ScopeBinding::Workspace => "Workspace".into(),
            ScopeBinding::Canvas { canvas_id } => format!("Canvas {canvas_id}"),
            ScopeBinding::Node { node_id } => format!("Node {node_id}"),
            ScopeBinding::Record {
                object_type,
                record_id,
            } => format!("{object_type} {record_id}"),
            ScopeBinding::Document { document_id } => format!("Document {document_id}"),
        };
        Self {
            label,
            target: binding.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_scope_has_a_named_click_target_including_workspace() {
        let cases = [
            ScopeBinding::Workspace,
            ScopeBinding::Node {
                node_id: "node-1".into(),
            },
            ScopeBinding::Canvas {
                canvas_id: "canvas-1".into(),
            },
            ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "acme".into(),
            },
        ];
        for binding in cases {
            let chip = ScopeChip::from(&binding);
            assert!(!chip.label.is_empty());
            assert_eq!(chip.target, binding);
        }
        assert_eq!(ScopeChip::from(&ScopeBinding::Workspace).label, "Workspace");
    }
}
