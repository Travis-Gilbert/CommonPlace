//! Placement and editing for the one layout renderer.
//!
//! This module owns where a widget sits and how a person changes that;
//! `record_page.rs` owns what a widget shows. Before W03 both files rendered
//! widgets, and only one of them handled an unregistered body kind, so the
//! same layout degraded differently depending on which renderer you reached.
//!
//! Geometry is dragged, not stepped. LY2 asks for widgets that snap to the
//! grid and persist on drop, so the cell size is a constant here and the same
//! constant is emitted into the stylesheet by [`emit_layout_css`]. That is
//! deliberate: the pointer maths and the CSS have to agree about how wide a
//! column is, and the only way to guarantee that is to have one of them read
//! the other's number rather than restate it.

use std::collections::BTreeMap;

use dioxus::prelude::*;
use dioxus_dnd::prelude::{apply_sort, Axis, SortEvent, SortableList};
use serde_json::Value;
use thiserror::Error;

use crate::{
    render_tab, BodyRegistry, BodyRequest, GridRect, LayoutMcpCall, LayoutObject, LayoutTab,
    LayoutWidget, PaletteEntry, ProjectedBody, RecordData, ScopeBinding,
};

pub const GRID_COLUMNS: u32 = 12;
/// The width of one grid column, in CSS pixels.
pub const GRID_CELL_PX: f64 = 72.0;
/// The height of one grid row, in CSS pixels.
pub const GRID_ROW_PX: f64 = 48.0;
/// The tallest a widget may be dragged. `GridRect::snapped` floors height at
/// one row but declares no ceiling, so the drag supplies its own.
pub const GRID_MAX_ROWS: u32 = 64;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CommitKind {
    WidgetDrop,
    WidgetResize,
    WidgetAdd,
    WidgetRemove,
    WidgetReorder,
    TabAdd,
    TabRemove,
    TabReorder,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LayoutCommit {
    pub kind: CommitKind,
    pub layout: LayoutObject,
    pub persistence: LayoutMcpCall,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LayoutEditor {
    persisted: LayoutObject,
    draft: LayoutObject,
    edit_mode: bool,
}

impl LayoutEditor {
    #[must_use]
    pub fn new(layout: LayoutObject) -> Self {
        Self {
            persisted: layout.clone(),
            draft: layout,
            edit_mode: false,
        }
    }

    #[must_use]
    pub const fn is_editing(&self) -> bool {
        self.edit_mode
    }

    #[must_use]
    pub const fn draft(&self) -> &LayoutObject {
        &self.draft
    }

    #[must_use]
    pub const fn persisted(&self) -> &LayoutObject {
        &self.persisted
    }

    pub const fn enter_edit_mode(&mut self) {
        self.edit_mode = true;
    }

    pub const fn exit_edit_mode(&mut self) {
        self.edit_mode = false;
    }

    /// Update draft geometry without persisting it.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or when the tab/widget is unknown.
    pub fn preview_widget_geometry(
        &mut self,
        tab_id: &str,
        widget_id: &str,
        grid: GridRect,
    ) -> Result<(), LayoutEditError> {
        self.require_edit_mode()?;
        self.widget_mut(tab_id, widget_id)?.grid = grid.snapped(GRID_COLUMNS);
        Ok(())
    }

    /// Read one widget's current draft geometry.
    #[must_use]
    pub fn widget_geometry(&self, tab_id: &str, widget_id: &str) -> Option<GridRect> {
        self.draft
            .tabs
            .iter()
            .find(|tab| tab.tab_id == tab_id)?
            .widgets
            .iter()
            .find(|widget| widget.widget_id == widget_id)
            .map(|widget| widget.grid)
    }

    /// Commit one completed widget drop and emit its graph persistence call.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or when the tab/widget is unknown.
    pub fn commit_widget_drop(
        &mut self,
        tab_id: &str,
        widget_id: &str,
        grid: GridRect,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.preview_widget_geometry(tab_id, widget_id, grid)?;
        Ok(self.commit(CommitKind::WidgetDrop))
    }

    /// Commit a widget resize and emit its graph persistence call.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or when the tab/widget is unknown.
    pub fn commit_widget_resize(
        &mut self,
        tab_id: &str,
        widget_id: &str,
        width: u32,
        height: u32,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        let widget = self.widget_mut(tab_id, widget_id)?;
        widget.grid = GridRect {
            w: width,
            h: height,
            ..widget.grid
        }
        .snapped(GRID_COLUMNS);
        Ok(self.commit(CommitKind::WidgetResize))
    }

    /// Add and persist one widget on an existing tab.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode, for an unknown tab, or for a
    /// duplicate widget id.
    pub fn add_widget(
        &mut self,
        tab_id: &str,
        mut widget: LayoutWidget,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        let tab = self.tab_mut(tab_id)?;
        if tab
            .widgets
            .iter()
            .any(|existing| existing.widget_id == widget.widget_id)
        {
            return Err(LayoutEditError::DuplicateWidget(widget.widget_id));
        }
        widget.grid = widget.grid.snapped(GRID_COLUMNS);
        tab.widgets.push(widget);
        Ok(self.commit(CommitKind::WidgetAdd))
    }

    /// Remove and persist one widget. LY2 names removal beside add.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or when the tab/widget is unknown.
    pub fn remove_widget(
        &mut self,
        tab_id: &str,
        widget_id: &str,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        let tab = self.tab_mut(tab_id)?;
        let before = tab.widgets.len();
        tab.widgets.retain(|widget| widget.widget_id != widget_id);
        if tab.widgets.len() == before {
            return Err(LayoutEditError::UnknownWidget(widget_id.to_owned()));
        }
        Ok(self.commit(CommitKind::WidgetRemove))
    }

    /// Persist a tab reorder emitted by `dioxus-dnd` after drop.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or for out-of-range indices.
    pub fn reorder_tabs(&mut self, event: SortEvent) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        validate_sort(event, self.draft.tabs.len())?;
        apply_sort(&mut self.draft.tabs, event);
        Ok(self.commit(CommitKind::TabReorder))
    }

    /// Exercise the same tab reorder semantics without constructing the
    /// non-exhaustive upstream event type.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or for out-of-range indices.
    pub fn reorder_tabs_by_index(
        &mut self,
        from: usize,
        to: usize,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        validate_indices(from, to, self.draft.tabs.len())?;
        apply_index_sort(&mut self.draft.tabs, from, to);
        Ok(self.commit(CommitKind::TabReorder))
    }

    /// Persist a widget reorder, reassigning grid slots in the new order.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode, for an unknown tab, or for
    /// out-of-range indices.
    pub fn reorder_widgets(
        &mut self,
        tab_id: &str,
        event: SortEvent,
    ) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        let tab = self.tab_mut(tab_id)?;
        validate_sort(event, tab.widgets.len())?;
        let slots = tab
            .widgets
            .iter()
            .map(|widget| widget.grid)
            .collect::<Vec<_>>();
        apply_sort(&mut tab.widgets, event);
        for (widget, slot) in tab.widgets.iter_mut().zip(slots) {
            widget.grid = slot;
        }
        Ok(self.commit(CommitKind::WidgetReorder))
    }

    const fn require_edit_mode(&self) -> Result<(), LayoutEditError> {
        if self.edit_mode {
            Ok(())
        } else {
            Err(LayoutEditError::EditModeRequired)
        }
    }

    fn tab_mut(&mut self, tab_id: &str) -> Result<&mut LayoutTab, LayoutEditError> {
        self.draft
            .tabs
            .iter_mut()
            .find(|tab| tab.tab_id == tab_id)
            .ok_or_else(|| LayoutEditError::UnknownTab(tab_id.to_owned()))
    }

    fn widget_mut(
        &mut self,
        tab_id: &str,
        widget_id: &str,
    ) -> Result<&mut LayoutWidget, LayoutEditError> {
        self.tab_mut(tab_id)?
            .widgets
            .iter_mut()
            .find(|widget| widget.widget_id == widget_id)
            .ok_or_else(|| LayoutEditError::UnknownWidget(widget_id.to_owned()))
    }

    fn commit(&mut self, kind: CommitKind) -> LayoutCommit {
        self.persisted = self.draft.clone();
        LayoutCommit {
            kind,
            layout: self.persisted.clone(),
            persistence: self.persisted.write_call(),
        }
    }
}

