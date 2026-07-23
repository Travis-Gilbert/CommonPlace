//! GPUI-free BrowserCore (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B2).
//!
//! Tabs, navigation, and history are views over an in-memory session graph.
//! Permissions and downloads emit receipts. Single-instance routing and the
//! cargo-dist update check are exercised without auto-applying updates.
//! Protocol / default-browser registration is reported per OS; macOS is the
//! first exercised path and is still report-if-unverified at runtime.

#![deny(unsafe_code)]

mod permissions;
mod session;
mod single_instance;
mod update;

pub use permissions::{
    DownloadReceipt, PermissionDecision, PermissionKind, PermissionReceipt, PermissionStore,
};
pub use session::{SessionGraph, TabId, Visit};
pub use single_instance::{SingleInstanceError, SingleInstanceServer};
pub use update::{UpdateCheckResult, UpdateFeed, check_update_feed};

/// OS registration status for protocol / default-browser claims.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistrationStatus {
    VerifiedOnMacos,
    NotVerified,
    Unsupported,
}

/// Honest per-OS registration report (never assumed working).
pub fn protocol_registration_status() -> RegistrationStatus {
    #[cfg(target_os = "macos")]
    {
        // Exercised path is implemented as a no-op stub until BrowserCore owns
        // LS handlers; report not-verified rather than claiming success.
        RegistrationStatus::NotVerified
    }
    #[cfg(not(target_os = "macos"))]
    {
        RegistrationStatus::NotVerified
    }
}

pub fn default_browser_registration_status() -> RegistrationStatus {
    protocol_registration_status()
}
