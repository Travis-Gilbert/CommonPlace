//! Complete Rust UI-message runtime for `TheoremWeb` agent surfaces.
//!
//! One [`ThreadRuntime`] owns streamed parts, approvals, attachments, and the
//! branch graph. UI modules project that runtime; they do not create a second
//! thread store.

pub mod action;
pub mod approval;
pub mod attachments;
pub mod bridge;
pub mod composer;
pub mod parts;
pub mod render;
pub mod scope;
pub mod sse;
pub mod thread;

pub use action::{ActionOutcome, AgentAction};
pub use approval::{ApprovalDecision, ApprovalStatus, PendingApproval};
pub use attachments::{
    AttachmentDraft, AttachmentError, DocumentIndex, DocumentResolver, ResolvedAttachment,
    ResolvedDocument,
};
pub use bridge::{
    BridgeCommand, BridgeDecision, BridgeMessage, BridgeMessageRole, BridgeTextPart,
    BridgeTextPartKind, RunEnvelope,
};
pub use composer::{ComposerAction, ComposerState, KeyGesture, RunRequest};
pub use parts::{parse_part_json, KnownStreamPart, StreamPart};
pub use render::{render_part, AgentThreadSurface, RenderedPart, ThreadView};
pub use scope::{ScopeBinding, ScopeChip};
pub use sse::{parse_sse_chunk, parse_sse_stream, SseEvent};
pub use thread::{BranchId, RunState, ThreadBranch, ThreadEvent, ThreadRuntime};