const fn validate_sort(event: SortEvent, len: usize) -> Result<(), LayoutEditError> {
    validate_indices(event.from, event.to, len)
}

const fn validate_indices(from: usize, to: usize, len: usize) -> Result<(), LayoutEditError> {
    if from >= len || to >= len {
        Err(LayoutEditError::InvalidSort { from, to, len })
    } else {
        Ok(())
    }
}

fn apply_index_sort<T>(items: &mut Vec<T>, from: usize, to: usize) {
    if from != to {
        let item = items.remove(from);
        items.insert(to, item);
    }
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum LayoutEditError {
    #[error("layout edit mode is required")]
    EditModeRequired,
    #[error("unknown layout tab: {0}")]
    UnknownTab(String),
    #[error("unknown layout widget: {0}")]
    UnknownWidget(String),
    #[error("duplicate layout widget: {0}")]
    DuplicateWidget(String),
    #[error("duplicate layout tab: {0}")]
    DuplicateTab(String),
    #[error("a layout must keep at least one tab")]
    LastTab,
    #[error("invalid sort from {from} to {to} for {len} items")]
    InvalidSort { from: usize, to: usize, len: usize },
}

impl LayoutEditor {
    /// Add and persist one tab. LY2 names tab add beside remove and reorder.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode or for a duplicate tab id.
    pub fn add_tab(&mut self, tab_id: &str, title: &str) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        if self.draft.tabs.iter().any(|tab| tab.tab_id == tab_id) {
            return Err(LayoutEditError::DuplicateTab(tab_id.to_owned()));
        }
        self.draft.tabs.push(LayoutTab {
            tab_id: tab_id.to_owned(),
            title: title.to_owned(),
            widgets: Vec::new(),
        });
        Ok(self.commit(CommitKind::TabAdd))
    }

    /// Remove and persist one tab.
    ///
    /// The last tab is refused: a layout with no tabs has nowhere to render
    /// and nowhere to add a widget back, so it is a state the editor should
    /// not be able to reach.
    ///
    /// # Errors
    ///
    /// Returns an error outside edit mode, for an unknown tab, or when it is
    /// the only remaining tab.
    pub fn remove_tab(&mut self, tab_id: &str) -> Result<LayoutCommit, LayoutEditError> {
        self.require_edit_mode()?;
        if !self.draft.tabs.iter().any(|tab| tab.tab_id == tab_id) {
            return Err(LayoutEditError::UnknownTab(tab_id.to_owned()));
        }
        if self.draft.tabs.len() == 1 {
            return Err(LayoutEditError::LastTab);
        }
        self.draft.tabs.retain(|tab| tab.tab_id != tab_id);
        Ok(self.commit(CommitKind::TabRemove))
    }
}

