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
use std::rc::Rc;

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use theoremweb_chrome::{ColorScheme, ThemeCommon};

use crate::calculate::{operations_for, AggregateReceipt};
use crate::cell_view::CellView;
use crate::cells::{render_cell, NoRelations};
use crate::columns::{ColumnSet, FieldColumn};
use crate::focus::{CellAddress, FocusEffect, FocusState, KeyIntent};
use crate::presence::{CoordinationStreamEvent, PresenceState};
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
    pub views: Vec<ViewMetadata>,
    #[serde(default)]
    pub rows: Vec<RecordRow>,
    /// Server-side total over the full filtered set.
    ///
    /// `None` means the server did not supply one. The header then reports the
    /// loaded count labeled as loaded, because the spec forbids presenting a
    /// client-computed total as complete.
    #[serde(default)]
    pub total: Option<usize>,
    #[serde(default)]
    pub aggregate: Option<AggregateReceipt>,
    #[serde(default)]
    pub presence_events: Vec<CoordinationStreamEvent>,
    #[serde(default)]
    pub notice: Option<String>,
}

/// A user gesture whose persistence belongs to the authenticated host.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum RecordTableAction {
    Focus {
        record_id: String,
    },
    Edit {
        record_id: String,
        field_key: String,
        value: Value,
    },
    SwitchView {
        view_id: String,
    },
    SaveView {
        view: ViewMetadata,
    },
    Aggregate {
        field_key: String,
        operation: String,
    },
}

/// Fallback viewport height before the first scroll event reports a real one.
const ASSUMED_VIEWPORT_PX: usize = 480;

