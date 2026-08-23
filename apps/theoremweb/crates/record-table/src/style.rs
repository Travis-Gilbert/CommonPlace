//! Layout for the record table's own class names.
//!
//! `theoremweb_chrome::emit_chrome_theme_css` owns the variable namespace and,
//! by its own contract, never generates selectors or classes. The crate that
//! emits a class name therefore owns its layout, which is this module.
//!
//! Every dimension is read from [`ThemeCommon::TWENTY`] rather than written as
//! a literal. A stylesheet with its own copy of the row height is a second
//! authority, and it drifts exactly the way duplicated registries do.

use std::fmt::Write as _;

use theoremweb_chrome::ThemeCommon;

/// The stylesheet for every `theorem-*` class this crate renders.
///
/// Colours come from the chrome variable namespace with literal fallbacks, so
/// a page that has not injected the theme yet still renders a legible table
/// instead of inheriting the browser's defaults.
#[must_use]
pub fn emit_record_table_css() -> String {
    let table = &ThemeCommon::TWENTY.table;
    let row_height = table.row_height_px;
    let padding = table.horizontal_cell_padding_px;
    let checkbox = table.checkbox_column_width_px;
    let header_height = row_height + 8;

    let mut css = String::with_capacity(3_072);
    let _ = write!(
        css,
        "
.theorem-record-table {{
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  color: var(--foreground, #333);
}}
.theorem-record-table-bar {{
  display: flex; align-items: center; justify-content: space-between;
  gap: {padding}px; padding: 0 {padding}px; height: {header_height}px;
  border-bottom: 1px solid var(--border, #ebebeb);
}}
.theorem-record-table-title {{ font-weight: 600; }}
.theorem-record-table-count {{ color: var(--muted-foreground, #666); font-variant-numeric: tabular-nums; }}
.theorem-record-table-error {{ padding: {padding}px; color: var(--destructive, #b3261e); }}
.theorem-record-table-scroll {{ flex: 1 1 auto; min-height: 0; }}

.theorem-grid {{ position: relative; }}
.theorem-grid-body {{ position: relative; }}
.theorem-record-row {{ display: flex; align-items: stretch; }}
.theorem-record-row:not(.theorem-record-head):hover {{ background: var(--accent, #f4f4f4); }}
.theorem-record-head {{
  position: sticky; top: 0; z-index: 52;
  background: var(--background, #fff);
  border-bottom: 1px solid var(--border, #ebebeb);
  font-weight: 600;
}}
[data-name=\"GridRow\"] {{ border-bottom: 1px solid var(--border, #ebebeb); }}

.theorem-grid [role=\"columnheader\"],
.theorem-grid [role=\"gridcell\"] {{
  flex: 0 0 auto; box-sizing: border-box;
  display: flex; align-items: center;
  padding: 0 {padding}px; min-width: 0;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}}
[data-name=\"GridSelectHeaderCell\"], [data-name=\"GridSelectCell\"] {{
  flex: 0 0 {checkbox}px; justify-content: center; padding: 0;
}}
[data-name=\"GridCellContent\"] {{ overflow: hidden; text-overflow: ellipsis; }}

.theorem-cell-empty::after {{ content: \"\\2014\"; opacity: 0.35; }}
.theorem-cell-number {{ font-variant-numeric: tabular-nums; }}
.theorem-cell-temporal {{ font-variant-numeric: tabular-nums; color: var(--muted-foreground, #666); }}
.theorem-cell-url {{ color: var(--primary, #1961ed); text-decoration: none; }}
.theorem-cell-url:hover {{ text-decoration: underline; }}
.theorem-cell-longtext {{ color: var(--muted-foreground, #666); }}
.theorem-cell-tags {{ display: inline-flex; gap: 4px; }}
.theorem-cell-tag {{
  border-radius: 4px; padding: 1px 6px; font-size: 12px; line-height: 18px;
}}
.theorem-cell-relation {{ display: inline-flex; gap: 4px; align-items: center; }}
.theorem-cell-chip {{
  display: inline-flex; gap: 4px; align-items: center;
  border: 1px solid var(--border, #ebebeb); border-radius: 999px;
  padding: 0 6px; font-size: 12px; line-height: 18px;
}}
.theorem-cell-overflow {{ color: var(--muted-foreground, #666); font-size: 12px; }}
.theorem-cell-inspect {{ color: var(--muted-foreground, #666); font-family: ui-monospace, monospace; font-size: 12px; }}
.theorem-cell-raw {{ color: var(--destructive, #b3261e); font-style: italic; }}
.theorem-cell-boolean {{ color: var(--muted-foreground, #666); }}
"
    );
    css
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_dimension_comes_from_the_theme_not_a_literal() {
        let css = emit_record_table_css();
        let table = &ThemeCommon::TWENTY.table;
        assert!(css.contains(&format!("padding: 0 {}px", table.horizontal_cell_padding_px)));
        assert!(css.contains(&format!("flex: 0 0 {}px", table.checkbox_column_width_px)));
        assert!(css.contains(&format!("height: {}px", table.row_height_px + 8)));
    }

    #[test]
    fn rows_lay_their_cells_out_horizontally() {
        // The grid primitives size cells with custom properties and position
        // rows absolutely. Without this rule the cells stack vertically, which
        // renders as a correct-but-unreadable column of values.
        let css = emit_record_table_css();
        assert!(css.contains(".theorem-record-row {\n  display: flex;")
            || css.contains(".theorem-record-row { display: flex;"));
    }

    #[test]
    fn colours_carry_literal_fallbacks_for_the_pre_theme_frame() {
        let css = emit_record_table_css();
        assert!(css.contains("var(--border, #ebebeb)"));
        assert!(css.contains("var(--foreground, #333)"));
    }

    #[test]
    fn an_empty_cell_is_visibly_distinct_from_a_blank_one() {
        assert!(emit_record_table_css().contains(".theorem-cell-empty::after"));
    }
}
