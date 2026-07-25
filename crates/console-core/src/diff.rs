use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::{GoldenId, GoldenRecord};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FieldChange {
    pub field: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EntityDiff {
    pub before_id: GoldenId,
    pub after_id: GoldenId,
    pub changes: Vec<FieldChange>,
}

pub fn diff_entities(before: &GoldenRecord, after: &GoldenRecord) -> EntityDiff {
    let mut keys = before.fields.keys().cloned().collect::<BTreeSet<_>>();
    keys.extend(after.fields.keys().cloned());

    let mut changes = Vec::new();
    if before.title != after.title {
        changes.push(FieldChange {
            field: "title".to_owned(),
            before: Some(Value::String(before.title.clone())),
            after: Some(Value::String(after.title.clone())),
        });
    }
    if before.entity_type != after.entity_type {
        changes.push(FieldChange {
            field: "entity_type".to_owned(),
            before: Some(Value::String(before.entity_type.clone())),
            after: Some(Value::String(after.entity_type.clone())),
        });
    }
    for key in keys {
        let old = before.fields.get(&key).cloned();
        let new = after.fields.get(&key).cloned();
        if old != new {
            changes.push(FieldChange {
                field: key,
                before: old,
                after: new,
            });
        }
    }

    EntityDiff {
        before_id: before.id.clone(),
        after_id: after.id.clone(),
        changes,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn record() -> GoldenRecord {
        GoldenRecord {
            id: GoldenId::new("golden:test"),
            entity_type: "person".into(),
            title: "Ada".into(),
            fields: [("city".into(), json!("London"))].into(),
            updated_at_ms: 1,
        }
    }

    #[test]
    fn reports_stable_field_order() {
        let before = record();
        let mut after = before.clone();
        after.title = "Ada Lovelace".into();
        after.fields.insert("city".into(), json!("Paris"));
        after.fields.insert("role".into(), json!("Mathematician"));

        let fields = diff_entities(&before, &after)
            .changes
            .into_iter()
            .map(|change| change.field)
            .collect::<Vec<_>>();
        assert_eq!(fields, ["title", "city", "role"]);
    }
}
