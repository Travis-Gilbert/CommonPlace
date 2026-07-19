//! SPEC-COMMONPLACE-BROWSER-SHELL — the Servo-free half of the pane host.
//!
//! The pane host is one process that owns one Servo engine and speaks
//! `pane-protocol` over stdio. Everything in that process except the engine
//! binding lives here: the protocol loop (B2), the session graph (B3), the
//! attention gate (B5), the highlighter (B6), and navigation safety (B7).
//!
//! It is split this way for one blunt reason. `browser-embed` links libservo,
//! which cannot be built without `mach bootstrap` and half an hour, so any
//! logic that lived beside it could only be exercised in CI. Behind
//! [`engine::Engine`] all of it is exercised by `cargo test` on a laptop, and
//! the crate that does link Servo (`pane-host-servo`) is a mapping layer thin
//! enough to read in one sitting.
//!
//! The chrome side links this crate too, for [`session`]: the plugin owns pane
//! lifecycle and the host owns navigation, and both write the same node shapes.

pub mod attention;
pub mod engine;
pub mod highlight;
pub mod nav;
pub mod server;
pub mod session;

pub use engine::{Engine, EngineError, EngineEvent, EngineResult};
pub use server::Host;
pub use session::{GraphTransport, LocalNode, RestoredPane, SessionGraph};

#[cfg(test)]
mod tests;
