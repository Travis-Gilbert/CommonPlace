//! The host root component.
//!
//! The old `TheoremWebShell` rendered a title and a one-line label and mounted
//! nothing. This component mounts, and every value it mounts with comes from
//! the canonical registry: the renderer binding and the negotiated size are
//! read out of the body registry the backend published, never composed here.
//!
//! Per-body rendering (the record table, the thread) belongs to the W02 and
//! W05 lanes. W01 owns the dispatch, so an unimplemented body renders as a
//! named, sized mount region rather than as a pretend table.

use dioxus::prelude::*;
use theoremweb_app::{MountPlan, SurfaceCatalog, SurfaceMount};
use theoremweb_layout::BodyRegistry;
use theoremweb_navigation::NavigationState;

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct HostModel {
    pub navigation: NavigationState,
    pub catalog: SurfaceCatalog,
    pub bodies: BodyRegistry,
    pub current: Option<SurfaceMount>,
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
    /// panic and never a dropped widget: SPEC-THEOREMWEB-SURFACE-1.0 requires
    /// a layout whose `body_kind` is unregistered to render a labeled
    /// placeholder rather than failing the page.
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
}

#[component]
pub fn TheoremWebHost(model: HostModel) -> Element {
    let theme_css = theoremweb_chrome::emit_chrome_theme_css(&[]).unwrap_or_default();
    let region = model
        .current
        .as_ref()
        .map(|mount| MountRegion::resolve(mount, &model.bodies));
    rsx! {
        style { "{theme_css}" }
        main { class: "theoremweb-host",
            aside { class: "theoremweb-navigation",
                input {
                    r#type: "search",
                    id: "theoremweb-omnibox",
                    placeholder: "Open a record or ask a question",
                    "aria-label": "TheoremWeb omnibox",
                }
                nav { "aria-label": "Surfaces",
                    for surface in model.catalog.surfaces() {
                        button {
                            key: "{surface.surface_id}",
                            "data-surface-id": "{surface.surface_id}",
                            "data-surface-icon": "{surface.icon}",
                            "{surface.title}"
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
                if let Some(region) = region {
                    h1 { "data-surface-id": "{region.surface_id}", "{region.title}" }
                    div {
                        class: "theoremweb-mount",
                        "data-body-kind": "{region.body_kind.clone().unwrap_or_default()}",
                        "data-renderer-binding": "{region.renderer_binding.clone().unwrap_or_default()}",
                        "data-engine-url": "{region.engine_url.clone().unwrap_or_default()}",
                        "data-unavailable": "{region.unavailable}",
                        style: if let Some((width, height)) = region.size {
                            format!("width:{width}px;height:{height}px")
                        } else {
                            String::new()
                        },
                        "{region.label}"
                    }
                } else {
                    h1 { "No surface selected" }
                    p { "Choose a surface" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use theoremweb_app::{Renderer, ScopeBinding, SurfaceSpec};
    use theoremweb_layout::{BodySpec, SizeNegotiation};

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
    fn the_host_renders_every_catalog_row_in_the_surface_nav() {
        let catalog = SurfaceCatalog::from_live(theoremweb_app::SurfaceListResponse {
            count: 1,
            surfaces: vec![mount(Renderer::Dioxus("record_table".into())).surface],
        });
        let model = HostModel {
            navigation: NavigationState::default(),
            catalog,
            bodies: bodies(),
            current: Some(mount(Renderer::Dioxus("record_table".into()))),
        };
        let html = dioxus_ssr::render_element(rsx! { TheoremWebHost { model } });
        assert!(html.contains("data-surface-id=\"records\""));
        assert!(html.contains("theorem.body.record_table"));
        assert!(html.contains("theoremweb-omnibox"));
    }
}