#[component]
pub fn RecordTable(
    page: RecordPage,
    scheme: ColorScheme,
    on_action: EventHandler<RecordTableAction>,
) -> Element {
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
    let focus = use_signal(|| FocusState::None);
    let mounted_cells = use_signal(BTreeMap::<CellAddress, Rc<MountedData>>::new);
    let pending_focus = use_signal(|| None::<CellAddress>);
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
    let all_selected = !all_ids.is_empty() && all_ids.iter().all(|id| selected.read().contains(id));
    let count_label = page.total.map_or_else(
        || format!("{} loaded", page.rows.len()),
        |total| format!("{total} records"),
    );
    let mut presence = PresenceState::default();
    if let Some(view_id) = page.view.as_ref().map(|view| view.view_id.as_str()) {
        for event in page.presence_events.clone() {
            if let Some(event) = event.into_presence_event() {
                presence.apply(view_id, event);
            }
        }
    }
    let windowed: Vec<_> = windowed
        .into_iter()
        .map(|(index, row)| {
            let highlights = presence
                .row_highlights(&row.record_id)
                .into_iter()
                .map(|actor| actor.display_name.clone())
                .collect::<Vec<_>>()
                .join(", ");
            let row_class = if highlights.is_empty() {
                "theorem-record-row"
            } else {
                "theorem-record-row theorem-record-row-presence"
            };
            (index, row, highlights, row_class)
        })
        .collect();
    let active_view_id = page
        .view
        .as_ref()
        .map(|view| view.view_id.clone())
        .unwrap_or_default();
    let active_view_name = page
        .view
        .as_ref()
        .map(|view| view.name.clone())
        .unwrap_or_else(|| "Records".into());
    let total = page.total.unwrap_or(page.rows.len());
    let notice = page.notice.clone();

    rsx! {
        div {
            class: "theorem-record-table",
            "data-object-type": "{page.object_type.object_type_id}",
            "data-keyboard-model": "soft-hard",
            div { class: "theorem-record-table-bar",
                span { class: "theorem-record-table-title", "{active_view_name} · {total}" }
                if !page.views.is_empty() {
                    select {
                        "aria-label": "Switch view",
                        value: "{active_view_id}",
                        onchange: move |event| on_action.call(RecordTableAction::SwitchView {
                            view_id: event.value(),
                        }),
                        for view in page.views.iter() {
                            option { value: "{view.view_id}", "{view.name}" }
                        }
                    }
                }
                if let Some(view) = page.view.clone() {
                    button {
                        r#type: "button",
                        "aria-label": "Save current view as a copy",
                        onclick: move |_| {
                            let mut saved = view.clone();
                            saved.view_id = format!("{}:copy", saved.view_id);
                            saved.name = format!("{} copy", saved.name);
                            on_action.call(RecordTableAction::SaveView { view: saved });
                        },
                        "Save as"
                    }
                }
                span {
                    class: "theorem-record-table-count",
                    "data-server-total": "{page.total.is_some()}",
                    "{count_label}"
                }
                for actor in presence.actors() {
                    span {
                        class: "theorem-record-presence-chip",
                        "data-actor-id": "{actor.actor.actor_id}",
                        "{actor.actor.display_name}"
                    }
                }
            }
            if let Some(notice) = notice {
                p { class: "theorem-record-table-error", role: "alert", "{notice}" }
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
                                if column.pinned {
                                    crate::grid::GridPinnedHeaderCell {
                                        key: "{column.field_key}",
                                        colindex: column.colindex,
                                        left: columns.pinned_left(&column.field_key).unwrap_or_default(),
                                        width: column.width,
                                        crate::grid::GridCellContent { "{column.label}" }
                                    }
                                } else {
                                    crate::grid::GridHeaderCell {
                                        key: "{column.field_key}",
                                        colindex: column.colindex,
                                        column: column.field_key.clone(),
                                        crate::grid::GridCellContent { "{column.label}" }
                                    }
                                }
                            }
                        }
                    }
                    crate::grid::VirtualizedGridBody { total_rows: page.rows.len(),
                        for (index, row, highlights, row_class) in windowed {
                            crate::grid::GridRow {
                                key: "{row.record_id}",
                                rowindex: index + 2,
                                index,
                                class: row_class.to_owned(),
                                focused_by: highlights,
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
                                for (column_index, column) in visible.iter().cloned().enumerate() {
                                    if column.pinned {
                                        crate::grid::GridPinnedCell {
                                            key: "{column.field_key}",
                                            colindex: column.colindex,
                                            left: columns.pinned_left(&column.field_key).unwrap_or_default(),
                                            width: column.width,
                                            current: matches!(
                                                focus(),
                                                FocusState::Soft(cell) | FocusState::Hard { cell, .. }
                                                    if cell == CellAddress { row: index, column: column_index }
                                            ),
                                            RecordValueCell {
                                                row: row.clone(),
                                                object_type: page.object_type.clone(),
                                                column: column.clone(),
                                                scheme,
                                                address: CellAddress { row: index, column: column_index },
                                                row_count: page.rows.len(),
                                                column_count: visible.len(),
                                                focus,
                                                mounted_cells,
                                                pending_focus,
                                                scroll_top,
                                                on_action,
                                            }
                                        }
                                    } else {
                                        crate::grid::GridCell {
                                            key: "{column.field_key}",
                                            colindex: column.colindex,
                                            column: column.field_key.clone(),
                                            current: matches!(
                                                focus(),
                                                FocusState::Soft(cell) | FocusState::Hard { cell, .. }
                                                    if cell == CellAddress { row: index, column: column_index }
                                            ),
                                            RecordValueCell {
                                                row: row.clone(),
                                                object_type: page.object_type.clone(),
                                                column,
                                                scheme,
                                                address: CellAddress { row: index, column: column_index },
                                                row_count: page.rows.len(),
                                                column_count: visible.len(),
                                                focus,
                                                mounted_cells,
                                                pending_focus,
                                                scroll_top,
                                                on_action,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    div { role: "row", class: "theorem-record-aggregate-row",
                        div { role: "gridcell", "Calculate" }
                        for column in visible.iter() {
                            div { role: "gridcell",
                                select {
                                    "aria-label": "Calculate {column.label}",
                                    value: "",
                                    onchange: {
                                        let field_key = column.field_key.clone();
                                        move |event| on_action.call(RecordTableAction::Aggregate {
                                            field_key: field_key.clone(),
                                            operation: event.value(),
                                        })
                                    },
                                    option { value: "", "Calculate" }
                                    if let Some(field) = page.object_type.fields.iter()
                                        .find(|field| field.key == column.field_key) {
                                        for operation in operations_for(&field.field_type.kind) {
                                            option {
                                                value: "{operation.wire_name()}",
                                                "{operation.wire_name()}"
                                            }
                                        }
                                    }
                                }
                                if let Some(receipt) = page.aggregate.as_ref()
                                    .filter(|receipt| receipt.field == column.field_key) {
                                    span { class: "theorem-record-aggregate-value", "{receipt.display_value()}" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn RecordValueCell(
    row: RecordRow,
    object_type: ObjectType,
    column: FieldColumn,
    scheme: ColorScheme,
    address: CellAddress,
    row_count: usize,
    column_count: usize,
    mut focus: Signal<FocusState>,
    mut mounted_cells: Signal<BTreeMap<CellAddress, Rc<MountedData>>>,
    mut pending_focus: Signal<Option<CellAddress>>,
    mut scroll_top: Signal<usize>,
    on_action: EventHandler<RecordTableAction>,
) -> Element {
    let focus_state = focus();
    let is_soft = matches!(focus_state, FocusState::Soft(cell) if cell == address);
    let hard_draft = match &focus_state {
        FocusState::Hard { cell, draft } if *cell == address => Some(draft.clone()),
        _ => None,
    };
    let focus_class = if hard_draft.is_some() {
        "theorem-record-cell-focus theorem-record-cell-hard"
    } else if is_soft {
        "theorem-record-cell-focus theorem-record-cell-soft"
    } else {
        "theorem-record-cell-focus"
    };
    let initial_value = editable_value(&row, &column.field_key);
    let field_kind = object_type
        .fields
        .iter()
        .find(|field| field.key == column.field_key)
        .map(|field| field.field_type.kind.clone());

    rsx! {
        div {
            class: focus_class,
            tabindex: if is_soft || hard_draft.is_some() { "0" } else { "-1" },
            "data-record-id": "{row.record_id}",
            "data-field-key": "{column.field_key}",
            "data-cell-row": address.row,
            "data-cell-column": address.column,
            onmounted: move |event: MountedEvent| {
                let node = event.data();
                mounted_cells.write().insert(address, node.clone());
                if pending_focus() == Some(address) {
                    pending_focus.set(None);
                    spawn(async move {
                        let _ = node.set_focus(true).await;
                    });
                }
            },
            onfocus: {
                let record_id = row.record_id.clone();
                move |_| {
                    if !matches!(focus(), FocusState::Hard { cell, .. } if cell == address) {
                        focus.set(FocusState::Soft(address));
                    }
                    on_action.call(RecordTableAction::Focus {
                        record_id: record_id.clone(),
                    });
                }
            },
            ondoubleclick: {
                let initial_value = initial_value.clone();
                move |_| {
                    focus.set(FocusState::Hard {
                        cell: address,
                        draft: initial_value.clone(),
                    });
                }
            },
            onkeydown: {
                let record_id = row.record_id.clone();
                let field_key = column.field_key.clone();
                let initial_value = initial_value.clone();
                let field_kind = field_kind.clone();
                move |event: KeyboardEvent| {
                    let Some(intent) = keyboard_intent(&event) else {
                        return;
                    };
                    let current = focus();
                    if matches!(current, FocusState::Hard { .. })
                        && !matches!(intent, KeyIntent::Escape | KeyIntent::Tab { .. })
                    {
                        return;
                    }
                    event.prevent_default();
                    let draft = match &current {
                        FocusState::Hard { draft, .. } => Some(draft.clone()),
                        _ => None,
                    };
                    let mut transition = current.reduce(intent.clone(), row_count, column_count);
                    if matches!(transition.effect, FocusEffect::MountEditor(_))
                        && matches!(intent, KeyIntent::Enter)
                    {
                        transition.state = FocusState::Hard {
                            cell: address,
                            draft: initial_value.clone(),
                        };
                    }
                    let next_focus = match transition.state {
                        FocusState::Soft(cell) => Some(cell),
                        _ => None,
                    };
                    if matches!(transition.effect, FocusEffect::Commit { .. }) {
                        let committed = draft.unwrap_or_else(|| initial_value.clone());
                        on_action.call(RecordTableAction::Edit {
                            record_id: record_id.clone(),
                            field_key: field_key.clone(),
                            value: edit_value(field_kind.as_ref(), &committed),
                        });
                    }
                    focus.set(transition.state);
                    if let Some(cell) = next_focus {
                        request_cell_focus(cell, mounted_cells, pending_focus, scroll_top);
                    }
                }
            },
            if let Some(ref draft) = hard_draft {
                input {
                    class: "theorem-record-inline-editor",
                    "aria-label": "Edit {column.label} for {row.record_id}",
                    value: "{draft}",
                    onmounted: move |event: MountedEvent| {
                        let node = event.data();
                        spawn(async move {
                            let _ = node.set_focus(true).await;
                        });
                    },
                    oninput: move |event| {
                        focus.set(FocusState::Hard {
                            cell: address,
                            draft: event.value(),
                        });
                    },
                }
            } else {
                CellView {
                    presentation: presentation_for(
                        &object_type,
                        &column.field_key,
                        &row,
                        scheme,
                    ),
                }
            }
        }
    }
}

fn keyboard_intent(event: &KeyboardEvent) -> Option<KeyIntent> {
    match event.key() {
        Key::ArrowUp => Some(KeyIntent::ArrowUp),
        Key::ArrowDown => Some(KeyIntent::ArrowDown),
        Key::ArrowLeft => Some(KeyIntent::ArrowLeft),
        Key::ArrowRight => Some(KeyIntent::ArrowRight),
        Key::Enter => Some(KeyIntent::Enter),
        Key::Escape => Some(KeyIntent::Escape),
        Key::Tab => Some(KeyIntent::Tab {
            backwards: event.modifiers().contains(Modifiers::SHIFT),
        }),
        Key::Character(text)
            if event.modifiers().is_empty() || event.modifiers() == Modifiers::SHIFT =>
        {
            Some(KeyIntent::Type(text.to_string()))
        }
        _ => None,
    }
}

fn request_cell_focus(
    address: CellAddress,
    mounted_cells: Signal<BTreeMap<CellAddress, Rc<MountedData>>>,
    mut pending_focus: Signal<Option<CellAddress>>,
    mut scroll_top: Signal<usize>,
) {
    pending_focus.set(Some(address));
    let mounted = mounted_cells.read().get(&address).cloned();
    if let Some(node) = mounted {
        pending_focus.set(None);
        spawn(async move {
            let _ = node.set_focus(true).await;
        });
    } else {
        let row_height = usize::from(ThemeCommon::TWENTY.table.row_height_px);
        scroll_top.set(address.row.saturating_mul(row_height));
    }
}

fn editable_value(row: &RecordRow, field_key: &str) -> String {
    match row.values.get(field_key) {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Null) | None => String::new(),
        Some(value) => value.to_string(),
    }
}

fn edit_value(kind: Option<&crate::schema::FieldKind>, input: &str) -> Value {
    use crate::schema::FieldKind;
    match kind {
        Some(FieldKind::Integer | FieldKind::Number | FieldKind::Boolean | FieldKind::Json) => {
            serde_json::from_str(input).unwrap_or_else(|_| Value::String(input.to_owned()))
        }
        _ => Value::String(input.to_owned()),
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
    let Some(field) = object_type
        .fields
        .iter()
        .find(|field| field.key == field_key)
    else {
        return crate::cells::CellPresentation::Empty;
    };
    let value = row.values.get(field_key).unwrap_or(&Value::Null);
    render_cell(object_type, field, value, scheme, &NoRelations)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::schema::{Enforcement, FieldKind, FieldSpec, FieldType, ViewColumn};

    fn field(key: &str, label: &str, kind: FieldKind) -> FieldSpec {
        FieldSpec {
            key: key.into(),
            label: label.into(),
            description: None,
            field_type: FieldType {
                kind,
                raw: json!({}),
            },
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
            views: Vec::new(),
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
            aggregate: None,
            presence_events: Vec::new(),
            notice: None,
        }
    }

    #[allow(non_snake_case)]
    #[component]
    fn TableHarness(page: RecordPage) -> Element {
        rsx! {
            RecordTable {
                page,
                scheme: ColorScheme::Light,
                on_action: move |_: RecordTableAction| {},
            }
        }
    }

    fn render(page: RecordPage) -> String {
        dioxus_ssr::render_element(rsx! {
            TableHarness { page }
        })
    }

    #[test]
    fn the_table_renders_declared_columns_and_real_values() {
        let html = render(page(3));
        assert!(html.contains("Name"));
        assert!(html.contains("Employees"));
        assert!(html.contains("Company 0"));
        assert!(html.contains("record-2") || html.contains("Company 2"));
        assert!(html.contains("role=\"grid\""));
        assert!(html.contains("data-keyboard-model=\"soft-hard\""));
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
    fn a_saved_pinned_column_uses_sticky_header_and_body_cells() {
        let mut value = page(3);
        value.view = Some(ViewMetadata {
            view_id: "view:companies".into(),
            tenant_id: "Travis-Gilbert".into(),
            object_type_id: "company".into(),
            name: "Companies".into(),
            schema_version: "v1".into(),
            filters: Vec::new(),
            sorts: Vec::new(),
            group_by: None,
            columns: vec![
                ViewColumn {
                    field_key: "name".into(),
                    order: 0,
                    width: 240,
                    visible: true,
                    pinned: true,
                },
                ViewColumn {
                    field_key: "employees".into(),
                    order: 1,
                    width: 128,
                    visible: true,
                    pinned: false,
                },
            ],
        });
        let html = render(value);
        assert!(html.contains("data-name=\"GridPinnedHeaderCell\""));
        assert_eq!(html.matches("data-name=\"GridPinnedCell\"").count(), 3);
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
            values: [("ghost".to_owned(), json!("surprise"))]
                .into_iter()
                .collect(),
        };
        let presentation = presentation_for(&object, "ghost", &row, ColorScheme::Light);
        assert_eq!(presentation, crate::cells::CellPresentation::Empty);
    }
}