/// The crate's own layout rules.
///
/// `theoremweb-chrome` owns the custom-property namespace and never emits a
/// selector, so the crate that emits class names owns their layout. The column
/// width here is [`GRID_CELL_PX`] rather than a literal, because the pointer
/// maths in [`LayoutSurface`] converts a drag distance into columns with that
/// same number; a stylesheet holding its own copy would drift the two apart
/// and the drag would land a widget somewhere other than where it was dropped.
#[must_use]
pub fn emit_layout_css() -> String {
    format!(
        ".theorem-layout-editor{{display:flex;flex-direction:column;gap:.75rem;color:var(--foreground);}}\
.theorem-layout-tabs{{display:flex;gap:.25rem;align-items:center;flex-wrap:wrap;}}\
.theorem-layout-tabs button{{background:transparent;border:1px solid var(--border);border-radius:var(--radius,4px);color:var(--muted-foreground);padding:.25rem .625rem;cursor:pointer;font:inherit;}}\
.theorem-layout-tabs button[aria-selected=\"true\"]{{background:var(--accent);color:var(--foreground);border-color:var(--primary);}}\
.theorem-layout-toolbar{{display:flex;gap:.5rem;align-items:center;margin-left:auto;}}\
.theorem-layout-palette{{display:flex;gap:.375rem;flex-wrap:wrap;padding:.5rem;border:1px dashed var(--border);border-radius:var(--radius,4px);}}\
.theorem-layout-palette button{{background:var(--card,var(--background));border:1px solid var(--border);border-radius:var(--radius,4px);color:var(--foreground);padding:.25rem .5rem;cursor:pointer;font:inherit;}}\
.theorem-layout-grid{{display:grid;grid-template-columns:repeat({GRID_COLUMNS},{GRID_CELL_PX}px);grid-auto-rows:{GRID_ROW_PX}px;gap:.5rem;align-content:start;position:relative;}}\
.theorem-layout-widget{{position:relative;overflow:hidden;background:var(--card,var(--background));border:1px solid var(--border);border-radius:var(--radius,4px);padding:.5rem;display:flex;flex-direction:column;gap:.25rem;min-width:0;}}\
.theorem-layout-widget[data-unavailable=\"true\"]{{border-style:dashed;color:var(--muted-foreground);}}\
.theorem-layout-widget-handle{{cursor:grab;font-size:.6875rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground);user-select:none;}}\
.theorem-layout-editing .theorem-layout-widget-handle{{cursor:grab;}}\
.theorem-widget-label{{margin:0;font-size:.8125rem;font-weight:600;}}\
.theorem-widget-body{{margin:0;font-size:.8125rem;overflow:auto;min-height:0;}}\
.theorem-widget-link{{background:none;border:none;padding:0;text-align:left;color:var(--primary);text-decoration:underline;cursor:pointer;font:inherit;}}\
.theorem-layout-resize-handle{{position:absolute;right:0;bottom:0;width:14px;height:14px;padding:0;border:none;background:var(--primary);opacity:.65;cursor:nwse-resize;touch-action:none;}}\
.theorem-layout-remove{{position:absolute;right:0;top:0;border:none;background:transparent;color:var(--muted-foreground);cursor:pointer;font:inherit;line-height:1;padding:.125rem .25rem;}}\
.theorem-layout-empty{{color:var(--muted-foreground);font-size:.8125rem;}}",
    )
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DragMode {
    Move,
    Resize,
}

#[derive(Clone, Debug, PartialEq)]
struct WidgetDrag {
    mode: DragMode,
    tab_id: String,
    widget_id: String,
    origin: (f64, f64),
    start: GridRect,
}

/// Convert a drag distance into a span, clamped before conversion.
///
/// The clamp runs in floating point and lands inside `1..=max`, so the
/// truncation clippy warns about cannot happen. The narrow allow is preferable
/// to restating this in integer arithmetic that would round half-cells
/// differently from the CSS grid.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn dragged_span(start: u32, delta_px: f64, cell_px: f64, max: u32) -> u32 {
    let cells = (delta_px / cell_px).round();
    (f64::from(start) + cells).clamp(1.0, f64::from(max)) as u32
}

