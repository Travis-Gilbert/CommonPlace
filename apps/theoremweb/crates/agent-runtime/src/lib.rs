//! Complete Rust UI-message runtime for `TheoremWeb` agent surfaces.
//!
//! One [`ThreadRuntime`] owns streamed parts, approvals, attachments, and the
//! branch graph. UI modules project that runtime; they do not create a second
//! thread store.

pub mod approval;
pub mod attachments;
pub mod composer;
pub mod parts;
pub mod render;
pub mod scope;
pub mod sse;
pub mod thread;

pub use approval::{ApprovalCommand, ApprovalDecision, ApprovalStatus, PendingApproval};
pub use attachments::{
    AttachmentDraft, AttachmentError, DocumentResolver, ResolvedAttachment, ResolvedDocument,
};
pub use composer::{ComposerAction, ComposerState, KeyGesture, RunRequest};
pub use parts::{parse_part_json, KnownStreamPart, StreamPart};
pub use render::{render_part, RenderedPart, ThreadView};
pub use scope::{ScopeBinding, ScopeChip};
pub use sse::{parse_sse_chunk, parse_sse_stream, SseEvent};
pub use thread::{BranchId, RunState, ThreadBranch, ThreadEvent, ThreadRuntime};
