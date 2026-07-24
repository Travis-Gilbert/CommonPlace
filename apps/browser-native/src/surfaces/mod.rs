//! Content-surface hosting contracts for SPEC B5 (Servo) and B6 (gpui-wry).
//!
//! Real RawWindowHandle parenting and gpui-wry linking are Codex/backend work
//! on the Theorem pane-host seam. This module owns the shell-side contracts,
//! mock hosts, z-order law, and acceptance tests that stay GPUI-free.

mod commonplace;
mod servo;
mod zorder;

pub use commonplace::{
    CommonPlaceSurfaceHost, MockCommonPlaceHost, MockCommonPlaceSurface, PlacedBlock,
    SurfaceCrashState, WorkspaceSnapshot,
};
pub use servo::{MockServoHost, MockServoSurface, ServoSurfaceHost};
pub use zorder::{
    rects_intersect, zorder_violations, ContentRect, NativeOverlay, ZOrderViolation,
};
