use serde_json::Value;

use crate::generated_tools::GeneratedToolCall;
use crate::schema::{Enforcement, ObjectType};

#[derive(Clone, Debug, PartialEq)]
pub enum EditStatus {
    Editing,
    Saving,
    Saved,
    Refused { message: String },
}

#[derive(Clone, Debug, PartialEq)]
pub struct OptimisticEdit {
    pub record_id: String,
    pub field_key: String,
    pub original: Value,
    pub displayed: Value,
    pub status: EditStatus,
}

impl OptimisticEdit {
    #[must_use]
    pub fn begin(
        record_id: impl Into<String>,
        field_key: impl Into<String>,
        original: Value,
    ) -> Self {
        Self {
            record_id: record_id.into(),
            field_key: field_key.into(),
            displayed: original.clone(),
            original,
            status: EditStatus::Editing,
        }
    }

    pub fn commit(
        &mut self,
        object_type: &ObjectType,
        optimistic_value: Value,
    ) -> GeneratedToolCall {
        self.displayed = optimistic_value.clone();
        self.status = EditStatus::Saving;
        GeneratedToolCall::update_one(
            object_type,
            &self.record_id,
            &self.field_key,
            optimistic_value,
        )
    }

    pub fn accept(&mut self, persisted_value: Value) {
        self.original = persisted_value.clone();
        self.displayed = persisted_value;
        self.status = EditStatus::Saved;
    }

    pub fn refuse(&mut self, enforcement: Enforcement, reason: impl Into<String>) {
        self.displayed = self.original.clone();
        let enforcement_name = match enforcement {
            Enforcement::Observe => "Observe",
            Enforcement::Warn => "Warn",
            Enforcement::Reject => "Reject",
        };
        self.status = EditStatus::Refused {
            message: format!("{enforcement_name} enforcement: {}", reason.into()),
        };
    }
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
    fn reject_rolls_back_and_names_enforcement() {
        let mut edit = OptimisticEdit::begin("c1", "revenue", serde_json::json!(100));
        let call = edit.commit(&company(), serde_json::json!("not a number"));
        assert_eq!(call.tool, "update_one_company");
        assert_eq!(edit.displayed, serde_json::json!("not a number"));
        edit.refuse(Enforcement::Reject, "revenue diverges from number");
        assert_eq!(edit.displayed, serde_json::json!(100));
        assert_eq!(
            edit.status,
            EditStatus::Refused {
                message: "Reject enforcement: revenue diverges from number".into()
            }
        );
    }
}
