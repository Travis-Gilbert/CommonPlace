use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use commonplace_console_core::format::format_count;
use commonplace_console_core::{
    EntityDetail, GoldenId, NodePos, Page, ReadinessState, Receipt, ReceiptFilter, ReceiptKind,
    ReceiptPage,
};
use gpui::{
    AnyElement, App, AppContext, Application, Bounds, ClickEvent, Context, Entity, EventEmitter,
    FocusHandle, Focusable, InteractiveElement, IntoElement, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, ParentElement, PathBuilder, Pixels, Point, Render, SharedString,
    StatefulInteractiveElement, Styled, Window, WindowBounds, WindowKind, WindowOptions, canvas,
    div, point, px, quad, size,
};
use gpui_component::{
    ActiveTheme, Disableable, Root, Selectable, Sizable, TitleBar,
    button::{Button, ButtonGroup, ButtonVariants},
    chart::BarChart,
    dock::{
        DockArea, DockAreaState, DockEvent, DockItem, Panel, PanelControl, PanelEvent, PanelInfo,
        PanelState, register_panel,
    },
    group_box::{GroupBox, GroupBoxVariants},
    h_flex,
    label::Label,
    list::ListItem,
    table::{Column, Table, TableDelegate, TableEvent, TableState},
    tag::Tag,
    v_flex,
};
use serde::{Deserialize, Serialize};

use crate::model::NativeConsoleModel;
use crate::shell::{
    DockHost, FileDockHost, NativeShell, Shell, SurfaceHost, SurfaceId, SurfaceRegistry,
};

const PANEL_NAME: &str = "CommonPlaceConsolePanel";
const LAYOUT_VERSION: usize = 1;
const RECEIPT_PAGE_LIMIT: u16 = 2;
const RECEIPT_KIND_OPTIONS: [(Option<ReceiptKind>, &str); 5] = [
    (None, "All kinds"),
    (Some(ReceiptKind::Ingest), "Ingest"),
    (Some(ReceiptKind::Merge), "Merge"),
    (Some(ReceiptKind::QueryFiring), "Query firing"),
    (Some(ReceiptKind::Consent), "Consent"),
];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PanelKind {
    Overview,
    Entities,
    Receipts,
    Watch,
    Graph,
}

impl PanelKind {
    const fn surface(self) -> SurfaceId {
        match self {
            Self::Overview => SurfaceId::Overview,
            Self::Entities => SurfaceId::Entities,
            Self::Receipts => SurfaceId::Receipts,
            Self::Watch => SurfaceId::Watch,
            Self::Graph => SurfaceId::Graph,
        }
    }
}

#[derive(Clone)]
struct CountDatum {
    label: SharedString,
    value: f64,
}

#[derive(Clone)]
struct EntityRow {
    id: String,
    entity_type: String,
    title: String,
    merge_count: usize,
    candidate_count: usize,
}

struct EntityTableDelegate {
    columns: Vec<Column>,
    rows: Vec<EntityRow>,
}

impl EntityTableDelegate {
    fn new(entities: &[EntityDetail]) -> Self {
        Self {
            columns: vec![
                Column::new("title", "Entity").width(210.).sortable(),
                Column::new("type", "Type").width(110.).sortable(),
                Column::new("id", "Golden ID").width(250.),
                Column::new("merges", "Merges").width(80.),
                Column::new("candidates", "Candidates").width(100.),
            ],
            rows: entities
                .iter()
                .map(|detail| EntityRow {
                    id: detail.record.id.to_string(),
                    entity_type: detail.record.entity_type.clone(),
                    title: detail.record.title.clone(),
                    merge_count: detail.merges.len(),
                    candidate_count: detail.candidates.len(),
                })
                .collect(),
        }
    }
}

impl TableDelegate for EntityTableDelegate {
    fn columns_count(&self, _: &App) -> usize {
        self.columns.len()
    }

    fn rows_count(&self, _: &App) -> usize {
        self.rows.len()
    }

    fn column(&self, col_ix: usize, _: &App) -> &Column {
        &self.columns[col_ix]
    }

    fn render_td(
        &mut self,
        row_ix: usize,
        col_ix: usize,
        _: &mut Window,
        _: &mut Context<TableState<Self>>,
    ) -> impl IntoElement {
        let row = &self.rows[row_ix];
        match self.columns[col_ix].key.as_ref() {
            "title" => row.title.clone(),
            "type" => row.entity_type.clone(),
            "id" => row.id.clone(),
            "merges" => row.merge_count.to_string(),
            "candidates" => row.candidate_count.to_string(),
            _ => String::new(),
        }
    }
}

struct ReceiptTableDelegate {
    columns: Vec<Column>,
    rows: Vec<Receipt>,
}

impl ReceiptTableDelegate {
    fn new(receipts: &[Receipt]) -> Self {
        Self {
            columns: vec![
                Column::new("kind", "Kind").width(100.).sortable(),
                Column::new("summary", "Summary").width(260.),
                Column::new("subject", "Subject").width(220.),
                Column::new("actor", "Actor").width(130.),
                Column::new("id", "Receipt ID").width(230.),
            ],
            rows: receipts.to_vec(),
        }
    }

