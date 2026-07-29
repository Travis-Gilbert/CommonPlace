//! SPEC-COMMONPLACE-BROWSER-SHELL B2 — the pane-host wire contract.
//! SPEC-THEOREM-BUILD-GRAPH-1.0 BG2 — versioned wire crate.
//!
//! # Semver
//!
//! - **Patch**: docs, non-serialized helpers, test-only changes.
//! - **Breaking while pre-1.0**: every serialized enum or field change requires
//!   a minor crate bump and a matching `WIRE_VERSION` bump. Bincode enum
//!   discriminants are positional, so even adding a variant is wire-breaking.
//! - **Breaking after 1.0**: the same changes require a major crate bump.
//!
//! Every frame carries a magic and exact wire version before its bincode
//! payload. Mixed peers are refused at the framing boundary; they are never
//! expected to ignore unknown variants.
//!
//! Conformance: `cargo test --manifest-path crates/pane-protocol/Cargo.toml`
//! is the two-sided suite; both repos run it against this crate.
//!
//! The architecture this serves (Option B in the spec): the trusted chrome is
//! the Next.js app in the Tauri system webview; untrusted content renders in
//! Servo instances that live in ONE dedicated `pane-host` process. The chrome
//! process never links Servo. Everything they say to each other crosses stdio
//! as length-prefixed bincode, and this crate is the only thing both sides
//! agree on.
//!
//! Direction matters and is encoded in the types:
//!
//! ```text
//!   chrome ──► pane-host   Envelope<Request>   (correlated by `id`)
//!   chrome ◄── pane-host   Outbound            (Response{id,..} or Event{..})
//! ```
//!
//! Events are NOT responses. A `LoadStable` or a `Crashed` arrives whenever the
//! engine has something to say, with no request to correlate against, so a
//! reader must be prepared for an event to interleave between a request and its
//! response.
//!
//! One design constraint worth stating out loud: the pane host may die. The
//! supervisor restarts it and re-creates panes from the session graph, so every
//! type here must be reconstructible from persisted state — which is why
//! `PaneId` is a plain `u64` the chrome assigns, not a handle the host mints.

use std::io::{self, Read, Write};

use serde::{Deserialize, Serialize};

/// Maximum frame size. A `Screenshot` response is the only large payload, and a
/// bound keeps a corrupt length prefix from becoming an allocation bomb.
pub const MAX_FRAME_BYTES: u32 = 64 * 1024 * 1024;
pub const WIRE_MAGIC: [u8; 4] = *b"CPPN";
pub const WIRE_VERSION: u16 = 2;
const WIRE_HEADER_BYTES: usize = WIRE_MAGIC.len() + std::mem::size_of::<u16>();

/// Stable identifier for a pane. Assigned by the CHROME, not the host: when the
/// host crashes and the supervisor rebuilds panes from the session graph, the
/// ids must survive, and only the chrome's persisted state can guarantee that.
#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct PaneId(pub u64);

impl std::fmt::Display for PaneId {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "pane:{}", self.0)
    }
}

/// A pane's rectangle in physical device pixels, relative to the parent window.
///
/// Device pixels, not CSS pixels: the chrome measures a DOM box with a
/// `ResizeObserver` in CSS pixels and multiplies by `devicePixelRatio` before
/// sending it, because the native child surface is positioned in the window
/// server's coordinate space, which knows nothing about CSS.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Bounds {
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    /// A zero-area pane cannot render and must not be handed to the engine.
    pub fn is_empty(&self) -> bool {
        self.width == 0 || self.height == 0
    }
}

/// The parent window a pane's native surface is reparented into.
///
/// Platform identifiers are kept dependency-free here so the protocol does
/// not pull a windowing stack into either peer. Only identifiers that are valid
/// across processes may be used by an engine. The AppKit, X11, and Wayland
/// pointer-shaped variants are retained for wire compatibility but current
/// out-of-process hosts refuse them until an exported-surface transport exists.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum ParentSurface {
    /// macOS: the `NSView` pointer of the host window's content view.
    AppKit { ns_view: u64 },
    /// Windows: the parent `HWND`.
    Win32 { hwnd: u64 },
    /// Linux/X11: the parent `Window` xid plus its display connection.
    X11 { window: u64, display: u64 },
    /// Linux/Wayland: the parent `wl_surface` and its `wl_display`.
    Wayland { surface: u64, display: u64 },
}

