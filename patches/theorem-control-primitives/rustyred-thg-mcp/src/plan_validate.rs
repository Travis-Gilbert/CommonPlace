//! CP6. Plan validation with available paths from upstream step schemas.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::step_schema::{compute_step_output_schema, JsonSchema, StepDefinition};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct TaskId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum JsonTypeTag {
    String,
    Number,
    Boolean,
    Object,
    Array,
    Null,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AvailablePath {
    pub path: String,
    pub source_task: TaskId,
    pub json_type: JsonTypeTag,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub task_id: Option<TaskId>,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidationReport {
    pub errors: Vec<ValidationIssue>,
    pub warnings: Vec<ValidationIssue>,
    pub available_paths: BTreeMap<TaskId, Vec<AvailablePath>>,
}

#[derive(Clone, Debug)]
pub struct PlanTaskDef {
    pub id: TaskId,
    pub step: StepDefinition,
    /// Explicit path references in this task's config, e.g. "{{t1.result.id}}".
    pub path_refs: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct PlanGraph {
    pub tasks: BTreeMap<TaskId, PlanTaskDef>,
    /// Directed edges: from upstream producer -> downstream consumer.
    pub edges: Vec<(TaskId, TaskId)>,
}

impl PlanGraph {
    pub fn upstream_of(&self, task: &TaskId) -> BTreeSet<TaskId> {
        let mut seen = BTreeSet::new();
        let mut stack: Vec<TaskId> = self
            .edges
            .iter()
            .filter(|(_, to)| to == task)
            .map(|(from, _)| from.clone())
            .collect();
        while let Some(node) = stack.pop() {
            if !seen.insert(node.clone()) {
                continue;
            }
            for (from, to) in &self.edges {
                if to == &node {
                    stack.push(from.clone());
                }
            }
        }
        seen
    }

    pub fn reachable_predecessors(&self, task: &TaskId) -> BTreeSet<TaskId> {
        self.upstream_of(task)
    }
}

fn tag_from_schema(schema: &serde_json::Value) -> JsonTypeTag {
    match schema.get("type").and_then(|v| v.as_str()) {
        Some("string") => JsonTypeTag::String,
        Some("number") | Some("integer") => JsonTypeTag::Number,
        Some("boolean") => JsonTypeTag::Boolean,
        Some("object") => JsonTypeTag::Object,
        Some("array") => JsonTypeTag::Array,
        Some("null") => JsonTypeTag::Null,
        _ => JsonTypeTag::Unknown,
    }
}

fn paths_from_schema(task: &TaskId, schema: &JsonSchema) -> Vec<AvailablePath> {
    let JsonSchema::Schema(value) = schema else {
        // Unknown contributes no paths rather than fabricated ones.
        return Vec::new();
    };
    let mut paths = Vec::new();
    let root = format!("{{{{{}.result}}}}", task.0);
    paths.push(AvailablePath {
        path: root,
        source_task: task.clone(),
        json_type: tag_from_schema(value),
    });
    if value.get("type").and_then(|v| v.as_str()) == Some("array") {
        if let Some(items) = value.get("items") {
            if let Some(props) = items.get("properties").and_then(|p| p.as_object()) {
                for (name, prop_schema) in props {
                    paths.push(AvailablePath {
                        path: format!("{{{{{}.result.{name}}}}}", task.0),
                        source_task: task.clone(),
                        json_type: tag_from_schema(prop_schema),
                    });
                }
            }
        }
    } else if let Some(props) = value
        .pointer("/properties/result/properties")
        .and_then(|p| p.as_object())
    {
        for (name, prop_schema) in props {
            paths.push(AvailablePath {
                path: format!("{{{{{}.result.{name}}}}}", task.0),
                source_task: task.clone(),
                json_type: tag_from_schema(prop_schema),
            });
        }
    } else if let Some(props) = value.get("properties").and_then(|p| p.as_object()) {
        for (name, prop_schema) in props {
            paths.push(AvailablePath {
                path: format!("{{{{{}.result.{name}}}}}", task.0),
                source_task: task.clone(),
                json_type: tag_from_schema(prop_schema),
            });
        }
    }
    paths
}

/// Full plan validator. Call once after a batch of edits.
pub fn validate_plan(graph: &PlanGraph) -> ValidationReport {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut available_paths: BTreeMap<TaskId, Vec<AvailablePath>> = BTreeMap::new();

    for (task_id, task) in &graph.tasks {
        let preds = graph.reachable_predecessors(task_id);
        let mut paths = Vec::new();
        for pred in &preds {
            if let Some(pred_task) = graph.tasks.get(pred) {
                let schema = compute_step_output_schema(&pred_task.step);
                paths.extend(paths_from_schema(pred, &schema));
            }
        }
        // Check refs against available paths.
        let allowed: BTreeSet<_> = paths.iter().map(|p| p.path.clone()).collect();
        for reference in &task.path_refs {
            if !allowed.contains(reference) {
                errors.push(ValidationIssue {
                    task_id: Some(task_id.clone()),
                    message: format!("nonexistent path reference: {reference}"),
                });
            }
        }
        available_paths.insert(task_id.clone(), paths);
    }

    if graph.tasks.is_empty() {
        warnings.push(ValidationIssue {
            task_id: None,
            message: "plan has no tasks".into(),
        });
    }

    ValidationReport {
        errors,
        warnings,
        available_paths,
    }
}

/// Compact summary for individual task mutations. Not a full report.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MutationSummary {
    pub task_id: TaskId,
    pub ok: bool,
    pub error_count: usize,
    pub warning_count: usize,
    pub available_path_count: usize,
}

pub fn mutation_summary(graph: &PlanGraph, task_id: &TaskId) -> MutationSummary {
    let report = validate_plan(graph);
    let error_count = report
        .errors
        .iter()
        .filter(|issue| issue.task_id.as_ref() == Some(task_id))
        .count();
    let warning_count = report
        .warnings
        .iter()
        .filter(|issue| issue.task_id.as_ref() == Some(task_id))
        .count();
    let available_path_count = report
        .available_paths
        .get(task_id)
        .map(|p| p.len())
        .unwrap_or(0);
    MutationSummary {
        task_id: task_id.clone(),
        ok: error_count == 0,
        error_count,
        warning_count,
        available_path_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::step_schema::{AffordanceManifest, FieldSpec};

    fn fields() -> Vec<FieldSpec> {
        vec![
            FieldSpec {
                name: "parcel_id".into(),
                json_type: "string".into(),
                required: true,
            },
            FieldSpec {
                name: "id".into(),
                json_type: "string".into(),
                required: true,
            },
        ]
    }

    #[test]
    fn three_step_plan_exposes_only_reachable_upstream_paths() {
        let t1 = TaskId("t1".into());
        let t2 = TaskId("t2".into());
        let t3 = TaskId("t3".into());
        let unreachable = TaskId("branch".into());
        let mut graph = PlanGraph::default();
        graph.tasks.insert(
            t1.clone(),
            PlanTaskDef {
                id: t1.clone(),
                step: StepDefinition::RecordVerb {
                    verb: "find_many_gclba_properties".into(),
                    object_type_id: "gclba_property".into(),
                    fields: fields(),
                },
                path_refs: vec![],
            },
        );
        graph.tasks.insert(
            t2.clone(),
            PlanTaskDef {
                id: t2.clone(),
                step: StepDefinition::CodeCell {
                    return_type: Some(serde_json::json!({
                        "type": "object",
                        "properties": { "score": { "type": "number" } }
                    })),
                },
                path_refs: vec![],
            },
        );
        graph.tasks.insert(
            t3.clone(),
            PlanTaskDef {
                id: t3.clone(),
                step: StepDefinition::Affordance {
                    manifest: Some(AffordanceManifest {
                        id: "write".into(),
                        output_schema: Some(serde_json::json!({ "type": "boolean" })),
                    }),
                },
                path_refs: vec!["{{t1.result.parcel_id}}".into()],
            },
        );
        graph.tasks.insert(
            unreachable.clone(),
            PlanTaskDef {
                id: unreachable.clone(),
                step: StepDefinition::CodeCell {
                    return_type: Some(serde_json::json!({
                        "type": "object",
                        "properties": { "secret": { "type": "string" } }
                    })),
                },
                path_refs: vec![],
            },
        );
        // Linear t1 -> t2 -> t3. branch is unreachable from t3.
        graph.edges.push((t1.clone(), t2.clone()));
        graph.edges.push((t2.clone(), t3.clone()));

        let report = validate_plan(&graph);
        let paths = report.available_paths.get(&t3).unwrap();
        assert!(paths.iter().any(|p| p.path == "{{t1.result.parcel_id}}"));
        assert!(paths.iter().any(|p| p.path.contains("t2.result")));
        assert!(!paths.iter().any(|p| p.path.contains("branch")));
        assert!(report.errors.is_empty());
    }

    #[test]
    fn unknown_output_contributes_no_paths() {
        let t1 = TaskId("t1".into());
        let t2 = TaskId("t2".into());
        let mut graph = PlanGraph::default();
        graph.tasks.insert(
            t1.clone(),
            PlanTaskDef {
                id: t1.clone(),
                step: StepDefinition::Affordance { manifest: None },
                path_refs: vec![],
            },
        );
        graph.tasks.insert(
            t2.clone(),
            PlanTaskDef {
                id: t2.clone(),
                step: StepDefinition::CodeCell {
                    return_type: Some(serde_json::json!({ "type": "string" })),
                },
                path_refs: vec![],
            },
        );
        graph.edges.push((t1.clone(), t2.clone()));
        let report = validate_plan(&graph);
        let paths = report.available_paths.get(&t2).unwrap();
        assert!(paths.is_empty());
    }

    #[test]
    fn nonexistent_path_error_alongside_available() {
        let t1 = TaskId("t1".into());
        let t2 = TaskId("t2".into());
        let mut graph = PlanGraph::default();
        graph.tasks.insert(
            t1.clone(),
            PlanTaskDef {
                id: t1.clone(),
                step: StepDefinition::RecordVerb {
                    verb: "find_many_gclba_properties".into(),
                    object_type_id: "gclba_property".into(),
                    fields: fields(),
                },
                path_refs: vec![],
            },
        );
        graph.tasks.insert(
            t2.clone(),
            PlanTaskDef {
                id: t2.clone(),
                step: StepDefinition::CodeCell {
                    return_type: Some(serde_json::json!({ "type": "string" })),
                },
                path_refs: vec!["{{t1.result.missing}}".into()],
            },
        );
        graph.edges.push((t1.clone(), t2.clone()));
        let report = validate_plan(&graph);
        assert!(!report.errors.is_empty());
        assert!(report
            .available_paths
            .get(&t2)
            .unwrap()
            .iter()
            .any(|p| p.path == "{{t1.result.parcel_id}}"));
    }

    #[test]
    fn mutation_returns_compact_summary() {
        let t1 = TaskId("t1".into());
        let mut graph = PlanGraph::default();
        graph.tasks.insert(
            t1.clone(),
            PlanTaskDef {
                id: t1.clone(),
                step: StepDefinition::CodeCell {
                    return_type: Some(serde_json::json!({ "type": "string" })),
                },
                path_refs: vec![],
            },
        );
        let summary = mutation_summary(&graph, &t1);
        assert!(summary.ok);
        assert_eq!(summary.error_count, 0);
        // Compact: no full available_paths map.
        let json = serde_json::to_value(&summary).unwrap();
        assert!(json.get("available_paths").is_none());
        assert!(json.get("available_path_count").is_some());
    }
}