    fn replace_rows(&mut self, receipts: Vec<Receipt>) {
        self.rows = receipts;
    }
}

impl TableDelegate for ReceiptTableDelegate {
    fn columns_count(&self, _: &App) -> usize {
        self.columns.len()
    }

    fn rows_count(&self, _: &App) -> usize {
        self.rows.len()
    }

    fn column(&self, col_ix: usize, _: &App) -> &Column {
        &self.columns[col_ix]
    }

    fn render_td(
        &mut self,
        row_ix: usize,
        col_ix: usize,
        _: &mut Window,
        _: &mut Context<TableState<Self>>,
    ) -> impl IntoElement {
        let row = &self.rows[row_ix];
        match self.columns[col_ix].key.as_ref() {
            "kind" => format!("{:?}", row.kind),
            "summary" => row.summary.clone(),
            "subject" => row.subject_id.clone(),
            "actor" => row.actor.clone(),
            "id" => row.id.clone(),
            _ => String::new(),
        }
    }
}

struct ConsolePanel {
    kind: PanelKind,
    model: Arc<NativeConsoleModel>,
    focus_handle: FocusHandle,
    entity_table: Option<Entity<TableState<EntityTableDelegate>>>,
    receipt_table: Option<Entity<TableState<ReceiptTableDelegate>>>,
    receipt_kind_filter: Option<ReceiptKind>,
    receipt_subject_filter: Option<String>,
    receipt_page_index: usize,
    graph_zoom: f32,
    graph_pan: Point<f32>,
    drag_last: Option<Point<Pixels>>,
    drag_distance: f32,
    graph_bounds: Arc<Mutex<Option<Bounds<Pixels>>>>,
}

impl ConsolePanel {
    fn new(
        kind: PanelKind,
        model: Arc<NativeConsoleModel>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let entity_table = (kind == PanelKind::Entities).then(|| {
            let delegate = EntityTableDelegate::new(&model.snapshot().entities);
            cx.new(|cx| {
                let mut state = TableState::new(delegate, window, cx)
                    .col_movable(true)
                    .col_resizable(true)
                    .sortable(true)
                    .row_selectable(true);
                if !model.snapshot().entities.is_empty() {
                    state.set_selected_row(0, cx);
                }
                state
            })
        });
        let receipt_table = (kind == PanelKind::Receipts).then(|| {
            let first_page = model
                .receipt_page(
                    &ReceiptFilter::default(),
                    Page {
                        cursor: None,
                        limit: RECEIPT_PAGE_LIMIT,
                    },
                )
                .expect("fixture receipt page");
            let delegate = ReceiptTableDelegate::new(&first_page.receipts);
            cx.new(|cx| {
                TableState::new(delegate, window, cx)
                    .col_movable(true)
                    .col_resizable(true)
                    .sortable(true)
                    .row_selectable(true)
            })
        });

        if let Some(table) = &entity_table {
            cx.subscribe_in(table, window, |_, _, event: &TableEvent, _, cx| {
                if matches!(event, TableEvent::SelectRow(_)) {
                    cx.notify();
                }
            })
            .detach();
        }

        Self {
            kind,
            model,
            focus_handle: cx.focus_handle(),
            entity_table,
            receipt_table,
            receipt_kind_filter: None,
            receipt_subject_filter: None,
            receipt_page_index: 0,
            graph_zoom: 1.0,
            graph_pan: point(0.0, 0.0),
            drag_last: None,
            drag_distance: 0.0,
            graph_bounds: Arc::new(Mutex::new(None)),
        }
    }

    fn render_overview(&self, _cx: &mut Context<Self>) -> AnyElement {
        let overview = &self.model.snapshot().overview;
        let chart_data = overview
            .counts_by_type
            .iter()
            .map(|(label, count)| CountDatum {
                label: label.clone().into(),
                value: *count as f64,
            })
            .collect::<Vec<_>>();
        let total = overview
            .counts_by_type
            .iter()
            .map(|(_, count)| count)
            .sum::<u64>();

        v_flex()
            .size_full()
            .gap_4()
            .child(
                h_flex()
                    .gap_3()
                    .flex_wrap()
                    .child(metric_box("Generation", format_count(overview.generation)))
                    .child(metric_box("Known nodes", format_count(total)))
                    .child(metric_box(
                        "Receipts",
                        format_count(self.model.snapshot().receipts.len() as u64),
                    ))
                    .child(metric_box(
                        "Standing queries",
                        format_count(self.model.snapshot().standing_queries.len() as u64),
                    )),
            )
            .child(
                GroupBox::new()
                    .outline()
                    .title(Label::new("Counts by node type"))
                    .h(px(260.))
                    .child(
                        BarChart::new(chart_data)
                            .x(|datum| datum.label.clone())
                            .y(|datum| datum.value)
                            .label(|datum| format_count(datum.value as u64)),
                    ),
            )
            .child(
                GroupBox::new()
                    .outline()
                    .title(Label::new("Index readiness"))
                    .child(
                        h_flex()
                            .gap_2()
                            .flex_wrap()
                            .children(overview.readiness.iter().map(|readiness| {
                                let tag = match readiness.state {
                                    ReadinessState::Ready => Tag::success(),
                                    ReadinessState::Building => Tag::warning(),
                                    ReadinessState::Unavailable => Tag::danger(),
                                };
                                tag.small()
                                    .child(Label::new(&readiness.capability).secondary(format!(
                                        "{:?}: {}",
                                        readiness.state, readiness.detail
                                    )))
                            })),
                    ),
            )
            .into_any_element()
    }

