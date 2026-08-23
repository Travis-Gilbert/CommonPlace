use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::LayoutWidget;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AggregateCompleteness {
    Page,
    FullFilteredSet,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ServerAggregateReceipt {
    pub widget_id: String,
    pub tool: String,
    pub arguments: Value,
    pub value: Value,
    pub completeness: AggregateCompleteness,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AggregateCall {
    pub tool: String,
    pub arguments: Value,
    pub completeness: AggregateCompleteness,
}

impl AggregateCall {
    /// Build a full-filtered-set aggregate call from a chart widget.
    ///
    /// # Errors
    ///
    /// Returns [`DashboardError::MissingParameter`] when the widget does not
    /// name its object type, field, or operation.
    pub fn from_widget(widget: &LayoutWidget) -> Result<Self, DashboardError> {
        let object_type = required_param(widget, "object_type")?;
        let field = required_param(widget, "field")?;
        let operation = required_param(widget, "operation")?;
        let mut arguments = widget
            .body_params
            .get("query")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        arguments.remove("offset");
        arguments.remove("limit");
        arguments.insert("field".into(), Value::String(field.into()));
        arguments.insert("op".into(), Value::String(operation.into()));
        Ok(Self {
            tool: format!("aggregate_{}", snake_case(object_type)),
            arguments: Value::Object(arguments),
            completeness: AggregateCompleteness::FullFilteredSet,
        })
    }
}

/// Project only server-attested full-set values into dashboard widget ids.
///
/// # Errors
///
/// Returns [`DashboardError::PageAggregateRefused`] if any receipt covers
/// only the loaded page.
pub fn project_server_aggregates(
    receipts: impl IntoIterator<Item = ServerAggregateReceipt>,
) -> Result<BTreeMap<String, Value>, DashboardError> {
    receipts
        .into_iter()
        .map(|receipt| {
            if receipt.completeness != AggregateCompleteness::FullFilteredSet {
                return Err(DashboardError::PageAggregateRefused(receipt.widget_id));
            }
            Ok((receipt.widget_id, receipt.value))
        })
        .collect()
}

fn required_param<'a>(widget: &'a LayoutWidget, key: &str) -> Result<&'a str, DashboardError> {
    widget
        .body_params
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| DashboardError::MissingParameter {
            widget_id: widget.widget_id.clone(),
            key: key.into(),
        })
}

fn snake_case(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .into()
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum DashboardError {
    #[error("dashboard widget {widget_id} requires {key}")]
    MissingParameter { widget_id: String, key: String },
    #[error("dashboard refused page-scoped aggregate for widget {0}")]
    PageAggregateRefused(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GridRect;
    use serde_json::Map;

    fn chart() -> LayoutWidget {
        LayoutWidget {
            widget_id: "revenue".into(),
            body_kind: "chart".into(),
            body_params: serde_json::json!({
                "object_type": "companies",
                "field": "revenue",
                "operation": "sum",
                "query": {"filters": [{"field_key": "status", "operator": "eq", "value": "Active"}], "offset": 0, "limit": 1}
            }),
            grid: GridRect {
                x: 0,
                y: 0,
                w: 6,
                h: 4,
            },
            field_visibility: None,
        }
    }

    #[test]
    fn aggregate_call_drops_page_bounds_and_requires_full_set() {
        let call = AggregateCall::from_widget(&chart()).unwrap();
        assert_eq!(call.tool, "aggregate_companies");
        assert!(call.arguments.get("offset").is_none());
        assert!(call.arguments.get("limit").is_none());
        assert_eq!(call.completeness, AggregateCompleteness::FullFilteredSet);
    }

    #[test]
    fn dashboard_projects_server_truth_not_the_loaded_page() {
        let loaded_page_sum = 20;
        let projected = project_server_aggregates([ServerAggregateReceipt {
            widget_id: "revenue".into(),
            tool: "aggregate_companies".into(),
            arguments: Value::Object(Map::new()),
            value: Value::from(50),
            completeness: AggregateCompleteness::FullFilteredSet,
        }])
        .unwrap();
        assert_eq!(loaded_page_sum, 20);
        assert_eq!(projected["revenue"], 50);
        assert_ne!(projected["revenue"], loaded_page_sum);
    }

    #[test]
    fn page_scoped_dashboard_value_is_refused() {
        let error = project_server_aggregates([ServerAggregateReceipt {
            widget_id: "revenue".into(),
            tool: "aggregate_companies".into(),
            arguments: Value::Object(Map::new()),
            value: Value::from(20),
            completeness: AggregateCompleteness::Page,
        }])
        .unwrap_err();
        assert_eq!(
            error.to_string(),
            "dashboard refused page-scoped aggregate for widget revenue"
        );
    }
}
