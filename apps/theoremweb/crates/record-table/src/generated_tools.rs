//! Typed calls into the generated record-tool family.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::schema::{ObjectType, ViewFilter, ViewSort};

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct RecordQuery {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub filters: Vec<ViewFilter>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sorts: Vec<ViewSort>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResultCompleteness {
    Page,
    FullFilteredSet,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GeneratedToolCall {
    pub tool: String,
    pub arguments: Value,
    pub completeness: ResultCompleteness,
}

impl GeneratedToolCall {
    #[must_use]
    pub fn find_many(object_type: &ObjectType, query: &RecordQuery) -> Self {
        Self {
            tool: format!("find_many_{}", snake_case(&object_type.name_plural)),
            arguments: serde_json::to_value(query).unwrap_or_else(|_| json!({})),
            completeness: ResultCompleteness::Page,
        }
    }

    #[must_use]
    pub fn update_one(
        object_type: &ObjectType,
        record_id: &str,
        field_key: &str,
        value: Value,
    ) -> Self {
        let mut arguments = Map::new();
        arguments.insert("id".into(), Value::String(record_id.to_owned()));
        arguments.insert(field_key.to_owned(), value);
        Self {
            tool: format!("update_one_{}", snake_case(&object_type.name_singular)),
            arguments: Value::Object(arguments),
            completeness: ResultCompleteness::Page,
        }
    }

    #[must_use]
    pub fn aggregate(
        object_type: &ObjectType,
        field_key: &str,
        operation: &str,
        query: &RecordQuery,
    ) -> Self {
        let mut arguments = serde_json::to_value(query)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default();
        arguments.remove("offset");
        arguments.remove("limit");
        arguments.insert("field".into(), Value::String(field_key.to_owned()));
        arguments.insert("op".into(), Value::String(operation.to_owned()));
        Self {
            tool: format!("aggregate_{}", snake_case(&object_type.name_plural)),
            arguments: Value::Object(arguments),
            completeness: ResultCompleteness::FullFilteredSet,
        }
    }

    #[must_use]
    pub fn group_by(object_type: &ObjectType, field_key: &str, query: &RecordQuery) -> Self {
        let mut arguments = serde_json::to_value(query)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default();
        arguments.remove("offset");
        arguments.remove("limit");
        arguments.insert("group_by".into(), Value::String(field_key.to_owned()));
        Self {
            tool: format!("group_by_{}", snake_case(&object_type.name_plural)),
            arguments: Value::Object(arguments),
            completeness: ResultCompleteness::FullFilteredSet,
        }
    }
}

fn snake_case(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut prior_was_separator = true;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            if character.is_ascii_uppercase() && !prior_was_separator && !out.ends_with('_') {
                out.push('_');
            }
            out.push(character.to_ascii_lowercase());
            prior_was_separator = false;
        } else if !prior_was_separator && !out.ends_with('_') {
            out.push('_');
            prior_was_separator = true;
        }
    }
    out.trim_matches('_').to_owned()
}

#[cfg(test)]
mod tests {
    use crate::schema::DeclaredModel;

    use super::*;

    fn company() -> ObjectType {
        serde_json::from_str::<DeclaredModel>(include_str!("../fixtures/companies-declared.json"))
            .unwrap()
            .with_schema_versions()
            .object_types
            .remove(0)
    }

    #[test]
    fn tool_names_match_the_generated_provider_contract() {
        let object_type = company();
        let query = RecordQuery::default();
        assert_eq!(
            GeneratedToolCall::find_many(&object_type, &query).tool,
            "find_many_companies"
        );
        assert_eq!(
            GeneratedToolCall::update_one(&object_type, "company-1", "name", json!("Acme")).tool,
            "update_one_company"
        );
        assert_eq!(
            GeneratedToolCall::aggregate(&object_type, "revenue", "sum", &query).completeness,
            ResultCompleteness::FullFilteredSet
        );
    }
}
