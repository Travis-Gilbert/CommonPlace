//! The host root component.
//!
//! `MountRegion` resolves what a surface mounts, entirely from canonical
//! registry data: the renderer binding and the negotiated size are read out of
//! the body registry the backend published, never composed here.
//!
//! `SurfaceBody` then renders it. Body kinds with a real component get one;
//! kinds whose lane has not landed get a named, correctly sized placeholder
//! rather than a pretend table.

use std::collections::BTreeMap;

use dioxus::prelude::*;
use serde_json::Value;
use theoremweb_app::{
    MountPlan, ScopeBinding as SurfaceScope, SurfaceCatalog, SurfaceHistory, SurfaceMount,
};
use theoremweb_chrome::ColorScheme;
use theoremweb_layout::{BodyRegistry, LayoutMcpCall, LayoutSet};
use theoremweb_navigation::NavigationState;
use theoremweb_record_table::{RecordPage, RecordTable};

use crate::surfaces::layout::LayoutMount;

#[derive(Clone, Debug, PartialEq)]
pub struct HostModel {
    pub navigation: NavigationState,
    pub catalog: SurfaceCatalog,
    pub bodies: BodyRegistry,
    pub current: Option<SurfaceMount>,
    pub records: Option<RecordPage>,
    /// Layouts the server published for the scopes this host can mount.
    ///
    /// A surface renders as a layout when this set claims its scope, and as a
    /// single body otherwise. No seed row declares which it is, so the server
    /// stays the authority on that.
    pub layouts: LayoutSet,
    /// Server-attested aggregates keyed by widget id.
    ///
    /// `dashboard::project_server_aggregates` refuses a page-scoped receipt
    /// before it can reach here, so a value in this map is full-filtered-set
    /// truth by construction rather than by convention.
    pub server_values: BTreeMap<String, Value>,
    pub scheme: ColorScheme,
}

/// What the host will mount, resolved entirely from canonical data.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MountRegion {
    pub surface_id: String,
    pub title: String,
    pub body_kind: Option<String>,
    pub renderer_binding: Option<String>,
    pub size: Option<(u32, u32)>,
    pub engine_url: Option<String>,
    pub label: String,
    pub unavailable: bool,
}

impl MountRegion {
    /// Resolve one mount against the canonical body registry.
    ///
    /// An unregistered body kind produces a labeled placeholder, never a
    /// panic and never a dropped widget.
    #[must_use]
    pub fn resolve(mount: &SurfaceMount, bodies: &BodyRegistry) -> Self {
        let surface_id = mount.surface.surface_id.clone();
        let title = mount.surface.title.clone();
        match MountPlan::from(mount) {
            MountPlan::Dioxus { body_kind } => bodies.get(&body_kind).map_or_else(
                || Self {
                    surface_id: surface_id.clone(),
                    title: title.clone(),
                    body_kind: Some(body_kind.clone()),
                    renderer_binding: None,
                    size: None,
                    engine_url: None,
                    label: format!("Unavailable body: {body_kind}"),
                    unavailable: true,
                },
                |spec| Self {
                    surface_id: surface_id.clone(),
                    title: title.clone(),
                    body_kind: Some(spec.kind.clone()),
                    renderer_binding: Some(spec.renderer_binding.clone()),
                    size: Some((spec.size.default_width, spec.size.default_height)),
                    engine_url: None,
                    label: spec.title.clone(),
                    unavailable: false,
                },
            ),
            MountPlan::Servo { url } => Self {
                surface_id,
                title,
                body_kind: None,
                renderer_binding: None,
                size: None,
                engine_url: Some(url.clone()),
                label: format!("Servo: {url}"),
                unavailable: false,
            },
            MountPlan::SystemWebview { url } => Self {
                surface_id,
                title,
                body_kind: None,
                renderer_binding: None,
                size: None,
                engine_url: Some(url.clone()),
                label: format!("System webview: {url}"),
                unavailable: false,
            },
            MountPlan::Unavailable { label } => Self {
                surface_id,
                title,
                body_kind: None,
                renderer_binding: None,
                size: None,
                engine_url: None,
                label,
                unavailable: true,
            },
        }
    }

