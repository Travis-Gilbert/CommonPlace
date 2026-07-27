//! Native permission and takeover prompts (SPEC B4).
//! Renders only in native chrome; resolutions write BrowserCore receipts.

use crate::traits::{PendingPrompt, PromptHost, PromptId};
use browser_core::{
    PermissionDecision, PermissionKind, PermissionReceipt, PermissionStore,
};

#[derive(Debug, Default)]
pub struct NativePromptQueue {
    next_id: u64,
    pending: Vec<PendingPrompt>,
    store: PermissionStore,
    clock_ms: u64,
}

impl NativePromptQueue {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_clock_ms(&mut self, ms: u64) {
        self.clock_ms = ms;
    }

    pub fn store(&self) -> &PermissionStore {
        &self.store
    }

    pub fn store_mut(&mut self) -> &mut PermissionStore {
        &mut self.store
    }
}

impl PromptHost for NativePromptQueue {
    fn enqueue_permission(
        &mut self,
        origin: impl Into<String>,
        kind: PermissionKind,
    ) -> PromptId {
        self.next_id = self.next_id.saturating_add(1);
        let id = PromptId(self.next_id);
        self.pending.push(PendingPrompt {
            id,
            origin: origin.into(),
            kind,
            takeover: false,
        });
        id
    }

    fn resolve(&mut self, id: PromptId, allow: bool) -> Option<PermissionReceipt> {
        let idx = self.pending.iter().position(|p| p.id == id)?;
        let prompt = self.pending.remove(idx);
        let decision = if allow {
            PermissionDecision::Allow
        } else {
            PermissionDecision::Deny
        };
        self.clock_ms = self.clock_ms.saturating_add(1);
        Some(
            self.store
                .grant(prompt.origin, prompt.kind, decision, self.clock_ms),
        )
    }

    fn pending(&self) -> &[PendingPrompt] {
        &self.pending
    }
}

impl NativePromptQueue {
    /// Takeover indication prompt (agent requesting control). Still native-only.
    pub fn enqueue_takeover(&mut self, origin: impl Into<String>) -> PromptId {
        self.next_id = self.next_id.saturating_add(1);
        let id = PromptId(self.next_id);
        self.pending.push(PendingPrompt {
            id,
            origin: origin.into(),
            kind: PermissionKind::Notifications,
            takeover: true,
        });
        id
    }
}
