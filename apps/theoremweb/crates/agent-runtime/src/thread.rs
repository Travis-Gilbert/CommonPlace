//! One branch-aware thread runtime for messages, stream parts, and approvals.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::approval::{ApprovalDecision, ApprovalStatus, PendingApproval};
use crate::parts::{KnownStreamPart, StreamPart};
use crate::scope::ScopeBinding;
use crate::sse::{parse_sse_stream, SseEvent};

pub type BranchId = u32;

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunState {
    #[default]
    Idle,
    Streaming,
    AwaitingApproval,
    Finished,
    Aborted,
    Errored,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ThreadEvent {
    UserMessage {
        text: String,
    },
    AssistantDelta {
        text: String,
    },
    ToolCall {
        id: String,
        name: String,
    },
    ApprovalRequested {
        approval_id: String,
        tool_call_id: String,
    },
    ApprovalDecided {
        approval_id: String,
        approved: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    Finished,
    Aborted {
        partial: bool,
    },
    Error {
        message: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ThreadBranch {
    pub branch_id: BranchId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_branch_id: Option<BranchId>,
    pub events: Vec<ThreadEvent>,
    pub parts: Vec<StreamPart>,
    pub assistant_text: String,
    pub partial: bool,
}

impl ThreadBranch {
    const fn root() -> Self {
        Self {
            branch_id: 0,
            parent_branch_id: None,
            events: Vec::new(),
            parts: Vec::new(),
            assistant_text: String::new(),
            partial: false,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ThreadRuntime {
    pub thread_id: String,
    pub scope: ScopeBinding,
    pub run: RunState,
    branches: BTreeMap<BranchId, ThreadBranch>,
    active_branch_id: BranchId,
    next_branch_id: BranchId,
    approvals: BTreeMap<String, PendingApproval>,
}

impl ThreadRuntime {
    #[must_use]
    pub fn new(thread_id: impl Into<String>, scope: ScopeBinding) -> Self {
        Self {
            thread_id: thread_id.into(),
            scope,
            run: RunState::Idle,
            branches: BTreeMap::from([(0, ThreadBranch::root())]),
            active_branch_id: 0,
            next_branch_id: 1,
            approvals: BTreeMap::new(),
        }
    }

    #[must_use]
    pub const fn active_branch_id(&self) -> BranchId {
        self.active_branch_id
    }

    /// Return the active readable branch.
    ///
    /// # Panics
    ///
    /// Panics only if an internally constructed runtime violates its invariant
    /// that `active_branch_id` always names an entry in `branches`.
    #[must_use]
    pub fn active_branch(&self) -> &ThreadBranch {
        self.branches
            .get(&self.active_branch_id)
            .expect("active branch is maintained by ThreadRuntime")
    }

    fn active_branch_mut(&mut self) -> &mut ThreadBranch {
        self.branches
            .get_mut(&self.active_branch_id)
            .expect("active branch is maintained by ThreadRuntime")
    }

    pub fn branches(&self) -> impl Iterator<Item = &ThreadBranch> {
        self.branches.values()
    }

    pub fn pending_approvals(&self) -> impl Iterator<Item = &PendingApproval> {
        self.approvals
            .values()
            .filter(|approval| approval.status == ApprovalStatus::Pending)
    }

    pub fn start_user_message(&mut self, text: impl Into<String>) {
        self.active_branch_mut()
            .events
            .push(ThreadEvent::UserMessage { text: text.into() });
        self.run = RunState::Streaming;
    }

    pub fn apply_part(&mut self, part: StreamPart) {
        match &part {
            StreamPart::Known(known) => self.apply_known(known),
            StreamPart::Data { .. } | StreamPart::Unknown { .. } => {}
        }
        self.active_branch_mut().parts.push(part);
    }

    fn apply_known(&mut self, part: &KnownStreamPart) {
        match part {
            KnownStreamPart::Start { .. } | KnownStreamPart::TextStart { .. } => {
                self.run = RunState::Streaming;
            }
            KnownStreamPart::TextDelta { delta, .. } => {
                let branch = self.active_branch_mut();
                branch.assistant_text.push_str(delta);
                branch.events.push(ThreadEvent::AssistantDelta {
                    text: delta.clone(),
                });
            }
            KnownStreamPart::ToolInputStart {
                tool_call_id,
                tool_name,
                ..
            } => self.active_branch_mut().events.push(ThreadEvent::ToolCall {
                id: tool_call_id.clone(),
                name: tool_name.clone(),
            }),
            KnownStreamPart::ToolApprovalRequest {
                approval_id,
                tool_call_id,
                ..
            } => {
                self.run = RunState::AwaitingApproval;
                self.approvals.insert(
                    approval_id.clone(),
                    PendingApproval {
                        approval_id: approval_id.clone(),
                        tool_call_id: tool_call_id.clone(),
                        status: ApprovalStatus::Pending,
                    },
                );
                self.active_branch_mut()
                    .events
                    .push(ThreadEvent::ApprovalRequested {
                        approval_id: approval_id.clone(),
                        tool_call_id: tool_call_id.clone(),
                    });
            }
            KnownStreamPart::ToolApprovalResponse {
                approval_id,
                approved,
                reason,
                ..
            } => self.record_approval_response(approval_id, *approved, reason.clone()),
            KnownStreamPart::Finish { .. } => {
                self.run = RunState::Finished;
                self.active_branch_mut().events.push(ThreadEvent::Finished);
            }
            KnownStreamPart::Abort { .. } => self.abort(),
            KnownStreamPart::Error { error_text } => {
                self.run = RunState::Errored;
                self.active_branch_mut().events.push(ThreadEvent::Error {
                    message: error_text.clone(),
                });
            }
            _ => {}
        }
    }

    pub fn decide_approval(
        &mut self,
        approval_id: &str,
        decision: ApprovalDecision,
    ) -> Option<crate::ApprovalCommand> {
        let approval = self.approvals.get(approval_id)?.clone();
        let command = approval.command(decision.clone());
        match decision {
            ApprovalDecision::Approve => self.record_approval_response(approval_id, true, None),
            ApprovalDecision::Deny { reason } => {
                self.record_approval_response(approval_id, false, Some(reason));
            }
        }
        Some(command)
    }

    fn record_approval_response(
        &mut self,
        approval_id: &str,
        approved: bool,
        reason: Option<String>,
    ) {
        if let Some(approval) = self.approvals.get_mut(approval_id) {
            approval.status = if approved {
                ApprovalStatus::Approved
            } else {
                ApprovalStatus::Denied {
                    reason: reason.clone().unwrap_or_default(),
                }
            };
        }
        self.run = RunState::Streaming;
        self.active_branch_mut()
            .events
            .push(ThreadEvent::ApprovalDecided {
                approval_id: approval_id.to_owned(),
                approved,
                reason,
            });
    }

    pub fn abort(&mut self) {
        let partial = !self.active_branch().assistant_text.is_empty();
        self.run = RunState::Aborted;
        let branch = self.active_branch_mut();
        branch.partial = partial;
        branch.events.push(ThreadEvent::Aborted { partial });
    }

    /// Fork from an earlier event, preserving both the original and new branch.
    #[must_use]
    pub fn edit_and_resend(
        &mut self,
        event_index: usize,
        replacement: impl Into<String>,
    ) -> BranchId {
        let parent_id = self.active_branch_id;
        let parent = self.active_branch().clone();
        let branch_id = self.next_branch_id;
        self.next_branch_id = self.next_branch_id.saturating_add(1);
        let mut branch = ThreadBranch {
            branch_id,
            parent_branch_id: Some(parent_id),
            events: parent.events.into_iter().take(event_index).collect(),
            parts: Vec::new(),
            assistant_text: String::new(),
            partial: false,
        };
        branch.events.push(ThreadEvent::UserMessage {
            text: replacement.into(),
        });
        self.branches.insert(branch_id, branch);
        self.active_branch_id = branch_id;
        self.run = RunState::Streaming;
        branch_id
    }

    pub fn switch_branch(&mut self, branch_id: BranchId) -> bool {
        if self.branches.contains_key(&branch_id) {
            self.active_branch_id = branch_id;
            true
        } else {
            false
        }
    }

    /// Text emitted by a bound node port comes only from the active branch.
    #[must_use]
    pub fn active_port_output(&self) -> &str {
        &self.active_branch().assistant_text
    }

    /// Ingest a complete UI-message SSE document.
    ///
    /// # Errors
    ///
    /// Returns a labeled framing or part-decoding error.
    pub fn ingest_sse(&mut self, document: &str) -> Result<(), String> {
        for event in parse_sse_stream(document)? {
            match event {
                SseEvent::Part(part) => self.apply_part(part),
                SseEvent::Done if self.run == RunState::Streaming => {
                    self.run = RunState::Finished;
                    self.active_branch_mut().events.push(ThreadEvent::Finished);
                }
                SseEvent::Done | SseEvent::Comment(_) | SseEvent::Ping => {}
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abort_retains_and_labels_partial_assistant_text() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.apply_part(StreamPart::Known(KnownStreamPart::TextDelta {
            id: "text-1".into(),
            delta: "partial".into(),
            provider_metadata: None,
        }));
        runtime.abort();
        assert_eq!(runtime.run, RunState::Aborted);
        assert_eq!(runtime.active_branch().assistant_text, "partial");
        assert!(runtime.active_branch().partial);
    }

    #[test]
    fn edit_forks_without_mutating_history_and_active_branch_drives_port() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.start_user_message("original");
        runtime.apply_part(StreamPart::Known(KnownStreamPart::TextDelta {
            id: "text-1".into(),
            delta: "old output".into(),
            provider_metadata: None,
        }));
        let fork = runtime.edit_and_resend(0, "edited");
        runtime.apply_part(StreamPart::Known(KnownStreamPart::TextDelta {
            id: "text-2".into(),
            delta: "new output".into(),
            provider_metadata: None,
        }));
        assert_eq!(runtime.branches().count(), 2);
        assert_eq!(runtime.active_port_output(), "new output");
        assert!(runtime.switch_branch(0));
        assert_eq!(runtime.active_port_output(), "old output");
        assert!(runtime.switch_branch(fork));
    }

    #[test]
    fn approval_pending_approve_and_deny_never_hang() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.apply_part(StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
            approval_id: "approval-1".into(),
            tool_call_id: "call-1".into(),
            is_automatic: None,
            signature: None,
        }));
        assert_eq!(runtime.run, RunState::AwaitingApproval);
        assert_eq!(runtime.pending_approvals().count(), 1);
        let denied = runtime
            .decide_approval(
                "approval-1",
                ApprovalDecision::Deny {
                    reason: "unsafe target".into(),
                },
            )
            .unwrap();
        assert!(!denied.approved);
        assert_eq!(denied.reason.as_deref(), Some("unsafe target"));
        assert_eq!(runtime.run, RunState::Streaming);
        assert_eq!(runtime.pending_approvals().count(), 0);

        runtime.apply_part(StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
            approval_id: "approval-2".into(),
            tool_call_id: "call-2".into(),
            is_automatic: Some(false),
            signature: None,
        }));
        let approved = runtime
            .decide_approval("approval-2", ApprovalDecision::Approve)
            .unwrap();
        assert!(approved.approved);
        assert_eq!(approved.reason, None);
        assert_eq!(runtime.run, RunState::Streaming);
        assert_eq!(runtime.pending_approvals().count(), 0);
    }
}
