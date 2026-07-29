//! The one abstraction this crate allows itself: the rendering engine.
//!
//! It exists for a specific, non-negotiable reason. `browser-embed` links
//! libservo, which needs `mach bootstrap` and half an hour from cold, so a
//! developer cannot build it on the machine they are writing this logic on. If
//! the protocol loop, the session graph, the attention gate, and the
//! highlighter all spoke to `EmbeddedServo` directly, none of them could be
//! tested anywhere but CI. Behind this trait they are all testable with a fake,
//! and the real `EmbeddedServo` implementation is a thin mapping layer that
//! lives in the one crate that does link Servo.
//!
//! The trait deliberately mirrors `browser_embed::EmbeddedServo` rather than
//! inventing a nicer shape: an adapter that reorders or reinterprets would be a
//! second place for behaviour to live.

use pane_protocol::{Bounds, ErrorKind, PaneError, PaneId, ParentSurface};

/// What the engine tells the host, unprompted.
///
/// A strict subset of `pane_protocol::PaneEvent`: the protocol's
/// `NavigationRefused`, `AttentionSpan` and `AttentionChanged` are host
/// concerns (B7, B5) and never come from the engine.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EngineEvent {
    LoadStart { pane: PaneId, url: String },
    LoadStable { pane: PaneId, url: String },
    TitleChanged { pane: PaneId, title: String },
    UrlChanged { pane: PaneId, url: String },
    Crashed { pane: PaneId, reason: String },
}

impl EngineEvent {
    pub fn pane(&self) -> PaneId {
        match self {
            EngineEvent::LoadStart { pane, .. }
            | EngineEvent::LoadStable { pane, .. }
            | EngineEvent::TitleChanged { pane, .. }
            | EngineEvent::UrlChanged { pane, .. }
            | EngineEvent::Crashed { pane, .. } => *pane,
        }
    }
}

/// An engine failure, already carrying the kind the chrome will render.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EngineError {
    pub kind: ErrorKind,
    pub message: String,
}

impl EngineError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn unknown_pane(pane: PaneId) -> Self {
        Self::new(ErrorKind::UnknownPane, format!("no open pane {pane}"))
    }

    pub fn engine(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Engine, message)
    }
}

impl From<EngineError> for PaneError {
    fn from(error: EngineError) -> Self {
        PaneError::new(error.kind, error.message)
    }
}

pub type EngineResult<T = ()> = Result<T, EngineError>;

/// One process, one engine, N panes.
///
/// `&mut self` throughout because the concrete engine is single-threaded and
/// `Rc`-based; pretending otherwise would only push the lie downstream.
pub trait Engine {
    fn create_pane(
        &mut self,
        pane: PaneId,
        parent: ParentSurface,
        bounds: Bounds,
        url: &str,
    ) -> EngineResult;
    fn navigate(&mut self, pane: PaneId, url: &str) -> EngineResult;
    fn back(&mut self, pane: PaneId) -> EngineResult;
    fn forward(&mut self, pane: PaneId) -> EngineResult;
    fn reload(&mut self, pane: PaneId) -> EngineResult;
    fn set_bounds(&mut self, pane: PaneId, bounds: Bounds) -> EngineResult;
    fn set_visible(&mut self, pane: PaneId, visible: bool) -> EngineResult;
    fn close(&mut self, pane: PaneId) -> EngineResult;
    fn evaluate_js(&mut self, pane: PaneId, script: &str) -> EngineResult<String>;

    /// Drain, not peek: an event delivered twice would double-write the session
    /// graph.
    fn poll_events(&mut self) -> Vec<EngineEvent>;

    /// Pump the engine once. The host owns the cadence.
    fn spin(&mut self);

    /// PNG bytes of the pane.
    ///
    /// Defaulted to a refusal because the B1 embedding does not expose a
    /// capture API. An engine that grows one overrides this; until then the
    /// chrome gets a typed "not available" rather than a hang.
    fn screenshot(&mut self, pane: PaneId) -> EngineResult<Vec<u8>> {
        Err(EngineError::new(
            ErrorKind::Unavailable,
            format!("this engine cannot capture {pane}"),
        ))
    }

    /// Focus or blur the pane. Default refuses; ServoEngine implements.
    fn set_focused(&mut self, pane: PaneId, focused: bool) -> EngineResult {
        let _ = focused;
        Err(EngineError::new(
            ErrorKind::Unavailable,
            format!("this engine cannot focus {pane}"),
        ))
    }

    fn inject_key(
        &mut self,
        pane: PaneId,
        key: &str,
        code: &str,
        down: bool,
    ) -> EngineResult {
        let _ = (key, code, down);
        Err(EngineError::new(
            ErrorKind::Unavailable,
            format!("this engine cannot inject keyboard into {pane}"),
        ))
    }

    fn inject_ime(
        &mut self,
        pane: PaneId,
        composition: Option<&str>,
        commit: Option<&str>,
    ) -> EngineResult {
        let _ = (composition, commit);
        Err(EngineError::new(
            ErrorKind::Unavailable,
            format!("this engine cannot inject IME into {pane}"),
        ))
    }

    fn set_overlay(
        &mut self,
        pane: PaneId,
        atoms: &[pane_protocol::OverlayAtom],
    ) -> EngineResult {
        let _ = atoms;
        Err(EngineError::new(
            ErrorKind::Unavailable,
            format!("this engine cannot set overlays on {pane}"),
        ))
    }
}
