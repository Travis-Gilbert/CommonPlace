//! CommonPlace native browser shell (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B4).
//!
//! Default feature is `mock`: no GPUI types linked or exported. Real GPUI use
//! stays behind [`traits::Shell`], [`traits::DockHost`], and
//! [`traits::SurfaceHost`].

#![deny(unsafe_code)]

pub mod chrome;
pub mod dock;
pub mod pins;
pub mod prompts;
pub mod rail;
pub mod surfaces;
pub mod traits;

pub use chrome::{
    content_bottom_inset, content_top_inset, BOTTOM_DOCK_HEIGHT, CHROME_GROUND,
    CHROME_HAIRLINE, CHROME_INK, CHROME_INK_2, CHROME_INK_3, CHROME_LINK,
    CHROME_SIGNAL, CHROME_SURFACE, CHROME_TOP, OMNIBOX_ROW_HEIGHT,
    PERMISSION_STRIP_HEIGHT, RAIL_WIDTH_COLLAPSED, TITLE_BAR_HEIGHT,
};

use dock::MockDockHost;
use prompts::NativePromptQueue;
use rail::CapabilityRail;
use surfaces::{MockCommonPlaceHost, MockServoHost};
use traits::{SurfaceHost, SurfaceKind, SurfaceRef};

use browser_core::{PermissionStore, SessionGraph};
use interaction_arbiter::{InteractionArbiter, SurfaceId};

/// Mock surface host (no GPUI / wry / Servo parenting).
#[derive(Debug, Default)]
pub struct MockSurfaceHost {
    surfaces: Vec<SurfaceRef>,
    focused: Option<String>,
}

impl MockSurfaceHost {
    pub fn new() -> Self {
        Self::default()
    }
}

impl SurfaceHost for MockSurfaceHost {
    fn list_surfaces(&self) -> Vec<SurfaceRef> {
        self.surfaces.clone()
    }

    fn add_surface(&mut self, surface: SurfaceRef) {
        if !self.surfaces.iter().any(|s| s.id == surface.id) {
            self.surfaces.push(surface);
        }
    }

    fn remove_surface(&mut self, id: &str) -> bool {
        let before = self.surfaces.len();
        self.surfaces.retain(|s| s.id != id);
        if self.focused.as_deref() == Some(id) {
            self.focused = None;
        }
        self.surfaces.len() != before
    }

    fn focused(&self) -> Option<&str> {
        self.focused.as_deref()
    }

    fn set_focused(&mut self, id: Option<&str>) {
        self.focused = id.map(str::to_string);
    }
}

/// Composes BrowserCore + InteractionArbiter behind the shell traits.
#[derive(Debug)]
pub struct NativeShell {
    title: String,
    pub session: SessionGraph,
    pub arbiter: InteractionArbiter,
    pub dock: MockDockHost,
    pub surfaces: MockSurfaceHost,
    pub prompts: NativePromptQueue,
    pub rail: CapabilityRail,
    /// B5 mock Servo panes (Real RawWindowHandle parenting is Codex work).
    pub servo: MockServoHost,
    /// B6 mock CommonPlace wry surface (real gpui-wry link is Codex work).
    pub commonplace: MockCommonPlaceHost,
}

impl Default for NativeShell {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeShell {
    pub fn new() -> Self {
        let mut surfaces = MockSurfaceHost::new();
        surfaces.add_surface(SurfaceRef {
            id: "commonplace".into(),
            kind: SurfaceKind::CommonPlace,
            title: "CommonPlace".into(),
        });
        surfaces.set_focused(Some("commonplace"));

        let mut arbiter = InteractionArbiter::new(SurfaceId::new("commonplace"));
        arbiter.set_focus(SurfaceId::new("commonplace"));

        Self {
            title: "CommonPlace".into(),
            session: SessionGraph::new(),
            arbiter,
            dock: MockDockHost::new(),
            surfaces,
            prompts: NativePromptQueue::new(),
            rail: CapabilityRail::new(),
            servo: MockServoHost::new(),
            commonplace: MockCommonPlaceHost::new("http://127.0.0.1:3010/"),
        }
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn set_title(&mut self, title: impl Into<String>) {
        self.title = title.into();
    }

    pub fn permissions(&self) -> &PermissionStore {
        self.prompts.store()
    }

    /// Trait-boundary check helper: shell public API has no GPUI type names.
    pub fn exported_type_names() -> &'static [&'static str] {
        &[
            "NativeShell",
            "MockDockHost",
            "MockSurfaceHost",
            "NativePromptQueue",
            "CapabilityRail",
            "DockLayout",
            "Shell",
            "DockHost",
            "SurfaceHost",
        ]
    }
}

impl traits::Shell for NativeShell {
    fn title(&self) -> &str {
        NativeShell::title(self)
    }

