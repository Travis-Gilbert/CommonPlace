//! Trait boundary for the native shell (SPEC B4).
//!
//! GPUI types must never appear here, in BrowserCore, blocks, pane-host, or
//! RustyRed. All GPUI use stays behind these traits.

use crate::dock::DockLayout;
use browser_core::{PermissionKind, PermissionReceipt};

/// Top-level shell authority: window lifecycle and composition.
pub trait Shell {
    fn title(&self) -> &str;
    fn set_title(&mut self, title: impl Into<String>);
    fn dock(&self) -> &dyn DockHost;
    fn dock_mut(&mut self) -> &mut dyn DockHost;
    fn surfaces(&self) -> &dyn SurfaceHost;
    fn surfaces_mut(&mut self) -> &mut dyn SurfaceHost;
}

/// Coarse DockArea arrangement: center tabs, left rail, right evidence, bottom.
pub trait DockHost {
    fn layout(&self) -> &DockLayout;
    fn set_layout(&mut self, layout: DockLayout);
    fn persist_layout_json(&self) -> Result<String, String>;
    fn restore_layout_json(&mut self, json: &str) -> Result<(), String>;
}

/// Surface lifecycle for CommonPlace (webview) and Servo panes.
pub trait SurfaceHost {
    fn list_surfaces(&self) -> Vec<SurfaceRef>;
    fn add_surface(&mut self, surface: SurfaceRef);
    fn remove_surface(&mut self, id: &str) -> bool;
    fn focused(&self) -> Option<&str>;
    fn set_focused(&mut self, id: Option<&str>);
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SurfaceRef {
    pub id: String,
    pub kind: SurfaceKind,
    pub title: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceKind {
    CommonPlace,
    Servo,
    NativeChrome,
}

/// Prompt host: native-only permission / takeover UI fed by BrowserCore.
pub trait PromptHost {
    fn enqueue_permission(
        &mut self,
        origin: impl Into<String>,
        kind: PermissionKind,
    ) -> PromptId;
    fn resolve(&mut self, id: PromptId, allow: bool) -> Option<PermissionReceipt>;
    fn pending(&self) -> &[PendingPrompt];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PromptId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingPrompt {
    pub id: PromptId,
    pub origin: String,
    pub kind: PermissionKind,
    pub takeover: bool,
}