    /// Whether a real component exists for this region's body kind.
    #[must_use]
    pub fn has_component(&self, records: Option<&RecordPage>) -> bool {
        matches!(self.body_kind.as_deref(), Some("record_table")) && records.is_some()
    }
}

#[component]
pub fn SurfaceBody(region: MountRegion, records: Option<RecordPage>, scheme: ColorScheme) -> Element {
    if let (Some("record_table"), Some(page)) = (region.body_kind.as_deref(), records) {
        return rsx! {
            div { class: "theoremweb-mount theoremweb-mount-live",
                "data-body-kind": "record_table",
                "data-renderer-binding": "{region.renderer_binding.clone().unwrap_or_default()}",
                "data-unavailable": "false",
                RecordTable { page, scheme }
            }
        };
    }
    let style = region.size.map_or_else(String::new, |(width, height)| {
        format!("width:{width}px;height:{height}px")
    });
    rsx! {
        div {
            class: "theoremweb-mount",
            "data-body-kind": "{region.body_kind.clone().unwrap_or_default()}",
            "data-renderer-binding": "{region.renderer_binding.clone().unwrap_or_default()}",
            "data-engine-url": "{region.engine_url.clone().unwrap_or_default()}",
            "data-unavailable": "{region.unavailable}",
            style,
            "{region.label}"
        }
    }
}

/// The mounted surface, or the empty state.
///
/// Two mounts are possible. When the published layout set claims this scope
/// the surface is a layout — many bodies, arranged and editable. Otherwise it
/// is a single body. Nothing in the seed rows distinguishes them, which is
/// deliberate: the server decides by publishing a layout or not.
#[derive(Clone, PartialEq, Props)]
struct SurfaceSectionProps {
    region: Option<MountRegion>,
    binding: Option<SurfaceScope>,
    layouts: LayoutSet,
    bodies: BodyRegistry,
    records: Option<RecordPage>,
    server_values: BTreeMap<String, Value>,
    scheme: ColorScheme,
    on_navigate: EventHandler<String>,
    on_persist: EventHandler<LayoutMcpCall>,
}

#[allow(non_snake_case, clippy::missing_errors_doc)]
fn SurfaceSection(props: SurfaceSectionProps) -> Element {
    let SurfaceSectionProps {
        region,
        binding,
        layouts,
        bodies,
        records,
        server_values,
        scheme,
        on_navigate,
        on_persist,
    } = props;

    let Some(region) = region else {
        return rsx! {
            h1 { "No surface selected" }
            p { "Choose a surface" }
        };
    };
    let surface_id = region.surface_id.clone();
    let title = region.title.clone();
    // Only a binding a published layout actually claims routes to the layout
    // renderer; the rest fall through to the single-body mount.
    let layout_binding = binding.filter(|binding| {
        layouts
            .resolve(&crate::surfaces::layout::layout_scope(binding))
            .is_some()
    });

    rsx! {
        h1 { "data-surface-id": "{surface_id}", "{title}" }
        if let Some(binding) = layout_binding {
            LayoutMount {
                layouts,
                binding,
                bodies,
                server_values,
                records,
                scheme,
                on_navigate,
                on_persist,
            }
        } else {
            SurfaceBody { region, records, scheme }
        }
    }
}