/// Convert a drag distance into a grid origin, clamped before conversion.
///
/// `GridRect::snapped` performs the real bounds check against the column
/// count; this only has to keep the value inside `i32`.
#[allow(clippy::cast_possible_truncation)]
fn dragged_origin(start: i32, delta_px: f64, cell_px: f64) -> i32 {
    let cells = (delta_px / cell_px).round();
    (f64::from(start) + cells).clamp(0.0, 4096.0) as i32
}

/// Pick a free widget id and a free row for a palette-added body.
fn palette_widget(layout: &LayoutObject, tab_id: &str, kind: &str) -> LayoutWidget {
    let tab = layout.tabs.iter().find(|tab| tab.tab_id == tab_id);
    let taken = |candidate: &str| {
        tab.is_some_and(|tab| {
            tab.widgets
                .iter()
                .any(|widget| widget.widget_id == candidate)
        })
    };
    let mut suffix = 1_usize;
    let mut widget_id = format!("{kind}-{suffix}");
    while taken(&widget_id) {
        suffix += 1;
        widget_id = format!("{kind}-{suffix}");
    }
    let bottom = tab.map_or(0, |tab| {
        tab.widgets
            .iter()
            .map(|widget| widget.grid.y + i32::try_from(widget.grid.h).unwrap_or(1))
            .max()
            .unwrap_or(0)
    });
    LayoutWidget {
        widget_id,
        body_kind: kind.to_owned(),
        body_params: Value::Object(serde_json::Map::new()),
        grid: GridRect {
            x: 0,
            y: bottom,
            w: 6,
            h: 3,
        },
        field_visibility: None,
    }
}

/// Apply a drag's current position to the draft without persisting it.
///
/// Preview and commit are split because LY2 wants unsaved geometry to survive
/// leaving edit mode: only the pointer-up path writes to `persisted`.
fn preview_drag(drag: Signal<Option<WidgetDrag>>, mut editor: Signal<LayoutEditor>, x: f64, y: f64) {
    let Some(active) = drag.read().clone() else { return };
    let dx = x - active.origin.0;
    let dy = y - active.origin.1;
    let next = match active.mode {
        DragMode::Resize => GridRect {
            w: dragged_span(active.start.w, dx, GRID_CELL_PX, GRID_COLUMNS),
            h: dragged_span(active.start.h, dy, GRID_ROW_PX, GRID_MAX_ROWS),
            ..active.start
        },
        DragMode::Move => GridRect {
            x: dragged_origin(active.start.x, dx, GRID_CELL_PX),
            y: dragged_origin(active.start.y, dy, GRID_ROW_PX),
            ..active.start
        },
    };
    // Refused outside edit mode, which the handles already gate; a preview
    // that cannot apply is not an error here.
    let _ = editor
        .write()
        .preview_widget_geometry(&active.tab_id, &active.widget_id, next);
}

/// End a drag, returning the graph write it earned.
fn commit_drag(
    mut drag: Signal<Option<WidgetDrag>>,
    mut editor: Signal<LayoutEditor>,
) -> Option<LayoutMcpCall> {
    let active = drag.write().take()?;
    let grid = editor
        .read()
        .widget_geometry(&active.tab_id, &active.widget_id)?;
    let commit = match active.mode {
        DragMode::Resize => {
            editor
                .write()
                .commit_widget_resize(&active.tab_id, &active.widget_id, grid.w, grid.h)
        }
        DragMode::Move => {
            editor
                .write()
                .commit_widget_drop(&active.tab_id, &active.widget_id, grid)
        }
    };
    commit.ok().map(|commit| commit.persistence)
}

#[derive(Clone, PartialEq, Props)]
struct TabStripProps {
    tabs: Vec<(String, String)>,
    selected: String,
    editing: bool,
    active_tab: Signal<Option<String>>,
    editor: Signal<LayoutEditor>,
    on_persist: EventHandler<LayoutMcpCall>,
}