    fn render_entities(&self, cx: &mut Context<Self>) -> AnyElement {
        let selected_index = self
            .entity_table
            .as_ref()
            .and_then(|table| table.read(cx).selected_row())
            .unwrap_or(0);
        let selected = self.model.snapshot().entities.get(selected_index);

        v_flex()
            .size_full()
            .gap_3()
            .child(
                h_flex()
                    .justify_between()
                    .child(Label::new("Golden records").secondary(
                        "Select rows with pointer or arrow keys. Merge and candidate counts stay visible.",
                    ))
                    .child(
                        Tag::info()
                            .small()
                            .child(format!("{} records", self.model.snapshot().entities.len())),
                    ),
            )
            .child(
                div().h(px(260.)).min_h_0().child(
                    Table::new(self.entity_table.as_ref().expect("entity table"))
                        .stripe(true)
                        .bordered(true),
                ),
            )
            .child(match selected {
                Some(detail) => entity_detail_panel(detail),
                None => GroupBox::new()
                    .outline()
                    .title(Label::new("Entity detail"))
                    .child(Label::new("No golden record selected"))
                    .into_any_element(),
            })
            .into_any_element()
    }

    fn receipt_filter(&self) -> ReceiptFilter {
        ReceiptFilter {
            kind: self.receipt_kind_filter,
            subject_id: self.receipt_subject_filter.clone(),
        }
    }

    fn current_receipt_page(&self) -> ReceiptPage {
        self.model
            .receipt_page(
                &self.receipt_filter(),
                Page {
                    cursor: (self.receipt_page_index > 0).then(|| {
                        (self.receipt_page_index * usize::from(RECEIPT_PAGE_LIMIT)).to_string()
                    }),
                    limit: RECEIPT_PAGE_LIMIT,
                },
            )
            .expect("fixture receipt page")
    }

    fn refresh_receipt_table(&mut self, cx: &mut Context<Self>) {
        let page = self.current_receipt_page();
        if let Some(table) = &self.receipt_table {
            table.update(cx, |state, cx| {
                state.delegate_mut().replace_rows(page.receipts);
                state.clear_selection(cx);
                state.refresh(cx);
            });
        }
        cx.notify();
    }

