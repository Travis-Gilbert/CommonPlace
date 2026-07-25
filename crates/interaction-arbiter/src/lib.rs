//! GPUI-free InteractionArbiter (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B3).
//!
//! Enforces the one-frame human-preemption law: synthetic or real human input
//! freezes every active agent lease in the same frame as the input event.
//! Owns agent action leases, canonical AgentPresence, ordered handoff events,
//! and the focus ownership registry.

#![deny(unsafe_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Opaque surface identity shared across realms (native chrome, React, Servo).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SurfaceId(pub String);

impl SurfaceId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct LeaseId(pub Uuid);

impl LeaseId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for LeaseId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LeaseStatus {
    Active,
    Frozen,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Lease {
    pub id: LeaseId,
    pub surface: SurfaceId,
    pub acquired_frame: u64,
    pub expires_at_frame: u64,
    pub status: LeaseStatus,
    pub frozen_at_frame: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PresenceState {
    Idle,
    Active,
    Frozen,
    HandingOff,
}

/// Canonical agent presence consumed by every realm's renderer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentPresence {
    pub surface: SurfaceId,
    pub state: PresenceState,
    /// Anchor within the surface (normalized or element id).
    pub anchor: String,
    pub frozen: bool,
    pub intent: String,
}

impl AgentPresence {
    pub fn idle(surface: SurfaceId) -> Self {
        Self {
            surface,
            state: PresenceState::Idle,
            anchor: String::new(),
            frozen: false,
            intent: String::new(),
        }
    }
}

/// Ordered handoff at a surface boundary. Consumers must see no gap and no overlap.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PresenceHandoff {
    pub from: SurfaceId,
    pub to: SurfaceId,
    pub at_frame: u64,
    pub anchor_from: String,
    pub anchor_to: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FocusEvent {
    pub surface: SurfaceId,
    pub at_frame: u64,
}

#[derive(Debug)]
pub struct InteractionArbiter {
    frame: u64,
    leases: HashMap<Uuid, Lease>,
    presence: AgentPresence,
    handoffs: Vec<PresenceHandoff>,
    /// Current focus owner, if any.
    focus: Option<SurfaceId>,
    focus_history: Vec<FocusEvent>,
    /// Frame of the most recent human input that caused a freeze (for assertions).
    last_human_preempt_frame: Option<u64>,
}

impl Default for InteractionArbiter {
    fn default() -> Self {
        Self::new(SurfaceId::new("native"))
    }
}

impl InteractionArbiter {
    pub fn new(initial_surface: SurfaceId) -> Self {
        Self {
            frame: 0,
            leases: HashMap::new(),
            presence: AgentPresence::idle(initial_surface),
            handoffs: Vec::new(),
            focus: None,
            focus_history: Vec::new(),
            last_human_preempt_frame: None,
        }
    }

    pub fn frame(&self) -> u64 {
        self.frame
    }

    /// Advance one simulation / compositor frame. Expires leases whose deadline
    /// has passed. Call after processing input for the frame.
    pub fn advance_frame(&mut self) {
        self.frame = self.frame.saturating_add(1);
        self.expire_leases();
    }

    /// Human input at `event_frame`. Freezes every Active lease in the **same**
    /// frame (one-frame preemption law). `event_frame` must be the current frame
    /// or the immediately prior frame being settled.
    pub fn human_input(&mut self, event_frame: u64) {
        let freeze_frame = event_frame;
        for lease in self.leases.values_mut() {
            if lease.status == LeaseStatus::Active {
                lease.status = LeaseStatus::Frozen;
                lease.frozen_at_frame = Some(freeze_frame);
            }
        }
        if self.presence.state == PresenceState::Active
            || self.presence.state == PresenceState::HandingOff
        {
            self.presence.state = PresenceState::Frozen;
            self.presence.frozen = true;
        }
        self.last_human_preempt_frame = Some(freeze_frame);
        // Keep arbiter clock at least at the input frame so assertions align.
        if freeze_frame > self.frame {
            self.frame = freeze_frame;
        }
    }

    pub fn last_human_preempt_frame(&self) -> Option<u64> {
        self.last_human_preempt_frame
    }

