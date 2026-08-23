use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write;

use theoremweb_chrome::ThemeCommon;
use thiserror::Error;

use crate::schema::{FieldKind, FieldType, ObjectType, ViewMetadata};

#[derive(Clone, Debug, PartialEq)]
pub struct FieldColumn {
    pub field_key: String,
    pub label: String,
    pub field_type: FieldType,
    pub width: i32,
    pub colindex: i32,
    pub pinned: bool,
    pub visible: bool,
    pub sortable: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ColumnSet {
    pub object_type: String,
    pub schema_version: String,
    pub columns: Vec<FieldColumn>,
    label_identifier_field: String,
}

#[derive(Clone, Debug, Error, PartialEq, Eq)]
pub enum ColumnError {
    #[error("declared object type `{0}` has no fields")]
    NoFields(String),
    #[error("label identifier field `{field}` is absent from `{object_type}`")]
    MissingLabelIdentifier { object_type: String, field: String },
    #[error("view `{view}` belongs to `{actual}`, not `{expected}`")]
    ViewObjectMismatch {
        view: String,
        expected: String,
        actual: String,
    },
    #[error("view `{view}` references unknown field `{field}`")]
    UnknownViewField { view: String, field: String },
    #[error("field `{0}` is not in this column set")]
    UnknownColumn(String),
}

impl ColumnSet {
    pub fn from_declared(
        object_type: &ObjectType,
        view: Option<&ViewMetadata>,
    ) -> Result<Self, ColumnError> {
        if object_type.fields.is_empty() {
            return Err(ColumnError::NoFields(object_type.object_type_id.clone()));
        }
        if !object_type
            .fields
            .iter()
            .any(|field| field.key == object_type.label_identifier_field)
        {
            return Err(ColumnError::MissingLabelIdentifier {
                object_type: object_type.object_type_id.clone(),
                field: object_type.label_identifier_field.clone(),
            });
        }
        if let Some(view) = view {
            if view.object_type_id != object_type.object_type_id {
                return Err(ColumnError::ViewObjectMismatch {
                    view: view.view_id.clone(),
                    expected: object_type.object_type_id.clone(),
                    actual: view.object_type_id.clone(),
                });
            }
        }

        let configuration = view
            .map(|view| {
                view.columns
                    .iter()
                    .map(|column| (column.field_key.as_str(), column))
                    .collect::<BTreeMap<_, _>>()
            })
            .unwrap_or_default();
        let known = object_type
            .fields
            .iter()
            .map(|field| field.key.as_str())
            .collect::<BTreeSet<_>>();
        if let Some(view) = view {
            for field in configuration.keys() {
                if !known.contains(field) {
                    return Err(ColumnError::UnknownViewField {
                        view: view.view_id.clone(),
                        field: (*field).to_owned(),
                    });
                }
            }
        }

        let mut fields = object_type.fields.iter().collect::<Vec<_>>();
        fields.sort_by_key(|field| {
            configuration
                .get(field.key.as_str())
                .map(|column| column.order)
                .unwrap_or(u32::MAX)
        });
        if view.is_none() {
            fields.sort_by_key(|field| field.key != object_type.label_identifier_field);
        }

        let columns = fields
            .into_iter()
            .enumerate()
            .map(|(index, field)| {
                let configured = configuration.get(field.key.as_str());
                FieldColumn {
                    field_key: field.key.clone(),
                    label: field.label.clone(),
                    field_type: field.field_type.clone(),
                    width: configured
                        .map(|column| column.width)
                        .filter(|width| *width > 0)
                        .unwrap_or_else(|| default_width(&field.field_type.kind)),
                    colindex: i32::try_from(index).unwrap_or(i32::MAX) + 2,
                    pinned: configured.is_some_and(|column| column.pinned),
                    visible: configured.is_none_or(|column| column.visible),
                    sortable: !matches!(
                        field.field_type.kind,
                        FieldKind::Json | FieldKind::Vector | FieldKind::Geometry
                    ),
                }
            })
            .collect();

        Ok(Self {
            object_type: object_type.object_type_id.clone(),
            schema_version: view
                .map(|view| view.schema_version.clone())
                .filter(|version| !version.is_empty())
                .unwrap_or_else(|| object_type.schema_version.clone()),
            columns,
            label_identifier_field: object_type.label_identifier_field.clone(),
        })
    }

    #[must_use]
    pub fn grid_style(&self) -> String {
        let checkbox = ThemeCommon::TWENTY.table.checkbox_column_width_px;
        let mut style =
            format!("--header-Select-size: {checkbox}; --col-Select-size: {checkbox}; ");
        for column in &self.columns {
            write!(
                style,
                "--header-{}-size: {}; --col-{}-size: {}; ",
                column.field_key, column.width, column.field_key, column.width
            )
            .expect("writing to String cannot fail");
        }
        style.push_str("max-height: calc(100vh - 16rem);");
        style
    }

