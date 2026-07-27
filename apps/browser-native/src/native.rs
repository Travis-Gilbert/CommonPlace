//! Real GPUI and gpui-wry executable seam.

use std::sync::Arc;

use anyhow::{bail, Context as _, Result};
use gpui::{
    div, AppContext as _, Context, Entity, IntoElement, ParentElement as _, Render, Styled as _,
    Window, WindowOptions,
};
use gpui_component::Root;
use gpui_wry::WebView;
use raw_window_handle::HasWindowHandle as _;
use url::Url;

use crate::loopback::LoopbackBridge;

const DEFAULT_CONSOLE_URL: &str = "http://127.0.0.1:3010/";

struct CommonPlaceRoot {
    webview: Entity<WebView>,
    // The process-owned substrate and socket outlive every surface reload.
    _bridge: Arc<LoopbackBridge>,
}

impl Render for CommonPlaceRoot {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full().child(self.webview.clone())
    }
}

pub fn run() -> Result<()> {
    let console_url = std::env::var("COMMONPLACE_CONSOLE_URL")
        .unwrap_or_else(|_| DEFAULT_CONSOLE_URL.to_string());
    let allowed_origin = trusted_origin(&console_url)?;
    let bridge = Arc::new(
        LoopbackBridge::start(Some(allowed_origin))
            .map_err(anyhow::Error::msg)
            .context("starting the native host bridge")?,
    );
    let initialization_script = bridge
        .bootstrap()
        .initialization_script()
        .context("serializing the native host bootstrap")?;

    gpui_platform::application().run(move |cx| {
        gpui_component::init(cx);
        let bridge = Arc::clone(&bridge);
        let console_url = console_url.clone();
        let initialization_script = initialization_script.clone();
        cx.spawn(async move |cx| {
            cx.open_window(WindowOptions::default(), move |window, cx| {
                let window_handle = window
                    .window_handle()
                    .expect("GPUI opened a window without a native handle");
                let builder = wry::WebViewBuilder::new()
                    .with_url(&console_url)
                    .with_initialization_script(&initialization_script);
                #[cfg(debug_assertions)]
                let builder = builder.with_devtools(true);
                let child = builder
                    .build_as_child(&window_handle)
                    .expect("gpui-wry could not create the CommonPlace child surface");
                let webview = cx.new(|cx| WebView::new(child, window, cx));
                let view = cx.new(|_| CommonPlaceRoot {
                    webview,
                    _bridge: Arc::clone(&bridge),
                });
                cx.new(|cx| Root::new(view, window, cx))
            })
            .expect("GPUI could not open the CommonPlace window");
        })
        .detach();
    });
    Ok(())
}

fn trusted_origin(console_url: &str) -> Result<String> {
    let parsed = Url::parse(console_url).context("COMMONPLACE_CONSOLE_URL is not a URL")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        bail!("COMMONPLACE_CONSOLE_URL must use http or https");
    }
    let origin = parsed.origin().ascii_serialization();
    if origin == "null" {
        bail!("COMMONPLACE_CONSOLE_URL must have a concrete origin");
    }
    Ok(origin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn console_origin_is_exact_and_drops_path() {
        assert_eq!(
            trusted_origin("http://127.0.0.1:3010/workspace?x=1").unwrap(),
            "http://127.0.0.1:3010"
        );
        assert!(trusted_origin("file:///tmp/console/index.html").is_err());
    }
}