impl ParentSurface {
    /// Short label for logs, receipts, and the build report's "which OS paths
    /// were actually exercised" table.
    pub fn platform(&self) -> &'static str {
        match self {
            ParentSurface::AppKit { .. } => "appkit",
            ParentSurface::Win32 { .. } => "win32",
            ParentSurface::X11 { .. } => "x11",
            ParentSurface::Wayland { .. } => "wayland",
        }
    }
}

/// A quote-anchored text span, in the shape of a W3C `TextQuoteSelector`.
///
/// B6 asks the highlighter to map extraction spans onto DOM ranges. Offsets
/// alone are not durable across a re-render, so each span carries the exact
/// quote plus the text immediately before and after it. `prefix`/`suffix` are
/// what disambiguates a quote that appears more than once on the page — without
/// them, "the" would highlight the first "the".
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct TextSpan {
    /// Character offset into the extraction's text, retained so a caller can
    /// map a highlight back to the document it came from.
    pub start: usize,
    pub end: usize,
    /// The exact text to anchor on.
    pub quote: String,
    /// Text immediately preceding `quote`, for occurrence disambiguation.
    #[serde(default)]
    pub prefix: String,
    /// Text immediately following `quote`.
    #[serde(default)]
    pub suffix: String,
}

/// Chrome -> host.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Request {
    /// Create a pane parented into `parent` at `bounds`, loading `url`.
    Create {
        pane: PaneId,
        parent: ParentSurface,
        bounds: Bounds,
        url: String,
    },
    Navigate {
        pane: PaneId,
        url: String,
    },
    Back {
        pane: PaneId,
    },
    Forward {
        pane: PaneId,
    },
    Reload {
        pane: PaneId,
    },
    SetBounds {
        pane: PaneId,
        bounds: Bounds,
    },
    /// Tab switching: hide rather than destroy, so the visit chain and engine
    /// state survive a switch away and back.
    SetVisible {
        pane: PaneId,
        visible: bool,
    },
    Close {
        pane: PaneId,
    },
    EvaluateJs {
        pane: PaneId,
        script: String,
    },
    /// B5. Off by default; `false` stops sampling entirely, it does not merely
    /// discard results.
    SetAttention {
        pane: PaneId,
        on: bool,
    },
    /// B6. Replaces the current highlight set; an empty vec clears it.
    Highlight {
        pane: PaneId,
        spans: Vec<TextSpan>,
    },
    ClearHighlight {
        pane: PaneId,
    },
    Screenshot {
        pane: PaneId,
    },
    /// Focus or blur the Servo pane (SR-008 / BG input seam).
    SetFocus {
        pane: PaneId,
        focused: bool,
    },
    /// Keyboard key transition injected into the focused pane.
    InjectKey {
        pane: PaneId,
        key: String,
        code: String,
        down: bool,
    },
    /// IME composition update and/or commit text.
    InjectIme {
        pane: PaneId,
        composition: Option<String>,
        commit: Option<String>,
    },
    /// SceneOS-shaped overlay atoms (presence / takeover / find).
    SetOverlay {
        pane: PaneId,
        atoms: Vec<OverlayAtom>,
    },
    /// Liveness probe used by the supervisor.
    Ping,
}

/// Overlay atom drawn through the SceneOS producer seam.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OverlayAtom {
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub label: String,
}

impl Request {
    /// The pane this request addresses, when it addresses one.
    pub fn pane(&self) -> Option<PaneId> {
        match self {
            Request::Create { pane, .. }
            | Request::Navigate { pane, .. }
            | Request::Back { pane }
            | Request::Forward { pane }
            | Request::Reload { pane }
            | Request::SetBounds { pane, .. }
            | Request::SetVisible { pane, .. }
            | Request::Close { pane }
            | Request::EvaluateJs { pane, .. }
            | Request::SetAttention { pane, .. }
            | Request::Highlight { pane, .. }
            | Request::ClearHighlight { pane }
            | Request::Screenshot { pane }
            | Request::SetFocus { pane, .. }
            | Request::InjectKey { pane, .. }
            | Request::InjectIme { pane, .. }
            | Request::SetOverlay { pane, .. } => Some(*pane),
            Request::Ping => None,
        }
    }
}