    fn set_title(&mut self, title: impl Into<String>) {
        NativeShell::set_title(self, title)
    }

    fn dock(&self) -> &dyn traits::DockHost {
        &self.dock
    }

    fn dock_mut(&mut self) -> &mut dyn traits::DockHost {
        &mut self.dock
    }

    fn surfaces(&self) -> &dyn SurfaceHost {
        &self.surfaces
    }

    fn surfaces_mut(&mut self) -> &mut dyn SurfaceHost {
        &mut self.surfaces
    }
}

#[cfg(test)]
mod acceptance {
    use super::*;
    use browser_core::{PermissionDecision, PermissionKind};
    use rail::RailContribution;
    use traits::PromptHost;

    #[test]
    fn mock_shell_runs_with_surfaces() {
        let mut shell = NativeShell::new();
        assert_eq!(shell.title(), "CommonPlace");
        shell.surfaces.add_surface(SurfaceRef {
            id: "servo-1".into(),
            kind: SurfaceKind::Servo,
            title: "example.com".into(),
        });
        assert_eq!(shell.surfaces.list_surfaces().len(), 2);
    }

    #[test]
    fn fixture_grant_renders_prompt_and_resolves_into_store() {
        let mut shell = NativeShell::new();
        let id = shell
            .prompts
            .enqueue_permission("https://example.com", PermissionKind::Geolocation);
        assert_eq!(shell.prompts.pending().len(), 1);
        assert!(shell.prompts.pending()[0].id == id);

        let receipt = shell
            .prompts
            .resolve(id, true)
            .expect("prompt should resolve");
        assert_eq!(receipt.kind, PermissionKind::Geolocation);
        assert_eq!(receipt.decision, PermissionDecision::Allow);
        assert_eq!(shell.prompts.pending().len(), 0);
        assert_eq!(shell.permissions().permission_receipts().len(), 1);
    }

    #[test]
    fn rail_lists_fixture_contributions_and_updates_live() {
        let mut shell = NativeShell::new();
        shell.rail.set_contributions(vec![RailContribution {
            id: "pane.notes".into(),
            label: "Notes".into(),
            pane_kind: Some("notes".into()),
            composer_verb: None,
        }]);
        assert_eq!(shell.rail.items().len(), 1);
        assert!(shell.rail.click_add("pane.notes").is_some());

        shell.rail.apply_bridge_update(vec![
            RailContribution {
                id: "pane.notes".into(),
                label: "Notes".into(),
                pane_kind: Some("notes".into()),
                composer_verb: None,
            },
            RailContribution {
                id: "verb.ask".into(),
                label: "Ask".into(),
                pane_kind: None,
                composer_verb: Some("ask".into()),
            },
        ]);
        assert_eq!(shell.rail.items().len(), 2);
        assert!(shell.rail.command_add("verb.ask").is_some());
    }

    #[test]
    fn dock_layout_survives_restart_via_json_graph() {
        let mut shell = NativeShell::new();
        let mut layout = shell.dock.layout().clone();
        layout.center_tabs = vec!["commonplace".into(), "servo-1".into()];
        layout.active_center = Some("servo-1".into());
        layout.right_evidence_open = true;
        layout.bottom_height_px = 200;
        shell.dock.set_layout(layout);

        let json = shell.dock.persist_layout_json().unwrap();

        let mut restored = NativeShell::new();
        restored.dock.restore_layout_json(&json).unwrap();
        assert_eq!(
            restored.dock.layout().active_center.as_deref(),
            Some("servo-1")
        );
        assert!(restored.dock.layout().right_evidence_open);
        assert_eq!(restored.dock.layout().bottom_height_px, 200);
        assert_eq!(restored.dock.layout().center_tabs.len(), 2);
    }

    #[test]
    fn trait_boundary_exports_no_gpui_type_names() {
        for name in NativeShell::exported_type_names() {
            let lower = name.to_ascii_lowercase();
            assert!(
                !lower.contains("gpui") && !lower.contains("wry") && !lower.contains("zed"),
                "exported name looks like GPUI: {name}"
            );
        }
        // Pins document SHAs but are not GPUI types in the public composition API.
        assert!(!pins::GPUI_COMPONENT_SHA.is_empty());
        assert!(!pins::GPUI_SHA.is_empty());
    }

    #[test]
    fn arbiter_and_session_compose() {
        let mut shell = NativeShell::new();
        let tab = shell.session.open_tab(1);
        shell
            .session
            .navigate(tab, "https://a.example/".into(), "A".into(), 2);
        shell
            .arbiter
            .acquire_lease(SurfaceId::new("commonplace"), 5)
            .unwrap();
        shell.arbiter.human_input(shell.arbiter.frame());
        assert!(shell.arbiter.presence().frozen || shell.arbiter.last_human_preempt_frame().is_some());
    }
}