    fn render_receipts(&self, cx: &mut Context<Self>) -> AnyElement {
        let page = self.current_receipt_page();
        let page_count = usize::try_from(page.total)
            .unwrap_or(usize::MAX)
            .div_ceil(usize::from(RECEIPT_PAGE_LIMIT))
            .max(1);
        let page_start = if page.receipts.is_empty() {
            0
        } else {
            self.receipt_page_index * usize::from(RECEIPT_PAGE_LIMIT) + 1
        };
        let page_end = page_start.saturating_add(page.receipts.len().saturating_sub(1));
        let mut subjects = self
            .model
            .snapshot()
            .receipts
            .iter()
            .map(|receipt| receipt.subject_id.clone())
            .collect::<Vec<_>>();
        subjects.sort();
        subjects.dedup();

        v_flex()
            .size_full()
            .gap_3()
            .child(
                h_flex()
                    .justify_between()
                    .child(Label::new("Immutable receipts").secondary(
                        "Ingest, merge, standing-query, and consent evidence from the caller door.",
                    ))
                    .child(
                        Tag::secondary()
                            .small()
                            .child(format!("{page_start}-{page_end} of {}", page.total)),
                    ),
            )
            .child(
                h_flex()
                    .gap_2()
                    .flex_wrap()
                    .child(Label::new("Kind"))
                    .child(
                        ButtonGroup::new("receipt-kind-filter")
                            .outline()
                            .small()
                            .children(RECEIPT_KIND_OPTIONS.iter().enumerate().map(
                                |(index, (kind, label))| {
                                    Button::new(("receipt-kind", index))
                                        .label(*label)
                                        .selected(self.receipt_kind_filter == *kind)
                                },
                            ))
                            .on_click(cx.listener(|this, indices: &Vec<usize>, _, cx| {
                                let Some(index) = indices.last().copied() else {
                                    return;
                                };
                                this.receipt_kind_filter = RECEIPT_KIND_OPTIONS[index].0;
                                this.receipt_page_index = 0;
                                this.refresh_receipt_table(cx);
                            })),
                    ),
            )
            .child(
                h_flex()
                    .gap_2()
                    .flex_wrap()
                    .child(Label::new("Subject"))
                    .child(
                        Button::new("receipt-subject-all")
                            .outline()
                            .small()
                            .label("All subjects")
                            .selected(self.receipt_subject_filter.is_none())
                            .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                this.receipt_subject_filter = None;
                                this.receipt_page_index = 0;
                                this.refresh_receipt_table(cx);
                            })),
                    )
                    .children(subjects.into_iter().enumerate().map(|(index, subject)| {
                        let selected = self.receipt_subject_filter.as_ref() == Some(&subject);
                        Button::new(("receipt-subject", index))
                            .outline()
                            .small()
                            .label(subject.clone())
                            .selected(selected)
                            .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| {
                                this.receipt_subject_filter = Some(subject.clone());
                                this.receipt_page_index = 0;
                                this.refresh_receipt_table(cx);
                            }))
                    })),
            )
            .child(
                div().flex_1().min_h_0().child(
                    Table::new(self.receipt_table.as_ref().expect("receipt table"))
                        .stripe(true)
                        .bordered(true),
                ),
            )
            .child(
                h_flex()
                    .justify_between()
                    .child(Label::new(format!(
                        "Page {} of {page_count}",
                        self.receipt_page_index + 1
                    )))
                    .child(
                        h_flex()
                            .gap_2()
                            .child(
                                Button::new("receipt-previous")
                                    .outline()
                                    .small()
                                    .label("Previous")
                                    .disabled(self.receipt_page_index == 0)
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.receipt_page_index =
                                            this.receipt_page_index.saturating_sub(1);
                                        this.refresh_receipt_table(cx);
                                    })),
                            )
                            .child(
                                Button::new("receipt-next")
                                    .outline()
                                    .small()
                                    .label("Next")
                                    .disabled(page.next_cursor.is_none())
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.receipt_page_index += 1;
                                        this.refresh_receipt_table(cx);
                                    })),
                            ),
                    ),
            )
            .into_any_element()
    }

    fn render_watch(&mut self, cx: &mut Context<Self>) -> AnyElement {
        let now_ms = self
            .model
            .snapshot()
            .firings
            .iter()
            .map(|event| event.occurred_at_ms)
            .max()
            .unwrap_or(0)
            .saturating_add(120_000);
        let watch = self.model.watch_snapshot(now_ms);
        let stats = watch.stats.clone();
        let selected_query = self.model.selected_watch_query();

        v_flex()
            .size_full()
            .gap_3()
            .child(
                h_flex()
                    .gap_2()
                    .justify_between()
                    .child(
                        h_flex()
                            .gap_2()
                            .child(if stats.active {
                                Tag::success().small().child("live")
                            } else {
                                Tag::secondary().small().child("stopped")
                            })
                            .child(Label::new(format!(
                                "{:.1} events/s",
                                stats.events_per_second
                            )))
                            .child(Label::new(format!(
                                "{} retained, {} dropped",
                                stats.retained, stats.dropped
                            ))),
                    )
                    .child(
                        h_flex()
                            .gap_2()
                            .child(
                                Button::new("watch-pause")
                                    .outline()
                                    .small()
                                    .label("Pause")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.model.pause_watch();
                                        cx.notify();
                                    })),
                            )
                            .child(
                                Button::new("watch-resume")
                                    .outline()
                                    .small()
                                    .label("Resume")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.model.resume_watch();
                                        cx.notify();
                                    })),
                            )
                            .child(
                                Button::new("watch-emit")
                                    .primary()
                                    .small()
                                    .label("Emit scripted firing")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.model.emit_scripted_firing();
                                        cx.notify();
                                    })),
                            ),
                    ),
            )
            .child(
                h_flex().gap_2().flex_wrap().children(
                    self.model
                        .snapshot()
                        .standing_queries
                        .iter()
                        .enumerate()
                        .map(|(index, query)| {
                            let query_id = query.id.clone();
                            ListItem::new(("standing-query", index))
                                .selected(query.id == selected_query)
                                .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| {
                                    this.model
                                        .select_watch_query(&query_id)
                                        .expect("fixture standing query");
                                    cx.notify();
                                }))
                                .child(
                                    Label::new(&query.name)
                                        .secondary(format!("{}: {}", query.id, query.shape)),
                                )
                        }),
                ),
            )
            .child(
                div()
                    .id("watch-events")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .children(watch.events.iter().rev().map(|event| {
                        ListItem::new(("watch-event", event.sequence))
                            .child(Label::new(format!(
                                "#{} {}",
                                event.sequence, event.query_id
                            )))
                            .child(
                                Label::new(event.matched_ids.join(", "))
                                    .secondary(format!("receipt {}", event.receipt_id)),
                            )
                    })),
            )
            .into_any_element()
    }

    fn render_graph(&mut self, cx: &mut Context<Self>) -> AnyElement {
        let graph = self.model.snapshot().graph.clone();
        let positions = self.model.positions().to_vec();
        let selected = self.model.selected_entity();
        let selected_title = self.model.selected_entity_title();
        let zoom = self.graph_zoom;
        let pan = self.graph_pan;
        let graph_bounds = Arc::clone(&self.graph_bounds);
        let node_color = cx.theme().primary;
        let selected_color = cx.theme().green;
        let edge_color = cx.theme().border;
        let background = cx.theme().background;

        v_flex()
            .size_full()
            .gap_3()
            .child(
                h_flex()
                    .justify_between()
                    .child(Label::new("Fixture neighborhood").secondary(
                        "Drag to pan. Use controls to zoom. Click a node to open its entity.",
                    ))
                    .child(
                        h_flex()
                            .gap_2()
                            .child(
                                Button::new("graph-zoom-out")
                                    .outline()
                                    .small()
                                    .label("Zoom out")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.graph_zoom = (this.graph_zoom / 1.2).max(0.35);
                                        cx.notify();
                                    })),
                            )
                            .child(
                                Tag::secondary()
                                    .small()
                                    .child(format!("{:.0}%", self.graph_zoom * 100.0)),
                            )
                            .child(
                                Button::new("graph-zoom-in")
                                    .outline()
                                    .small()
                                    .label("Zoom in")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.graph_zoom = (this.graph_zoom * 1.2).min(4.0);
                                        cx.notify();
                                    })),
                            )
                            .child(
                                Button::new("graph-reset")
                                    .ghost()
                                    .small()
                                    .label("Reset")
                                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                                        this.graph_zoom = 1.0;
                                        this.graph_pan = point(0.0, 0.0);
                                        cx.notify();
                                    })),
                            ),
                    ),
            )
            .child(
                div()
                    .id("graph-canvas")
                    .relative()
                    .flex_1()
                    .min_h(px(280.))
                    .overflow_hidden()
                    .border_1()
                    .border_color(cx.theme().border)
                    .rounded(cx.theme().radius)
                    .child(
                        canvas(
                            move |bounds, _, _| {
                                *graph_bounds.lock().expect("graph bounds") = Some(bounds);
                            },
                            move |bounds, _, window, _| {
                                window.paint_quad(quad(
                                    bounds,
                                    px(0.),
                                    background,
                                    px(0.),
                                    edge_color,
                                    Default::default(),
                                ));
                                let screen_positions = positions
                                    .iter()
                                    .map(|position| {
                                        (
                                            position.id.clone(),
                                            screen_point(bounds, position, pan, zoom),
                                        )
                                    })
                                    .collect::<BTreeMap<_, _>>();

                                for edge in &graph.edges {
                                    let (Some(source), Some(target)) = (
                                        screen_positions.get(&edge.source),
                                        screen_positions.get(&edge.target),
                                    ) else {
                                        continue;
                                    };
                                    let mut path = PathBuilder::stroke(px(1.));
                                    path.move_to(*source);
                                    path.line_to(*target);
                                    if let Ok(path) = path.build() {
                                        window.paint_path(path, edge_color);
                                    }
                                }

                                for node in &graph.nodes {
                                    let Some(center) = screen_positions.get(&node.id) else {
                                        continue;
                                    };
                                    let is_selected = graph_node_is_selected(
                                        node.golden_id.as_ref(),
                                        selected.as_ref(),
                                    );
                                    window.paint_quad(quad(
                                        Bounds {
                                            origin: point(center.x - px(7.), center.y - px(7.)),
                                            size: size(px(14.), px(14.)),
                                        },
                                        px(7.),
                                        if is_selected {
                                            selected_color
                                        } else {
                                            node_color
                                        },
                                        px(1.),
                                        background,
                                        Default::default(),
                                    ));
                                }
                            },
                        )
                        .size_full(),
                    )
                    .on_mouse_down(
                        MouseButton::Left,
                        cx.listener(|this, event: &MouseDownEvent, _, _| {
                            this.drag_last = Some(event.position);
                            this.drag_distance = 0.0;
                        }),
                    )
                    .on_mouse_move(cx.listener(|this, event: &MouseMoveEvent, _, cx| {
                        if !event.dragging() {
                            return;
                        }
                        let Some(previous) = this.drag_last.replace(event.position) else {
                            return;
                        };
                        let delta = event.position - previous;
                        let dx = f32::from(delta.x);
                        let dy = f32::from(delta.y);
                        this.graph_pan.x += dx;
                        this.graph_pan.y += dy;
                        this.drag_distance += dx.hypot(dy);
                        cx.notify();
                    }))
                    .on_mouse_up(
                        MouseButton::Left,
                        cx.listener(|this, event: &MouseUpEvent, _, cx| {
                            this.drag_last = None;
                            if this.drag_distance <= 4.0 {
                                this.select_graph_node_at(event.position);
                            }
                            cx.notify();
                        }),
                    ),
            )
            .child(
                GroupBox::new()
                    .outline()
                    .title(Label::new("Selected entity"))
                    .child(match (selected_title, self.model.selected_entity()) {
                        (Some(title), Some(id)) => Label::new(title).secondary(id.to_string()),
                        _ => Label::new("No node selected")
                            .secondary("Choose a golden node in the graph."),
                    }),
            )
            .into_any_element()
    }

    fn select_graph_node_at(&self, position: Point<Pixels>) {
        let Some(bounds) = *self.graph_bounds.lock().expect("graph bounds") else {
            return;
        };
        let nearest = self
            .model
            .positions()
            .iter()
            .map(|node| {
                let screen = screen_point(bounds, node, self.graph_pan, self.graph_zoom);
                let dx = f32::from(screen.x - position.x);
                let dy = f32::from(screen.y - position.y);
                (&node.id, dx.hypot(dy))
            })
            .filter(|(_, distance)| *distance <= 18.0)
            .min_by(|left, right| left.1.total_cmp(&right.1));
        if let Some((node_id, _)) = nearest {
            self.model.select_graph_node(node_id);
        }
    }
}

