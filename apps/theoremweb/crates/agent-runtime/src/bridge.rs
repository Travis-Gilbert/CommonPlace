//! The wire contract this crate speaks to the server bridge.
//!
//! Mirrors `packages/theorem-acp/src/bridge.ts`'s `BridgeCommand` union
//! byte-for-byte. That file is the one place the server accepts a resumed
//! turn, an approval decision, or a cancellation; inventing a second shape
//! here would silently stop being understood the moment the two drift, so
//! every field name and tag below is pinned by a test against the literal
//! strings the TypeScript validator checks for.

use serde::{Deserialize, Serialize};

use crate::approval::ApprovalDecision;
use crate::attachments::ResolvedAttachment;

/// `'allow' | 'reject'` on the wire.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BridgeDecision {
    Allow,
    Reject,
}

impl From<&ApprovalDecision> for BridgeDecision {
    fn from(decision: &ApprovalDecision) -> Self {
        match decision {
            ApprovalDecision::Approve => Self::Allow,
            ApprovalDecision::Deny { .. } => Self::Reject,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BridgeTextPart {
    #[serde(rename = "type")]
    pub kind: BridgeTextPartKind,
    pub text: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeTextPartKind {
    Text,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BridgeMessage {
    pub role: BridgeMessageRole,
    pub parts: Vec<BridgeTextPart>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeMessageRole {
    User,
}

/// The exact `BridgeCommand` union from `packages/theorem-acp/src/bridge.ts`.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum BridgeCommand {
    AddMessage {
        message: BridgeMessage,
        #[serde(rename = "parentId")]
        parent_id: Option<String>,
        #[serde(rename = "sourceId")]
        source_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none", rename = "displayText")]
        display_text: Option<String>,
    },
    PermissionResponse {
        #[serde(rename = "callId")]
        call_id: String,
        decision: BridgeDecision,
    },
    Cancel,
}

impl BridgeCommand {
    /// Build the resumed-turn command the composer's send action requires.
    #[must_use]
    pub fn add_message(text: impl Into<String>) -> Self {
        let text = text.into();
        Self::AddMessage {
            message: BridgeMessage {
                role: BridgeMessageRole::User,
                parts: vec![BridgeTextPart {
                    kind: BridgeTextPartKind::Text,
                    text,
                }],
            },
            parent_id: None,
            source_id: None,
            display_text: None,
        }
    }

    /// Build the approval-decision command from the tool's own call id.
    ///
    /// The bridge resumes a permission by `callId`, which is the ACP tool
    /// call id, not the derived, prefixed `approvalId` a UI-message part
    /// carries for display. Sending the display id here silently resumes
    /// nothing: the session has no pending permission under that key.
    #[must_use]
    pub fn permission_response(tool_call_id: impl Into<String>, decision: &ApprovalDecision) -> Self {
        Self::PermissionResponse {
            call_id: tool_call_id.into(),
            decision: BridgeDecision::from(decision),
        }
    }
}

/// One resumed request: the bridge commands to dispatch and any
/// client-resolved attachments to carry alongside them.
///
/// Attachments travel outside `BridgeCommand` because the bridge's own
/// message parts are text-only; the console route folds resolved document
/// content into the prompt the same way it already folds in web-research
/// sources, so this crate never invents a second attachment channel either.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct RunEnvelope {
    pub commands: Vec<BridgeCommand>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<ResolvedAttachment>,
}

impl RunEnvelope {
    #[must_use]
    pub fn send(text: impl Into<String>, attachments: Vec<ResolvedAttachment>) -> Self {
        Self {
            commands: vec![BridgeCommand::add_message(text)],
            attachments,
        }
    }

    #[must_use]
    pub fn respond(tool_call_id: impl Into<String>, decision: &ApprovalDecision) -> Self {
        Self {
            commands: vec![BridgeCommand::permission_response(tool_call_id, decision)],
            attachments: Vec::new(),
        }
    }

    #[must_use]
    pub fn cancel() -> Self {
        Self {
            commands: vec![BridgeCommand::Cancel],
            attachments: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_message_matches_the_bridge_ts_wire_shape() {
        let command = BridgeCommand::add_message("hello");
        let value = serde_json::to_value(&command).expect("command serializes");
        assert_eq!(
            value,
            serde_json::json!({
                "type": "add-message",
                "message": {"role": "user", "parts": [{"type": "text", "text": "hello"}]},
                "parentId": null,
                "sourceId": null,
            })
        );
    }

    #[test]
    fn permission_response_derives_call_id_from_the_tool_call_not_the_approval_id() {
        let command =
            BridgeCommand::permission_response("call-1", &ApprovalDecision::Approve);
        let value = serde_json::to_value(&command).expect("command serializes");
        assert_eq!(
            value,
            serde_json::json!({
                "type": "permission-response",
                "callId": "call-1",
                "decision": "allow",
            })
        );

        let denial = BridgeCommand::permission_response(
            "call-2",
            &ApprovalDecision::Deny {
                reason: "unsafe target".into(),
            },
        );
        let value = serde_json::to_value(&denial).expect("command serializes");
        assert_eq!(
            value,
            serde_json::json!({
                "type": "permission-response",
                "callId": "call-2",
                "decision": "reject",
            })
        );
    }

    #[test]
    fn cancel_matches_the_bridge_ts_wire_shape() {
        let value = serde_json::to_value(BridgeCommand::Cancel).expect("command serializes");
        assert_eq!(value, serde_json::json!({ "type": "cancel" }));
    }

    #[test]
    fn run_envelope_omits_attachments_when_none_are_resolved() {
        let envelope = RunEnvelope::send("hi", Vec::new());
        let value = serde_json::to_value(&envelope).expect("envelope serializes");
        assert_eq!(
            value,
            serde_json::json!({
                "commands": [{
                    "type": "add-message",
                    "message": {"role": "user", "parts": [{"type": "text", "text": "hi"}]},
                    "parentId": null,
                    "sourceId": null,
                }],
            })
        );
    }
}
