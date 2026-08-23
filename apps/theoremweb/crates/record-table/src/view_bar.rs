use crate::generated_tools::RecordQuery;
use crate::schema::{FieldKind, FilterOperator, ViewMetadata};

#[derive(Clone, Debug, PartialEq)]
pub struct ViewBar {
    pub active: ViewMetadata,
    pub record_count: u64,
}

impl ViewBar {
    #[must_use]
    pub fn header(&self) -> String {
        format!("{} · {}", self.active.name, self.record_count)
    }

    #[must_use]
    pub fn query(&self) -> RecordQuery {
        RecordQuery {
            filters: self.active.filters.clone(),
            sorts: self.active.sorts.clone(),
            offset: None,
            limit: None,
        }
    }

    #[must_use]
    pub fn switch_to(&self, next: ViewMetadata, record_count: u64) -> Self {
        Self {
            active: next,
            record_count,
        }
    }

    #[must_use]
    pub fn save_as(&self, view_id: impl Into<String>, name: impl Into<String>) -> ViewMetadata {
        let mut copy = self.active.clone();
        copy.view_id = view_id.into();
        copy.name = name.into();
        copy
    }
}

#[must_use]
pub fn operators_for(kind: &FieldKind) -> &'static [FilterOperator] {
    use FilterOperator as Op;
    const EQUALITY: &[Op] = &[Op::Eq, Op::NotEq, Op::IsEmpty, Op::IsNotEmpty];
    const TEXT: &[Op] = &[
        Op::Eq,
        Op::NotEq,
        Op::Contains,
        Op::StartsWith,
        Op::In,
        Op::NotIn,
        Op::IsEmpty,
        Op::IsNotEmpty,
    ];
    const ORDERED: &[Op] = &[
        Op::Eq,
        Op::NotEq,
        Op::GreaterThan,
        Op::GreaterThanOrEqual,
        Op::LessThan,
        Op::LessThanOrEqual,
        Op::IsEmpty,
        Op::IsNotEmpty,
    ];
    match kind {
        FieldKind::Text | FieldKind::LongText | FieldKind::Uuid => TEXT,
        FieldKind::Integer | FieldKind::Number | FieldKind::Timestamp | FieldKind::Date => ORDERED,
        _ => EQUALITY,
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::{SortDirection, ViewSort};

    use super::*;

    #[test]
    fn switching_views_swaps_server_query_state_together() {
        let first = ViewMetadata {
            view_id: "a".into(),
            tenant_id: "t".into(),
            object_type_id: "company".into(),
            name: "All".into(),
            schema_version: "v1".into(),
            filters: Vec::new(),
            sorts: Vec::new(),
            group_by: None,
            columns: Vec::new(),
        };
        let mut second = first.clone();
        second.view_id = "b".into();
        second.name = "Newest".into();
        second.sorts.push(ViewSort {
            field_key: "created_at".into(),
            direction: SortDirection::Desc,
        });
        let bar = ViewBar {
            active: first,
            record_count: 10,
        }
        .switch_to(second, 3);
        assert_eq!(bar.header(), "Newest · 3");
        assert_eq!(bar.query().sorts.len(), 1);
    }
}