/// Why the host refused or failed a request. Typed so the chrome can render a
/// real message instead of a generic failure — B7 requires the scheme refusal
/// to reach the user as something they can understand.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum ErrorKind {
    /// No pane with that id (often: the host restarted and has not been
    /// re-seeded yet).
    UnknownPane,
    /// The URL did not parse or could not be canonicalized.
    InvalidUrl,
    /// B7: the scheme is not in the content-pane allowlist (http, https, about).
    /// `file://` lands here.
    SchemeRefused,
    /// The engine itself failed.
    Engine,
    /// The host is alive but cannot serve this yet.
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PaneError {
    pub kind: ErrorKind,
    /// Human-readable, and meant to be shown. Written for the person who typed
    /// the URL, not for the log.
    pub message: String,
}

impl PaneError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn unknown_pane(pane: PaneId) -> Self {
        Self::new(ErrorKind::UnknownPane, format!("no open pane {pane}"))
    }
}

/// The value half of a successful response.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ResponseValue {
    /// The request completed and carries no value.
    Ack,
    /// `EvaluateJs` result, as the JSON text the script produced.
    Js { value: String },
    /// PNG bytes. Left as bytes rather than base64 so the framing pays for the
    /// size once instead of inflating it by a third.
    Screenshot { png: Vec<u8> },
    /// `Navigate`/`Create` accepted; carries the POST-canonicalization URL so
    /// the omnibox can settle on the real destination (B7/F3).
    Navigating { canonical_url: String },
    Pong,
}

/// Host -> chrome, correlated to a request by `id`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Response {
    pub id: u64,
    pub result: Result<ResponseValue, PaneError>,
}

/// Host -> chrome, uncorrelated. These arrive whenever the engine has news.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum PaneEvent {
    LoadStart {
        pane: PaneId,
        url: String,
    },
    /// The load finished and the page is settled enough to extract from. This
    /// is the trigger for the B4 agent-view pipeline.
    LoadStable {
        pane: PaneId,
        url: String,
    },
    TitleChanged {
        pane: PaneId,
        title: String,
    },
    /// Emitted with the canonical URL after any navigation, including
    /// redirects. The omnibox renders from this, never from what was typed.
    UrlChanged {
        pane: PaneId,
        url: String,
    },
    /// The engine lost this pane. The chrome renders the crashed state; the
    /// supervisor decides whether to restart.
    Crashed {
        pane: PaneId,
        reason: String,
    },
    /// B7: a navigation was refused before it happened. Distinct from `Crashed`
    /// because nothing is broken — the chrome should say why and stay put.
    NavigationRefused {
        pane: PaneId,
        url: String,
        error: PaneError,
    },
    /// B5: visible text sampled on scroll settle, matched back to extraction
    /// spans. Only ever emitted while attention is on for this pane.
    AttentionSpan {
        pane: PaneId,
        url: String,
        spans: Vec<TextSpan>,
        /// Monotonic per-pane counter, so a consumer can tell a duplicate from
        /// a genuine re-observation.
        sequence: u64,
    },
    /// Attention was turned on or off. Lets the chrome chip reflect the HOST's
    /// state rather than an optimistic local guess (F5).
    AttentionChanged {
        pane: PaneId,
        on: bool,
    },
}

impl PaneEvent {
    pub fn pane(&self) -> PaneId {
        match self {
            PaneEvent::LoadStart { pane, .. }
            | PaneEvent::LoadStable { pane, .. }
            | PaneEvent::TitleChanged { pane, .. }
            | PaneEvent::UrlChanged { pane, .. }
            | PaneEvent::Crashed { pane, .. }
            | PaneEvent::NavigationRefused { pane, .. }
            | PaneEvent::AttentionSpan { pane, .. }
            | PaneEvent::AttentionChanged { pane, .. } => *pane,
        }
    }

    /// The Tauri event name the plugin forwards this under.
    pub fn event_name(&self) -> &'static str {
        match self {
            PaneEvent::LoadStart { .. } => "pane://load-start",
            PaneEvent::LoadStable { .. } => "pane://load-stable",
            PaneEvent::TitleChanged { .. } => "pane://title-changed",
            PaneEvent::UrlChanged { .. } => "pane://url-changed",
            PaneEvent::Crashed { .. } => "pane://crashed",
            PaneEvent::NavigationRefused { .. } => "pane://navigation-refused",
            PaneEvent::AttentionSpan { .. } => "pane://attention-span",
            PaneEvent::AttentionChanged { .. } => "pane://attention-changed",
        }
    }
}

