//! Runtime-safe Dioxus data-grid primitives.
//!
//! Adapted from `rust-ui/dioxus-ui` at commit
//! `2f87a8d0531d483d5b32df6f89b7979ceb4beb74`.
//! Copyright (c) 2026 Max Wells. Licensed under the MIT License.
//!
//! The donor's static column traits, `strum` enumeration, and client sorting
//! are intentionally replaced by [`ColumnSet`](crate::columns::ColumnSet).

use std::collections::BTreeSet;

use dioxus::prelude::*;
use theoremweb_chrome::ThemeCommon;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VirtualRange {
    pub start: usize,
    pub end: usize,
    pub total_height_px: usize,
    pub offset_px: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VirtualScrollState {
    pub total_rows: usize,
    pub viewport_height_px: usize,
    pub scroll_top_px: usize,
    pub overscan_rows: usize,
}

impl VirtualScrollState {
    #[must_use]
    pub fn visible_range(self) -> VirtualRange {
        let row_height = usize::from(ThemeCommon::TWENTY.table.row_height_px);
        let first = self.scroll_top_px / row_height;
        let visible = self.viewport_height_px.div_ceil(row_height);
        let start = first
            .saturating_sub(self.overscan_rows)
            .min(self.total_rows);
        let end = first
            .saturating_add(visible)
            .saturating_add(self.overscan_rows)
            .min(self.total_rows);
        VirtualRange {
            start,
            end,
            total_height_px: self.total_rows.saturating_mul(row_height),
            offset_px: start.saturating_mul(row_height),
        }
    }
}

#[must_use]
pub fn use_virtual_scroll(
    total_rows: usize,
    viewport_height_px: usize,
    scroll_top_px: usize,
) -> VirtualRange {
    VirtualScrollState {
        total_rows,
        viewport_height_px,
        scroll_top_px,
        overscan_rows: 4,
    }
    .visible_range()
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct GridAddress {
    pub row: usize,
    pub column: usize,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DragSelection {
    anchor: Option<GridAddress>,
    current: Option<GridAddress>,
}

impl DragSelection {
    pub fn begin(&mut self, cell: GridAddress) {
        self.anchor = Some(cell);
        self.current = Some(cell);
    }

    pub fn extend(&mut self, cell: GridAddress) {
        if self.anchor.is_some() {
            self.current = Some(cell);
        }
    }

    #[must_use]
    pub fn contains(&self, cell: GridAddress) -> bool {
        let (Some(anchor), Some(current)) = (self.anchor, self.current) else {
            return false;
        };
        let rows = anchor.row.min(current.row)..=anchor.row.max(current.row);
        let columns = anchor.column.min(current.column)..=anchor.column.max(current.column);
        rows.contains(&cell.row) && columns.contains(&cell.column)
    }
}

#[must_use]
pub fn use_drag_selection() -> DragSelection {
    DragSelection::default()
}

#[must_use]
pub fn use_copy_clipboard(cells: &[Vec<String>], selection: &DragSelection) -> String {
    cells
        .iter()
        .enumerate()
        .filter_map(|(row_index, row)| {
            let selected = row
                .iter()
                .enumerate()
                .filter(|(column_index, _)| {
                    selection.contains(GridAddress {
                        row: row_index,
                        column: *column_index,
                    })
                })
                .map(|(_, value)| value.as_str())
                .collect::<Vec<_>>();
            (!selected.is_empty()).then(|| selected.join("\t"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DataGridState {
    pub selected_rows: BTreeSet<String>,
    pub pinned_fields: BTreeSet<String>,
    pub visible_fields: BTreeSet<String>,
}

#[must_use]
pub fn use_data_grid_state(field_keys: impl IntoIterator<Item = String>) -> DataGridState {
    DataGridState {
        visible_fields: field_keys.into_iter().collect(),
        ..DataGridState::default()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CellEditState {
    pub cell: GridAddress,
    pub draft: String,
}

#[must_use]
pub fn use_cell_edit(cell: GridAddress, initial_value: impl Into<String>) -> CellEditState {
    CellEditState {
        cell,
        draft: initial_value.into(),
    }
}

/// Select only rows in the virtual window. Its capitalized name matches the
/// donor helper while the returned data remains independent of a static row
/// trait.
#[allow(non_snake_case)]
#[must_use]
pub fn VirtualFor<T: Clone>(rows: &[T], range: VirtualRange) -> Vec<(usize, T)> {
    (range.start..range.end)
        .filter_map(|index| rows.get(index).cloned().map(|row| (index, row)))
        .collect()
}

#[component]
pub fn GridWrapper(children: Element) -> Element {
    rsx! {
        div { "data-name": "GridWrapper", class: "theorem-grid-wrapper", {children} }
    }
}

#[component]
pub fn Grid(children: Element, rowcount: i32, colcount: i32, style: String) -> Element {
    rsx! {
        div {
            role: "grid",
            "data-name": "DataGrid",
            "aria-label": "Data grid",
            "aria-rowcount": rowcount,
            "aria-colcount": colcount,
            tabindex: "0",
            class: "theorem-grid",
            style,
            {children}
        }
    }
}

#[component]
pub fn GridBody(children: Element, style: String) -> Element {
    rsx! {
        div {
            role: "rowgroup",
            "data-name": "GridBody",
            class: "theorem-grid-body",
            style,
            {children}
        }
    }
}

#[component]
pub fn VirtualizedGrid(children: Element, rowcount: i32, colcount: i32, style: String) -> Element {
    rsx! { Grid { rowcount, colcount, style, {children} } }
}

#[component]
pub fn VirtualizedGridBody(children: Element, total_rows: usize) -> Element {
    let height = total_rows.saturating_mul(usize::from(ThemeCommon::TWENTY.table.row_height_px));
    rsx! {
        div {
            role: "rowgroup",
            "data-name": "VirtualizedGridBody",
            class: "theorem-grid-body",
            style: "height: {height}px; position: relative;",
            {children}
        }
    }
}

#[component]
pub fn GridRow(children: Element, rowindex: usize, index: usize) -> Element {
    let row_height = usize::from(ThemeCommon::TWENTY.table.row_height_px);
    let translate_y = index.saturating_mul(row_height);
    rsx! {
        div {
            role: "row",
            "data-name": "GridRow",
            "aria-rowindex": rowindex,
            "data-index": index,
            class: "theorem-record-row",
            tabindex: "-1",
            style: "position: absolute; width: 100%; height: {row_height}px; transform: translateY({translate_y}px); content-visibility: auto; contain-intrinsic-size: auto {row_height}px;",
            {children}
        }
    }
}

#[component]
pub fn GridHeaderCell(
    children: Element,
    colindex: i32,
    column: String,
    #[props(default = true)] visible: bool,
) -> Element {
    rsx! {
        div {
            role: "columnheader",
            "aria-sort": "none",
            "aria-colindex": colindex,
            "data-name": "GridHeaderCell",
            "data-visible": visible,
            style: "width: calc(var(--header-{column}-size) * 1px);",
            {children}
        }
    }
}

#[component]
pub fn GridCell(
    children: Element,
    colindex: i32,
    column: String,
    #[props(default = true)] visible: bool,
    #[props(default = false)] active: bool,
    #[props(default = false)] current: bool,
) -> Element {
    rsx! {
        div {
            role: "gridcell",
            "aria-colindex": colindex,
            "aria-selected": active,
            "aria-current": current,
            "data-name": "GridCell",
            "data-visible": visible,
            class: "theorem-record-cell",
            tabindex: "-1",
            style: "width: calc(var(--col-{column}-size) * 1px);",
            {children}
        }
    }
}

#[component]
pub fn GridCellWrapper(children: Element) -> Element {
    rsx! {
        div { "data-name": "GridCellWrapper", tabindex: "-1", {children} }
    }
}

#[component]
pub fn GridCellContent(children: Element) -> Element {
    rsx! { span { "data-name": "GridCellContent", {children} } }
}

#[component]
pub fn GridSelectHeaderCell(children: Element) -> Element {
    let width = ThemeCommon::TWENTY.table.checkbox_column_width_px;
    rsx! {
        div {
            role: "columnheader",
            "aria-colindex": "1",
            "data-name": "GridSelectHeaderCell",
            style: "left: 0; position: sticky; width: {width}px; z-index: 51; background: var(--background);",
            {children}
        }
    }
}

#[component]
pub fn GridSelectCell(children: Element) -> Element {
    let width = ThemeCommon::TWENTY.table.checkbox_column_width_px;
    rsx! {
        div {
            role: "gridcell",
            "aria-colindex": "1",
            "data-name": "GridSelectCell",
            style: "left: 0; position: sticky; width: {width}px; z-index: 51; background: var(--background);",
            {children}
        }
    }
}

#[component]
pub fn GridPinnedHeaderCell(children: Element, left: i32, width: i32) -> Element {
    rsx! {
        div {
            role: "columnheader",
            "data-name": "GridPinnedHeaderCell",
            style: "left: {left}px; position: sticky; width: {width}px; z-index: 51; background: var(--background);",
            {children}
        }
    }
}

#[component]
pub fn GridPinnedCell(children: Element, colindex: i32, left: i32, width: i32) -> Element {
    rsx! {
        div {
            role: "gridcell",
            "aria-colindex": colindex,
            "data-name": "GridPinnedCell",
            style: "left: {left}px; position: sticky; width: {width}px; z-index: 51; background: var(--background);",
            {children}
        }
    }
}

#[component]
pub fn TableSeparator(valuenow: i32) -> Element {
    rsx! {
        div {
            role: "separator",
            "data-name": "TableSeparator",
            "aria-orientation": "vertical",
            "aria-label": "Resize column",
            "aria-valuenow": valuenow,
            "aria-valuemin": "60",
            "aria-valuemax": "800",
            tabindex: "0"
        }
    }
}

#[component]
pub fn DataGridToolbar(children: Element) -> Element {
    rsx! {
        div {
            "data-name": "DataGridToolbar",
            role: "toolbar",
            "aria-orientation": "horizontal",
            {children}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ten_thousand_rows_yield_only_the_visible_window() {
        let rows = (0..10_000).collect::<Vec<_>>();
        let range = use_virtual_scroll(rows.len(), 640, 32 * 5_000);
        let visible = VirtualFor(&rows, range);
        assert!(visible.len() < 32);
        assert!(visible.iter().all(|(index, value)| index == value));
        assert_eq!(range.total_height_px, 320_000);
    }

    #[test]
    fn drag_selection_copies_a_rectangular_tsv() {
        let mut selection = use_drag_selection();
        selection.begin(GridAddress { row: 0, column: 1 });
        selection.extend(GridAddress { row: 1, column: 2 });
        let cells = vec![
            vec!["a".into(), "b".into(), "c".into()],
            vec!["d".into(), "e".into(), "f".into()],
        ];
        assert_eq!(use_copy_clipboard(&cells, &selection), "b\tc\ne\tf");
    }

    #[test]
    fn rendered_row_uses_the_theme_row_height() {
        let html = dioxus_ssr::render_element(rsx! {
            GridRow { rowindex: 1, index: 2, "row" }
        });
        assert!(html.contains("height: 32px"));
        assert!(html.contains("translateY(64px)"));
    }
}