impl EventEmitter<PanelEvent> for ConsolePanel {}

impl Focusable for ConsolePanel {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}

impl Panel for ConsolePanel {
    fn panel_name(&self) -> &'static str {
        PANEL_NAME
    }

    fn title(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.kind.surface().title()
    }

    fn title_suffix(&mut self, _: &mut Window, _: &mut Context<Self>) -> Option<impl IntoElement> {
        Some(Tag::secondary().small().child("fixture door"))
    }

    fn closable(&self, _: &App) -> bool {
        false
    }

    fn zoomable(&self, _: &App) -> Option<PanelControl> {
        Some(PanelControl::Toolbar)
    }

    fn dump(&self, _: &App) -> PanelState {
        let mut state = PanelState::new(self);
        state.info = PanelInfo::panel(serde_json::to_value(self.kind).expect("panel kind"));
        state
    }
}

impl Render for ConsolePanel {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        match self.kind {
            PanelKind::Overview => self.render_overview(cx),
            PanelKind::Entities => self.render_entities(cx),
            PanelKind::Receipts => self.render_receipts(cx),
            PanelKind::Watch => self.render_watch(cx),
            PanelKind::Graph => self.render_graph(cx),
        }
    }
}

fn entity_detail_panel(detail: &EntityDetail) -> AnyElement {
    div()
        .id("entity-detail")
        .flex_1()
        .min_h_0()
        .overflow_y_scroll()
        .child(
            v_flex()
                .gap_3()
                .child(
                    GroupBox::new()
                        .outline()
                        .title(Label::new(&detail.record.title))
                        .child(Label::new(detail.record.id.to_string()).secondary(format!(
                            "{} record, updated {}",
                            detail.record.entity_type, detail.record.updated_at_ms
                        )))
                        .child(
                            v_flex().children(detail.record.fields.iter().enumerate().map(
                                |(index, (name, value))| {
                                    ListItem::new(("entity-field", index)).child(
                                        Label::new(name.clone()).secondary(value.to_string()),
                                    )
                                },
                            )),
                        ),
                )
                .child(
                    GroupBox::new()
                        .outline()
                        .title(Label::new(format!(
                            "Merge receipts ({})",
                            detail.merges.len()
                        )))
                        .child(if detail.merges.is_empty() {
                            Label::new("No merge receipts for this golden record")
                                .into_any_element()
                        } else {
                            v_flex()
                                .children(detail.merges.iter().enumerate().map(|(index, merge)| {
                                    ListItem::new(("entity-merge", index))
                                        .child(Label::new(&merge.id).secondary(format!(
                                            "Merged {} at {:.1}% confidence",
                                            merge.merged_ids.join(", "),
                                            f64::from(merge.confidence_ppm) / 10_000.0
                                        )))
                                        .child(
                                            Label::new(merge.basis.join(", ")).secondary(format!(
                                                "decided {}",
                                                merge.decided_at_ms
                                            )),
                                        )
                                }))
                                .into_any_element()
                        }),
                )
                .child(
                    GroupBox::new()
                        .outline()
                        .title(Label::new(format!(
                            "Doppelganger candidates ({})",
                            detail.candidates.len()
                        )))
                        .child(if detail.candidates.is_empty() {
                            Label::new("No unresolved candidates").into_any_element()
                        } else {
                            v_flex()
                                .children(detail.candidates.iter().enumerate().map(
                                    |(index, candidate)| {
                                        ListItem::new(("entity-candidate", index)).child(
                                            Label::new(candidate.candidate_id.to_string())
                                                .secondary(format!(
                                                    "{:.1}% confidence from {}",
                                                    f64::from(candidate.confidence_ppm) / 10_000.0,
                                                    candidate.shared_signals.join(", ")
                                                )),
                                        )
                                    },
                                ))
                                .into_any_element()
                        }),
                )
                .child(
                    GroupBox::new()
                        .outline()
                        .title(Label::new(format!(
                            "Related receipts ({})",
                            detail.receipts.len()
                        )))
                        .child(if detail.receipts.is_empty() {
                            Label::new("No related receipts").into_any_element()
                        } else {
                            v_flex()
                                .children(detail.receipts.iter().enumerate().map(
                                    |(index, receipt)| {
                                        ListItem::new(("entity-receipt", index)).child(
                                            Label::new(&receipt.summary).secondary(format!(
                                                "{:?}: {}",
                                                receipt.kind, receipt.id
                                            )),
                                        )
                                    },
                                ))
                                .into_any_element()
                        }),
                ),
        )
        .into_any_element()
}