/// Chrome -> host frame.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Envelope {
    pub id: u64,
    pub request: Request,
}

/// Host -> chrome frame.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Outbound {
    Response(Response),
    Event(PaneEvent),
}

/// Framing errors. Kept separate from `PaneError`: a framing failure means the
/// pipe is untrustworthy and the supervisor should restart the host, whereas a
/// `PaneError` is a normal, in-band answer.
#[derive(Debug)]
pub enum CodecError {
    Io(io::Error),
    /// The peer closed cleanly between frames.
    Eof,
    /// The length prefix exceeded `MAX_FRAME_BYTES`.
    FrameTooLarge(u32),
    /// The frame did not carry the CommonPlace pane-protocol marker.
    InvalidMagic([u8; 4]),
    /// The peer was built against a different breaking wire shape.
    VersionMismatch { expected: u16, actual: u16 },
    Decode(bincode::Error),
}

impl std::fmt::Display for CodecError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CodecError::Io(error) => write!(formatter, "pane protocol io error: {error}"),
            CodecError::Eof => write!(formatter, "pane protocol peer closed the pipe"),
            CodecError::FrameTooLarge(len) => write!(
                formatter,
                "pane protocol frame of {len} bytes exceeds the {MAX_FRAME_BYTES} byte limit"
            ),
            CodecError::InvalidMagic(actual) => write!(
                formatter,
                "pane protocol frame has invalid magic {actual:?}; expected {WIRE_MAGIC:?}"
            ),
            CodecError::VersionMismatch { expected, actual } => write!(
                formatter,
                "pane protocol wire version mismatch: expected {expected}, received {actual}"
            ),
            CodecError::Decode(error) => write!(formatter, "pane protocol decode failed: {error}"),
        }
    }
}

impl std::error::Error for CodecError {}

impl From<io::Error> for CodecError {
    fn from(error: io::Error) -> Self {
        CodecError::Io(error)
    }
}

impl From<bincode::Error> for CodecError {
    fn from(error: bincode::Error) -> Self {
        CodecError::Decode(error)
    }
}

/// Write one length-prefixed, versioned bincode frame.
///
/// The prefix is a big-endian `u32`. Big-endian because a wire format that a
/// human may one day have to read in a hexdump should not depend on the
/// architecture that wrote it.
pub fn write_frame<W: Write, T: Serialize>(writer: &mut W, value: &T) -> Result<(), CodecError> {
    let bytes = bincode::serialize(value)?;
    let frame_len = WIRE_HEADER_BYTES
        .checked_add(bytes.len())
        .ok_or(CodecError::FrameTooLarge(u32::MAX))?;
    let len = u32::try_from(frame_len).map_err(|_| CodecError::FrameTooLarge(u32::MAX))?;
    if len > MAX_FRAME_BYTES {
        return Err(CodecError::FrameTooLarge(len));
    }
    writer.write_all(&len.to_be_bytes())?;
    writer.write_all(&WIRE_MAGIC)?;
    writer.write_all(&WIRE_VERSION.to_be_bytes())?;
    writer.write_all(&bytes)?;
    // stdio pipes buffer; a request that never flushes is a request that never
    // arrives, and the caller would block forever waiting for its response.
    writer.flush()?;
    Ok(())
}

