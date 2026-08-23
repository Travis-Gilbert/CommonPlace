//! The record table's front door.
//!
//! The crate shipped sixteen grid primitives, a column model, a cell
//! presentation map, and virtualization hooks, and nothing that composed them.
//! This is that composition, and it is the only component the host needs to
//! mount a records surface.
//!
//! Query state is not computed here. Sorts, filters, and aggregates ride the
//! server per the spec's named choice 9, so this component renders the rows it
//! is given in the order it is given them. There is deliberately no sort
//! comparator and no filter predicate in this file.

use std::collections::{BTreeMap, BTreeSet};

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use theoremweb_chrome::{ColorScheme, ThemeCommon};

use crate::cell_view::CellView;
use crate::cells::{render_cell, NoRelations};
use crate::columns::ColumnSet;
use crate::schema::{ObjectType, ViewMetadata};

/// One record, keyed by field key so a runtime column can find its value
/// without a static row type.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecordRow {
    pub record_id: String,
    #[serde(default)]
    pub values: BTreeMap<String, Value>,
}

/// Everything a records surface renders from.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RecordPage {
    pub object_type: ObjectType,
    #[serde(default)]
    pub view: Option<ViewMetadata>,
    #[serde(default)]
    pub rows: Vec<RecordRow>,
    /// Server-side total over the full filtered set.
    ///
    /// `None` means the server did not supply one. The header then reports the
    /// loaded count labeled as loaded, because the spec forbids presenting a
    /// client-computed total as complete.
    #[serde(default)]
    pub total: Option<usize>,
}

/// Fallback viewport height before the first scroll event reports a real one.
const ASSUMED_VIEWPORT_PX: usize = 480;