    pub fn acquire_lease(
        &mut self,
        surface: SurfaceId,
        ttl_frames: u64,
    ) -> Result<LeaseId, LeaseError> {
        if self.any_frozen() {
            return Err(LeaseError::Frozen);
        }
        let id = LeaseId::new();
        let lease = Lease {
            id,
            surface,
            acquired_frame: self.frame,
            expires_at_frame: self.frame.saturating_add(ttl_frames),
            status: LeaseStatus::Active,
            frozen_at_frame: None,
        };
        self.leases.insert(id.0, lease);
        Ok(id)
    }

    pub fn renew_lease(&mut self, id: LeaseId, ttl_frames: u64) -> Result<(), LeaseError> {
        let lease = self.leases.get_mut(&id.0).ok_or(LeaseError::NotFound)?;
        match lease.status {
            LeaseStatus::Active => {
                lease.expires_at_frame = self.frame.saturating_add(ttl_frames);
                Ok(())
            }
            LeaseStatus::Frozen => Err(LeaseError::Frozen),
            LeaseStatus::Cancelled | LeaseStatus::Expired => Err(LeaseError::NotActive),
        }
    }

    pub fn freeze_lease(&mut self, id: LeaseId) -> Result<(), LeaseError> {
        let lease = self.leases.get_mut(&id.0).ok_or(LeaseError::NotFound)?;
        if lease.status != LeaseStatus::Active {
            return Err(LeaseError::NotActive);
        }
        lease.status = LeaseStatus::Frozen;
        lease.frozen_at_frame = Some(self.frame);
        Ok(())
    }

    pub fn cancel_lease(&mut self, id: LeaseId) -> Result<(), LeaseError> {
        let lease = self.leases.get_mut(&id.0).ok_or(LeaseError::NotFound)?;
        if matches!(
            lease.status,
            LeaseStatus::Cancelled | LeaseStatus::Expired
        ) {
            return Err(LeaseError::NotActive);
        }
        lease.status = LeaseStatus::Cancelled;
        Ok(())
    }

    pub fn lease(&self, id: LeaseId) -> Option<&Lease> {
        self.leases.get(&id.0)
    }

    pub fn leases(&self) -> impl Iterator<Item = &Lease> {
        self.leases.values()
    }

    fn expire_leases(&mut self) {
        for lease in self.leases.values_mut() {
            if lease.status == LeaseStatus::Active && self.frame >= lease.expires_at_frame {
                lease.status = LeaseStatus::Expired;
            }
        }
    }

    fn any_frozen(&self) -> bool {
        self.leases
            .values()
            .any(|l| l.status == LeaseStatus::Frozen)
            || self.presence.frozen
    }

    // --- Presence ---

    pub fn presence(&self) -> &AgentPresence {
        &self.presence
    }

    pub fn set_presence_active(&mut self, surface: SurfaceId, anchor: String, intent: String) {
        self.presence = AgentPresence {
            surface,
            state: PresenceState::Active,
            anchor,
            frozen: false,
            intent,
        };
    }

    /// Hand off presence across a surface boundary. Emits an ordered handoff
    /// event; presence lands on `to` with no gap (same frame) and no overlap
    /// (only one surface owns presence after the call).
    pub fn handoff_presence(
        &mut self,
        to: SurfaceId,
        anchor_to: String,
    ) -> Result<&PresenceHandoff, HandoffError> {
        if self.presence.frozen {
            return Err(HandoffError::Frozen);
        }
        let from = self.presence.surface.clone();
        if from == to {
            return Err(HandoffError::SameSurface);
        }
        let anchor_from = self.presence.anchor.clone();
        self.presence.state = PresenceState::HandingOff;
        let event = PresenceHandoff {
            from,
            to: to.clone(),
            at_frame: self.frame,
            anchor_from,
            anchor_to: anchor_to.clone(),
        };
        self.handoffs.push(event);
        self.presence.surface = to;
        self.presence.anchor = anchor_to;
        self.presence.state = PresenceState::Active;
        self.presence.frozen = false;
        Ok(self.handoffs.last().expect("just pushed"))
    }

    pub fn handoffs(&self) -> &[PresenceHandoff] {
        &self.handoffs
    }

    // --- Focus registry ---

    pub fn set_focus(&mut self, surface: SurfaceId) {
        self.focus = Some(surface.clone());
        self.focus_history.push(FocusEvent {
            surface,
            at_frame: self.frame,
        });
    }

    pub fn clear_focus(&mut self) {
        self.focus = None;
    }

    pub fn focus(&self) -> Option<&SurfaceId> {
        self.focus.as_ref()
    }