/// Read one length-prefixed bincode frame. Returns `CodecError::Eof` on a clean
/// close between frames, which is a normal shutdown rather than a fault.
pub fn read_frame<R: Read, T: serde::de::DeserializeOwned>(
    reader: &mut R,
) -> Result<T, CodecError> {
    let mut length_bytes = [0u8; 4];
    match reader.read_exact(&mut length_bytes) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => {
            return Err(CodecError::Eof)
        }
        Err(error) => return Err(CodecError::Io(error)),
    }
    let len = u32::from_be_bytes(length_bytes);
    if len > MAX_FRAME_BYTES {
        return Err(CodecError::FrameTooLarge(len));
    }
    if len < WIRE_HEADER_BYTES as u32 {
        return Err(CodecError::InvalidMagic([0; 4]));
    }
    let mut payload = vec![0u8; len as usize];
    reader.read_exact(&mut payload)?;
    let mut magic = [0u8; 4];
    magic.copy_from_slice(&payload[..WIRE_MAGIC.len()]);
    if magic != WIRE_MAGIC {
        return Err(CodecError::InvalidMagic(magic));
    }
    let version_offset = WIRE_MAGIC.len();
    let actual = u16::from_be_bytes([
        payload[version_offset],
        payload[version_offset + 1],
    ]);
    if actual != WIRE_VERSION {
        return Err(CodecError::VersionMismatch {
            expected: WIRE_VERSION,
            actual,
        });
    }
    Ok(bincode::deserialize(&payload[WIRE_HEADER_BYTES..])?)
}

/// Scheme allowlist for content panes (B7).
///
/// `file://` is deliberately absent: a content pane renders foreign pages, and
/// letting one reach the local filesystem is the whole class of bug this
/// allowlist exists to prevent.
pub const CONTENT_SCHEME_ALLOWLIST: &[&str] = &["http", "https", "about"];

