//! The stateful, interactive agent-runtime surface.
//!
//! [`super::ThreadView`] is a pure historical projection: it renders every
//! stream part but has nothing to click. This component is what AC5 means
//! by a product surface: it owns no thread state of its own (the same "no
//! second authority" rule the layout surface documents for its record data)
//! and instead projects the caller's [`ThreadRuntime`] plus emits one
//! [`AgentAction`] per real gesture. Purely ephemeral UI state that never
//! needs to survive a lost prop update -- the composer draft, attachment
//! drafts, and per-approval deny reasons -- lives in local signals, the same
//! split `LayoutSurface` makes between server-owned geometry and in-flight
//! drag state.

use std::collections::BTreeMap;

use dioxus::prelude::*;

use crate::action::AgentAction;
use crate::attachments::{AttachmentDraft, DocumentIndex};
use crate::composer::{ComposerAction, ComposerState, KeyGesture};
use crate::render::{part_kind_name, render_part};
use crate::scope::ScopeChip;
use crate::thread::{RunState, ThreadEvent, ThreadRuntime};

#[derive(Clone, PartialEq, Props)]
pub struct AgentThreadSurfaceProps {
    pub thread: ThreadRuntime,
    #[props(default)]
    pub documents: DocumentIndex,
    pub on_navigate: EventHandler<String>,
    pub on_action: EventHandler<AgentAction>,
}