fn metric_box(title: &str, value: String) -> AnyElement {
    GroupBox::new()
        .outline()
        .min_w(px(180.))
        .flex_1()
        .title(Label::new(title.to_string()))
        .child(Label::new(value).text_2xl())
        .into_any_element()
}

fn graph_node_is_selected(node_golden_id: Option<&GoldenId>, selected: Option<&GoldenId>) -> bool {
    selected.is_some_and(|selected_id| node_golden_id == Some(selected_id))
}

fn screen_point(
    bounds: Bounds<Pixels>,
    position: &NodePos,
    pan: Point<f32>,
    zoom: f32,
) -> Point<Pixels> {
    let center = bounds.center();
    point(
        center.x + px(position.x as f32 * zoom + pan.x),
        center.y + px(position.y as f32 * zoom + pan.y),
    )
}

type ConsoleShell = NativeShell<FileDockHost, SurfaceRegistry>;

struct ConsoleWorkspace {
    dock_area: Entity<DockArea>,
    shell: ConsoleShell,
    model: Arc<NativeConsoleModel>,
    last_persisted_layout: Option<Vec<u8>>,
}

impl ConsoleWorkspace {
    fn new(model: Arc<NativeConsoleModel>, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let shell = NativeShell::new(
            FileDockHost::new("commonplace-console-layout-v1", default_layout_path()),
            SurfaceRegistry::default(),
        );
        let layout_key = shell.dock_host().layout_key().to_string();
        let dock_area = cx.new(|cx| DockArea::new(layout_key, Some(LAYOUT_VERSION), window, cx));
        let weak_dock_area = dock_area.downgrade();

        if Self::load_layout(&shell, dock_area.clone(), window, cx).is_err() {
            Self::reset_default_layout(weak_dock_area, Arc::clone(&model), window, cx);
        }

        cx.subscribe_in(
            &dock_area,
            window,
            |this, dock_area, event: &DockEvent, _, cx| {
                if matches!(event, DockEvent::LayoutChanged) {
                    this.persist_layout(dock_area, cx);
                }
            },
        )
        .detach();

        cx.on_app_quit({
            let dock_area = dock_area.clone();
            let layout_host = shell.dock_host().clone();
            move |_, cx| {
                let state = dock_area.read(cx).dump(cx);
                if let Ok(bytes) = serde_json::to_vec_pretty(&state) {
                    let _ = layout_host.save_layout(&bytes);
                }
                gpui::Task::ready(())
            }
        })
        .detach();

        Self {
            dock_area,
            shell,
            model,
            last_persisted_layout: None,
        }
    }

