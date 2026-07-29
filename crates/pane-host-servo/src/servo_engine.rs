//! `browser_embed::EmbeddedServo` seen as a `pane_host::Engine`.
//!
//! Two type systems meet here and neither may absorb the other. `pane-protocol`
//! must not depend on Servo — it is linked by the chrome — so it carries parent
//! surfaces as plain integers. `browser-embed` must not depend on the protocol —
//! it is a general embedding — so it carries `raw_window_handle` types. This
//! module is the only place that knows both, and it is deliberately nothing but
//! translation.

use std::ffi::c_void;
use std::num::NonZeroIsize;
use std::ptr::NonNull;

use browser_embed as embed;
use pane_host::engine::{Engine, EngineError, EngineEvent, EngineResult};
use pane_protocol::{Bounds, ErrorKind, PaneId, ParentSurface};
use raw_window_handle::{
    AppKitDisplayHandle, AppKitWindowHandle, RawDisplayHandle, RawWindowHandle,
    WaylandDisplayHandle, WaylandWindowHandle, Win32WindowHandle, WindowsDisplayHandle,
    XlibDisplayHandle, XlibWindowHandle,
};

pub struct ServoEngine {
    inner: embed::EmbeddedServo,
}

impl ServoEngine {
    pub fn new() -> Self {
        Self {
            inner: embed::EmbeddedServo::new(),
        }
    }
}

impl Default for ServoEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine for ServoEngine {
    fn create_pane(
        &mut self,
        pane: PaneId,
        parent: ParentSurface,
        bounds: Bounds,
        url: &str,
    ) -> EngineResult {
        let parent = parent_surface(parent)?;
        self.inner
            .create_pane(id(pane), parent, rect(bounds), url)
            .map(|_| ())
            .map_err(translate)
    }

    fn navigate(&mut self, pane: PaneId, url: &str) -> EngineResult {
        self.inner.navigate(id(pane), url).map_err(translate)
    }

    fn back(&mut self, pane: PaneId) -> EngineResult {
        self.inner.back(id(pane)).map_err(translate)
    }

    fn forward(&mut self, pane: PaneId) -> EngineResult {
        self.inner.forward(id(pane)).map_err(translate)
    }

    fn reload(&mut self, pane: PaneId) -> EngineResult {
        self.inner.reload(id(pane)).map_err(translate)
    }

    fn set_bounds(&mut self, pane: PaneId, bounds: Bounds) -> EngineResult {
        self.inner
            .set_bounds(id(pane), rect(bounds))
            .map_err(translate)
    }

    fn set_visible(&mut self, pane: PaneId, visible: bool) -> EngineResult {
        self.inner.set_visible(id(pane), visible).map_err(translate)
    }

    fn close(&mut self, pane: PaneId) -> EngineResult {
        self.inner.close(id(pane)).map_err(translate)
    }

    fn evaluate_js(&mut self, pane: PaneId, script: &str) -> EngineResult<String> {
        self.inner.evaluate_js(id(pane), script).map_err(translate)
    }

    fn poll_events(&mut self) -> Vec<EngineEvent> {
        self.inner.poll_events().into_iter().map(event).collect()
    }

    fn spin(&mut self) {
        self.inner.spin();
    }

    fn set_focused(&mut self, pane: PaneId, focused: bool) -> EngineResult {
        self.inner
            .set_focused(id(pane), focused)
            .map_err(translate)
    }

    fn inject_key(
        &mut self,
        pane: PaneId,
        key: &str,
        code: &str,
        down: bool,
    ) -> EngineResult {
        self.inner
            .inject_input(
                id(pane),
                embed::EmbedInput::Key {
                    key: key.to_string(),
                    code: code.to_string(),
                    down,
                },
            )
            .map(|_| ())
            .map_err(translate)
    }

    fn inject_ime(
        &mut self,
        pane: PaneId,
        composition: Option<&str>,
        commit: Option<&str>,
    ) -> EngineResult {
        self.inner
            .inject_input(
                id(pane),
                embed::EmbedInput::Ime {
                    composition: composition.map(str::to_string),
                    commit: commit.map(str::to_string),
                },
            )
            .map(|_| ())
            .map_err(translate)
    }