/// Mount the full interactive agent surface for one thread.
#[allow(
    non_snake_case,
    clippy::too_many_lines,
    clippy::missing_errors_doc
)]
pub fn AgentThreadSurface(props: AgentThreadSurfaceProps) -> Element {
    let AgentThreadSurfaceProps {
        thread,
        documents,
        on_navigate,
        on_action,
    } = props;

    let mut draft = use_signal(String::new);
    let mut edit_target = use_signal(|| Option::<usize>::None);
    let mut attachment_input = use_signal(String::new);
    let mut attachment_drafts = use_signal(Vec::<AttachmentDraft>::new);
    let mut deny_drafts = use_signal(BTreeMap::<String, String>::new);

    let branch = thread.active_branch().clone();
    let chip = ScopeChip::from(&thread.scope);
    let navigate_intent = thread.scope.navigate_intent();
    let branches = thread.branches().map(|b| b.branch_id).collect::<Vec<_>>();
    let active_branch_id = thread.active_branch_id();
    let can_cancel = matches!(thread.run, RunState::Streaming | RunState::AwaitingApproval);
    let pending_approvals = thread.pending_approvals().cloned().collect::<Vec<_>>();
    let rendered_parts = branch.parts.iter().map(render_part).collect::<Vec<_>>();

    let mut submit = {
        let submit_documents = documents.clone();
        move || {
            let text = draft();
            if text.trim().is_empty() {
                return;
            }
            let action = if let Some(event_index) = edit_target() {
                AgentAction::EditAndResend {
                    event_index,
                    replacement: text,
                }
            } else {
                let resolved = attachment_drafts()
                    .iter()
                    .filter_map(|item| item.resolve(&submit_documents).ok())
                    .collect();
                AgentAction::Send {
                    text,
                    attachments: resolved,
                }
            };
            on_action.call(action);
            draft.set(String::new());
            edit_target.set(None);
            attachment_drafts.set(Vec::new());
            attachment_input.set(String::new());
        }
    };
    let mut submit_click = submit.clone();

    rsx! {
        section { class: "theorem-agent-thread", "data-run": "{run_state_name(&thread.run)}",
            header { class: "theorem-agent-thread-header",
                button {
                    class: "theorem-scope-chip",
                    "data-scope": "{chip.target.stable_key()}",
                    disabled: navigate_intent.is_none(),
                    onclick: move |_| {
                        if let Some(intent) = &navigate_intent {
                            on_navigate.call(intent.clone());
                        }
                    },
                    "{chip.label}"
                }
                if branch.partial {
                    span { class: "theorem-partial-label", "Partial response" }
                }
                if branches.len() > 1 {
                    nav { class: "theorem-branch-switcher", "aria-label": "Thread branches",
                        for branch_id in branches {
                            button {
                                key: "{branch_id}",
                                "data-branch-id": "{branch_id}",
                                "data-active": "{branch_id == active_branch_id}",
                                onclick: move |_| on_action.call(AgentAction::SwitchBranch(branch_id)),
                                "Branch {branch_id}"
                            }
                        }
                    }
                }
                if can_cancel {
                    button {
                        class: "theorem-agent-cancel",
                        "data-action": "cancel",
                        onclick: move |_| on_action.call(AgentAction::Cancel),
                        "Cancel"
                    }
                }
            }

            if !pending_approvals.is_empty() {
                section { class: "theorem-agent-approvals", "aria-label": "Pending approvals",
                    for approval in pending_approvals {
                        article {
                            key: "{approval.approval_id}",
                            class: "theorem-agent-approval",
                            "data-approval-id": "{approval.approval_id}",
                            "data-tool-call-id": "{approval.tool_call_id}",
                            p { "Approval requested for {approval.tool_call_id}" }
                            input {
                                r#type: "text",
                                placeholder: "Reason for denial (optional)",
                                "aria-label": "Denial reason",
                                value: "{deny_drafts().get(&approval.approval_id).cloned().unwrap_or_default()}",
                                oninput: {
                                    let approval_id = approval.approval_id.clone();
                                    move |event| {
                                        deny_drafts.write().insert(approval_id.clone(), event.value());
                                    }
                                },
                            }
                            button {
                                "data-action": "approve",
                                onclick: {
                                    let approval_id = approval.approval_id.clone();
                                    move |_| on_action.call(AgentAction::Approve { approval_id: approval_id.clone() })
                                },
                                "Approve"
                            }
                            button {
                                "data-action": "deny",
                                onclick: {
                                    let approval_id = approval.approval_id;
                                    move |_| {
                                        let reason = deny_drafts().get(&approval_id).cloned().unwrap_or_default();
                                        on_action.call(AgentAction::Deny { approval_id: approval_id.clone(), reason });
                                    }
                                },
                                "Deny"
                            }
                        }
                    }
                }
            }

            div { class: "theorem-agent-events",
                for (index , event) in branch.events.iter().cloned().enumerate() {
                    if let ThreadEvent::UserMessage { text } = event {
                        div {
                            key: "event-{index}",
                            class: "theorem-agent-user-message",
                            "data-event-index": "{index}",
                            p { "{text}" }
                            button {
                                "data-action": "edit-and-resend",
                                onclick: move |_| {
                                    edit_target.set(Some(index));
                                    draft.set(text.clone());
                                },
                                "Edit & resend"
                            }
                        }
                    }
                }
            }

            div { class: "theorem-agent-parts",
                for (index , part) in rendered_parts.iter().enumerate() {
                    article {
                        key: "{index}-{part.label}",
                        class: "theorem-stream-part",
                        "data-part-kind": "{part_kind_name(&part.kind)}",
                        if part.collapsible {
                            details {
                                summary { "{part.label}" }
                                pre { "{part.body}" }
                            }
                        } else {
                            strong { "{part.label}" }
                            pre { "{part.body}" }
                        }
                        if let Some(target) = &part.target {
                            a { href: "{target}", "Open" }
                        }
                    }
                }
            }

            section { class: "theorem-agent-attachments", "aria-label": "Attachments",
                div { class: "theorem-agent-attachment-composer",
                    input {
                        r#type: "text",
                        placeholder: "Graph document id",
                        "aria-label": "Attach a graph document by id",
                        value: "{attachment_input}",
                        oninput: move |event| attachment_input.set(event.value()),
                    }
                    button {
                        "data-action": "attach-document",
                        onclick: move |_| {
                            let document_id = attachment_input();
                            if !document_id.trim().is_empty() {
                                attachment_drafts.write().push(AttachmentDraft::GraphDocument { document_id });
                                attachment_input.set(String::new());
                            }
                        },
                        "Attach"
                    }
                }
                for (index , draft_item) in attachment_drafts().into_iter().enumerate() {
                    div {
                        key: "attachment-{index}",
                        class: "theorem-agent-attachment",
                        match draft_item.resolve(&documents) {
                            Ok(resolved) => rsx! {
                                span { "data-attachment-status": "resolved", "{attachment_summary(&resolved)}" }
                            },
                            Err(error) => rsx! {
                                span { "data-attachment-status": "error", "{error}" }
                            },
                        }
                        button {
                            "data-action": "remove-attachment",
                            onclick: move |_| {
                                attachment_drafts.write().remove(index);
                            },
                            "Remove"
                        }
                    }
                }
            }

            form {
                class: "theorem-agent-composer",
                onsubmit: move |event| {
                    event.prevent_default();
                    submit_click();
                },
                textarea {
                    "aria-label": "Message",
                    value: "{draft}",
                    oninput: move |event| draft.set(event.value()),
                    onkeydown: move |event| {
                        let gesture = KeyGesture {
                            enter: event.key() == Key::Enter,
                            shift: event.modifiers().contains(Modifiers::SHIFT),
                            composing: event.is_composing(),
                        };
                        if ComposerState::keyboard_action(gesture) == ComposerAction::Submit {
                            event.prevent_default();
                            submit();
                        }
                    },
                }
                button { r#type: "submit", "data-action": "send", "Send" }
            }
        }
    }
}

fn attachment_summary(resolved: &crate::attachments::ResolvedAttachment) -> String {
    match resolved {
        crate::attachments::ResolvedAttachment::Image { name, .. } => format!("Image: {name}"),
        crate::attachments::ResolvedAttachment::Document(document) => {
            format!("{} ({} bytes)", document.title, document.content.len())
        }
    }
}

const fn run_state_name(run: &RunState) -> &'static str {
    match run {
        RunState::Idle => "idle",
        RunState::Streaming => "streaming",
        RunState::AwaitingApproval => "awaiting_approval",
        RunState::Finished => "finished",
        RunState::Aborted => "aborted",
        RunState::Errored => "errored",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::attachments::ResolvedDocument;
    use crate::parts::{KnownStreamPart, StreamPart};
    use crate::sse::{parse_sse_stream, SseEvent};
    use crate::scope::ScopeBinding;

    fn thread_with(scope: ScopeBinding) -> ThreadRuntime {
        ThreadRuntime::new("thread-1", scope)
    }

    // `dioxus_ssr::render_element` evaluates its argument as a plain
    // `Element` value before any `VirtualDom`/`Runtime` exists, so a
    // component passed there directly cannot call hooks (`use_signal`
    // panics with "Must be called from inside a Dioxus runtime"). Nesting
    // the real component one level inside this hook-free wrapper gives the
    // renderer's own internal `VirtualDom` machinery a proper scope to run
    // it in -- the same split `crates/layout/src/grid.rs`'s `Harness` test
    // wrapper uses for `LayoutSurface`, which has the identical shape
    // (props struct, no `#[component]` tag, hooks in its own body).
    #[allow(non_snake_case)]
    #[component]
    fn Harness(thread: ThreadRuntime, documents: DocumentIndex) -> Element {
        rsx! {
            AgentThreadSurface {
                thread,
                documents,
                on_navigate: move |_| {},
                on_action: move |_| {},
            }
        }
    }

    fn render(thread: ThreadRuntime) -> String {
        dioxus_ssr::render_element(rsx! {
            Harness { thread, documents: DocumentIndex::new() }
        })
    }

    #[test]
    fn renders_a_navigable_record_scope_chip_and_all_parts() {
        let mut thread = thread_with(ScopeBinding::Record {
            object_type: "company".into(),
            record_id: "acme".into(),
        });
        for event in parse_sse_stream(include_str!("../../fixtures/all-parts.sse")).unwrap() {
            if let SseEvent::Part(part) = event {
                thread.apply_part(part);
            }
        }
        let html = render(thread);
        assert!(html.contains("data-scope=\"record:company:acme\""));
        assert!(!html.contains("disabled"));
        assert!(html.contains("Data: weather"));
        // The fixture's approval is already resolved (denied) by the end of
        // the stream, so the historical projection shows it, but there is
        // nothing left in `pending_approvals` to bind the live banner to.
        assert!(html.contains("Approval pending"));
        assert!(html.contains("Approval denied"));
        assert!(!html.contains("Approval requested for"));
    }

    #[test]
    fn a_pending_approval_renders_the_live_approve_and_deny_banner() {
        let mut thread = thread_with(ScopeBinding::Workspace);
        thread.apply_part(StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
            approval_id: "approval-9".into(),
            tool_call_id: "call-9".into(),
            is_automatic: None,
            signature: None,
        }));
        let html = render(thread);
        assert!(html.contains("Approval requested for call-9"));
        assert!(html.contains("data-approval-id=\"approval-9\""));
        assert!(html.contains("data-tool-call-id=\"call-9\""));
        assert!(html.contains("data-action=\"approve\""));
        assert!(html.contains("data-action=\"deny\""));
    }

    #[test]
    fn a_non_navigable_scope_renders_a_disabled_chip_rather_than_a_fake_link() {
        let thread = thread_with(ScopeBinding::Canvas {
            canvas_id: "canvas-1".into(),
        });
        let html = render(thread);
        assert!(html.contains("disabled"));
    }

    #[test]
    fn cancel_only_renders_while_a_run_is_active() {
        let mut thread = thread_with(ScopeBinding::Workspace);
        let idle_html = render(thread.clone());
        assert!(!idle_html.contains("data-action=\"cancel\""));

        thread.apply_part(StreamPart::Known(KnownStreamPart::TextStart {
            id: "text-1".into(),
            provider_metadata: None,
        }));
        let streaming_html = render(thread);
        assert!(streaming_html.contains("data-action=\"cancel\""));
    }

    #[test]
    fn branch_switcher_only_renders_once_a_second_branch_exists() {
        let mut thread = thread_with(ScopeBinding::Workspace);
        thread.start_user_message("first");
        let single_html = render(thread.clone());
        assert!(!single_html.contains("theorem-branch-switcher"));

        let _ = thread.edit_and_resend(0, "second");
        let multi_html = render(thread);
        assert!(multi_html.contains("theorem-branch-switcher"));
        assert!(multi_html.contains("data-branch-id=\"0\""));
        assert!(multi_html.contains("data-branch-id=\"1\""));
    }

    #[test]
    fn a_resolved_attachment_shows_its_content_and_an_unresolved_one_names_the_error() {
        let mut documents = DocumentIndex::new();
        documents.insert(ResolvedDocument {
            document_id: "doc-1".into(),
            title: "Runbook".into(),
            media_type: "text/markdown".into(),
            content: "steps".into(),
        });
        let resolved = AttachmentDraft::GraphDocument {
            document_id: "doc-1".into(),
        }
        .resolve(&documents)
        .unwrap();
        assert_eq!(attachment_summary(&resolved), "Runbook (5 bytes)");

        let error = AttachmentDraft::GraphDocument {
            document_id: "doc-absent".into(),
        }
        .resolve(&documents)
        .unwrap_err();
        assert_eq!(error.to_string(), "graph document not found: doc-absent");
    }

    #[test]
    fn user_messages_carry_an_edit_and_resend_affordance() {
        let mut thread = thread_with(ScopeBinding::Workspace);
        thread.start_user_message("original");
        let html = render(thread);
        assert!(html.contains("data-event-index=\"0\""));
        assert!(
            html.contains("Edit &amp; resend")
                || html.contains("Edit &#38; resend")
                || html.contains("Edit & resend")
        );
    }
}
