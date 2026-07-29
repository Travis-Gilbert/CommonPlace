//! GPUI-free BrowserCore (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B2).
//!
//! Tabs, navigation, and history are views over an in-memory session graph.
//! Permissions and downloads emit receipts. Single-instance routing and the
//! cargo-dist update check are exercised without auto-applying updates.
//! Protocol / default-browser registration is reported per OS; macOS is the
//! first exercised path and is still report-if-unverified at runtime.

#![deny(unsafe_code)]

mod permissions;
mod registration;
mod session;
mod single_instance;
mod update;

pub use permissions::{
    DownloadReceipt, PermissionDecision, PermissionKind, PermissionReceipt, PermissionStore,
};
pub use registration::{
    RegistrationProbe, RegistrationStatus, bundle_declares_url_scheme,
    default_browser_registration_status, default_browser_registration_status_with,
    protocol_registration_status, protocol_registration_status_with,
    registration_capture_present, request_protocol_registration,
};
pub use session::{SessionGraph, TabId, Visit};
pub use single_instance::{SingleInstanceError, SingleInstanceServer};
pub use update::{UpdateCheckResult, UpdateFeed, check_update_feed};
