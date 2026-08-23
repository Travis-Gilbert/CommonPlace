//! Scope-keyed composer state and run commands.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{ResolvedAttachment, ScopeBinding, ThreadRuntime};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct KeyGesture {
    pub enter: bool,
    pub shift: bool,
    pub composing: bool,
}

impl KeyGesture {
    #[must_use]
    pub const fn submits(self) -> bool {
        self.enter && !self.shift && !self.composing
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ComposerAction {
    None,
    Submit,
    Newline,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct RunRequest {
    pub thread_id: String,
    pub scope: ScopeBinding,
    pub text: String,
    pub attachments: Vec<ResolvedAttachment>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ComposerState {
    drafts: BTreeMap<String, String>,
}

impl ComposerState {
    #[must_use]
    pub fn draft(&self, scope: &ScopeBinding) -> &str {
        self.drafts
            .get(&scope.stable_key())
            .map_or("", String::as_str)
    }

    pub fn update_draft(&mut self, scope: &ScopeBinding, draft: impl Into<String>) {
        self.drafts.insert(scope.stable_key(), draft.into());
    }

    #[must_use]
    pub const fn keyboard_action(gesture: KeyGesture) -> ComposerAction {
        if gesture.submits() {
            ComposerAction::Submit
        } else if gesture.enter {
            ComposerAction::Newline
        } else {
            ComposerAction::None
        }
    }

    pub fn send(
        &mut self,
        runtime: &mut ThreadRuntime,
        attachments: Vec<ResolvedAttachment>,
    ) -> Option<RunRequest> {
        let key = runtime.scope.stable_key();
        let text = self.drafts.get(&key)?.trim().to_owned();
        if text.is_empty() {
            return None;
        }
        self.drafts.insert(key, String::new());
        runtime.start_user_message(text.clone());
        Some(RunRequest {
            thread_id: runtime.thread_id.clone(),
            scope: runtime.scope.clone(),
            text,
            attachments,
        })
    }

    pub fn cancel(runtime: &mut ThreadRuntime) {
        runtime.abort();
    }

    #[must_use]
    pub fn edit_and_resend(
        runtime: &mut ThreadRuntime,
        event_index: usize,
        replacement: impl Into<String>,
    ) -> crate::BranchId {
        runtime.edit_and_resend(event_index, replacement)
    }
}

#[cfg(test)]
mod tests {
    use crate::{KnownStreamPart, StreamPart};

    use super::*;

    #[test]
    fn draft_survives_surface_switch_at_same_binding_and_cancel_keeps_partial() {
        let scope = ScopeBinding::Node {
            node_id: "node-1".into(),
        };
        let mut composer = ComposerState::default();
        composer.update_draft(&scope, "unfinished draft");
        let other_surface_same_scope = scope.clone();
        assert_eq!(
            composer.draft(&other_surface_same_scope),
            "unfinished draft"
        );

        let mut runtime = ThreadRuntime::new("thread-1", scope);
        runtime.apply_part(StreamPart::Known(KnownStreamPart::TextDelta {
            id: "text-1".into(),
            delta: "partial answer".into(),
            provider_metadata: None,
        }));
        ComposerState::cancel(&mut runtime);
        assert_eq!(runtime.active_branch().assistant_text, "partial answer");
        assert!(runtime.active_branch().partial);
    }

    #[test]
    fn enter_submits_but_shift_enter_and_ime_do_not() {
        assert_eq!(
            ComposerState::keyboard_action(KeyGesture {
                enter: true,
                shift: false,
                composing: false,
            }),
            ComposerAction::Submit
        );
        assert_eq!(
            ComposerState::keyboard_action(KeyGesture {
                enter: true,
                shift: true,
                composing: false,
            }),
            ComposerAction::Newline
        );
        assert_eq!(
            ComposerState::keyboard_action(KeyGesture {
                enter: true,
                shift: false,
                composing: true,
            }),
            ComposerAction::Newline
        );
    }
}
