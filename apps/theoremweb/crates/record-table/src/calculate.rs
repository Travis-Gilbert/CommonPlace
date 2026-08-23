use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::generated_tools::{GeneratedToolCall, RecordQuery};
use crate::schema::{FieldKind, ObjectType};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AggregateOperation {
    Count,
    Empty,
    NonEmpty,
    Sum,
    Average,
    Min,
    Max,
    Earliest,
    Latest,
}

impl AggregateOperation {
    #[must_use]
    pub const fn wire_name(self) -> &'static str {
        match self {
            Self::Count => "count",
            Self::Empty => "empty",
            Self::NonEmpty => "non_empty",
            Self::Sum => "sum",
            Self::Average => "average",
            Self::Min => "min",
            Self::Max => "max",
            Self::Earliest => "earliest",
            Self::Latest => "latest",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct AggregateReceipt {
    pub field: String,
    pub op: String,
    #[serde(default)]
    pub value: Option<Value>,
    pub available: bool,
    #[serde(default)]
    pub reason: Option<String>,
}

impl AggregateReceipt {
    #[must_use]
    pub fn display_value(&self) -> String {
        if !self.available {
            return self
                .reason
                .clone()
                .unwrap_or_else(|| "Aggregate unavailable".into());
        }
        self.value
            .as_ref()
            .map(Value::to_string)
            .unwrap_or_else(|| "No value".into())
    }
}

#[must_use]
pub fn operations_for(kind: &FieldKind) -> Vec<AggregateOperation> {
    let mut operations = vec![
        AggregateOperation::Count,
        AggregateOperation::Empty,
        AggregateOperation::NonEmpty,
    ];
    match kind {
        FieldKind::Integer | FieldKind::Number => operations.extend([
            AggregateOperation::Sum,
            AggregateOperation::Average,
            AggregateOperation::Min,
            AggregateOperation::Max,
        ]),
        FieldKind::Date | FieldKind::Timestamp => {
            operations.extend([AggregateOperation::Earliest, AggregateOperation::Latest])
        }
        _ => {}
    }
    operations
}

#[must_use]
pub fn aggregate_call(
    object_type: &ObjectType,
    field_key: &str,
    operation: AggregateOperation,
    filtered_query: &RecordQuery,
) -> GeneratedToolCall {
    GeneratedToolCall::aggregate(
        object_type,
        field_key,
        operation.wire_name(),
        filtered_query,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_numeric_fields_offer_only_counts() {
        assert_eq!(
            operations_for(&FieldKind::Text),
            vec![
                AggregateOperation::Count,
                AggregateOperation::Empty,
                AggregateOperation::NonEmpty
            ]
        );
        assert!(operations_for(&FieldKind::Number).contains(&AggregateOperation::Sum));
        assert!(operations_for(&FieldKind::Date).contains(&AggregateOperation::Earliest));
    }

    #[test]
    fn unavailable_receipt_never_pretends_to_be_zero() {
        let receipt: AggregateReceipt = serde_json::from_value(serde_json::json!({
            "field": "name",
            "op": "sum",
            "available": false,
            "reason": "numeric aggregate unavailable for non-numeric field"
        }))
        .unwrap();
        assert_eq!(
            receipt.display_value(),
            "numeric aggregate unavailable for non-numeric field"
        );
    }
}
