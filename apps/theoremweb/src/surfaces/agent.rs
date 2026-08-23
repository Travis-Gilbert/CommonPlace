//! The stateful agent-runtime product surface.
//!
//! W05 / AC5. This is the seam between a resolved surface row bound to
//! `body_kind == "thread"` and the from-scratch UI-message runtime: it
//! translates the host's `ScopeBinding` into the runtime crate's own binding
//! (the same duplication `surfaces::layout::layout_scope` documents and pins
//! with a test, extended here to a third crate), and mounts the single
//! interactive `AgentThreadSurface` component.
//!
//! All thread state -- streamed parts, approvals, the branch graph -- lives
//! in the `ThreadRuntime` the host already owns; this seam creates no second
//! authority over it and performs no mutation of its own. Every gesture the
//! surface emits comes out as one `AgentAction`, which the host applies via
//! `ThreadRuntime::apply_action` and, when that returns
//! `ActionOutcome::Dispatch`, sends over the bridge. See the W05 handoff for
//! the exact wiring this seam expects `app.rs`/`main.rs` to grow; neither is
//! in this node's declared scope.

use dioxus::prelude::*;
use theoremweb_agent_runtime::{
    AgentAction, AgentThreadSurface, DocumentIndex, ScopeBinding as AgentScope, ThreadRuntime,
};
use theoremweb_app::ScopeBinding as SurfaceScope;

/// Translate a mounted surface's binding into the agent-runtime crate's
/// binding.
///
/// Three crates now declare a byte-identical `ScopeBinding`: `app`,
/// `layout`, and `agent-runtime`. Collapsing them onto one authority is
/// outside this node's declared scope, so the translation is explicit here,
/// mirrors `surfaces::layout::layout_scope` exactly, and is pinned by a test
/// rather than left to a silent structural coincidence.
#[must_use]
pub fn agent_scope(binding: &SurfaceScope) -> AgentScope {
    match binding {
        SurfaceScope::Workspace => AgentScope::Workspace,
        SurfaceScope::Canvas { canvas_id } => AgentScope::Canvas {
            canvas_id: canvas_id.clone(),
        },
        SurfaceScope::Node { node_id } => AgentScope::Node {
            node_id: node_id.clone(),
        },
        SurfaceScope::Record {
            object_type,
            record_id,
        } => AgentScope::Record {
            object_type: object_type.clone(),
            record_id: record_id.clone(),
        },
        SurfaceScope::Document { document_id } => AgentScope::Document {
            document_id: document_id.clone(),
        },
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct AgentMountProps {
    /// The host's single authority over this thread's state. Constructing
    /// one for a scope not seen before, and deciding when a scope switch
    /// starts a fresh thread versus resumes a stored one, is host state
    /// management (`main.rs`), not this seam's concern.
    pub thread: ThreadRuntime,
    /// Graph documents the host already holds for this scope, attachable
    /// without a second fetch. `theoremweb_app::ScopeContext.documents`
    /// carries the candidate ids; resolving them into `ResolvedDocument`
    /// values is host-side and out of this node's declared scope.
    #[props(default)]
    pub documents: DocumentIndex,
    pub on_navigate: EventHandler<String>,
    pub on_action: EventHandler<AgentAction>,
}

/// Mount the interactive agent thread for a `body_kind == "thread"` region.
#[allow(non_snake_case, clippy::missing_errors_doc)]
pub fn AgentMount(props: AgentMountProps) -> Element {
    let AgentMountProps {
        thread,
        documents,
        on_navigate,
        on_action,
    } = props;
    rsx! {
        AgentThreadSurface { thread, documents, on_navigate, on_action }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_surface_and_agent_scope_bindings_still_agree() {
        // Mirrors `surfaces::layout`'s equivalent test: the match in
        // `agent_scope` is exhaustive, so a variant added on the app side
        // fails to compile here, and this covers the other half, that the
        // two sides still serialize to the same wire shape.
        let cases = [
            (SurfaceScope::Workspace, AgentScope::Workspace),
            (
                SurfaceScope::Canvas {
                    canvas_id: "commands".into(),
                },
                AgentScope::Canvas {
                    canvas_id: "commands".into(),
                },
            ),
            (
                SurfaceScope::Node {
                    node_id: "node-1".into(),
                },
                AgentScope::Node {
                    node_id: "node-1".into(),
                },
            ),
            (
                SurfaceScope::Record {
                    object_type: "company".into(),
                    record_id: "acme".into(),
                },
                AgentScope::Record {
                    object_type: "company".into(),
                    record_id: "acme".into(),
                },
            ),
            (
                SurfaceScope::Document {
                    document_id: "doc-1".into(),
                },
                AgentScope::Document {
                    document_id: "doc-1".into(),
                },
            ),
        ];
        for (from, want) in cases {
            assert_eq!(agent_scope(&from), want);
            assert_eq!(
                serde_json::to_value(&from).expect("surface scope serializes"),
                serde_json::to_value(&want).expect("agent scope serializes"),
            );
        }
    }

    #[allow(non_snake_case)]
    #[component]
    fn Harness(thread: ThreadRuntime) -> Element {
        rsx! {
            AgentMount {
                thread,
                on_navigate: move |_| {},
                on_action: move |_| {},
            }
        }
    }

    #[test]
    fn the_mount_renders_the_real_interactive_surface_not_a_placeholder() {
        let thread = ThreadRuntime::new("thread-1", AgentScope::Workspace);
        let html = dioxus_ssr::render_element(rsx! { Harness { thread } });
        assert!(html.contains("theorem-agent-thread"));
        assert!(html.contains("data-action=\"send\""));
        assert!(html.contains("theorem-agent-composer"));
    }
}
