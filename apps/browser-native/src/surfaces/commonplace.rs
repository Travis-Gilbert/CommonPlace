//! CommonPlace (gpui-wry) surface hosting contract
//! (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B6).
//!
//! Mock host records bundle URL, loopback placeBlock receipts, reload restore,
//! crash/restart, and the z-order content hole. Real gpui-wry panel linking is
//! deferred to the backend handoff that enables the `gpui` feature.

use crate::surfaces::zorder::ContentRect;
use serde::{Deserialize, Serialize};

/// Honest crashed / restartable webview state (SPEC B6 acceptance).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceCrashState {
    Live,
    Crashed,
    Restarting,
}

/// Fixture block placement as the shell records it after adapter round-trip.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlacedBlock {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub grants: Vec<String>,
}

/// Workspace substrate snapshot restored after webview reload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct WorkspaceSnapshot {
    pub workspace_id: String,
    pub blocks: Vec<PlacedBlock>,
    pub layout_json: String,
}

/// CommonPlace panel as the shell sees it (GPUI-free).
#[derive(Debug, Clone, PartialEq)]
pub struct MockCommonPlaceSurface {
    pub id: String,
    pub bundle_url: String,
    pub bounds: ContentRect,
    pub crash: SurfaceCrashState,
    pub substrate: WorkspaceSnapshot,
}

impl MockCommonPlaceSurface {
    pub fn new(id: impl Into<String>, bundle_url: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            bundle_url: bundle_url.into(),
            bounds: ContentRect::default(),
            crash: SurfaceCrashState::Live,
            substrate: WorkspaceSnapshot::default(),
        }
    }

    pub fn place_block(&mut self, block: PlacedBlock) {
        if let Some(existing) = self
            .substrate
            .blocks
            .iter_mut()
            .find(|b| b.id == block.id)
        {
            *existing = block;
        } else {
            self.substrate.blocks.push(block);
        }
    }

    /// Forced reload: webview state dies; substrate snapshot is re-subscribed.
    pub fn force_reload(&mut self) -> WorkspaceSnapshot {
        // Reload loses ephemeral UI only; substrate is canonical.
        self.crash = SurfaceCrashState::Live;
        self.substrate.clone()
    }

    pub fn kill_webview(&mut self) {
        self.crash = SurfaceCrashState::Crashed;
    }

    pub fn restart_webview(&mut self) -> Result<(), String> {
        if self.crash != SurfaceCrashState::Crashed {
            return Err("restart only from crashed".into());
        }
        self.crash = SurfaceCrashState::Restarting;
        self.crash = SurfaceCrashState::Live;
        Ok(())
    }

    pub fn set_bounds(&mut self, bounds: ContentRect) {
        self.bounds = bounds;
    }
}

/// Host for the trusted React bundle in a wry webview.
pub trait CommonPlaceSurfaceHost {
    fn surface(&self) -> &MockCommonPlaceSurface;
    fn surface_mut(&mut self) -> &mut MockCommonPlaceSurface;
    fn content_hole(&self) -> ContentRect;
}

#[derive(Debug)]
pub struct MockCommonPlaceHost {
    surface: MockCommonPlaceSurface,
}

impl MockCommonPlaceHost {
    pub fn new(bundle_url: impl Into<String>) -> Self {
        Self {
            surface: MockCommonPlaceSurface::new("commonplace", bundle_url),
        }
    }
}

impl CommonPlaceSurfaceHost for MockCommonPlaceHost {
    fn surface(&self) -> &MockCommonPlaceSurface {
        &self.surface
    }

    fn surface_mut(&mut self) -> &mut MockCommonPlaceSurface {
        &mut self.surface
    }

    fn content_hole(&self) -> ContentRect {
        self.surface.bounds
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn place_block_round_trips_through_substrate() {
        let mut host = MockCommonPlaceHost::new("http://127.0.0.1:3010/");
        host.surface_mut().place_block(PlacedBlock {
            id: "block_fixture_1".into(),
            workspace_id: "default".into(),
            kind: "note".into(),
            grants: vec!["read".into()],
        });
        assert_eq!(host.surface().substrate.blocks[0].id, "block_fixture_1");
    }

    #[test]
    fn forced_reload_restores_fixture_workspace_byte_identically() {
        let mut host = MockCommonPlaceHost::new("http://127.0.0.1:3010/");
        host.surface_mut().substrate.workspace_id = "default".into();
        host.surface_mut().substrate.layout_json = r#"{"center":["commonplace"]}"#.into();
        host.surface_mut().place_block(PlacedBlock {
            id: "block_a".into(),
            workspace_id: "default".into(),
            kind: "note".into(),
            grants: vec![],
        });
        let before = serde_json::to_string(&host.surface().substrate).unwrap();
        let restored = host.surface_mut().force_reload();
        let after = serde_json::to_string(&restored).unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn kill_webview_shows_honest_crashed_state_with_restart() {
        let mut host = MockCommonPlaceHost::new("http://127.0.0.1:3010/");
        host.surface_mut().kill_webview();
        assert_eq!(host.surface().crash, SurfaceCrashState::Crashed);
        host.surface_mut().restart_webview().unwrap();
        assert_eq!(host.surface().crash, SurfaceCrashState::Live);
    }
}