    fn load_layout(
        shell: &ConsoleShell,
        dock_area: Entity<DockArea>,
        window: &mut Window,
        cx: &mut App,
    ) -> anyhow::Result<()> {
        let Some(bytes) = shell.dock_host().load_layout()? else {
            anyhow::bail!("no saved layout");
        };
        let state: DockAreaState = serde_json::from_slice(&bytes)?;
        if state.version != Some(LAYOUT_VERSION) {
            anyhow::bail!("saved layout version changed");
        }
        dock_area.update(cx, |dock_area, cx| dock_area.load(state, window, cx))?;
        Ok(())
    }

    fn persist_layout(&mut self, dock_area: &Entity<DockArea>, cx: &mut Context<Self>) {
        let state = dock_area.read(cx).dump(cx);
        self.persist_layout_state(&state);
    }

    fn persist_layout_state(&mut self, state: &DockAreaState) {
        if let Ok(bytes) = serde_json::to_vec_pretty(&state) {
            if self.last_persisted_layout.as_deref() == Some(bytes.as_slice()) {
                return;
            }
            if self.shell.dock_host().save_layout(&bytes).is_ok() {
                self.last_persisted_layout = Some(bytes);
            }
        }
    }

    fn persist_current_layout(&mut self, cx: &mut Context<Self>) -> SurfaceId {
        let state = self.dock_area.read(cx).dump(cx);
        let active = center_surface(&state);
        self.persist_layout_state(&state);
        active
    }

    fn reset_default_layout(
        dock_area: gpui::WeakEntity<DockArea>,
        model: Arc<NativeConsoleModel>,
        window: &mut Window,
        cx: &mut App,
    ) {
        let center = DockItem::tabs(
            vec![
                Arc::new(panel(PanelKind::Overview, Arc::clone(&model), window, cx)),
                Arc::new(panel(PanelKind::Entities, Arc::clone(&model), window, cx)),
                Arc::new(panel(PanelKind::Graph, Arc::clone(&model), window, cx)),
            ],
            &dock_area,
            window,
            cx,
        );
        let receipts = DockItem::tab(
            panel(PanelKind::Receipts, Arc::clone(&model), window, cx),
            &dock_area,
            window,
            cx,
        );
        let watch = DockItem::tab(
            panel(PanelKind::Watch, model, window, cx),
            &dock_area,
            window,
            cx,
        );

        let _ = dock_area.update(cx, |area, cx| {
            area.set_version(LAYOUT_VERSION, window, cx);
            area.set_center(center, window, cx);
            area.set_right_dock(receipts, Some(px(430.)), true, window, cx);
            area.set_bottom_dock(watch, Some(px(290.)), true, window, cx);
        });
    }
}

