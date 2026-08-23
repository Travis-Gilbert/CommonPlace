//! Approval lifecycle projected from the active [`ThreadRuntime`](crate::ThreadRuntime).

use serde::{Deserialize, Serialize};

use crate::bridge::BridgeCommand;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied { reason: String },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PendingApproval {
    pub approval_id: String,
    pub tool_call_id: String,
    pub status: ApprovalStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ApprovalDecision {
    Approve,
    Deny { reason: String },
}

impl PendingApproval {
    /// The real server bridge resumes a permission by `callId`, which is the
    /// ACP tool call id carried on this approval, never the derived
    /// `approvalId` a UI-message part uses for display. Building the command
    /// here, next to the field it must read, is what keeps that distinction
    /// from being re-broken by a future caller who reaches for the id with
    /// the friendlier name.
    #[must_use]
    pub fn bridge_command(&self, decision: &ApprovalDecision) -> BridgeCommand {
        BridgeCommand::permission_response(self.tool_call_id.clone(), decision)
    }
}
