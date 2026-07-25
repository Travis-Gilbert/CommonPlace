//! Servo surface hosting contract (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B5).
//!
//! Mock host records load URL, bounds, focus, and presence overlay handoff at
//! the panel edge. Real parenting via RawWindowHandle is deferred to the
//! pane-host backend handoff.

use crate::surfaces::zorder::ContentRect;

/// Servo panel as the shell sees it (GPUI-free).
#[derive(Debug, Clone, PartialEq)]
pub struct MockServoSurface {
    pub id: String,
    pub url: String,
    pub title: String,
    pub bounds: ContentRect,
    pub focused: bool,
    pub ime_composing: bool,
    /// Presence overlay drawn in-page from arbiter state (fixture).
    pub presence_in_page: bool,
    /// True when presence has handed off at this panel's edge.
    pub presence_edge_handoff: bool,
}

impl MockServoSurface {
    pub fn new(id: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            url: url.into(),
            title: String::new(),
            bounds: ContentRect::default(),
            focused: false,
            ime_composing: false,
            presence_in_page: false,
            presence_edge_handoff: false,
        }
    }

    pub fn load(&mut self, url: impl Into<String>, title: impl Into<String>) {
        self.url = url.into();
        self.title = title.into();
    }

    pub fn set_bounds(&mut self, bounds: ContentRect) {
        self.bounds = bounds;
    }

    pub fn set_focused(&mut self, focused: bool) {
        self.focused = focused;
        if !focused {
            self.ime_composing = false;
        }
    }

    pub fn begin_ime(&mut self) -> Result<(), String> {
        if !self.focused {
            return Err("ime requires focus".into());
        }
        self.ime_composing = true;
        Ok(())
    }

    pub fn apply_presence_fixture(&mut self, in_page: bool, at_edge: bool) {
        self.presence_in_page = in_page;
        self.presence_edge_handoff = at_edge;
    }
}

/// Host for Servo panes parented into the shell window.
pub trait ServoSurfaceHost {
    fn list(&self) -> &[MockServoSurface];
    fn open(&mut self, id: impl Into<String>, url: impl Into<String>) -> &MockServoSurface;
    fn surface_mut(&mut self, id: &str) -> Option<&mut MockServoSurface>;
    fn resize_side_by_side(
        &mut self,
        servo_id: &str,
        commonplace_bounds: ContentRect,
        split_x: f32,
        height: f32,
    ) -> Result<(), String>;
}

/// In-memory Servo host used until pane-host wiring lands.
#[derive(Debug, Default)]
pub struct MockServoHost {
    surfaces: Vec<MockServoSurface>,
}

impl MockServoHost {
    pub fn new() -> Self {
        Self::default()
    }
}

impl ServoSurfaceHost for MockServoHost {
    fn list(&self) -> &[MockServoSurface] {
        &self.surfaces
    }

    fn open(&mut self, id: impl Into<String>, url: impl Into<String>) -> &MockServoSurface {
        let id = id.into();
        if let Some(idx) = self.surfaces.iter().position(|s| s.id == id) {
            self.surfaces[idx].load(url, "");
            return &self.surfaces[idx];
        }
        self.surfaces.push(MockServoSurface::new(id, url));
        self.surfaces.last().expect("just pushed")
    }

    fn surface_mut(&mut self, id: &str) -> Option<&mut MockServoSurface> {
        self.surfaces.iter_mut().find(|s| s.id == id)
    }

    fn resize_side_by_side(
        &mut self,
        servo_id: &str,
        commonplace_bounds: ContentRect,
        split_x: f32,
        height: f32,
    ) -> Result<(), String> {
        let servo = self
            .surface_mut(servo_id)
            .ok_or_else(|| format!("unknown servo surface {servo_id}"))?;
        // Servo takes the right of the split; CommonPlace the left.
        servo.set_bounds(ContentRect {
            x: split_x,
            y: commonplace_bounds.y,
            width: (commonplace_bounds.x + commonplace_bounds.width - split_x).max(0.0),
            height,
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_site_loads_in_docked_panel() {
        let mut host = MockServoHost::new();
        let surface = host.open("servo-1", "https://example.com/");
        assert_eq!(surface.url, "https://example.com/");
        assert_eq!(host.list().len(), 1);
    }

    #[test]
    fn side_by_side_resize_tracks_split() {
        let mut host = MockServoHost::new();
        host.open("servo-1", "https://example.com/");
        let cp = ContentRect {
            x: 56.0,
            y: 86.0,
            width: 800.0,
            height: 600.0,
        };
        host
            .resize_side_by_side("servo-1", cp, 456.0, 600.0)
            .unwrap();
        let servo = host.surface_mut("servo-1").unwrap();
        assert_eq!(servo.bounds.x, 456.0);
        assert!((servo.bounds.width - 400.0).abs() < f32::EPSILON);
    }

    #[test]
    fn keyboard_focus_and_ime_smoke() {
        let mut host = MockServoHost::new();
        host.open("servo-1", "https://example.com/");
        let s = host.surface_mut("servo-1").unwrap();
        assert!(s.begin_ime().is_err());
        s.set_focused(true);
        s.begin_ime().unwrap();
        assert!(s.ime_composing);
    }

    #[test]
    fn presence_overlay_handoff_at_panel_edge() {
        let mut host = MockServoHost::new();
        host.open("servo-1", "https://example.com/");
        let s = host.surface_mut("servo-1").unwrap();
        s.apply_presence_fixture(true, true);
        assert!(s.presence_in_page);
        assert!(s.presence_edge_handoff);
    }
}