/// Whether a scheme may be loaded in a content pane.
pub fn scheme_is_allowed(scheme: &str) -> bool {
    CONTENT_SCHEME_ALLOWLIST
        .iter()
        .any(|allowed| allowed.eq_ignore_ascii_case(scheme))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_round_trips_through_a_frame() {
        let envelope = Envelope {
            id: 7,
            request: Request::Create {
                pane: PaneId(3),
                parent: ParentSurface::AppKit { ns_view: 0xdead },
                bounds: Bounds::new(10, 20, 800, 600),
                url: "https://example.com/".to_string(),
            },
        };
        let mut buffer = Vec::new();
        write_frame(&mut buffer, &envelope).expect("frame writes");
        let decoded: Envelope = read_frame(&mut buffer.as_slice()).expect("frame reads");
        assert_eq!(decoded, envelope);
    }

    #[test]
    fn focus_ime_and_overlay_requests_round_trip() {
        let frames = [
            Request::SetFocus {
                pane: PaneId(1),
                focused: true,
            },
            Request::InjectKey {
                pane: PaneId(1),
                key: "a".into(),
                code: "KeyA".into(),
                down: true,
            },
            Request::InjectIme {
                pane: PaneId(1),
                composition: Some("ん".into()),
                commit: Some("ん".into()),
            },
            Request::SetOverlay {
                pane: PaneId(1),
                atoms: vec![OverlayAtom {
                    kind: "presence".into(),
                    x: 1.0,
                    y: 2.0,
                    width: 3.0,
                    height: 4.0,
                    label: "agent".into(),
                }],
            },
        ];
        for request in frames {
            let envelope = Envelope { id: 1, request };
            let mut buffer = Vec::new();
            write_frame(&mut buffer, &envelope).expect("write");
            let decoded: Envelope = read_frame(&mut buffer.as_slice()).expect("read");
            assert_eq!(decoded, envelope);
        }
    }

    #[test]
    fn outbound_events_and_responses_share_one_stream() {
        let frames: Vec<Outbound> = vec![
            Outbound::Event(PaneEvent::LoadStart {
                pane: PaneId(1),
                url: "https://example.com/".to_string(),
            }),
            Outbound::Response(Response {
                id: 42,
                result: Ok(ResponseValue::Navigating {
                    canonical_url: "https://example.com/".to_string(),
                }),
            }),
            Outbound::Event(PaneEvent::LoadStable {
                pane: PaneId(1),
                url: "https://example.com/".to_string(),
            }),
        ];
        let mut buffer = Vec::new();
        for frame in &frames {
            write_frame(&mut buffer, frame).expect("frame writes");
        }
        let mut cursor = buffer.as_slice();
        for expected in &frames {
            let decoded: Outbound = read_frame(&mut cursor).expect("frame reads");
            assert_eq!(&decoded, expected);
        }
        assert!(matches!(
            read_frame::<_, Outbound>(&mut cursor),
            Err(CodecError::Eof)
        ));
    }

    #[test]
    fn clean_close_between_frames_is_eof_not_an_error() {
        let mut empty: &[u8] = &[];
        assert!(matches!(
            read_frame::<_, Envelope>(&mut empty),
            Err(CodecError::Eof)
        ));
    }

    #[test]
    fn oversized_length_prefix_is_refused_without_allocating() {
        let mut framed = Vec::new();
        framed.extend_from_slice(&(MAX_FRAME_BYTES + 1).to_be_bytes());
        let mut cursor = framed.as_slice();
        match read_frame::<_, Envelope>(&mut cursor) {
            Err(CodecError::FrameTooLarge(len)) => assert_eq!(len, MAX_FRAME_BYTES + 1),
            other => panic!("expected FrameTooLarge, got {other:?}"),
        }
    }

    #[test]
    fn mismatched_wire_version_is_refused_before_bincode_decode() {
        let envelope = Envelope {
            id: 1,
            request: Request::Ping,
        };
        let mut buffer = Vec::new();
        write_frame(&mut buffer, &envelope).expect("frame writes");
        let version_offset = 4 + WIRE_MAGIC.len();
        buffer[version_offset..version_offset + 2]
            .copy_from_slice(&(WIRE_VERSION + 1).to_be_bytes());
        assert!(matches!(
            read_frame::<_, Envelope>(&mut buffer.as_slice()),
            Err(CodecError::VersionMismatch {
                expected: WIRE_VERSION,
                actual
            }) if actual == WIRE_VERSION + 1
        ));
    }

    #[test]
    fn error_responses_round_trip_with_their_kind() {
        let response = Response {
            id: 9,
            result: Err(PaneError::new(
                ErrorKind::SchemeRefused,
                "file:// pages cannot open in a content pane",
            )),
        };
        let mut buffer = Vec::new();
        write_frame(&mut buffer, &Outbound::Response(response.clone())).expect("frame writes");
        let decoded: Outbound = read_frame(&mut buffer.as_slice()).expect("frame reads");
        assert_eq!(decoded, Outbound::Response(response));
    }

    #[test]
    fn content_scheme_allowlist_refuses_file_urls() {
        assert!(scheme_is_allowed("https"));
        assert!(scheme_is_allowed("HTTP"));
        assert!(scheme_is_allowed("about"));
        assert!(!scheme_is_allowed("file"));
        assert!(!scheme_is_allowed("javascript"));
        assert!(!scheme_is_allowed("data"));
    }

    #[test]
    fn every_event_carries_a_pane_and_a_tauri_name() {
        let events = [
            PaneEvent::LoadStart {
                pane: PaneId(1),
                url: String::new(),
            },
            PaneEvent::LoadStable {
                pane: PaneId(1),
                url: String::new(),
            },
            PaneEvent::TitleChanged {
                pane: PaneId(1),
                title: String::new(),
            },
            PaneEvent::UrlChanged {
                pane: PaneId(1),
                url: String::new(),
            },
            PaneEvent::Crashed {
                pane: PaneId(1),
                reason: String::new(),
            },
            PaneEvent::NavigationRefused {
                pane: PaneId(1),
                url: String::new(),
                error: PaneError::new(ErrorKind::SchemeRefused, ""),
            },
            PaneEvent::AttentionSpan {
                pane: PaneId(1),
                url: String::new(),
                spans: Vec::new(),
                sequence: 0,
            },
            PaneEvent::AttentionChanged {
                pane: PaneId(1),
                on: true,
            },
        ];
        let mut names = std::collections::BTreeSet::new();
        for event in &events {
            assert_eq!(event.pane(), PaneId(1));
            assert!(names.insert(event.event_name()), "duplicate event name");
            assert!(event.event_name().starts_with("pane://"));
        }
        assert_eq!(names.len(), events.len());
    }

    #[test]
    fn zero_area_bounds_are_recognised_as_unrenderable() {
        assert!(Bounds::new(0, 0, 0, 600).is_empty());
        assert!(Bounds::new(0, 0, 800, 0).is_empty());
        assert!(!Bounds::new(0, 0, 800, 600).is_empty());
    }

    #[test]
    fn requests_report_the_pane_they_address() {
        assert_eq!(
            Request::Navigate {
                pane: PaneId(5),
                url: String::new()
            }
            .pane(),
            Some(PaneId(5))
        );
        assert_eq!(Request::Ping.pane(), None);
    }
}
