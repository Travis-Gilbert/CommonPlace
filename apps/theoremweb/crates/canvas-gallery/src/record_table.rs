//! A6 record-table body over runtime columns and a generated-tool record page.

use serde_json::Value;
use theoremweb_record_table::{ColumnSet, HEADER_HEIGHT, ROW_HEIGHT};

pub const CARD_VISIBLE_ROWS: usize = 6;
pub const FOCUS_VISIBLE_ROWS: usize = 10;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Expansion {
    Collapsed,
    Card,
    Focus,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LiveRecordPage {
    pub object_type_id: String,
    pub schema_version: String,
    pub records: Vec<Value>,
    pub total_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BodySize {
    pub visible_rows: usize,
    pub height_px: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RecordTableBody<'a> {
    pub columns: &'a ColumnSet,
    pub page: &'a LiveRecordPage,
    pub expansion: Expansion,
}

impl RecordTableBody<'_> {
    #[must_use]
    pub fn visible_records(&self) -> &[Value] {
        let count = self.size().visible_rows.min(self.page.records.len());
        &self.page.records[..count]
    }

    #[must_use]
    pub fn size(&self) -> BodySize {
        let visible_rows = match self.expansion {
            Expansion::Collapsed => 0,
            Expansion::Card => CARD_VISIBLE_ROWS,
            Expansion::Focus => FOCUS_VISIBLE_ROWS,
        };
        let header = usize::from(HEADER_HEIGHT);
        let rows = visible_rows.saturating_mul(usize::from(ROW_HEIGHT));
        BodySize {
            visible_rows,
            height_px: header.saturating_add(rows),
        }
    }

    pub fn validate_contract(&self) -> Result<(), String> {
        if self.page.object_type_id != self.columns.object_type {
            return Err(format!(
                "record page object type `{}` does not match columns `{}`",
                self.page.object_type_id, self.columns.object_type
            ));
        }
        if self.page.schema_version != self.columns.schema_version {
            return Err(format!(
                "record page schema version `{}` does not match columns `{}`",
                self.page.schema_version, self.columns.schema_version
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use theoremweb_record_table::schema::DeclaredModel;

    use super::*;

    #[test]
    fn live_body_preserves_card_and_focus_size_negotiation() {
        let mut object_type = serde_json::from_str::<DeclaredModel>(include_str!(
            "../../record-table/fixtures/companies-declared.json"
        ))
        .unwrap()
        .with_schema_versions()
        .object_types
        .remove(0);
        let columns = ColumnSet::from_declared(&object_type, None).unwrap();
        let page = LiveRecordPage {
            object_type_id: object_type.object_type_id.clone(),
            schema_version: object_type.schema_version.clone(),
            records: (0..20)
                .map(|index| serde_json::json!({"id": index, "name": format!("Company {index}")}))
                .collect(),
            total_count: 20,
        };

        let collapsed = RecordTableBody {
            columns: &columns,
            page: &page,
            expansion: Expansion::Collapsed,
        };
        let card = RecordTableBody {
            expansion: Expansion::Card,
            ..collapsed.clone()
        };
        let focus = RecordTableBody {
            expansion: Expansion::Focus,
            ..collapsed.clone()
        };
        assert_eq!(collapsed.visible_records().len(), 0);
        assert_eq!(card.visible_records().len(), CARD_VISIBLE_ROWS);
        assert_eq!(focus.visible_records().len(), FOCUS_VISIBLE_ROWS);
        assert_eq!(card.size().height_px, 32 + CARD_VISIBLE_ROWS * 32);
        assert_eq!(focus.size().height_px, 32 + FOCUS_VISIBLE_ROWS * 32);
        card.validate_contract().unwrap();

        object_type.schema_version = "different".into();
        let mismatched = ColumnSet::from_declared(&object_type, None).unwrap();
        assert!(RecordTableBody {
            columns: &mismatched,
            page: &page,
            expansion: Expansion::Card,
        }
        .validate_contract()
        .unwrap_err()
        .contains("schema version"));
    }
}