    pub fn focus_history(&self) -> &[FocusEvent] {
        &self.focus_history
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaseError {
    NotFound,
    NotActive,
    Frozen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandoffError {
    Frozen,
    SameSurface,
}

#[cfg(test)]
mod acceptance {
    use super::*;

    #[test]
    fn human_input_freezes_agent_lease_same_frame() {
        let mut arb = InteractionArbiter::new(SurfaceId::new("servo"));
        arb.set_presence_active(
            SurfaceId::new("servo"),
            "el-1".into(),
            "type".into(),
        );
        let lease = arb
            .acquire_lease(SurfaceId::new("servo"), 10)
            .expect("acquire");

        // Scripted agent action at frame 0; human input arrives same frame.
        let human_frame = arb.frame();
        arb.human_input(human_frame);

        let l = arb.lease(lease).unwrap();
        assert_eq!(l.status, LeaseStatus::Frozen);
        assert_eq!(l.frozen_at_frame, Some(human_frame));
        assert_eq!(arb.last_human_preempt_frame(), Some(human_frame));
        assert!(arb.presence().frozen);
        assert_eq!(arb.presence().state, PresenceState::Frozen);
        // Event-timestamp assertion: freeze frame equals human input frame.
        assert_eq!(l.frozen_at_frame.unwrap(), human_frame);
    }

    #[test]
    fn lease_expiry_cancels_cleanly() {
        let mut arb = InteractionArbiter::new(SurfaceId::new("native"));
        let id = arb.acquire_lease(SurfaceId::new("native"), 2).unwrap();
        assert_eq!(arb.lease(id).unwrap().status, LeaseStatus::Active);

        arb.advance_frame(); // frame 1
        assert_eq!(arb.lease(id).unwrap().status, LeaseStatus::Active);

        arb.advance_frame(); // frame 2 >= expires_at_frame(2)
        assert_eq!(arb.lease(id).unwrap().status, LeaseStatus::Expired);

        assert_eq!(arb.cancel_lease(id), Err(LeaseError::NotActive));
        assert_eq!(arb.renew_lease(id, 5), Err(LeaseError::NotActive));
    }

    #[test]
    fn lease_cancel_and_renew_happy_paths() {
        let mut arb = InteractionArbiter::new(SurfaceId::new("react"));
        let id = arb.acquire_lease(SurfaceId::new("react"), 5).unwrap();
        arb.renew_lease(id, 10).unwrap();
        assert!(arb.lease(id).unwrap().expires_at_frame >= 10);
        arb.cancel_lease(id).unwrap();
        assert_eq!(arb.lease(id).unwrap().status, LeaseStatus::Cancelled);
    }

    #[test]
    fn presence_handoff_ordered_no_gap_no_overlap() {
        let mut arb = InteractionArbiter::new(SurfaceId::new("native"));
        arb.set_presence_active(SurfaceId::new("native"), "chrome".into(), "move".into());

        arb.handoff_presence(SurfaceId::new("react"), "block-1".into())
            .unwrap();
        arb.advance_frame();
        arb.handoff_presence(SurfaceId::new("servo"), "node-9".into())
            .unwrap();

        let events = arb.handoffs();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].from, SurfaceId::new("native"));
        assert_eq!(events[0].to, SurfaceId::new("react"));
        assert_eq!(events[1].from, SurfaceId::new("react"));
        assert_eq!(events[1].to, SurfaceId::new("servo"));

        // No gap: each handoff's `to` is the next handoff's `from`.
        assert_eq!(events[0].to, events[1].from);
        // No overlap: only one surface owns presence now.
        assert_eq!(arb.presence().surface, SurfaceId::new("servo"));
        assert_eq!(arb.presence().state, PresenceState::Active);
        assert!(!arb.presence().frozen);
        // Ordered by frame (non-decreasing).
        assert!(events[0].at_frame <= events[1].at_frame);
    }

    #[test]
    fn focus_registry_matches_scripted_sequence() {
        let mut arb = InteractionArbiter::new(SurfaceId::new("native"));
        let seq = ["native", "react", "servo", "react"];
        for id in seq {
            arb.set_focus(SurfaceId::new(id));
            arb.advance_frame();
        }
        let hist: Vec<_> = arb
            .focus_history()
            .iter()
            .map(|e| e.surface.0.as_str())
            .collect();
        assert_eq!(hist, seq);
        assert_eq!(arb.focus().map(|s| s.0.as_str()), Some("react"));
    }
}
