//! Permission store with receipts for native prompts.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionKind {
    Geolocation,
    Notifications,
    Camera,
    Microphone,
    Clipboard,
    Downloads,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionDecision {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PermissionReceipt {
    pub id: Uuid,
    pub origin: String,
    pub kind: PermissionKind,
    pub decision: PermissionDecision,
    pub at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DownloadReceipt {
    pub id: Uuid,
    pub url: String,
    pub filename: String,
    pub bytes: u64,
    pub at_ms: u64,
}

#[derive(Debug, Default, Clone)]
pub struct PermissionStore {
    receipts: Vec<PermissionReceipt>,
    downloads: Vec<DownloadReceipt>,
}

impl PermissionStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn grant(
        &mut self,
        origin: impl Into<String>,
        kind: PermissionKind,
        decision: PermissionDecision,
        at_ms: u64,
    ) -> PermissionReceipt {
        let receipt = PermissionReceipt {
            id: Uuid::new_v4(),
            origin: origin.into(),
            kind,
            decision,
            at_ms,
        };
        self.receipts.push(receipt.clone());
        receipt
    }

    pub fn record_download(
        &mut self,
        url: impl Into<String>,
        filename: impl Into<String>,
        bytes: u64,
        at_ms: u64,
    ) -> DownloadReceipt {
        let receipt = DownloadReceipt {
            id: Uuid::new_v4(),
            url: url.into(),
            filename: filename.into(),
            bytes,
            at_ms,
        };
        self.downloads.push(receipt.clone());
        receipt
    }

    pub fn permission_receipts(&self) -> &[PermissionReceipt] {
        &self.receipts
    }

    pub fn download_receipts(&self) -> &[DownloadReceipt] {
        &self.downloads
    }
}