    pub fn pinned_left(&self, field_key: &str) -> Result<i32, ColumnError> {
        let mut left = i32::from(ThemeCommon::TWENTY.table.checkbox_column_width_px);
        for column in &self.columns {
            if column.field_key == field_key {
                return Ok(left);
            }
            if column.pinned && column.visible {
                left = left.saturating_add(column.width);
            }
        }
        Err(ColumnError::UnknownColumn(field_key.to_owned()))
    }

    pub fn label_identifier(&self) -> &FieldColumn {
        self.columns
            .iter()
            .find(|column| column.field_key == self.label_identifier_field)
            .expect("constructor verifies the label identifier")
    }

    pub fn visible(&self) -> impl Iterator<Item = &FieldColumn> {
        self.columns.iter().filter(|column| column.visible)
    }
}

fn default_width(kind: &FieldKind) -> i32 {
    match kind {
        FieldKind::Boolean => 96,
        FieldKind::Integer | FieldKind::Number => 128,
        FieldKind::Date | FieldKind::Timestamp => 160,
        FieldKind::Json | FieldKind::Geometry | FieldKind::Vector => 220,
        FieldKind::Relation => 200,
        FieldKind::LongText => 280,
        _ => 180,
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::{DeclaredModel, ViewColumn};

    use super::*;

    fn fixture(path: &str) -> ObjectType {
        let source = match path {
            "companies" => include_str!("../fixtures/companies-declared.json"),
            "tasks" => include_str!("../fixtures/tasks-declared.json"),
            _ => unreachable!(),
        };
        serde_json::from_str::<DeclaredModel>(source)
            .unwrap()
            .with_schema_versions()
            .object_types
            .remove(0)
    }

    #[test]
    fn two_object_types_create_different_runtime_columns_without_code_changes() {
        let companies = ColumnSet::from_declared(&fixture("companies"), None).unwrap();
        let tasks = ColumnSet::from_declared(&fixture("tasks"), None).unwrap();
        assert_eq!(companies.label_identifier().field_key, "name");
        assert_eq!(tasks.label_identifier().field_key, "title");
        assert_ne!(
            companies
                .columns
                .iter()
                .map(|column| &column.field_key)
                .collect::<Vec<_>>(),
            tasks
                .columns
                .iter()
                .map(|column| &column.field_key)
                .collect::<Vec<_>>()
        );
        assert_eq!(companies.schema_version, "schema-v7");
        assert_eq!(tasks.schema_version, "schema-v9");
    }

    #[test]
    fn view_restores_order_width_visibility_and_pin_offsets() {
        let company = fixture("companies");
        let view = ViewMetadata {
            view_id: "view-1".into(),
            tenant_id: "tenant-a".into(),
            object_type_id: company.object_type_id.clone(),
            name: "Revenue".into(),
            schema_version: "schema-v8".into(),
            filters: Vec::new(),
            sorts: Vec::new(),
            group_by: None,
            columns: vec![
                ViewColumn {
                    field_key: "revenue".into(),
                    order: 0,
                    width: 144,
                    visible: true,
                    pinned: true,
                },
                ViewColumn {
                    field_key: "name".into(),
                    order: 1,
                    width: 240,
                    visible: false,
                    pinned: false,
                },
            ],
        };
        let set = ColumnSet::from_declared(&company, Some(&view)).unwrap();
        assert_eq!(set.columns[0].field_key, "revenue");
        assert_eq!(set.columns[0].width, 144);
        assert!(!set.columns[1].visible);
        assert_eq!(set.pinned_left("revenue").unwrap(), 32);
        assert_eq!(set.schema_version, "schema-v8");
        assert!(set.grid_style().contains("--col-revenue-size: 144"));
    }

    #[test]
    fn a_new_declared_field_appears_without_a_recompile() {
        let mut company = fixture("companies");
        let before = ColumnSet::from_declared(&company, None).unwrap();
        company.fields.push(crate::schema::FieldSpec {
            key: "score".into(),
            label: "Score".into(),
            description: None,
            field_type: FieldType::new(FieldKind::Number),
            required: false,
            system: false,
        });
        company.schema_version = "schema-v8".into();
        let after = ColumnSet::from_declared(&company, None).unwrap();
        assert_eq!(after.columns.len(), before.columns.len() + 1);
        assert!(after
            .columns
            .iter()
            .any(|column| column.field_key == "score"));
        assert_eq!(after.schema_version, "schema-v8");
    }
}
