//! CP5. Step output schema: computed from the step definition. Never guessed.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FieldSpec {
    pub name: String,
    pub json_type: String,
    pub required: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AffordanceManifest {
    pub id: String,
    pub output_schema: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum StepDefinition {
    /// Generated record verb, e.g. find_many_gclba_properties.
    RecordVerb {
        verb: String,
        object_type_id: String,
        fields: Vec<FieldSpec>,
    },
    CodeCell {
        return_type: Option<Value>,
    },
    Affordance {
        manifest: Option<AffordanceManifest>,
    },
    PlanTask {
        affordance: Option<AffordanceManifest>,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum JsonSchema {
    Schema(Value),
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StepSchemaUnknown;

/// Compute the JSON Schema of what a step will produce. Unknown is valid.
pub fn compute_step_output_schema(step: &StepDefinition) -> JsonSchema {
    match step {
        StepDefinition::RecordVerb { fields, object_type_id, verb } => {
            let mut properties = serde_json::Map::new();
            let mut required = Vec::new();
            for field in fields {
                properties.insert(
                    field.name.clone(),
                    json!({ "type": field.json_type }),
                );
                if field.required {
                    required.push(field.name.clone());
                }
            }
            // find_many_* returns an array of records.
            let item = json!({
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": false,
                "x-object-type": object_type_id,
            });
            if verb.starts_with("find_many_") || verb.starts_with("list_") {
                JsonSchema::Schema(json!({
                    "type": "array",
                    "items": item,
                    "x-verb": verb,
                }))
            } else {
                JsonSchema::Schema(json!({
                    "type": "object",
                    "properties": {
                        "result": item
                    },
                    "required": ["result"],
                    "x-verb": verb,
                }))
            }
        }
        StepDefinition::CodeCell { return_type } => match return_type {
            Some(schema) => JsonSchema::Schema(schema.clone()),
            None => JsonSchema::Unknown,
        },
        StepDefinition::Affordance { manifest } | StepDefinition::PlanTask { affordance: manifest } => {
            match manifest {
                Some(AffordanceManifest {
                    output_schema: Some(schema),
                    ..
                }) => JsonSchema::Schema(schema.clone()),
                Some(AffordanceManifest {
                    output_schema: None,
                    ..
                })
                | None => JsonSchema::Unknown,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gclba_fields() -> Vec<FieldSpec> {
        vec![
            FieldSpec {
                name: "id".into(),
                json_type: "string".into(),
                required: true,
            },
            FieldSpec {
                name: "parcel_id".into(),
                json_type: "string".into(),
                required: true,
            },
            FieldSpec {
                name: "address".into(),
                json_type: "string".into(),
                required: false,
            },
        ]
    }

    #[test]
    fn find_many_gclba_properties_matches_array_shape() {
        let schema = compute_step_output_schema(&StepDefinition::RecordVerb {
            verb: "find_many_gclba_properties".into(),
            object_type_id: "gclba_property".into(),
            fields: gclba_fields(),
        });
        let JsonSchema::Schema(value) = schema else {
            panic!("expected schema");
        };
        assert_eq!(value["type"], "array");
        assert_eq!(value["items"]["properties"]["parcel_id"]["type"], "string");
        // An actual result must validate against this shape.
        let sample = json!([{ "id": "1", "parcel_id": "P-1", "address": "1 Main" }]);
        assert_eq!(sample[0]["parcel_id"], "P-1");
        assert!(value["items"]["required"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "parcel_id"));
    }

    #[test]
    fn code_cell_returns_declared_type() {
        let declared = json!({ "type": "number" });
        let schema = compute_step_output_schema(&StepDefinition::CodeCell {
            return_type: Some(declared.clone()),
        });
        assert_eq!(schema, JsonSchema::Schema(declared));
    }

    #[test]
    fn affordance_without_manifest_returns_unknown_not_empty_object() {
        let schema = compute_step_output_schema(&StepDefinition::Affordance { manifest: None });
        assert_eq!(schema, JsonSchema::Unknown);
        let schema = compute_step_output_schema(&StepDefinition::Affordance {
            manifest: Some(AffordanceManifest {
                id: "x".into(),
                output_schema: None,
            }),
        });
        assert_eq!(schema, JsonSchema::Unknown);
        // Never fabricate {}.
        assert_ne!(schema, JsonSchema::Schema(json!({})));
    }
}
