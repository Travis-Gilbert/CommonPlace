//! One entry point for every user gesture the agent surface emits.
//!
//! A UI component never mutates [`ThreadRuntime`] with ad hoc calls to
//! `start_user_message`, `abort`, `switch_branch`, and friends scattered
//! through its event handlers: that duplicates the decision of which local
//! state changes accompany which network request in every caller. Instead a
//! surface emits one [`AgentAction`] per gesture and this module is the only
//! place that decides both halves: the local mutation (always applied,
//! always synchronous) and the bridge request it requires, if any.
//!
//! Branch switching and a locally-observed cancel need no network call at
//! all, which is exactly the "load-bearing local branch switching" and
//! "cancel preserving partial output" the product surface promises: the
//! partial text and the switched branch are real the instant the action
//! applies, not after a round trip confirms them.

use crate::approval::ApprovalDecision;
use crate::bridge::RunEnvelope;
use crate::thread::{BranchId, ThreadRuntime};

/// A single user gesture against the active thread.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentAction {
    /// Submit the composer's text, with any attachments already resolved by
    /// the caller (see [`crate::attachments::DocumentResolver`]).
    Send {
        text: String,
        attachments: Vec<crate::attachments::ResolvedAttachment>,
    },
    /// Resolve a pending approval by its display `approvalId`.
    Approve { approval_id: String },
    /// Reject a pending approval with a reason shown back to the person.
    Deny { approval_id: String, reason: String },
    /// Stop the active run. Marks the accumulated assistant text partial
    /// immediately; the network half best-effort cancels a resumable turn.
    Cancel,
    /// Switch which branch of the thread is the active, port-driving one.
    /// Pure local state: the branch graph already lives on the client.
    SwitchBranch(BranchId),
    /// Fork history at `event_index` and resend a replacement user message.
    EditAndResend { event_index: usize, replacement: String },
}

/// What applying one [`AgentAction`] requires of the transport layer.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub enum ActionOutcome {
    /// The action was entirely local; nothing to send.
    #[default]
    None,
    /// Post this envelope to resume the session.
    Dispatch(RunEnvelope),
}