#[component]
pub fn TheoremWebHost(model: HostModel, on_persist: EventHandler<LayoutMcpCall>) -> Element {
    let theme_css = theoremweb_chrome::emit_chrome_theme_css(&[]).unwrap_or_default();
    // chrome owns the variable namespace and never emits selectors, so each
    // crate that renders class names contributes its own layout.
    let table_css = theoremweb_record_table::emit_record_table_css();
    let layout_css = theoremweb_layout::emit_layout_css();
    let catalog = model.catalog.clone();
    let bodies = model.bodies.clone();

    let mut current = use_signal(|| model.current.clone());
    let mut history = use_signal(|| {
        let mut history = SurfaceHistory::default();
        if let Some(mount) = model.current.clone() {
            history.push(mount);
        }
        history
    });
    let mut intent = use_signal(String::new);
    let mut omnibox_error = use_signal(String::new);

    // One place composes an intent into a mount and records it, so the
    // omnibox, the surface list, and history cannot drift apart. `Callback` is
    // Copy, which is what lets the same resolver serve several handlers.
    let open = use_callback({
        let catalog = catalog.clone();
        move |raw: String| match catalog.resolve(&raw) {
            Ok(mount) => {
                history.write().push(mount.clone());
                current.set(Some(mount));
                omnibox_error.set(String::new());
            }
            Err(error) => omnibox_error.set(error.to_string()),
        }
    });

    let region = current
        .read()
        .as_ref()
        .map(|mount| MountRegion::resolve(mount, &bodies));
    let binding = current.read().as_ref().map(|mount| mount.binding.clone());
    let error_text = omnibox_error();

    rsx! {
        style { "{theme_css}" }
        style { "{table_css}" }
        style { "{layout_css}" }
        main { class: "theoremweb-host",
            aside { class: "theoremweb-navigation",
                input {
                    r#type: "search",
                    id: "theoremweb-omnibox",
                    placeholder: "Open a record or ask a question",
                    "aria-label": "TheoremWeb omnibox",
                    value: "{intent}",
                    oninput: move |event| intent.set(event.value()),
                    onkeydown: move |event| {
                        if event.key() == Key::Enter {
                            open.call(intent());
                        }
                    },
                }
                if !error_text.is_empty() {
                    p { class: "theoremweb-omnibox-error", role: "alert", "{error_text}" }
                }
                div { class: "theoremweb-history",
                    button {
                        "data-history": "back",
                        "aria-label": "Back",
                        onclick: move |_| {
                            let mount = history.write().back().cloned();
                            if let Some(mount) = mount {
                                current.set(Some(mount));
                            }
                        },
                        "Back"
                    }
                    button {
                        "data-history": "forward",
                        "aria-label": "Forward",
                        onclick: move |_| {
                            let mount = history.write().forward().cloned();
                            if let Some(mount) = mount {
                                current.set(Some(mount));
                            }
                        },
                        "Forward"
                    }
                }
                nav { "aria-label": "Surfaces",
                    // Owned (id, icon, title) per row, so each click handler
                    // moves one String rather than holding the whole spec.
                    for row in catalog.surfaces().iter().map(|surface| {
                        (
                            surface.surface_id.clone(),
                            surface.icon.clone(),
                            surface.title.clone(),
                        )
                    }) {
                        button {
                            key: "{row.0}",
                            "data-surface-id": "{row.0}",
                            "data-surface-icon": "{row.1}",
                            onclick: move |_| open.call(row.0.clone()),
                            "{row.2}"
                        }
                    }
                }
                nav { "aria-label": "Navigation",
                    for item in model.navigation.items() {
                        button {
                            key: "{item.nav_item_id}",
                            "data-nav-id": "{item.nav_item_id}",
                            "{item.label()}"
                        }
                    }
                }
            }
            section { class: "theoremweb-surface",
                SurfaceSection {
                    region,
                    binding,
                    layouts: model.layouts.clone(),
                    bodies,
                    records: model.records.clone(),
                    server_values: model.server_values.clone(),
                    scheme: model.scheme,
                    // One resolver owns "what does opening this mean", so a
                    // related-record widget and the omnibox cannot disagree.
                    on_navigate: move |intent: String| open.call(intent),
                    on_persist,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use theoremweb_app::{Renderer, ScopeBinding, SurfaceListResponse, SurfaceSpec};
    use theoremweb_layout::{
        BodySpec, GridRect, LayoutObject, LayoutTab, LayoutTarget, LayoutWidget, SizeNegotiation,
    };

    use super::*;

    fn bodies() -> BodyRegistry {
        BodyRegistry::from_canonical([BodySpec {
            kind: "record_table".into(),
            title: "Record table".into(),
            icon: "table".into(),
            renderer_binding: "theorem.body.record_table".into(),
            size: SizeNegotiation {
                min_width: 240,
                min_height: 160,
                default_width: 480,
                default_height: 320,
                max_width: None,
                max_height: None,
            },
        }])
        .expect("one canonical body")
    }

    fn mount(renderer: Renderer) -> SurfaceMount {
        SurfaceMount {
            surface: SurfaceSpec {
                surface_id: "records".into(),
                title: "Records".into(),
                icon: "table".into(),
                default_scope: ScopeBinding::Workspace,
                renderer,
                fallback_renderer: None,
                layout_ref: None,
                capabilities: Vec::new(),
            },
            binding: ScopeBinding::Workspace,
        }
    }

    fn page() -> RecordPage {
        crate::records::parse_page(
            br#"{
                "object_type": {
                    "object_type_id": "company", "tenant_id": "t",
                    "name_singular": "company", "name_plural": "companies",
                    "label_singular": "Company", "label_plural": "Companies",
                    "node_label": "Company", "label_identifier_field": "name",
                    "fields": [{"key": "name", "label": "Name",
                        "field_type": {"kind": "text", "raw": {}},
                        "required": true, "system": false}],
                    "enforcement": "reject", "system": false,
                    "content_anchor": "", "retired": false, "schema_version": "v1"
                },
                "rows": [{"record_id": "acme", "values": {"name": "Acme"}}],
                "total": 1
            }"#,
        )
        .expect("fixture page decodes")
    }

    /// A closure only becomes an `EventHandler` inside a running Dioxus
    /// runtime, so SSR assertions go through a component.
    #[allow(non_snake_case)]
    #[component]
    fn HostHarness(model: HostModel) -> Element {
        rsx! { TheoremWebHost { model, on_persist: move |_| {} } }
    }

    fn dashboard_layout() -> LayoutSet {
        LayoutSet {
            layouts: vec![LayoutObject {
                layout_id: "layout:workspace".into(),
                scope: theoremweb_layout::ScopeBinding::Workspace,
                applies_to: LayoutTarget::Workspace,
                tabs: vec![LayoutTab {
                    tab_id: "main".into(),
                    title: "Main".into(),
                    widgets: vec![
                        LayoutWidget {
                            widget_id: "companies".into(),
                            body_kind: "record_table".into(),
                            body_params: serde_json::json!({}),
                            grid: GridRect { x: 0, y: 0, w: 8, h: 6 },
                            field_visibility: None,
                        },
                        LayoutWidget {
                            widget_id: "future".into(),
                            body_kind: "future_body".into(),
                            body_params: serde_json::json!({}),
                            grid: GridRect { x: 8, y: 0, w: 4, h: 6 },
                            field_visibility: None,
                        },
                    ],
                }],
            }],
        }
    }

    fn model(records: Option<RecordPage>) -> HostModel {
        HostModel {
            navigation: NavigationState::default(),
            catalog: SurfaceCatalog::from_live(SurfaceListResponse {
                count: 1,
                surfaces: vec![mount(Renderer::Dioxus("record_table".into())).surface],
            }),
            bodies: bodies(),
            current: Some(mount(Renderer::Dioxus("record_table".into()))),
            records,
            layouts: LayoutSet::default(),
            server_values: BTreeMap::new(),
            scheme: ColorScheme::Light,
        }
    }

    #[test]
    fn the_mount_takes_its_binding_and_size_from_the_canonical_registry() {
        let region = MountRegion::resolve(&mount(Renderer::Dioxus("record_table".into())), &bodies());
        assert_eq!(
            region.renderer_binding.as_deref(),
            Some("theorem.body.record_table")
        );
        assert_eq!(region.size, Some((480, 320)));
        assert!(!region.unavailable);
    }

    #[test]
    fn an_unregistered_body_is_a_labeled_placeholder_not_a_failure() {
        let region = MountRegion::resolve(&mount(Renderer::Dioxus("future_body".into())), &bodies());
        assert_eq!(region.label, "Unavailable body: future_body");
        assert!(region.unavailable);
        assert_eq!(region.renderer_binding, None);
    }

    #[test]
    fn an_engine_row_carries_its_url_instead_of_a_body() {
        let region = MountRegion::resolve(
            &mount(Renderer::Servo("https://ide.example/".into())),
            &bodies(),
        );
        assert_eq!(region.engine_url.as_deref(), Some("https://ide.example/"));
        assert_eq!(region.body_kind, None);
        assert!(!region.unavailable);
    }

    #[test]
    fn the_records_surface_mounts_a_real_grid_not_a_placeholder() {
        let model = model(Some(page()));
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(html.contains("role=\"grid\""));
        assert!(html.contains("theorem-record-table"));
        assert!(html.contains("Acme"));
        assert!(html.contains("theoremweb-mount-live"));
    }

    #[test]
    fn the_records_surface_degrades_to_a_labeled_box_when_no_page_arrived() {
        let model = model(None);
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(!html.contains("role=\"grid\""));
        assert!(html.contains("data-body-kind=\"record_table\""));
        assert!(html.contains("Record table"));
    }

    #[test]
    fn the_host_renders_the_omnibox_and_history_controls() {
        let model = model(Some(page()));
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(html.contains("theoremweb-omnibox"));
        assert!(html.contains("data-history=\"back\""));
        assert!(html.contains("data-history=\"forward\""));
        assert!(html.contains("data-surface-id=\"records\""));
    }

    #[test]
    fn has_component_is_true_only_when_a_page_is_present() {
        let region = MountRegion::resolve(&mount(Renderer::Dioxus("record_table".into())), &bodies());
        assert!(region.has_component(Some(&page())));
        assert!(!region.has_component(None));
    }

    #[test]
    fn a_published_layout_replaces_the_single_body_mount() {
        // No seed row says "this surface is a layout". The server saying so,
        // by publishing a layout that claims the scope, is what routes it.
        let mut model = model(Some(page()));
        model.layouts = dashboard_layout();
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        // Asserted on attributes the stylesheet does not mention. The host
        // inlines emit_layout_css() into the same document, so any assertion
        // on a class name or a styled attribute selector passes whether or
        // not the element was ever rendered.
        assert!(html.contains("data-layout-id=\"layout:workspace\""));
        assert!(html.contains("data-edit-mode=\"false\""));
        assert!(html.contains("data-layout-edit-toggle"));
    }

    #[test]
    fn a_record_table_widget_inside_a_layout_renders_the_real_grid() {
        // W02's table stops being a whole surface and becomes a widget, from
        // the same component: this is what LY5 means by a dashboard with
        // RecordTable bodies.
        let mut model = model(Some(page()));
        model.layouts = dashboard_layout();
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(html.contains("data-widget-id=\"companies\""));
        assert!(html.contains("role=\"grid\""));
        assert!(html.contains("Acme"));
    }

    #[test]
    fn an_unregistered_widget_inside_a_layout_is_labeled_not_dropped() {
        // LY2's recoverability clause, at the product mount rather than in a
        // crate test: the rest of the page still renders around it.
        let mut model = model(Some(page()));
        model.layouts = dashboard_layout();
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(html.contains("data-widget-id=\"future\""));
        assert!(html.contains("Unavailable body: future_body"));
        // `data-unavailable="true"` is also a selector in the inlined
        // stylesheet, so it cannot discriminate here; the label text can.
        assert!(html.contains("No renderer registered for future_body"));
        // and the sibling widget survived it
        assert!(html.contains("role=\"grid\""));
    }

    #[test]
    fn with_no_layout_published_the_single_body_mount_still_wins() {
        let model = model(Some(page()));
        assert!(model.layouts.layouts.is_empty());
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(!html.contains("data-layout-id="));
        assert!(!html.contains("data-edit-mode="));
        assert!(html.contains("theoremweb-mount-live"));
        assert!(html.contains("role=\"grid\""));
    }

    #[test]
    fn the_host_emits_the_layout_stylesheet_beside_the_table_stylesheet() {
        // The W02 lesson: chrome emits tokens and never selectors, so a class
        // whose crate does not contribute its own layout renders unstyled.
        let mut model = model(Some(page()));
        model.layouts = dashboard_layout();
        let html = dioxus_ssr::render_element(rsx! { HostHarness { model } });
        assert!(html.contains(".theorem-layout-grid{display:grid;"));
        assert!(html.contains(".theorem-record-row"));
    }

}
