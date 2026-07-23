//! DockArea layout: persist / restore coarse surface arrangement (SPEC B4).

use serde::{Deserialize, Serialize};

/// Named DockArea regions from the spec.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockLayout {
    /// Center tab ids (Servo surfaces + CommonPlace workspace tab).
    pub center_tabs: Vec<String>,
    pub active_center: Option<String>,
    /// Left capability rail open.
    pub left_rail_open: bool,
    /// Right optional evidence surface open.
    pub right_evidence_open: bool,
    /// Bottom dock: downloads, activity, approvals.
    pub bottom_open: bool,
    pub bottom_height_px: u32,
    pub left_width_px: u32,
    pub right_width_px: u32,
}

impl Default for DockLayout {
    fn default() -> Self {
        Self {
            center_tabs: vec!["commonplace".into()],
            active_center: Some("commonplace".into()),
            left_rail_open: true,
            right_evidence_open: false,
            bottom_open: true,
            bottom_height_px: 160,
            left_width_px: 220,
            right_width_px: 280,
        }
    }
}

impl DockLayout {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    pub fn from_json(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }
}

/// In-memory DockHost used by the mock shell.
#[derive(Debug, Default, Clone)]
pub struct MockDockHost {
    layout: DockLayout,
}

impl MockDockHost {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn layout(&self) -> &DockLayout {
        &self.layout
    }

    pub fn set_layout(&mut self, layout: DockLayout) {
        self.layout = layout;
    }

    pub fn persist_layout_json(&self) -> Result<String, String> {
        self.layout.to_json().map_err(|e| e.to_string())
    }

    pub fn restore_layout_json(&mut self, json: &str) -> Result<(), String> {
        self.layout = DockLayout::from_json(json).map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl crate::traits::DockHost for MockDockHost {
    fn layout(&self) -> &DockLayout {
        MockDockHost::layout(self)
    }

    fn set_layout(&mut self, layout: DockLayout) {
        MockDockHost::set_layout(self, layout)
    }

    fn persist_layout_json(&self) -> Result<String, String> {
        MockDockHost::persist_layout_json(self)
    }

    fn restore_layout_json(&mut self, json: &str) -> Result<(), String> {
        MockDockHost::restore_layout_json(self, json)
    }
}
