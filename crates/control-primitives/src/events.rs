//! CP1. Event plane: record and metadata operations with total reversible
//! compilation. Events name what changed; they never carry record payloads.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObjectSelector {
    Named(String),
    Any,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecordEvent {
    Created,
    Updated,
    Deleted,
    Restored,
    Any,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MetadataSelector {
    Named(String),
    Any,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MetadataOperation {
    Created,
    Updated,
    Deleted,
    Any,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventOperation {
    Record {
        object: ObjectSelector,
        event: RecordEvent,
    },
    Metadata {
        entity: MetadataSelector,
        operation: MetadataOperation,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub compiled: String,
    pub tenant: String,
    pub actor: String,
    pub principal: String,
    pub graph_version_before: u64,
    pub graph_version_after: u64,
    pub affected_node_ids: Vec<String>,
    /// Wall-clock ms for ordering only. Never a payload.
    pub at_ms: u64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EventCompileError {
    #[error("empty compiled event")]
    Empty,
    #[error("unknown event plane: {0}")]
    UnknownPlane(String),
    #[error("malformed compiled event: {0}")]
    Malformed(String),
}

impl ObjectSelector {
    fn compile(&self) -> String {
        match self {
            Self::Named(name) => name.clone(),
            Self::Any => "*".to_string(),
        }
    }

    fn parse(raw: &str) -> Self {
        if raw == "*" {
            Self::Any
        } else {
            Self::Named(raw.to_string())
        }
    }
}

impl RecordEvent {
    fn compile(&self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Updated => "updated",
            Self::Deleted => "deleted",
            Self::Restored => "restored",
            Self::Any => "*",
        }
    }

    fn parse(raw: &str) -> Result<Self, EventCompileError> {
        Ok(match raw {
            "created" => Self::Created,
            "updated" => Self::Updated,
            "deleted" => Self::Deleted,
            "restored" => Self::Restored,
            "*" => Self::Any,
            other => {
                return Err(EventCompileError::Malformed(format!(
                    "unknown record verb: {other}"
                )))
            }
        })
    }

    fn matches(&self, concrete: &RecordEvent) -> bool {
        matches!(self, Self::Any) || self == concrete
    }
}

impl MetadataSelector {
    fn compile(&self) -> String {
        match self {
            // Metadata entities are namespaced: object_type, field, etc.
            Self::Named(name) => name.clone(),
            Self::Any => "*".to_string(),
        }
    }

    fn parse(raw: &str) -> Self {
        if raw == "*" {
            Self::Any
        } else {
            Self::Named(raw.to_string())
        }
    }
}

impl MetadataOperation {
    fn compile(&self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Updated => "updated",
            Self::Deleted => "deleted",
            Self::Any => "*",
        }
    }

    fn parse(raw: &str) -> Result<Self, EventCompileError> {
        Ok(match raw {
            "created" => Self::Created,
            "updated" => Self::Updated,
            "deleted" => Self::Deleted,
            "*" => Self::Any,
            other => {
                return Err(EventCompileError::Malformed(format!(
                    "unknown metadata verb: {other}"
                )))
            }
        })
    }

    fn matches(&self, concrete: &MetadataOperation) -> bool {
        matches!(self, Self::Any) || self == concrete
    }
}

/// Compile an operation to a stable string. Total over the enum.
///
/// Record: `{object}.{verb}` e.g. `gclba_property.created`, `*.*`
/// Metadata: `metadata.{entity}.{verb}` e.g. `metadata.object_type.created`
pub fn compile_operation(op: &EventOperation) -> String {
    match op {
        EventOperation::Record { object, event } => {
            format!("{}.{}", object.compile(), event.compile())
        }
        EventOperation::Metadata { entity, operation } => {
            format!(
                "metadata.{}.{}",
                entity.compile(),
                operation.compile()
            )
        }
    }
}

/// Reverse of [`compile_operation`]. Round-trips for every constructed value.
pub fn parse_compiled(compiled: &str) -> Result<EventOperation, EventCompileError> {
    let compiled = compiled.trim();
    if compiled.is_empty() {
        return Err(EventCompileError::Empty);
    }
    if let Some(rest) = compiled.strip_prefix("metadata.") {
        let (entity, verb) = split_last_dot(rest).ok_or_else(|| {
            EventCompileError::Malformed(format!("metadata event needs entity.verb: {compiled}"))
        })?;
        return Ok(EventOperation::Metadata {
            entity: MetadataSelector::parse(entity),
            operation: MetadataOperation::parse(verb)?,
        });
    }
    let (object, verb) = split_last_dot(compiled).ok_or_else(|| {
        EventCompileError::Malformed(format!("record event needs object.verb: {compiled}"))
    })?;
    Ok(EventOperation::Record {
        object: ObjectSelector::parse(object),
        event: RecordEvent::parse(verb)?,
    })
}

fn split_last_dot(raw: &str) -> Option<(&str, &str)> {
    let idx = raw.rfind('.')?;
    let (left, right) = raw.split_at(idx);
    let verb = right.strip_prefix('.')?;
    if left.is_empty() || verb.is_empty() {
        return None;
    }
    Some((left, verb))
}

/// Whether a subscription selector matches a concrete emitted event.
/// Wildcards on either axis of the selector match.
pub fn match_operation(selector: &EventOperation, concrete: &EventOperation) -> bool {
    match (selector, concrete) {
        (
            EventOperation::Record {
                object: sel_obj,
                event: sel_ev,
            },
            EventOperation::Record {
                object: con_obj,
                event: con_ev,
            },
        ) => object_matches(sel_obj, con_obj) && sel_ev.matches(con_ev),
        (
            EventOperation::Metadata {
                entity: sel_ent,
                operation: sel_op,
            },
            EventOperation::Metadata {
                entity: con_ent,
                operation: con_op,
            },
        ) => entity_matches(sel_ent, con_ent) && sel_op.matches(con_op),
        _ => false,
    }
}

fn object_matches(selector: &ObjectSelector, concrete: &ObjectSelector) -> bool {
    match (selector, concrete) {
        (ObjectSelector::Any, _) => true,
        (ObjectSelector::Named(a), ObjectSelector::Named(b)) => a == b,
        (ObjectSelector::Named(_), ObjectSelector::Any) => false,
    }
}

fn entity_matches(selector: &MetadataSelector, concrete: &MetadataSelector) -> bool {
    match (selector, concrete) {
        (MetadataSelector::Any, _) => true,
        (MetadataSelector::Named(a), MetadataSelector::Named(b)) => a == b,
        (MetadataSelector::Named(_), MetadataSelector::Any) => false,
    }
}

/// Build a record-write envelope. Carries no payload.
pub fn record_write_event(
    object_type: &str,
    verb: RecordEvent,
    tenant: &str,
    actor: &str,
    principal: &str,
    graph_version_before: u64,
    graph_version_after: u64,
    affected_node_ids: Vec<String>,
    at_ms: u64,
) -> EventEnvelope {
    let op = EventOperation::Record {
        object: ObjectSelector::Named(object_type.to_string()),
        event: verb,
    };
    EventEnvelope {
        compiled: compile_operation(&op),
        tenant: tenant.to_string(),
        actor: actor.to_string(),
        principal: principal.to_string(),
        graph_version_before,
        graph_version_after,
        affected_node_ids,
        at_ms,
    }
}

/// Build a schema_declare metadata envelope.
pub fn schema_declare_event(
    tenant: &str,
    actor: &str,
    principal: &str,
    graph_version_before: u64,
    graph_version_after: u64,
    object_type_node_id: &str,
    at_ms: u64,
) -> EventEnvelope {
    let op = EventOperation::Metadata {
        entity: MetadataSelector::Named("object_type".to_string()),
        operation: MetadataOperation::Created,
    };
    EventEnvelope {
        compiled: compile_operation(&op),
        tenant: tenant.to_string(),
        actor: actor.to_string(),
        principal: principal.to_string(),
        graph_version_before,
        graph_version_after,
        affected_node_ids: vec![object_type_node_id.to_string()],
        at_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_named_record_and_round_trips() {
        let op = EventOperation::Record {
            object: ObjectSelector::Named("gclba_property".into()),
            event: RecordEvent::Created,
        };
        let compiled = compile_operation(&op);
        assert_eq!(compiled, "gclba_property.created");
        assert_eq!(parse_compiled(&compiled).unwrap(), op);
    }

    #[test]
    fn compiles_metadata_object_type_created() {
        let op = EventOperation::Metadata {
            entity: MetadataSelector::Named("object_type".into()),
            operation: MetadataOperation::Created,
        };
        assert_eq!(compile_operation(&op), "metadata.object_type.created");
        assert_eq!(parse_compiled("metadata.object_type.created").unwrap(), op);
    }

    #[test]
    fn compiles_double_wildcard() {
        let op = EventOperation::Record {
            object: ObjectSelector::Any,
            event: RecordEvent::Any,
        };
        assert_eq!(compile_operation(&op), "*.*");
        assert_eq!(parse_compiled("*.*").unwrap(), op);
    }

    #[test]
    fn wildcard_selector_matches_concrete() {
        let selector = EventOperation::Record {
            object: ObjectSelector::Any,
            event: RecordEvent::Any,
        };
        let concrete = EventOperation::Record {
            object: ObjectSelector::Named("task".into()),
            event: RecordEvent::Updated,
        };
        assert!(match_operation(&selector, &concrete));
    }

    #[test]
    fn metadata_wildcard_matches_plane_only() {
        let selector = EventOperation::Metadata {
            entity: MetadataSelector::Any,
            operation: MetadataOperation::Any,
        };
        let meta = EventOperation::Metadata {
            entity: MetadataSelector::Named("field".into()),
            operation: MetadataOperation::Updated,
        };
        let record = EventOperation::Record {
            object: ObjectSelector::Named("task".into()),
            event: RecordEvent::Created,
        };
        assert!(match_operation(&selector, &meta));
        assert!(!match_operation(&selector, &record));
    }

    #[test]
    fn envelope_carries_no_payload_fields() {
        let env = record_write_event(
            "gclba_property",
            RecordEvent::Created,
            "tenant-a",
            "actor-1",
            "principal-1",
            10,
            11,
            vec!["node-1".into()],
            1,
        );
        assert_eq!(env.compiled, "gclba_property.created");
        let json = serde_json::to_value(&env).unwrap();
        assert!(json.get("payload").is_none());
        assert!(json.get("body").is_none());
        assert!(json.get("record").is_none());
    }

    #[test]
    fn schema_declare_emits_metadata_object_type_created() {
        let env = schema_declare_event("t", "a", "p", 1, 2, "ot-1", 3);
        assert_eq!(env.compiled, "metadata.object_type.created");
    }
}
