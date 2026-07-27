//! SPEC-THEOREM-CONTROL-PRIMITIVES-1.0.
//!
//! Pure control plane primitives (CP1–CP6). Mirror targets when Theorem is
//! available:
//! - CP1 `rustyred-thg-core/src/events.rs`
//! - CP2 `rustyred-thg-mcp/src/webhooks.rs`
//! - CP3 `rustyred-thg-mcp/src/navigation.rs`
//! - CP4 `rustyred-thg-core/src/revisable.rs`
//! - CP5 `rustyred-thg-mcp/src/step_schema.rs`
//! - CP6 `rustyred-thg-mcp/src/plan_substrate.rs` (extend)

pub mod event_log;
pub mod events;
pub mod navigation;
pub mod plan_validate;
pub mod revisable;
pub mod step_schema;
pub mod webhooks;

pub use event_log::EventLog;
pub use events::{
    compile_operation, match_operation, parse_compiled, record_write_event, schema_declare_event,
    EventEnvelope, EventOperation, MetadataOperation, MetadataSelector, ObjectSelector, RecordEvent,
};
pub use navigation::{
    derive_label, NavItem, NavItemKind, NavScope, NavigationRegistry, NavigationError,
};
pub use plan_validate::{
    AvailablePath, JsonTypeTag, PlanGraph, PlanTaskDef, TaskId, ValidationIssue, ValidationReport,
    validate_plan, mutation_summary,
};
pub use revisable::{
    draft_from, publish, supersede, PublishReceipt, Revisable, RevisionError, RevisionId,
    RevisionState,
};
pub use step_schema::{
    compute_step_output_schema, AffordanceManifest, FieldSpec, JsonSchema, StepDefinition,
    StepSchemaUnknown,
};
pub use webhooks::{
    DeliveryAttempt, DeliveryOutcome, WebhookDeadLetter, WebhookError, WebhookStore,
    WebhookSubscription,
};
