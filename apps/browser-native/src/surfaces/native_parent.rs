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

pub fn parent_surface_from_raw(
    display: RawDisplayHandle,
    window: RawWindowHandle,
) -> Result<ParentSurface, String> {
    match (display, window) {
        (RawDisplayHandle::AppKit(_), RawWindowHandle::AppKit(handle)) => {
            Ok(ParentSurface::AppKit {
                ns_view: handle.ns_view.as_ptr() as usize as u64,
            })
        }
        (RawDisplayHandle::Windows(_), RawWindowHandle::Win32(handle)) => {
            Ok(ParentSurface::Win32 {
                hwnd: handle.hwnd.get() as u64,
            })
        }
        (RawDisplayHandle::Xlib(display), RawWindowHandle::Xlib(window)) => {
            let display = display
                .display
                .ok_or("Xlib display handle is null")?
                .as_ptr() as usize as u64;
            Ok(ParentSurface::X11 {
                window: window.window,
                display,
            })
        }
        (RawDisplayHandle::Wayland(display), RawWindowHandle::Wayland(window)) => {
            Ok(ParentSurface::Wayland {
                surface: window.surface.as_ptr() as usize as u64,
                display: display.display.as_ptr() as usize as u64,
            })
        }
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
    fn appkit_view_pointer_crosses_the_protocol_without_truncation() {
        let pointer = NonNull::new(0x1234usize as *mut c_void).unwrap();
        let parent = parent_surface_from_raw(
            RawDisplayHandle::AppKit(AppKitDisplayHandle::new()),
            RawWindowHandle::AppKit(AppKitWindowHandle::new(pointer)),
        )
        .unwrap();
        assert_eq!(parent, ParentSurface::AppKit { ns_view: 0x1234 });
    }
}
