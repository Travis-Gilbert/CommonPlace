//! Runtime-declared records surface for TheoremWeb.
//!
//! The crate consumes `ObjectType` and `ViewMetadata` JSON contracts. It never
//! compiles a column enum and never computes complete query results in the
//! browser: sorting, filtering, counts, and aggregates remain generated-tool
//! calls to RustyRed.

pub mod calculate;
pub mod cell_view;
pub mod cells;
pub mod columns;
pub mod editors;
pub mod focus;
pub mod generated_tools;
pub mod grid;
pub mod presence;
pub mod schema;
pub mod style;
pub mod table;
pub mod view_bar;

pub use cell_view::CellView;
pub use columns::{ColumnSet, FieldColumn};
pub use schema::{FieldKind, FieldSpec, FieldType, ObjectType, ViewMetadata};
pub use style::emit_record_table_css;
pub use table::{RecordPage, RecordRow, RecordTable, RecordTableAction};

pub const ROW_HEIGHT: u16 = theoremweb_chrome::ThemeCommon::TWENTY.table.row_height_px;
pub const HEADER_HEIGHT: u16 = theoremweb_chrome::ThemeCommon::TWENTY.table.row_height_px;