#[component]
pub fn RecordTable(page: RecordPage, scheme: ColorScheme) -> Element {
    let columns = match ColumnSet::from_declared(&page.object_type, page.view.as_ref()) {
        Ok(columns) => columns,
        // A column model that cannot be built is a labeled surface, never a
        // panic and never an empty div that reads as "no records".
        Err(error) => {
            return rsx! {
                div { class: "theorem-record-table-error", role: "alert",
                    "This object type cannot render a table: {error}"
                }
            };
        }
    };

    let mut selected = use_signal(BTreeSet::<String>::new);
    let mut scroll_top = use_signal(|| 0_usize);
    let mut viewport = use_signal(|| ASSUMED_VIEWPORT_PX);
    let range = crate::grid::use_virtual_scroll(page.rows.len(), viewport(), scroll_top());
    let windowed = crate::grid::VirtualFor(&page.rows, range);

    let visible: Vec<_> = columns.visible().cloned().collect();
    // +1 for the sticky select column, which grid_style() already sizes.
    let colcount = i32::try_from(visible.len().saturating_add(1)).unwrap_or(i32::MAX);
    let rowcount = i32::try_from(page.rows.len()).unwrap_or(i32::MAX);
    let grid_style = columns.grid_style();
    let row_height = usize::from(ThemeCommon::TWENTY.table.row_height_px);
    let all_ids: Vec<String> = page.rows.iter().map(|row| row.record_id.clone()).collect();
    let all_selected = !all_ids.is_empty()
        && all_ids.iter().all(|id| selected.read().contains(id));
    let count_label = page.total.map_or_else(
        || format!("{} loaded", page.rows.len()),
        |total| format!("{total} records"),
    );

    rsx! {
        div { class: "theorem-record-table", "data-object-type": "{page.object_type.object_type_id}",
            div { class: "theorem-record-table-bar",
                span { class: "theorem-record-table-title", "{page.object_type.label_plural}" }
                span {
                    class: "theorem-record-table-count",
                    "data-server-total": "{page.total.is_some()}",
                    "{count_label}"
                }
            }
            div {
                class: "theorem-record-table-scroll",
                style: "overflow: auto; height: 100%;",
                onscroll: move |event| {
                    let data = event.data();
                    scroll_top.set(data.scroll_top().max(0.0) as usize);
                    let height = data.client_height();
                    if height > 0 {
                        viewport.set(usize::try_from(height).unwrap_or(ASSUMED_VIEWPORT_PX));
                    }
                },
                crate::grid::VirtualizedGrid {
                    rowcount,
                    colcount,
                    style: grid_style,
                    div { role: "rowgroup", "data-name": "GridHead",
                        div {
                            role: "row",
                            "aria-rowindex": 1_usize,
                            class: "theorem-record-row theorem-record-head",
                            style: "height: {row_height}px;",
                            crate::grid::GridSelectHeaderCell {
                                input {
                                    r#type: "checkbox",
                                    "aria-label": "Select all loaded records",
                                    checked: all_selected,
                                    onchange: move |_| {
                                        if all_selected {
                                            selected.write().clear();
                                        } else {
                                            let mut next = selected.write();
                                            for id in &all_ids {
                                                next.insert(id.clone());
                                            }
                                        }
                                    },
                                }
                            }
                            for column in visible.iter().cloned() {
                                crate::grid::GridHeaderCell {
                                    key: "{column.field_key}",
                                    colindex: column.colindex,
                                    column: column.field_key.clone(),
                                    crate::grid::GridCellContent { "{column.label}" }
                                }
                            }
                        }
                    }
                    crate::grid::VirtualizedGridBody { total_rows: page.rows.len(),
                        for (index, row) in windowed {
                            crate::grid::GridRow {
                                key: "{row.record_id}",
                                rowindex: index + 2,
                                index,
                                crate::grid::GridSelectCell {
                                    input {
                                        r#type: "checkbox",
                                        "aria-label": "Select {row.record_id}",
                                        checked: selected.read().contains(&row.record_id),
                                        onchange: {
                                            let record_id = row.record_id.clone();
                                            move |_| {
                                                let mut next = selected.write();
                                                if !next.remove(&record_id) {
                                                    next.insert(record_id.clone());
                                                }
                                            }
                                        },
                                    }
                                }
                                for column in visible.iter().cloned() {
                                    crate::grid::GridCell {
                                        key: "{column.field_key}",
                                        colindex: column.colindex,
                                        column: column.field_key.clone(),
                                        crate::grid::GridCellContent {
                                            CellView {
                                                presentation: presentation_for(
                                                    &page.object_type,
                                                    &column.field_key,
                                                    &row,
                                                    scheme,
                                                ),
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Resolve one cell through the declared field spec.
///
/// A column whose field is absent from the declaration renders as empty rather
/// than guessing a kind from the value's JSON shape, because inferring a type
/// from data is how a client starts disagreeing with the schema.
fn presentation_for(
    object_type: &ObjectType,
    field_key: &str,
    row: &RecordRow,
    scheme: ColorScheme,
) -> crate::cells::CellPresentation {
    let Some(field) = object_type.fields.iter().find(|field| field.key == field_key) else {
        return crate::cells::CellPresentation::Empty;
    };
    let value = row.values.get(field_key).unwrap_or(&Value::Null);
    render_cell(object_type, field, value, scheme, &NoRelations)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::schema::{Enforcement, FieldKind, FieldSpec, FieldType};

    fn field(key: &str, label: &str, kind: FieldKind) -> FieldSpec {
        FieldSpec {
            key: key.into(),
            label: label.into(),
            description: None,
            field_type: FieldType { kind, raw: json!({}) },
            required: false,
            system: false,
        }
    }

    fn object_type() -> ObjectType {
        ObjectType {
            object_type_id: "company".into(),
            tenant_id: "Travis-Gilbert".into(),
            name_singular: "company".into(),
            name_plural: "companies".into(),
            label_singular: "Company".into(),
            label_plural: "Companies".into(),
            description: None,
            node_label: "Company".into(),
            label_identifier_field: "name".into(),
            fields: vec![
                field("name", "Name", FieldKind::Text),
                field("employees", "Employees", FieldKind::Integer),
            ],
            enforcement: Enforcement::Reject,
            system: false,
            extensions: BTreeMap::new(),
            content_anchor: String::new(),
            retired: false,
            schema_version: "v1".into(),
        }
    }

    fn page(row_count: usize) -> RecordPage {
        RecordPage {
            object_type: object_type(),
            view: None,
            rows: (0..row_count)
                .map(|index| RecordRow {
                    record_id: format!("record-{index}"),
                    values: [
                        ("name".to_owned(), json!(format!("Company {index}"))),
                        ("employees".to_owned(), json!(index)),
                    ]
                    .into_iter()
                    .collect(),
                })
                .collect(),
            total: None,
        }
    }

    fn render(page: RecordPage) -> String {
        dioxus_ssr::render_element(rsx! { RecordTable { page, scheme: ColorScheme::Light } })
    }

    #[test]
    fn the_table_renders_declared_columns_and_real_values() {
        let html = render(page(3));
        assert!(html.contains("Name"));
        assert!(html.contains("Employees"));
        assert!(html.contains("Company 0"));
        assert!(html.contains("record-2") || html.contains("Company 2"));
        assert!(html.contains("role=\"grid\""));
    }

    #[test]
    fn ten_thousand_rows_render_only_the_visible_window() {
        let html = render(page(10_000));
        let rendered_rows = html.matches("data-name=\"GridRow\"").count();
        assert!(
            rendered_rows < 40,
            "virtualization broke: {rendered_rows} rows rendered out of 10000"
        );
        // The grid still declares the full row count for assistive technology.
        assert!(html.contains("aria-rowcount=10000"));
    }

    #[test]
    fn an_absent_server_total_is_labeled_loaded_not_presented_as_complete() {
        let html = render(page(5));
        assert!(html.contains("5 loaded"));
        assert!(html.contains("data-server-total=\"false\""));
    }

    #[test]
    fn a_server_total_is_reported_as_the_total() {
        let mut value = page(5);
        value.total = Some(4321);
        let html = render(value);
        assert!(html.contains("4321 records"));
        assert!(html.contains("data-server-total=\"true\""));
    }

    #[test]
    fn an_object_type_with_no_fields_is_a_labeled_alert_not_an_empty_table() {
        let mut value = page(1);
        value.object_type.fields.clear();
        let html = render(value);
        assert!(html.contains("role=\"alert\""));
        assert!(html.contains("cannot render a table"));
    }

    #[test]
    fn every_row_carries_a_real_select_checkbox_and_the_grid_counts_it() {
        let html = render(page(3));
        assert!(html.contains("data-name=\"GridSelectHeaderCell\""));
        assert_eq!(html.matches("data-name=\"GridSelectCell\"").count(), 3);
        assert!(html.contains("Select record-0"));
        // Two declared fields plus the sticky select column.
        assert!(html.contains("aria-colcount=3"));
    }

    #[test]
    fn a_column_whose_field_is_undeclared_renders_empty_rather_than_guessing() {
        let object = object_type();
        let row = RecordRow {
            record_id: "record-0".into(),
            values: [("ghost".to_owned(), json!("surprise"))].into_iter().collect(),
        };
        let presentation = presentation_for(&object, "ghost", &row, ColorScheme::Light);
        assert_eq!(presentation, crate::cells::CellPresentation::Empty);
    }
}
