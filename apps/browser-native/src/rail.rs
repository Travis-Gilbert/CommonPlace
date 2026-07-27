//! Capability rail: extension-point contributions via the host bridge (SPEC B4).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RailContribution {
    pub id: String,
    pub label: String,
    pub pane_kind: Option<String>,
    pub composer_verb: Option<String>,
}

/// Left capability rail. V1 interactions: click-to-add and command-to-add only.
#[derive(Debug, Default, Clone)]
pub struct CapabilityRail {
    items: Vec<RailContribution>,
}

impl CapabilityRail {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_contributions(&mut self, items: Vec<RailContribution>) {
        self.items = items;
    }

    /// Live update when the bridge emits `extension_points`.
    pub fn apply_bridge_update(&mut self, items: Vec<RailContribution>) {
        self.items = items;
    }

    pub fn items(&self) -> &[RailContribution] {
        &self.items
    }

    /// Click-to-add: returns the contribution id to feed `placeBlock`.
    pub fn click_add(&self, id: &str) -> Option<&RailContribution> {
        self.items.iter().find(|c| c.id == id)
    }

    /// Command-to-add: same placement path, invoked from the command palette.
    pub fn command_add(&self, id: &str) -> Option<&RailContribution> {
        self.click_add(id)
    }
}
