//! One graph-backed layout algebra for record pages, dashboards, canvases, and nodes.
//!
//! The browser owns only an editable draft. Completed interactions emit
//! `layout_write`; aggregate values enter only as full-filtered-set server
//! receipts.

mod body_registry;
mod contracts;
mod dashboard;
mod grid;
mod record_page;

pub use body_registry::{BodyRegistry, BodySpec, PaletteEntry, RegistryError, SizeNegotiation};
pub use contracts::{
    GridRect, LayoutMcpCall, LayoutObject, LayoutSet, LayoutTab, LayoutTarget, LayoutWidget,
    ScopeBinding,
};
pub use dashboard::{
    project_server_aggregates, AggregateCall, AggregateCompleteness, DashboardError,
    ServerAggregateReceipt,
};
pub use grid::{
    emit_layout_css, projected_body_slot, CommitKind, LayoutCommit, LayoutEditError, LayoutEditor,
    LayoutSurface, LayoutSurfaceProps, GRID_CELL_PX, GRID_COLUMNS, GRID_MAX_ROWS, GRID_ROW_PX,
};
pub use record_page::{
    render_layout, render_tab, render_widget, BodyRequest, ProjectedBody, RecordData,
    RelatedRecord, RenderedSurface, RenderedWidget, SurfaceView,
};
