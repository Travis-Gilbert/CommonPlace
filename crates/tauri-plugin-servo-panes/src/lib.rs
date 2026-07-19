//! SPEC-COMMONPLACE-BROWSER-SHELL B2 (chrome half) — the `pane_*` command
//! surface.
//!
//! The trusted chrome is a Next.js app in the Tauri system webview. Untrusted
//! content renders in Servo, in a separate `pane-host` process that this plugin
//! spawns, supervises, and restarts. Nothing here links Servo; the only thing
//! that crosses the boundary is `pane-protocol` over the child's stdio.
//!
//! The command names, argument casing, and event payloads are fixed by
//! `apps/console/src/lib/pane-bridge.ts`, which already exists. This is its
//! Rust face and nothing else.

mod supervisor;

use std::sync::Arc;

use pane_protocol::{Bounds, ParentSurface, Request};
use raw_window_handle::{HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, RunEvent, Runtime};

pub use supervisor::{HostConfig, Lifecycle, PaneStatus, Supervisor};

/// A pane rectangle as the chrome measures it: physical DEVICE pixels.
///
/// The fields arrive as `f64` because the chrome measures a DOM box in CSS
/// pixels and multiplies by `devicePixelRatio`, which on a 1.5x display yields
/// fractions. Rounding here beats failing to deserialize a pane into existence.
#[derive(Clone, Copy, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaneBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl From<PaneBounds> for Bounds {
    fn from(bounds: PaneBounds) -> Self {
        Bounds::new(
            bounds.x.round() as i32,
            bounds.y.round() as i32,
            bounds.width.round().max(0.0) as u32,
            bounds.height.round().max(0.0) as u32,
        )
    }
}

/// Navigation accepted; the URL AFTER canonicalization and redirects.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaneNavigation {
    pub canonical_url: String,
}

/// Every command hops to a blocking thread: the wire to the pane host is a
/// blocking pipe, and the async runtime's threads are not ours to park.
///
/// The supervisor is fetched from the `AppHandle` rather than injected as a
/// `State` parameter because the handle is also what pins the command's runtime
/// type: `State<Arc<Supervisor<R>>>` alone leaves `R` free, and
/// `generate_handler!` cannot infer it.
async fn off_thread<R, T>(
    app: AppHandle<R>,
    work: impl FnOnce(&Supervisor<R>) -> Result<T, String> + Send + 'static,
) -> Result<T, String>
where
    R: Runtime,
    T: Send + 'static,
{
    let supervisor = app.state::<Arc<Supervisor<R>>>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || work(&supervisor))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn pane_create<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
    url: String,
    bounds: PaneBounds,
) -> Result<PaneNavigation, String> {
    let canonical_url = off_thread(app, move |host| {
        host.create(&pane_id, &url, bounds.into())
    })
    .await?;
    Ok(PaneNavigation { canonical_url })
}

#[tauri::command]
async fn pane_navigate<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
    url: String,
) -> Result<PaneNavigation, String> {
    let canonical_url = off_thread(app, move |host| {
        host.navigate(&pane_id, &url)
    })
    .await?;
    Ok(PaneNavigation { canonical_url })
}

#[tauri::command]
async fn pane_set_bounds<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
    bounds: PaneBounds,
) -> Result<(), String> {
    off_thread(app, move |host| {
        host.set_bounds(&pane_id, bounds.into())
    })
    .await
}

#[tauri::command]
async fn pane_set_visible<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
    visible: bool,
) -> Result<(), String> {
    off_thread(app, move |host| {
        host.simple(Request::SetVisible {
            pane: Supervisor::<R>::pane_id(&pane_id),
            visible,
        })
    })
    .await
}

#[tauri::command]
async fn pane_close<R: Runtime>(app: AppHandle<R>, pane_id: String) -> Result<(), String> {
    off_thread(app, move |host| host.close(&pane_id)).await
}

#[tauri::command]
async fn pane_back<R: Runtime>(app: AppHandle<R>, pane_id: String) -> Result<(), String> {
    off_thread(app, move |host| {
        host.simple(Request::Back {
            pane: Supervisor::<R>::pane_id(&pane_id),
        })
    })
    .await
}

#[tauri::command]
async fn pane_forward<R: Runtime>(app: AppHandle<R>, pane_id: String) -> Result<(), String> {
    off_thread(app, move |host| {
        host.simple(Request::Forward {
            pane: Supervisor::<R>::pane_id(&pane_id),
        })
    })
    .await
}

#[tauri::command]
async fn pane_reload<R: Runtime>(app: AppHandle<R>, pane_id: String) -> Result<(), String> {
    off_thread(app, move |host| {
        host.simple(Request::Reload {
            pane: Supervisor::<R>::pane_id(&pane_id),
        })
    })
    .await
}

#[tauri::command]
async fn pane_set_attention<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
    on: bool,
) -> Result<(), String> {
    off_thread(app, move |host| {
        host.simple(Request::SetAttention {
            pane: Supervisor::<R>::pane_id(&pane_id),
            on,
        })
    })
    .await
}