impl Render for ConsoleWorkspace {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let active = self.persist_current_layout(cx);
        self.shell.surface_host_mut().activate_surface(active);
        let surface_count = self.shell.surface_host().surfaces().len();
        let contract = self.model.snapshot().contract_version.clone();

        v_flex()
            .size_full()
            .child(
                TitleBar::new().child(
                    h_flex()
                        .w_full()
                        .pr_3()
                        .justify_between()
                        .child(
                            h_flex()
                                .gap_2()
                                .child(Label::new("CommonPlace Console"))
                                .child(Tag::info().small().child("operator")),
                        )
                        .child(
                            h_flex()
                                .gap_2()
                                .child(Tag::success().small().child("read only"))
                                .child(Tag::secondary().small().child("fixture door")),
                        ),
                ),
            )
            .child(self.dock_area.clone())
            .child(
                h_flex()
                    .h(px(24.))
                    .px_3()
                    .justify_between()
                    .border_t_1()
                    .border_color(cx.theme().border)
                    .child(Label::new(format!("{} surfaces", surface_count)))
                    .child(Label::new(active.title()).secondary(contract)),
            )
            .children(Root::render_sheet_layer(window, cx))
            .children(Root::render_dialog_layer(window, cx))
            .children(Root::render_notification_layer(window, cx))
    }
}

fn center_surface(state: &DockAreaState) -> SurfaceId {
    match state.center.info.active_index().unwrap_or(0) {
        1 => SurfaceId::Entities,
        2 => SurfaceId::Graph,
        _ => SurfaceId::Overview,
    }
}

fn panel(
    kind: PanelKind,
    model: Arc<NativeConsoleModel>,
    window: &mut Window,
    cx: &mut App,
) -> Entity<ConsolePanel> {
    cx.new(|cx| ConsolePanel::new(kind, model, window, cx))
}

fn register_console_panel(model: Arc<NativeConsoleModel>, cx: &mut App) {
    register_panel(cx, PANEL_NAME, move |_, _, info, window, cx| {
        let kind = match info {
            PanelInfo::Panel(value) => {
                serde_json::from_value(value.clone()).unwrap_or(PanelKind::Overview)
            }
            _ => PanelKind::Overview,
        };
        Box::new(panel(kind, Arc::clone(&model), window, cx))
    });
}

fn default_layout_path() -> PathBuf {
    if let Some(directory) = std::env::var_os("COMMONPLACE_CONSOLE_STATE_DIR") {
        return PathBuf::from(directory).join("layout.json");
    }
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("CommonPlace")
            .join("console-native-layout.json");
    }
    PathBuf::from("target/console-native-layout.json")
}

pub fn run(model: Arc<NativeConsoleModel>) {
    let app = Application::new().with_assets(gpui_component_assets::Assets);
    app.run(move |cx| {
        gpui_component::init(cx);
        register_console_panel(Arc::clone(&model), cx);
        cx.activate(true);

        let mut window_size = size(px(1440.0), px(960.0));
        if let Some(display) = cx.primary_display() {
            window_size.width = window_size.width.min(display.bounds().size.width * 0.9);
            window_size.height = window_size.height.min(display.bounds().size.height * 0.9);
        }
        let window_bounds = Bounds::centered(None, window_size, cx);

        cx.spawn(async move |cx| {
            let options = WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(window_bounds)),
                titlebar: Some(TitleBar::title_bar_options()),
                window_min_size: Some(size(px(840.), px(620.))),
                kind: WindowKind::Normal,
                ..Default::default()
            };
            let window = cx.open_window(options, |window, cx| {
                let workspace = cx.new(|cx| ConsoleWorkspace::new(Arc::clone(&model), window, cx));
                cx.new(|cx| Root::new(workspace, window, cx))
            })?;
            window.update(cx, |_, window, _| {
                window.activate_window();
                window.set_window_title("CommonPlace Console");
            })?;
            Ok::<_, anyhow::Error>(())
        })
        .detach();
    });
}

#[cfg(test)]
mod tests {
    use super::{center_surface, graph_node_is_selected};
    use commonplace_console_core::GoldenId;
    use gpui_component::dock::{DockAreaState, PanelInfo};

    #[test]
    fn missing_node_identity_is_not_an_empty_selection() {
        let selected = GoldenId::new("golden:person:ada");

        assert!(!graph_node_is_selected(None, None));
        assert!(!graph_node_is_selected(None, Some(&selected)));
        assert!(graph_node_is_selected(Some(&selected), Some(&selected)));
    }

    #[test]
    fn center_surface_tracks_the_live_tab_index() {
        let mut state = DockAreaState::default();
        state.center.info = PanelInfo::tabs(2);

        assert_eq!(center_surface(&state), crate::shell::SurfaceId::Graph);
    }
}
