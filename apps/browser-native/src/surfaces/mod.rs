//! Content-surface hosting contracts for SPEC B5 (Servo) and B6 (gpui-wry).
//!
//! This module owns the shell-side contracts, mock hosts, z-order law, and
//! acceptance tests that stay GPUI-free. Native parent-handle translation lives
//! in `native_parent`, and the real GPUI plus Wry window path lives in
//! `crate::native`.

mod commonplace;
#[cfg(feature = "servo-pane")]
pub mod native_parent;
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
