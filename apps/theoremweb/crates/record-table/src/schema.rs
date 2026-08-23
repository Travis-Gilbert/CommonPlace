//! Forward-compatible wire types for the declared-schema and view contracts.

use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{Map, Value};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FieldKind {
    Text,
    LongText,
    Integer,
    Number,
    Boolean,
    Timestamp,
    Date,
    Uuid,
    Json,
    Enum,
    Vector,
    Geometry,
    Relation,
    Unknown(String),
}

impl FieldKind {
    #[must_use]
    pub fn from_wire(value: &str) -> Self {
        match value {
            "text" => Self::Text,
            "long_text" => Self::LongText,
            "integer" => Self::Integer,
            "number" => Self::Number,
            "boolean" => Self::Boolean,
            "timestamp" => Self::Timestamp,
            "date" => Self::Date,
            "uuid" => Self::Uuid,
            "json" => Self::Json,
            "enum" => Self::Enum,
            "vector" => Self::Vector,
            "geometry" => Self::Geometry,
            "relation" => Self::Relation,
            other => Self::Unknown(other.to_owned()),
        }
    }

    #[must_use]
    pub fn wire_name(&self) -> &str {
        match self {
            Self::Text => "text",
            Self::LongText => "long_text",
            Self::Integer => "integer",
            Self::Number => "number",
            Self::Boolean => "boolean",
            Self::Timestamp => "timestamp",
            Self::Date => "date",
            Self::Uuid => "uuid",
            Self::Json => "json",
            Self::Enum => "enum",
            Self::Vector => "vector",
            Self::Geometry => "geometry",
            Self::Relation => "relation",
            Self::Unknown(name) => name,
        }
    }
}

/// The exact field-type payload, including data from variants this build does
/// not know yet.
#[derive(Clone, Debug, PartialEq)]
pub struct FieldType {
    pub kind: FieldKind,
    pub raw: Value,
}

impl FieldType {
    #[must_use]
    pub fn new(kind: FieldKind) -> Self {
        let raw = serde_json::json!({"kind": kind.wire_name()});
        Self { kind, raw }
    }

    #[must_use]
    pub fn enum_variants(&self) -> &[Value] {
        self.raw
            .get("variants")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[])
    }

    #[must_use]
    pub fn relation_target(&self) -> Option<&str> {
        self.raw
            .get("target_object_type_id")
            .and_then(Value::as_str)
    }

    #[must_use]
    pub fn relation_is_many(&self) -> bool {
        self.raw.get("cardinality").and_then(Value::as_str) == Some("many")
    }
}

impl Serialize for FieldType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.raw.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for FieldType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = Value::deserialize(deserializer)?;
        let kind = raw
            .get("kind")
            .and_then(Value::as_str)
            .map(FieldKind::from_wire)
            .unwrap_or_else(|| FieldKind::Unknown("missing_kind".into()));
        Ok(Self { kind, raw })
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FieldSpec {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    pub field_type: FieldType,
    pub required: bool,
    pub system: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ObjectType {
    pub object_type_id: String,
    pub tenant_id: String,
    pub name_singular: String,
    pub name_plural: String,
    pub label_singular: String,
    pub label_plural: String,
    #[serde(default)]
    pub description: Option<String>,
    pub node_label: String,
    pub label_identifier_field: String,
    pub fields: Vec<FieldSpec>,
    pub enforcement: Enforcement,
    pub system: bool,
    #[serde(default)]
    pub extensions: BTreeMap<String, Value>,
    pub content_anchor: String,
    #[serde(default)]
    pub retired: bool,
    /// Enriched by the declared-model boundary from its top-level receipt.
    #[serde(default)]
    pub schema_version: String,
}

impl ObjectType {
    #[must_use]
    pub fn semantic_kind(&self, field_key: &str) -> Option<&str> {
        self.extensions
            .get("theorem.field_semantics")
            .and_then(Value::as_object)
            .and_then(|fields| fields.get(field_key))
            .and_then(Value::as_str)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Enforcement {
    Observe,
    #[default]
    Warn,
    Reject,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Eq,
    NotEq,
    Contains,
    StartsWith,
    In,
    NotIn,
    IsEmpty,
    IsNotEmpty,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewFilter {
    pub field_key: String,
    pub operator: FilterOperator,
    #[serde(default)]
    pub value: Value,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ViewSort {
    pub field_key: String,
    pub direction: SortDirection,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ViewColumn {
    pub field_key: String,
    pub order: u32,
    pub width: i32,
    pub visible: bool,
    pub pinned: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewMetadata {
    pub view_id: String,
    pub tenant_id: String,
    pub object_type_id: String,
    pub name: String,
    pub schema_version: String,
    #[serde(default)]
    pub filters: Vec<ViewFilter>,
    #[serde(default)]
    pub sorts: Vec<ViewSort>,
    #[serde(default)]
    pub group_by: Option<String>,
    #[serde(default)]
    pub columns: Vec<ViewColumn>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DeclaredModel {
    pub object_types: Vec<ObjectType>,
    #[serde(default)]
    pub views: Vec<ViewMetadata>,
    #[serde(default)]
    pub schema_version: Option<Value>,
}

impl DeclaredModel {
    /// Propagate the top-level schema receipt into each runtime object type.
    #[must_use]
    pub fn with_schema_versions(mut self) -> Self {
        let version = self
            .schema_version
            .as_ref()
            .and_then(|value| {
                value
                    .get("schema_version_id")
                    .or_else(|| value.get("id"))
                    .or_else(|| value.get("version"))
            })
            .and_then(|value| match value {
                Value::String(value) => Some(value.clone()),
                Value::Number(value) => Some(value.to_string()),
                _ => None,
            })
            .unwrap_or_default();
        for object_type in &mut self.object_types {
            if object_type.schema_version.is_empty() {
                object_type.schema_version.clone_from(&version);
            }
        }
        self
    }
}

#[must_use]
pub fn object(values: impl IntoIterator<Item = (String, Value)>) -> Value {
    Value::Object(Map::from_iter(values))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_field_variant_round_trips_with_raw_payload() {
        let source = serde_json::json!({"kind": "currency", "code": "USD", "scale": 2});
        let decoded: FieldType = serde_json::from_value(source.clone()).unwrap();
        assert_eq!(decoded.kind, FieldKind::Unknown("currency".into()));
        assert_eq!(decoded.raw, source);
        assert_eq!(serde_json::to_value(decoded).unwrap(), source);
    }

    #[test]
    fn declared_model_propagates_top_level_schema_receipt() {
        let source = include_str!("../fixtures/companies-declared.json");
        let model: DeclaredModel = serde_json::from_str(source).unwrap();
        let model = model.with_schema_versions();
        assert_eq!(model.object_types[0].schema_version, "schema-v7");
    }
}