    fn set_overlay(
        &mut self,
        pane: PaneId,
        atoms: &[pane_protocol::OverlayAtom],
    ) -> EngineResult {
        let mapped: Vec<embed::OverlayAtom> = atoms
            .iter()
            .map(|atom| embed::OverlayAtom {
                kind: atom.kind.clone(),
                x: atom.x,
                y: atom.y,
                width: atom.width,
                height: atom.height,
                label: atom.label.clone(),
            })
            .collect();
        self.inner
            .set_overlay(id(pane), &mapped)
            .map(|_| ())
            .map_err(translate)
    }
}

fn id(pane: PaneId) -> embed::PaneId {
    embed::PaneId(pane.0)
}

fn rect(bounds: Bounds) -> embed::Bounds {
    embed::Bounds::new(bounds.x, bounds.y, bounds.width, bounds.height)
}

fn event(event: embed::PaneEvent) -> EngineEvent {
    match event {
        embed::PaneEvent::LoadStart { pane, url } => EngineEvent::LoadStart {
            pane: PaneId(pane.0),
            url,
        },
        embed::PaneEvent::LoadStable { pane, url } => EngineEvent::LoadStable {
            pane: PaneId(pane.0),
            url,
        },
        embed::PaneEvent::TitleChanged { pane, title } => EngineEvent::TitleChanged {
            pane: PaneId(pane.0),
            title,
        },
        embed::PaneEvent::UrlChanged { pane, url } => EngineEvent::UrlChanged {
            pane: PaneId(pane.0),
            url,
        },
        embed::PaneEvent::Crashed { pane, reason } => EngineEvent::Crashed {
            pane: PaneId(pane.0),
            reason,
        },
    }
}

fn translate(error: embed::EmbedError) -> EngineError {
    match error {
        embed::EmbedError::UnknownPane(pane) => EngineError::unknown_pane(PaneId(pane.0)),
        embed::EmbedError::InvalidUrl { url, reason } => EngineError::new(
            ErrorKind::InvalidUrl,
            format!("{url} could not be opened: {reason}"),
        ),
        // Not a failure so much as a boundary: the user asked to go back from
        // the first page in the chain. `Unavailable` says "nothing is broken,
        // there is just nothing there".
        embed::EmbedError::NoHistory => EngineError::new(
            ErrorKind::Unavailable,
            "this pane has no page to go to in that direction",
        ),
        embed::EmbedError::Surface(reason) | embed::EmbedError::Engine(reason) => {
            EngineError::engine(reason)
        }
    }
}

/// Rebuild the platform handles the protocol transported as integers.
///
/// UNVERIFIED ON HARDWARE. Each arm below is written against
/// `raw-window-handle` 0.6's constructors, but only the platform the host
/// actually runs on can prove that the handle it reconstitutes is the one the
/// window server expects. Treat a new platform as unexercised until a pane has
/// rendered on it.
fn parent_surface(parent: ParentSurface) -> Result<embed::ParentSurface, EngineError> {
    let (display, window) = match parent {
        ParentSurface::AppKit { ns_view } => {
            let view = pointer(ns_view, "NSView")?;
            (
                RawDisplayHandle::AppKit(AppKitDisplayHandle::new()),
                RawWindowHandle::AppKit(AppKitWindowHandle::new(view)),
            )
        }
        ParentSurface::Win32 { hwnd } => {
            let handle = NonZeroIsize::new(hwnd as isize).ok_or_else(|| {
                EngineError::new(ErrorKind::Engine, "the chrome sent a null HWND")
            })?;
            (
                RawDisplayHandle::Windows(WindowsDisplayHandle::new()),
                RawWindowHandle::Win32(Win32WindowHandle::new(handle)),
            )
        }
        ParentSurface::X11 { window, display } => (
            // Screen 0: the protocol carries no screen number because a pane is
            // always parented into a window the chrome already owns, and that
            // window's screen is not the host's to choose.
            RawDisplayHandle::Xlib(XlibDisplayHandle::new(
                Some(pointer(display, "Display")?),
                0,
            )),
            RawWindowHandle::Xlib(XlibWindowHandle::new(window as _)),
        ),
        ParentSurface::Wayland { surface, display } => (
            RawDisplayHandle::Wayland(WaylandDisplayHandle::new(pointer(display, "wl_display")?)),
            RawWindowHandle::Wayland(WaylandWindowHandle::new(pointer(surface, "wl_surface")?)),
        ),
    };
    Ok(embed::ParentSurface::Parented { display, window })
}

fn pointer(value: u64, what: &str) -> Result<NonNull<c_void>, EngineError> {
    NonNull::new(value as *mut c_void).ok_or_else(|| {
        EngineError::new(ErrorKind::Engine, format!("the chrome sent a null {what}"))
    })
}
