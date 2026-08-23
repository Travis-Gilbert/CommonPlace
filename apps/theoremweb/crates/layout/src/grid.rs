use dioxus::prelude::*;
use dioxus_dnd::prelude::{apply_sort, Axis, ReorderMode, SortEvent, SortableGrid, SortableList};
use thiserror::Error;

use crate::{GridRect, LayoutMcpCall, LayoutObject, LayoutTab, LayoutWidget};

pub const GRID_COLUMNS: u32 = 12;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CommitKind {
    WidgetDrop,
    WidgetResize,
    WidgetAdd,
    WidgetReorder,
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

    /// Persist a widget reorder emitted by `dioxus-dnd` after drop.
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
    #[error("invalid sort from {from} to {to} for {len} items")]
    InvalidSort { from: usize, to: usize, len: usize },
}

#[component]
pub fn EditableLayout(initial: LayoutObject, on_persist: EventHandler<LayoutMcpCall>) -> Element {
    let mut editor = use_signal(|| {
        let mut editor = LayoutEditor::new(initial);
        editor.enter_edit_mode();
        editor
    });
    let tabs = editor.read().draft().tabs.clone();
    let tabs_for_labels = tabs.clone();
    let active = tabs.first().cloned();
    rsx! {
        section {
            class: "theorem-layout-editor",
            "data-layout-id": "{editor.read().draft().layout_id}",
            SortableList {
                len: tabs.len(),
                axis: Axis::Horizontal,
                render: move |index: usize| {
                    let tab = &tabs_for_labels[index];
                    rsx! { button { "data-tab-id": "{tab.tab_id}", "{tab.title}" } }
                },
                on_sort: move |event: SortEvent| {
                    if let Ok(commit) = editor.write().reorder_tabs(event) {
                        on_persist.call(commit.persistence);
                    }
                },
            }
            if let Some(tab) = active {
                LayoutWidgetGrid { tab, editor, on_persist }
            }
        }
    }
}

#[component]
fn LayoutWidgetGrid(
    tab: LayoutTab,
    editor: Signal<LayoutEditor>,
    on_persist: EventHandler<LayoutMcpCall>,
) -> Element {
    let tab_id_for_sort = tab.tab_id.clone();
    let tab_id_for_resize = tab.tab_id.clone();
    let widgets = tab.widgets;
    let widgets_for_render = widgets.clone();
    rsx! {
        SortableGrid {
            len: widgets.len(),
            cols: usize::try_from(GRID_COLUMNS).unwrap_or(12),
            mode: ReorderMode::Insert,
            class: "theorem-layout-grid",
            render: move |index: usize| {
                let widget = &widgets_for_render[index];
                let resize_tab_id = tab_id_for_resize.clone();
                let resize_widget_id = widget.widget_id.clone();
                let next_width = widget.grid.w.saturating_add(1);
                let height = widget.grid.h;
                rsx! {
                    article {
                        "data-widget-id": "{widget.widget_id}",
                        "data-body-kind": "{widget.body_kind}",
                        style: "grid-column: {widget.grid.x + 1} / span {widget.grid.w}; grid-row: {widget.grid.y + 1} / span {widget.grid.h};",
                        "{widget.body_kind}"
                        button {
                            class: "theorem-layout-resize-handle",
                            "aria-label": "Resize {widget.widget_id}",
                            onclick: move |_| {
                                if let Ok(commit) = editor.write().commit_widget_resize(
                                    &resize_tab_id,
                                    &resize_widget_id,
                                    next_width,
                                    height,
                                ) {
                                    on_persist.call(commit.persistence);
                                }
                            },
                            "Resize"
                        }
                    }
                }
            },
            on_sort: move |event: SortEvent| {
                if let Ok(commit) = editor.write().reorder_widgets(&tab_id_for_sort, event) {
                    on_persist.call(commit.persistence);
                }
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> LayoutObject {
        serde_json::from_str(include_str!("../fixtures/company-layout.json")).unwrap()
    }

    #[component]
    fn LayoutHarness() -> Element {
        rsx! { EditableLayout { initial: layout(), on_persist: move |_| {} } }
    }

    #[test]
    fn drop_resize_add_and_tab_reorder_commit_graph_writes() {
        let mut editor = LayoutEditor::new(layout());
        editor.enter_edit_mode();
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
        editor.reorder_tabs_by_index(1, 0).unwrap();
        assert_eq!(editor.persisted().tabs[0].tab_id, "activity");
    }

    #[test]
    fn leaving_edit_mode_keeps_unsaved_geometry_in_the_draft() {
        let mut editor = LayoutEditor::new(layout());
        editor.enter_edit_mode();
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
    fn dioxus_dnd_layout_renders_tabs_and_widgets() {
        let html = dioxus_ssr::render_element(rsx! { LayoutHarness {} });
        assert!(html.contains("theorem-layout-editor"));
        assert!(html.contains("data-widget-id=\"fields\""));
        assert!(html.contains("theorem-layout-resize-handle"));
    }
}