impl ThreadRuntime {
    /// Apply one UI gesture, returning the request it requires.
    ///
    /// `Send` and `EditAndResend` on an empty or whitespace-only replacement
    /// apply no local mutation and dispatch nothing, matching the composer's
    /// own submit guard: an empty message never starts a run.
    pub fn apply_action(&mut self, action: AgentAction) -> ActionOutcome {
        match action {
            AgentAction::Send { text, attachments } => {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    return ActionOutcome::None;
                }
                self.start_user_message(trimmed.to_owned());
                ActionOutcome::Dispatch(RunEnvelope::send(trimmed.to_owned(), attachments))
            }
            AgentAction::Approve { approval_id } => {
                self.dispatch_decision(&approval_id, ApprovalDecision::Approve)
            }
            AgentAction::Deny { approval_id, reason } => {
                self.dispatch_decision(&approval_id, ApprovalDecision::Deny { reason })
            }
            AgentAction::Cancel => {
                self.abort();
                ActionOutcome::Dispatch(RunEnvelope::cancel())
            }
            AgentAction::SwitchBranch(branch_id) => {
                self.switch_branch(branch_id);
                ActionOutcome::None
            }
            AgentAction::EditAndResend { event_index, replacement } => {
                let trimmed = replacement.trim();
                if trimmed.is_empty() {
                    return ActionOutcome::None;
                }
                let _ = self.edit_and_resend(event_index, trimmed.to_owned());
                ActionOutcome::Dispatch(RunEnvelope::send(trimmed.to_owned(), Vec::new()))
            }
        }
    }

    fn dispatch_decision(&mut self, approval_id: &str, decision: ApprovalDecision) -> ActionOutcome {
        self.decide_approval(approval_id, decision)
            .map_or(ActionOutcome::None, |command| {
                ActionOutcome::Dispatch(RunEnvelope {
                    commands: vec![command],
                    attachments: Vec::new(),
                })
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parts::{KnownStreamPart, StreamPart};
    use crate::scope::ScopeBinding;
    use crate::thread::RunState;

    #[test]
    fn send_starts_the_message_locally_and_dispatches_the_bridge_command() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        let outcome = runtime.apply_action(AgentAction::Send {
            text: "hello".into(),
            attachments: Vec::new(),
        });
        assert_eq!(runtime.active_branch().events.len(), 1);
        assert_eq!(runtime.run, RunState::Streaming);
        match outcome {
            ActionOutcome::Dispatch(envelope) => {
                assert_eq!(envelope.commands.len(), 1);
                assert!(envelope.attachments.is_empty());
            }
            ActionOutcome::None => panic!("send must dispatch"),
        }
    }

    #[test]
    fn send_ignores_a_blank_message() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        let outcome = runtime.apply_action(AgentAction::Send {
            text: "   ".into(),
            attachments: Vec::new(),
        });
        assert_eq!(outcome, ActionOutcome::None);
        assert!(runtime.active_branch().events.is_empty());
    }

    #[test]
    fn cancel_marks_partial_locally_and_still_dispatches_a_best_effort_cancel() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.apply_part(StreamPart::Known(KnownStreamPart::TextDelta {
            id: "text-1".into(),
            delta: "partial output".into(),
            provider_metadata: None,
        }));
        let outcome = runtime.apply_action(AgentAction::Cancel);
        assert_eq!(runtime.run, RunState::Aborted);
        assert!(runtime.active_branch().partial);
        assert_eq!(runtime.active_branch().assistant_text, "partial output");
        assert!(matches!(outcome, ActionOutcome::Dispatch(_)));
    }

    #[test]
    fn switch_branch_is_local_only_and_dispatches_nothing() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.start_user_message("first");
        let fork = runtime.edit_and_resend(0, "second");
        let outcome = runtime.apply_action(AgentAction::SwitchBranch(0));
        assert_eq!(outcome, ActionOutcome::None);
        assert_eq!(runtime.active_branch_id(), 0);
        let back = runtime.apply_action(AgentAction::SwitchBranch(fork));
        assert_eq!(back, ActionOutcome::None);
        assert_eq!(runtime.active_branch_id(), fork);
    }

    #[test]
    fn approve_resumes_the_tool_call_id_and_deny_carries_the_reason() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.apply_part(StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
            approval_id: "approval-call-1".into(),
            tool_call_id: "call-1".into(),
            is_automatic: None,
            signature: None,
        }));
        let outcome = runtime.apply_action(AgentAction::Approve {
            approval_id: "approval-call-1".into(),
        });
        let ActionOutcome::Dispatch(envelope) = outcome else {
            panic!("approve must dispatch");
        };
        assert_eq!(
            serde_json::to_value(&envelope.commands[0]).unwrap(),
            serde_json::json!({"type": "permission-response", "callId": "call-1", "decision": "allow"})
        );

        runtime.apply_part(StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
            approval_id: "approval-call-2".into(),
            tool_call_id: "call-2".into(),
            is_automatic: None,
            signature: None,
        }));
        let outcome = runtime.apply_action(AgentAction::Deny {
            approval_id: "approval-call-2".into(),
            reason: "unsafe target".into(),
        });
        let ActionOutcome::Dispatch(envelope) = outcome else {
            panic!("deny must dispatch");
        };
        assert_eq!(
            serde_json::to_value(&envelope.commands[0]).unwrap(),
            serde_json::json!({"type": "permission-response", "callId": "call-2", "decision": "reject"})
        );
    }

    #[test]
    fn an_unknown_approval_id_dispatches_nothing_rather_than_a_malformed_request() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        let outcome = runtime.apply_action(AgentAction::Approve {
            approval_id: "not-pending".into(),
        });
        assert_eq!(outcome, ActionOutcome::None);
    }

    #[test]
    fn edit_and_resend_forks_locally_and_dispatches_the_replacement() {
        let mut runtime = ThreadRuntime::new("thread-1", ScopeBinding::Workspace);
        runtime.start_user_message("original");
        let before = runtime.branches().count();
        let outcome = runtime.apply_action(AgentAction::EditAndResend {
            event_index: 0,
            replacement: "edited".into(),
        });
        assert_eq!(runtime.branches().count(), before + 1);
        assert_ne!(runtime.active_branch_id(), 0);
        match outcome {
            ActionOutcome::Dispatch(envelope) => assert_eq!(envelope.commands.len(), 1),
            ActionOutcome::None => panic!("edit and resend must dispatch"),
        }
    }
}