#[tauri::command]
async fn pane_status<R: Runtime>(
    app: AppHandle<R>,
    pane_id: String,
) -> Result<PaneStatus, String> {
    off_thread(app, move |host| host.status(&pane_id)).await
}

#[tauri::command]
async fn pane_host_restart<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let supervisor = app.state::<Arc<Supervisor<R>>>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || supervisor.restart())
        .await
        .map_err(|error| error.to_string())?
}

/// Register the plugin. `config` carries the local node's address and bearer,
/// which live in the OS keychain and are the host application's to fetch.
pub fn init<R: Runtime>(config: HostConfig) -> TauriPlugin<R> {
    Builder::<R>::new("servo-panes")
        .invoke_handler(tauri::generate_handler![
            pane_create,
            pane_navigate,
            pane_set_bounds,
            pane_set_visible,
            pane_close,
            pane_back,
            pane_forward,
            pane_reload,
            pane_set_attention,
            pane_status,
            pane_host_restart,
        ])
        .setup(move |app, _api| {
            let parent = parent_surface(app)?;
            let supervisor = Supervisor::new(app.clone(), parent, config.clone());
            supervisor.start()?;
            app.manage(supervisor);
            Ok(())
        })
        .on_event(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(supervisor) = app.try_state::<Arc<Supervisor<R>>>() {
                    supervisor.shutdown();
                }
            }
        })
        .build()
}

/// Read the chrome window's native handles once, during setup, which runs on
/// the main thread.
///
/// A pane is always parented into the chrome's own window, so one capture is
/// enough — and fetching a window handle off the main thread is not something
/// every platform tolerates.
// An X11 window id is a `c_ulong`: u64 on a 64-bit target, u32 on a 32-bit one.
// The widening conversion is the portable one, and it is a no-op on the target
// this compiles for today, which is the only reason clippy calls it useless.
#[allow(clippy::useless_conversion)]
fn parent_surface<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<ParentSurface, Box<dyn std::error::Error>> {
    let window = app
        .webview_windows()
        .into_values()
        .next()
        .ok_or("the pane host needs a chrome window to parent panes into")?;
    let display = window.display_handle()?.as_raw();
    let handle = window.window_handle()?.as_raw();
    match (handle, display) {
        (RawWindowHandle::AppKit(window), _) => Ok(ParentSurface::AppKit {
            ns_view: window.ns_view.as_ptr() as u64,
        }),
        (RawWindowHandle::Win32(window), _) => Ok(ParentSurface::Win32 {
            hwnd: window.hwnd.get() as u64,
        }),
        (RawWindowHandle::Xlib(window), RawDisplayHandle::Xlib(display)) => Ok(ParentSurface::X11 {
            // `From`, not `as`: an X11 window id is a `c_ulong`, which is u64
            // here and u32 on a 32-bit target, and a widening conversion is the
            // one that is right on both.
            window: u64::from(window.window),
            display: display.display.map(|display| display.as_ptr() as u64).unwrap_or(0),
        }),
        (RawWindowHandle::Wayland(window), RawDisplayHandle::Wayland(display)) => {
            Ok(ParentSurface::Wayland {
                surface: window.surface.as_ptr() as u64,
                display: display.display.as_ptr() as u64,
            })
        }
        (window, display) => Err(format!(
            "panes cannot be parented into a {window:?} window on a {display:?} display"
        )
        .into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fractional_device_pixels_round_rather_than_refusing_to_deserialize() {
        let bounds: PaneBounds = serde_json::from_str(
            r#"{ "x": 10.5, "y": -3.4, "width": 800.6, "height": 600.2 }"#,
        )
        .expect("fractional bounds deserialize");
        assert_eq!(Bounds::from(bounds), Bounds::new(11, -3, 801, 600));
    }

    #[test]
    fn a_negative_size_cannot_reach_the_engine() {
        let bounds = PaneBounds {
            x: 0.0,
            y: 0.0,
            width: -4.0,
            height: 600.0,
        };
        assert!(Bounds::from(bounds).is_empty());
    }

    #[test]
    fn navigation_answers_the_key_the_bridge_reads() {
        let json = serde_json::to_value(PaneNavigation {
            canonical_url: "https://example.com/".to_string(),
        })
        .expect("serializes");
        assert_eq!(json["canonicalUrl"], "https://example.com/");
    }

    #[test]
    fn a_status_serializes_into_the_shape_the_bridge_expects() {
        let json = serde_json::to_value(PaneStatus {
            pane_id: "pane-3".to_string(),
            url: "https://example.com/".to_string(),
            title: "Example".to_string(),
            attention: true,
            state: Lifecycle::Ready,
        })
        .expect("serializes");
        assert_eq!(json["paneId"], "pane-3");
        assert_eq!(json["state"], "ready");
        assert_eq!(json["attention"], true);
    }
}
