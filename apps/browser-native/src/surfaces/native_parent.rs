//! Raw-window-handle translation at the GPUI to pane-host boundary.

use pane_protocol::ParentSurface;
use raw_window_handle::{HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle};

pub fn capture_parent_surface(
    window: &(impl HasWindowHandle + HasDisplayHandle),
) -> Result<ParentSurface, String> {
    let display = window
        .display_handle()
        .map_err(|error| format!("native display handle is unavailable: {error}"))?
        .as_raw();
    let window = window
        .window_handle()
        .map_err(|error| format!("native window handle is unavailable: {error}"))?
        .as_raw();
    parent_surface_from_raw(display, window)
}

/// Window-handle-only capture for platforms where the display is implicit.
///
/// Win32 HWND values are valid across processes. AppKit NSView pointers are
/// process-local and require a future IOSurface/CALayerHost transport.
pub fn parent_surface_from_window_handle(
    window: &impl HasWindowHandle,
) -> Result<ParentSurface, String> {
    let window = window
        .window_handle()
        .map_err(|error| format!("native window handle is unavailable: {error}"))?
        .as_raw();
    match window {
        RawWindowHandle::AppKit(_) => Err(
            "out-of-process AppKit panes require an IOSurface/CALayerHost transport; NSView pointers cannot cross the pane-host boundary"
                .into(),
        ),
        RawWindowHandle::Win32(handle) => Ok(ParentSurface::Win32 {
            hwnd: handle.hwnd.get() as u64,
        }),
        other => Err(format!(
            "pane-host needs a display handle for this GPUI parent: {other:?}"
        )),
    }
}

pub fn parent_surface_from_raw(
    display: RawDisplayHandle,
    window: RawWindowHandle,
) -> Result<ParentSurface, String> {
    match (display, window) {
        (RawDisplayHandle::AppKit(_), RawWindowHandle::AppKit(_)) => Err(
            "out-of-process AppKit panes require an IOSurface/CALayerHost transport; NSView pointers cannot cross the pane-host boundary"
                .into(),
        ),
        (RawDisplayHandle::Windows(_), RawWindowHandle::Win32(handle)) => {
            Ok(ParentSurface::Win32 {
                hwnd: handle.hwnd.get() as u64,
            })
        }
        (RawDisplayHandle::Xlib(_), RawWindowHandle::Xlib(_)) => Err(
            "out-of-process X11 panes require a reopened display connection; Display pointers cannot cross the pane-host boundary"
                .into(),
        ),
        (RawDisplayHandle::Wayland(_), RawWindowHandle::Wayland(_)) => Err(
            "out-of-process Wayland panes require exported compositor buffers; wl_surface pointers cannot cross the pane-host boundary"
                .into(),
        ),
        (_, window) => Err(format!(
            "pane-host does not support this GPUI parent handle: {window:?}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::c_void;
    use std::ptr::NonNull;

    use raw_window_handle::{AppKitDisplayHandle, AppKitWindowHandle};

    use super::*;

    #[test]
    fn appkit_view_pointer_is_rejected_at_the_process_boundary() {
        let pointer = NonNull::new(0x1234usize as *mut c_void).unwrap();
        let error = parent_surface_from_raw(
            RawDisplayHandle::AppKit(AppKitDisplayHandle::new()),
            RawWindowHandle::AppKit(AppKitWindowHandle::new(pointer)),
        )
        .unwrap_err();
        assert!(error.contains("NSView pointers cannot cross"));
    }
}