/// The tab row: always selectable, draggable only in edit mode.
///
/// Selection and reorder are separate affordances on purpose. A tab that both
/// switches on click and reorders on drag is one gesture ambiguity; keeping
/// the sortable wrapper to edit mode means a reader can only ever click.
#[allow(non_snake_case, clippy::missing_errors_doc)]
fn LayoutTabStrip(props: TabStripProps) -> Element {
    let TabStripProps {
        tabs,
        selected,
        editing,
        mut active_tab,
        mut editor,
        on_persist,
    } = props;
    let sortable_rows = tabs.clone();
    let sortable_selected = selected.clone();
    rsx! {
        header { class: "theorem-layout-tabs",
            if editing {
                SortableList {
                    len: sortable_rows.len(),
                    axis: Axis::Horizontal,
                    render: move |index: usize| {
                        let (id, title) = sortable_rows[index].clone();
                        let chosen = id.clone();
                        let is_selected = id == sortable_selected;
                        rsx! {
                            button {
                                "data-tab-id": "{id}",
                                "aria-selected": if is_selected { "true" } else { "false" },
                                onclick: move |_| active_tab.set(Some(chosen.clone())),
                                "{title}"
                            }
                        }
                    },
                    on_sort: move |event: SortEvent| {
                        if let Ok(commit) = editor.write().reorder_tabs(event) {
                            on_persist.call(commit.persistence);
                        }
                    },
                }
            } else {
                for (id, title) in tabs {
                    {
                        let chosen = id.clone();
                        let is_selected = id == selected;
                        rsx! {
                            button {
                                key: "{id}",
                                "data-tab-id": "{id}",
                                "aria-selected": if is_selected { "true" } else { "false" },
                                onclick: move |_| active_tab.set(Some(chosen.clone())),
                                "{title}"
                            }
                        }
                    }
                }
            }
            div { class: "theorem-layout-toolbar",
                button {
                    "data-layout-edit-toggle": "true",
                    "aria-pressed": if editing { "true" } else { "false" },
                    onclick: move |_| {
                        let mut guard = editor.write();
                        if guard.is_editing() {
                            guard.exit_edit_mode();
                        } else {
                            guard.enter_edit_mode();
                        }
                    },
                    if editing { "Done" } else { "Edit layout" }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
struct WidgetPaletteProps {
    entries: Vec<PaletteEntry>,
    tab_id: Option<String>,
    editor: Signal<LayoutEditor>,
    on_persist: EventHandler<LayoutMcpCall>,
}

/// The add-a-widget palette, derived from the canonical registry.
///
/// LY3's acceptance is that one registration reaches both palettes with no
/// second registration, so this iterates `widget_palette()` and never a list
/// of its own.
#[allow(non_snake_case, clippy::missing_errors_doc)]
fn WidgetPalette(props: WidgetPaletteProps) -> Element {
    let WidgetPaletteProps {
        entries,
        tab_id,
        mut editor,
        on_persist,
    } = props;
    rsx! {
        div { class: "theorem-layout-palette", "data-palette": "widget",
            for entry in entries {
                {
                    let kind = entry.kind.clone();
                    let target = tab_id.clone();
                    rsx! {
                        button {
                            key: "{entry.kind}",
                            "data-palette-kind": "{entry.kind}",
                            "data-palette-icon": "{entry.icon}",
                            onclick: move |_| {
                                let Some(tab_id) = target.clone() else { return };
                                let widget = palette_widget(editor.read().draft(), &tab_id, &kind);
                                if let Ok(commit) = editor.write().add_widget(&tab_id, widget) {
                                    on_persist.call(commit.persistence);
                                }
                            },
                            "{entry.title}"
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct LayoutSurfaceProps {
    pub initial: LayoutObject,
    pub registry: BodyRegistry,
    pub scope: ScopeBinding,
    #[props(default)]
    pub record: Option<RecordData>,
    /// Server-attested values only. `dashboard::project_server_aggregates`
    /// refuses page-scoped receipts before they can reach this map.
    #[props(default)]
    pub server_values: BTreeMap<String, Value>,
    /// The host's chance to own a body kind it has a real component for.
    pub body: Callback<BodyRequest, Element>,
    pub on_persist: EventHandler<LayoutMcpCall>,
}

/// One layout surface: a record page, a canvas, or a dashboard.
///
/// The editor state is seeded once from `initial`. A host that swaps the
/// mounted layout must give this component a `key` of the layout id so Dioxus
/// remounts it; otherwise the new layout would render against the previous
/// layout's draft.
///
/// Navigation is not a prop here. The host closes over its own resolver when
/// it builds the `body` slot, which keeps one owner for "what does opening
/// this mean" instead of two paths that can disagree.
// Dioxus components are PascalCase by convention; `#[component]` emits this
// allow itself, and this one takes a props struct rather than individual
// arguments so it stays under the argument-count lint.
#[allow(non_snake_case, clippy::missing_errors_doc)]
pub fn LayoutSurface(props: LayoutSurfaceProps) -> Element {
    let LayoutSurfaceProps {
        initial,
        registry,
        scope,
        record,
        server_values,
        body,
        on_persist,
    } = props;

    let editor = use_signal(|| LayoutEditor::new(initial));
    let active_tab = use_signal(|| None::<String>);
    let drag = use_signal(|| None::<WidgetDrag>);

    let draft = editor.read().draft().clone();
    let editing = editor.read().is_editing();

    // A stale tab selection falls back to the first tab rather than rendering
    // nothing, but a *named* tab that no longer exists is a different case and
    // `render_tab` refuses that one.
    let current = active_tab
        .read()
        .clone()
        .filter(|id| draft.tabs.iter().any(|tab| &tab.tab_id == id))
        .or_else(|| draft.tabs.first().map(|tab| tab.tab_id.clone()));

    let surface = render_tab(
        &draft,
        current.as_deref(),
        scope,
        &registry,
        record.as_ref(),
        &server_values,
    );
    let requests = current
        .as_ref()
        .and_then(|id| draft.tabs.iter().find(|tab| &tab.tab_id == id))
        .map(|tab| tab.widgets.clone())
        .unwrap_or_default()
        .into_iter()
        .zip(surface.widgets)
        .map(|(widget, rendered)| BodyRequest { widget, rendered })
        .collect::<Vec<_>>();

    let tabs = draft
        .tabs
        .iter()
        .map(|tab| (tab.tab_id.clone(), tab.title.clone()))
        .collect::<Vec<_>>();
    let selected_id = current.clone().unwrap_or_default();
    let frame_tab = selected_id.clone();
    let empty = requests.is_empty();

    rsx! {
        section {
            class: if editing { "theorem-layout-editor theorem-layout-editing" } else { "theorem-layout-editor" },
            "data-layout-id": "{draft.layout_id}",
            "data-edit-mode": if editing { "true" } else { "false" },
            "data-renderer": surface.renderer,
            LayoutTabStrip {
                tabs,
                selected: selected_id.clone(),
                editing,
                active_tab,
                editor,
                on_persist,
            }
            if editing {
                WidgetPalette {
                    entries: registry.widget_palette(),
                    tab_id: current,
                    editor,
                    on_persist,
                }
            }
            div {
                class: "theorem-layout-grid",
                "data-tab-id": "{selected_id}",
                onpointermove: move |event| {
                    let point = event.client_coordinates();
                    preview_drag(drag, editor, point.x, point.y);
                },
                onpointerup: move |_| {
                    if let Some(call) = commit_drag(drag, editor) {
                        on_persist.call(call);
                    }
                },
                for request in requests {
                    WidgetFrame {
                        key: "{request.rendered.widget_id}",
                        request,
                        tab_id: frame_tab.clone(),
                        editing,
                        editor,
                        drag,
                        body,
                        on_persist,
                    }
                }
                if empty {
                    p { class: "theorem-layout-empty", "This tab has no widgets." }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
struct WidgetFrameProps {
    request: BodyRequest,
    tab_id: String,
    editing: bool,
    editor: Signal<LayoutEditor>,
    drag: Signal<Option<WidgetDrag>>,
    body: Callback<BodyRequest, Element>,
    on_persist: EventHandler<LayoutMcpCall>,
}

#[allow(non_snake_case, clippy::missing_errors_doc)]
fn WidgetFrame(props: WidgetFrameProps) -> Element {
    let WidgetFrameProps {
        request,
        tab_id,
        editing,
        mut editor,
        mut drag,
        body,
        on_persist,
    } = props;

    let grid = request.rendered.grid;
    let widget_id = request.rendered.widget_id.clone();
    let kind = request.rendered.kind.clone();
    let unavailable = request.rendered.unavailable;
    let style = format!(
        "grid-column:{} / span {};grid-row:{} / span {};",
        grid.x + 1,
        grid.w,
        grid.y + 1,
        grid.h
    );
    let content = body.call(request);

    let move_tab = tab_id.clone();
    let move_widget = widget_id.clone();
    let resize_tab = tab_id.clone();
    let resize_widget = widget_id.clone();
    let remove_widget = widget_id.clone();

    rsx! {
        article {
            class: "theorem-layout-widget",
            "data-widget-id": "{widget_id}",
            "data-body-kind": "{kind}",
            "data-unavailable": unavailable.then_some("true"),
            "data-grid": "{grid.x},{grid.y},{grid.w},{grid.h}",
            style: "{style}",
            if editing {
                div {
                    class: "theorem-layout-widget-handle",
                    "data-drag-handle": "{widget_id}",
                    onpointerdown: move |event| {
                        event.stop_propagation();
                        let point = event.client_coordinates();
                        drag.set(Some(WidgetDrag {
                            mode: DragMode::Move,
                            tab_id: move_tab.clone(),
                            widget_id: move_widget.clone(),
                            origin: (point.x, point.y),
                            start: grid,
                        }));
                    },
                    "Move"
                }
            }
            {content}
            if editing {
                button {
                    class: "theorem-layout-remove",
                    "aria-label": "Remove {widget_id}",
                    onclick: move |_| {
                        if let Ok(commit) = editor.write().remove_widget(&tab_id, &remove_widget) {
                            on_persist.call(commit.persistence);
                        }
                    },
                    "x"
                }
                button {
                    class: "theorem-layout-resize-handle",
                    "data-resize-handle": "{widget_id}",
                    "aria-label": "Resize {widget_id}",
                    onpointerdown: move |event| {
                        event.stop_propagation();
                        let point = event.client_coordinates();
                        drag.set(Some(WidgetDrag {
                            mode: DragMode::Resize,
                            tab_id: resize_tab.clone(),
                            widget_id: resize_widget.clone(),
                            origin: (point.x, point.y),
                            start: grid,
                        }));
                    },
                }
            }
        }
    }
}

/// The default body slot: every kind falls through to the projection.
///
/// A host with no special bodies passes this; a host that owns one component
/// matches on the kind and delegates the rest here.
#[must_use]
pub fn projected_body_slot(on_navigate: EventHandler<String>) -> Callback<BodyRequest, Element> {
    Callback::new(move |request: BodyRequest| {
        rsx! { ProjectedBody { rendered: request.rendered, on_navigate } }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{body_registry::fixtures::canonical_stub, render_widget};

    fn layout() -> LayoutObject {
        serde_json::from_str(include_str!("../fixtures/company-layout.json")).unwrap()
    }

    fn editing_editor() -> LayoutEditor {
        let mut editor = LayoutEditor::new(layout());
        editor.enter_edit_mode();
        editor
    }

    #[allow(non_snake_case)]
    #[component]
    fn Harness() -> Element {
        let body = projected_body_slot(EventHandler::new(|_: String| {}));
        rsx! {
            LayoutSurface {
                initial: layout(),
                registry: canonical_stub(),
                scope: ScopeBinding::Workspace,
                body,
                on_persist: move |_| {},
            }
        }
    }

    #[allow(non_snake_case)]
    #[component]
    fn EditingFrame() -> Element {
        let widget = layout().tabs[0].widgets[0].clone();
        let rendered = render_widget(&widget, &canonical_stub(), None, &BTreeMap::new());
        let editor = use_signal(editing_editor);
        let drag = use_signal(|| None::<WidgetDrag>);
        let body = projected_body_slot(EventHandler::new(|_: String| {}));
        rsx! {
            WidgetFrame {
                request: BodyRequest { widget, rendered },
                tab_id: "main".to_string(),
                editing: true,
                editor,
                drag,
                body,
                on_persist: move |_| {},
            }
        }
    }

    #[test]
    fn drop_resize_add_remove_and_tab_reorder_commit_graph_writes() {
        let mut editor = editing_editor();
        let moved = editor
            .commit_widget_drop(
                "main",
                "fields",
                GridRect {
                    x: 10,
                    y: 3,
                    w: 4,
                    h: 5,
                },
            )
            .unwrap();
        assert_eq!(moved.kind, CommitKind::WidgetDrop);
        assert_eq!(moved.layout.tabs[0].widgets[0].grid.x, 8);
        assert_eq!(moved.persistence.tool, "layout_write");

        let resized = editor.commit_widget_resize("main", "fields", 3, 7).unwrap();
        assert_eq!(resized.layout.tabs[0].widgets[0].grid.w, 3);

        editor
            .add_widget(
                "main",
                LayoutWidget {
                    widget_id: "chart".into(),
                    body_kind: "chart".into(),
                    body_params: serde_json::json!({}),
                    grid: GridRect {
                        x: 0,
                        y: 4,
                        w: 6,
                        h: 3,
                    },
                    field_visibility: None,
                },
            )
            .unwrap();
        assert_eq!(editor.persisted().tabs[0].widgets.len(), 3);

        let removed = editor.remove_widget("main", "chart").unwrap();
        assert_eq!(removed.kind, CommitKind::WidgetRemove);
        assert_eq!(editor.persisted().tabs[0].widgets.len(), 2);

        editor.reorder_tabs_by_index(1, 0).unwrap();
        assert_eq!(editor.persisted().tabs[0].tab_id, "activity");
    }

    #[test]
    fn leaving_edit_mode_keeps_unsaved_geometry_in_the_draft() {
        let mut editor = editing_editor();
        editor
            .preview_widget_geometry(
                "main",
                "fields",
                GridRect {
                    x: 2,
                    y: 2,
                    w: 5,
                    h: 5,
                },
            )
            .unwrap();
        editor.exit_edit_mode();
        assert_eq!(editor.draft().tabs[0].widgets[0].grid.x, 2);
        assert_eq!(editor.persisted().tabs[0].widgets[0].grid.x, 0);
        editor.enter_edit_mode();
        assert_eq!(editor.draft().tabs[0].widgets[0].grid.x, 2);
    }

    #[test]
    fn every_edit_is_refused_outside_edit_mode() {
        let mut editor = LayoutEditor::new(layout());
        assert_eq!(
            editor
                .commit_widget_resize("main", "fields", 2, 2)
                .unwrap_err(),
            LayoutEditError::EditModeRequired
        );
        assert_eq!(
            editor.remove_widget("main", "fields").unwrap_err(),
            LayoutEditError::EditModeRequired
        );
        assert_eq!(
            editor.add_tab("extra", "Extra").unwrap_err(),
            LayoutEditError::EditModeRequired
        );
    }

    #[test]
    fn tab_add_and_remove_persist_and_the_last_tab_is_refused() {
        let mut editor = editing_editor();
        let added = editor.add_tab("notes", "Notes").unwrap();
        assert_eq!(added.kind, CommitKind::TabAdd);
        assert_eq!(editor.persisted().tabs.len(), 3);
        assert_eq!(
            editor.add_tab("notes", "Notes").unwrap_err(),
            LayoutEditError::DuplicateTab("notes".into())
        );

        editor.remove_tab("notes").unwrap();
        editor.remove_tab("activity").unwrap();
        assert_eq!(editor.persisted().tabs.len(), 1);
        // A layout with no tabs has nowhere to add a widget back.
        assert_eq!(editor.remove_tab("main").unwrap_err(), LayoutEditError::LastTab);
    }

    #[test]
    fn the_interactive_renderer_shows_bodies_not_body_kind_strings() {
        // The defect this replaces: `EditableLayout` rendered `"{body_kind}"`
        // as bare text, so the records tab of a real layout showed the word
        // "fields" where the fields belonged.
        let html = dioxus_ssr::render_element(rsx! { Harness {} });
        assert!(html.contains("theorem-layout-editor"));
        assert!(html.contains("data-widget-id=\"fields\""));
        assert!(html.contains("theorem-widget-label"));
        assert!(html.contains("No record bound"));
        assert!(html.contains("data-navigate-intent=\"record:company:globex\""));
    }

    #[test]
    fn the_interactive_renderer_labels_an_unregistered_body_too() {
        // Both renderers now degrade the same way. Previously only
        // `record_page::SurfaceView` labeled it and the grid printed the raw
        // kind, so the same layout was recoverable in one and confusing in the
        // other.
        let widget = layout().tabs[1].widgets[0].clone();
        let rendered = render_widget(&widget, &canonical_stub(), None, &BTreeMap::new());
        assert!(rendered.unavailable);
        assert_eq!(rendered.label, "Unavailable body: future_body");
    }

    #[test]
    fn the_surface_opens_read_only_with_no_palette_and_no_handles() {
        // LY2: edit mode is entered deliberately, so a freshly opened layout
        // offers no drag handle to catch by accident.
        let html = dioxus_ssr::render_element(rsx! { Harness {} });
        assert!(html.contains("data-edit-mode=\"false\""));
        assert!(html.contains("data-layout-edit-toggle"));
        assert!(!html.contains("data-palette-kind"));
        assert!(!html.contains("theorem-layout-resize-handle"));
        assert!(!html.contains("data-drag-handle"));
    }

    #[test]
    fn an_editing_widget_offers_move_resize_and_remove() {
        let html = dioxus_ssr::render_element(rsx! { EditingFrame {} });
        assert!(html.contains("data-drag-handle=\"fields\""));
        assert!(html.contains("data-resize-handle=\"fields\""));
        assert!(html.contains("aria-label=\"Remove fields\""));
        assert!(html.contains("data-grid=\"0,0,6,4\""));
    }

    #[test]
    fn tabs_are_selectable_and_the_first_one_starts_selected() {
        let html = dioxus_ssr::render_element(rsx! { Harness {} });
        assert!(html.contains("data-tab-id=\"main\""));
        assert!(html.contains("data-tab-id=\"activity\""));
        assert!(html.contains("aria-selected=\"true\""));
        assert!(html.contains("aria-selected=\"false\""));
    }

    #[test]
    fn the_palette_offers_exactly_what_the_registry_declares() {
        // LY3: one registration drives the palette, so a body kind added to
        // the canonical document needs no edit here.
        let registry = canonical_stub();
        let kinds = registry
            .widget_palette()
            .into_iter()
            .map(|entry| entry.kind)
            .collect::<Vec<_>>();
        assert_eq!(kinds, registry.kinds());
        assert_eq!(registry.widget_palette(), registry.node_palette());
    }

    #[test]
    fn palette_widget_skips_ids_already_in_use() {
        let mut editor = editing_editor();
        let first = palette_widget(editor.draft(), "main", "chart");
        assert_eq!(first.widget_id, "chart-1");
        // It lands below the existing widgets rather than on top of them.
        assert_eq!(first.grid.y, 4);
        editor.add_widget("main", first).unwrap();
        let second = palette_widget(editor.draft(), "main", "chart");
        assert_eq!(second.widget_id, "chart-2");
    }

    #[test]
    fn a_drag_becomes_whole_grid_cells() {
        // Two and a half columns right rounds to three.
        assert_eq!(dragged_span(4, GRID_CELL_PX * 2.5, GRID_CELL_PX, 12), 7);
        // Dragging past the left edge floors at one column, never zero.
        assert_eq!(dragged_span(4, -GRID_CELL_PX * 9.0, GRID_CELL_PX, 12), 1);
        // And never past the declared column count.
        assert_eq!(dragged_span(4, GRID_CELL_PX * 40.0, GRID_CELL_PX, 12), 12);
        assert_eq!(dragged_origin(2, GRID_CELL_PX * 3.0, GRID_CELL_PX), 5);
        assert_eq!(dragged_origin(2, -GRID_CELL_PX * 8.0, GRID_CELL_PX), 0);
    }

    #[test]
    fn the_stylesheet_and_the_drag_maths_share_one_cell_size() {
        // The discriminating test for this file's central claim. If the CSS
        // ever restates the column width as a literal, a drag computes cells
        // against one number while the browser lays out against another, and
        // widgets land beside the cursor instead of under it.
        let css = emit_layout_css();
        assert!(css.contains(&format!(
            "grid-template-columns:repeat({GRID_COLUMNS},{GRID_CELL_PX}px)"
        )));
        assert!(css.contains(&format!("grid-auto-rows:{GRID_ROW_PX}px")));
        assert!(css.contains(".theorem-layout-grid{display:grid;"));
    }
}
