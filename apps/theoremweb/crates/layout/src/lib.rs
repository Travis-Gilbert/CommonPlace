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
    GridRect, LayoutMcpCall, LayoutObject, LayoutTab, LayoutTarget, LayoutWidget, ScopeBinding,
};
pub use dashboard::{
    project_server_aggregates, AggregateCall, AggregateCompleteness, DashboardError,
    ServerAggregateReceipt,
};
pub use grid::{CommitKind, EditableLayout, LayoutCommit, LayoutEditError, LayoutEditor};
pub use record_page::{
    render_layout, RecordData, RelatedRecord, RenderedSurface, RenderedWidget, SurfaceView,
};
