//! Approval lifecycle projected from the active [`ThreadRuntime`](crate::ThreadRuntime).

use serde::{Deserialize, Serialize};

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

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ApprovalCommand {
    #[serde(rename = "approvalId")]
    pub approval_id: String,
    pub approved: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl PendingApproval {
    #[must_use]
    pub fn command(&self, decision: ApprovalDecision) -> ApprovalCommand {
        match decision {
            ApprovalDecision::Approve => ApprovalCommand {
                approval_id: self.approval_id.clone(),
                approved: true,
                reason: None,
            },
            ApprovalDecision::Deny { reason } => ApprovalCommand {
                approval_id: self.approval_id.clone(),
                approved: false,
                reason: Some(reason),
            },
        }
    }
}
