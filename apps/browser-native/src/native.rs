//! Real GPUI chrome + gpui-wry content hole (SPEC B4 / B6).
//!
//! Layout reserves title bar, omnibox, optional permission strip, left rail,
//! and bottom dock around the CommonPlace webview. Wry bounds track the
//! content hole automatically via gpui-wry prepaint. Native overlays never
//! paint over the webview rectangle (z-order law).

use std::sync::Arc;

use anyhow::{bail, Context as _, Result};
use gpui::{
    div, prelude::FluentBuilder as _, px, AppContext as _, Context, Entity,
    InteractiveElement as _, IntoElement, ParentElement as _, Render, Styled as _, Window,
    WindowOptions,
};
use gpui_component::{
    button::{Button, ButtonVariants as _},
    h_flex,
    input::{Input, InputEvent, InputState},
    label::Label,
    v_flex, ActiveTheme as _, Root, Selectable as _, TitleBar,
};
use gpui_wry::WebView;
use raw_window_handle::HasWindowHandle as _;
use url::{Host, Url};

use crate::chrome::{
    content_bottom_inset, BOTTOM_DOCK_HEIGHT, OMNIBOX_ROW_HEIGHT, PERMISSION_STRIP_HEIGHT,
    RAIL_WIDTH_COLLAPSED, TITLE_BAR_HEIGHT,
};
use crate::loopback::LoopbackBridge;
use crate::prompts::NativePromptQueue;
use crate::rail::{CapabilityRail, RailContribution};
use crate::traits::PromptHost;
use browser_core::PermissionKind;
use interaction_arbiter::{InteractionArbiter, SurfaceId};

const DEFAULT_CONSOLE_URL: &str = "https://v2.theoremharness.com/";

#[derive(Clone, Copy, PartialEq, Eq)]
enum OmniboxVerb {
    Go,
    Ask,
    Find,
}

struct CommonPlaceRoot {
    webview: Entity<WebView>,
    address_input: Entity<InputState>,
    verb: OmniboxVerb,
    console_base_url: String,
    _bridge: Arc<LoopbackBridge>,
    prompts: NativePromptQueue,
    rail: CapabilityRail,
    arbiter: InteractionArbiter,
    /// Live wry crash/restart state for SR-009.
    wry_crashed: bool,
    #[cfg(feature = "servo-pane")]
    _pane_host: Option<Arc<crate::surfaces::sidecar::PaneHostSupervisor>>,
}

impl CommonPlaceRoot {
    fn submit_omnibox(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let raw = self.address_input.read(cx).value().to_string();
        let trimmed = raw.trim().to_string();
        if trimmed.is_empty() {
            return;
        }
        match self.verb {
            OmniboxVerb::Go => {
                let url = canonicalize_go_url(&trimmed);
                self.address_input.update(cx, |input, cx| {
                    input.set_value(url.clone(), window, cx);
                });
                if !self.wry_crashed {
                    self.webview.update(cx, |view, _| {
                        view.load_url(&url);
                    });
                }
            }
            OmniboxVerb::Ask | OmniboxVerb::Find => {
                // React realm handles ask/find via openTarget after the page
                // loads; push a query hash the console SearchPanel can observe.
                let kind = if self.verb == OmniboxVerb::Ask {
                    "ask"
                } else {
                    "find"
                };
                let target = format!(
                    "{base}#{kind}={query}",
                    base = self.console_base_url.trim_end_matches('/'),
                    query = urlencoding_lite(&trimmed)
                );
                if !self.wry_crashed {
                    self.webview.update(cx, |view, _| {
                        view.load_url(&target);
                    });
                }
            }
        }
        cx.notify();
    }

    fn kill_webview(&mut self, cx: &mut Context<Self>) {
        self.wry_crashed = true;
        self.webview.update(cx, |view, _| {
            view.hide();
        });
        cx.notify();
    }

    fn restart_webview(&mut self, cx: &mut Context<Self>) {
        if !self.wry_crashed {
            return;
        }
        self.wry_crashed = false;
        let url = self.address_input.read(cx).value().to_string();
        self.webview.update(cx, |view, _| {
            view.show();
            view.load_url(&url);
        });
        cx.notify();
    }
}

impl Render for CommonPlaceRoot {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let permission_open = !self.prompts.pending().is_empty();
        let presence = self.arbiter.presence();
        let presence_label = format!(
            "presence:{:?}{}",
            presence.state,
            if presence.frozen { " (frozen)" } else { "" }
        );

        v_flex()
            .size_full()
            .bg(cx.theme().background)
            .child(
                TitleBar::new().child(
                    h_flex()
                        .w_full()
                        .h(px(TITLE_BAR_HEIGHT))
                        .px_3()
                        .items_center()
                        .justify_between()
                        .child(Label::new("CommonPlace"))
                        .child(Label::new(presence_label)),
                ),
            )
            .child(self.render_omnibox(cx))
            .when(permission_open, |col| {
                col.child(self.render_permission_strip(cx))
            })
            .child(
                h_flex()
                    .flex_1()
                    .min_h_0()
                    .child(self.render_rail(cx))
                    .child(self.render_content_hole(cx)),
            )
            .child(self.render_bottom_dock(cx))
            .children(Root::render_notification_layer(window, cx))
    }
}

impl CommonPlaceRoot {
    fn render_omnibox(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let go_active = self.verb == OmniboxVerb::Go;
        let ask_active = self.verb == OmniboxVerb::Ask;
        let find_active = self.verb == OmniboxVerb::Find;

        h_flex()
            .h(px(OMNIBOX_ROW_HEIGHT))
            .px_3()
            .gap_2()
            .items_center()
            .border_b_1()
            .border_color(cx.theme().border)
            .child(
                Button::new("verb-go")
                    .label("go")
                    .selected(go_active)
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.verb = OmniboxVerb::Go;
                        cx.notify();
                    })),
            )
            .child(
                Button::new("verb-ask")
                    .label("ask")
                    .selected(ask_active)
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.verb = OmniboxVerb::Ask;
                        cx.notify();
                    })),
            )
            .child(
                Button::new("verb-find")
                    .label("find")
                    .selected(find_active)
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.verb = OmniboxVerb::Find;
                        cx.notify();
                    })),
            )
            .child(Input::new(&self.address_input).flex_1())
            .child(
                Button::new("omnibox-submit")
                    .primary()
                    .label("Submit")
                    .on_click(cx.listener(|this, _, window, cx| this.submit_omnibox(window, cx))),
            )
    }

    fn render_permission_strip(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let pending = self.prompts.pending();
        let label = pending
            .first()
            .map(|p| format!("{} wants {:?}", p.origin, p.kind))
            .unwrap_or_else(|| "Permission".into());
        let id = pending.first().map(|p| p.id);

        h_flex()
            .h(px(PERMISSION_STRIP_HEIGHT))
            .px_3()
            .gap_2()
            .items_center()
            .border_b_1()
            .border_color(cx.theme().border)
            .child(Label::new(label))
            .child(
                Button::new("perm-allow")
                    .primary()
                    .label("Allow")
                    .on_click(cx.listener(move |this, _, _, cx| {
                        if let Some(id) = id {
                            let _ = this.prompts.resolve(id, true);
                            cx.notify();
                        }
                    })),
            )
            .child(Button::new("perm-deny").label("Deny").on_click(cx.listener(
                move |this, _, _, cx| {
                    if let Some(id) = id {
                        let _ = this.prompts.resolve(id, false);
                        cx.notify();
                    }
                },
            )))
    }

    fn render_rail(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let mut col = v_flex()
            .w(px(RAIL_WIDTH_COLLAPSED))
            .h_full()
            .gap_1()
            .p_1()
            .border_r_1()
            .border_color(cx.theme().border)
            .child(Label::new("Rail"));

        for item in self.rail.items() {
            let id = item.id.clone();
            let label = item.label.clone();
            col = col.child(
                Button::new(format!("rail-{id}"))
                    .label(label)
                    .on_click(cx.listener(move |this, _, _, cx| {
                        let _ = this.rail.click_add(&id);
                        // Placement is completed in the React realm via the
                        // HostCapabilityRailBridge; native rail records intent.
                        cx.notify();
                    })),
            );
        }
        col
    }

    fn render_content_hole(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let mut hole = div().id("content-hole").flex_1().min_h_0().min_w_0();
        if self.wry_crashed {
            hole = hole.child(
                v_flex()
                    .size_full()
                    .items_center()
                    .justify_center()
                    .gap_2()
                    .child(Label::new("CommonPlace surface crashed"))
                    .child(
                        Button::new("restart-webview")
                            .primary()
                            .label("Restart")
                            .on_click(cx.listener(|this, _, _, cx| this.restart_webview(cx))),
                    ),
            );
        } else {
            hole = hole.child(self.webview.clone());
        }
        hole
    }

    fn render_bottom_dock(&self, cx: &mut Context<Self>) -> impl IntoElement {
        h_flex()
            .h(px(BOTTOM_DOCK_HEIGHT.max(content_bottom_inset())))
            .px_3()
            .items_center()
            .justify_between()
            .border_t_1()
            .border_color(cx.theme().border)
            .child(Label::new("downloads · activity · approvals"))
            .child(
                Button::new("simulate-crash")
                    .label("Kill surface")
                    .on_click(cx.listener(|this, _, _, cx| this.kill_webview(cx))),
            )
    }
}

pub fn run() -> Result<()> {
    // Windows child webviews require GPUI_DISABLE_DIRECT_COMPOSITION=true in
    // the process environment (set by the launcher; see gpui-wry example).

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
            let options = WindowOptions {
                titlebar: Some(TitleBar::title_bar_options()),
                ..Default::default()
            };
            cx.open_window(options, move |window, cx| {
                let (child, pane_host) = {
                    let window_handle = window
                        .window_handle()
                        .expect("GPUI opened a window without a native handle");
                    #[cfg(feature = "servo-pane")]
                    let pane_host = maybe_start_pane_host(&window_handle);
                    #[cfg(not(feature = "servo-pane"))]
                    let pane_host = ();
                    let builder = wry::WebViewBuilder::new()
                        .with_url(&console_url)
                        .with_initialization_script(&initialization_script);
                    #[cfg(debug_assertions)]
                    let builder = builder.with_devtools(true);
                    let child = builder
                        .build_as_child(&window_handle)
                        .expect("gpui-wry could not create the CommonPlace child surface");
                    (child, pane_host)
                };
                let webview = cx.new(|cx| WebView::new(child, window, cx));
                let address_input =
                    cx.new(|cx| InputState::new(window, cx).default_value(console_url.as_str()));

                let mut prompts = NativePromptQueue::new();
                // Demo strip so chrome is visible without a live grant path.
                if std::env::var_os("COMMONPLACE_DEMO_PERMISSION").is_some() {
                    let _ = prompts
                        .enqueue_permission("https://example.com", PermissionKind::Geolocation);
                }

                let mut rail = CapabilityRail::new();
                rail.set_contributions(vec![
                    RailContribution {
                        id: "pane.note".into(),
                        label: "Note".into(),
                        pane_kind: Some("note".into()),
                        composer_verb: None,
                    },
                    RailContribution {
                        id: "pane.browser".into(),
                        label: "Browser".into(),
                        pane_kind: Some("browser".into()),
                        composer_verb: None,
                    },
                ]);

                let mut arbiter = InteractionArbiter::new(SurfaceId::new("commonplace"));
                arbiter.set_focus(SurfaceId::new("commonplace"));
                arbiter.set_presence_active(
                    SurfaceId::new("commonplace"),
                    "chrome".into(),
                    "idle".into(),
                );

                let view = cx.new(|cx| {
                    cx.subscribe(
                        &address_input,
                        |this: &mut CommonPlaceRoot, _, event: &InputEvent, cx| {
                            if matches!(event, InputEvent::PressEnter { .. }) {
                                let raw = this.address_input.read(cx).value().to_string();
                                let trimmed = raw.trim().to_string();
                                if !trimmed.is_empty() && !this.wry_crashed {
                                    let url = match this.verb {
                                        OmniboxVerb::Go => canonicalize_go_url(&trimmed),
                                        OmniboxVerb::Ask => format!(
                                            "{}#ask={}",
                                            this.console_base_url.trim_end_matches('/'),
                                            urlencoding_lite(&trimmed)
                                        ),
                                        OmniboxVerb::Find => format!(
                                            "{}#find={}",
                                            this.console_base_url.trim_end_matches('/'),
                                            urlencoding_lite(&trimmed)
                                        ),
                                    };
                                    this.webview.update(cx, |view, _| {
                                        view.load_url(&url);
                                    });
                                }
                            }
                        },
                    )
                    .detach();

                    CommonPlaceRoot {
                        webview,
                        address_input: address_input.clone(),
                        verb: OmniboxVerb::Go,
                        console_base_url: console_url.clone(),
                        _bridge: Arc::clone(&bridge),
                        prompts,
                        rail,
                        arbiter,
                        wry_crashed: false,
                        #[cfg(feature = "servo-pane")]
                        _pane_host: pane_host,
                    }
                });
                cx.new(|cx| Root::new(view, window, cx))
            })
            .expect("GPUI could not open the CommonPlace window");
        })
        .detach();
    });
    Ok(())
}

/// Start the B5 pane-host sidecar when `PANE_HOST_BIN` points at a host binary.
#[cfg(feature = "servo-pane")]
fn maybe_start_pane_host(
    window_handle: &impl raw_window_handle::HasWindowHandle,
) -> Option<Arc<crate::surfaces::sidecar::PaneHostSupervisor>> {
    use crate::surfaces::native_parent::parent_surface_from_window_handle;
    use crate::surfaces::sidecar::{PaneHostSupervisor, SidecarConfig};

    let binary = std::env::var("PANE_HOST_BIN").ok()?;
    let parent = match parent_surface_from_window_handle(window_handle) {
        Ok(parent) => parent,
        Err(error) => {
            eprintln!("[browser-native] pane-host parent capture failed: {error}");
            return None;
        }
    };
    let supervisor = PaneHostSupervisor::new(
        SidecarConfig {
            binary,
            local_node: std::env::var("THEOREM_LOCAL_NODE").ok(),
            tenant: std::env::var("THEOREM_TENANT").ok(),
            bearer: std::env::var("THEOREM_HARNESS_TOKEN").ok(),
        },
        parent,
    );
    if let Err(error) = supervisor.start() {
        eprintln!("[browser-native] pane-host sidecar failed to start: {error}");
        return None;
    }
    Some(supervisor)
}

fn trusted_origin(console_url: &str) -> Result<String> {
    let parsed = Url::parse(console_url).context("COMMONPLACE_CONSOLE_URL is not a URL")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        bail!("COMMONPLACE_CONSOLE_URL must use http or https");
    }
    if parsed.scheme() == "http"
        && !matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "::1"))
    {
        bail!("COMMONPLACE_CONSOLE_URL may use http only for a loopback development host");
    }
    let origin = parsed.origin().ascii_serialization();
    if origin == "null" {
        bail!("COMMONPLACE_CONSOLE_URL must have a concrete origin");
    }
    Ok(origin)
}

fn canonicalize_go_url(input: &str) -> String {
    if input.contains("://") {
        input.to_string()
    } else if bare_input_is_loopback(input) {
        format!("http://{input}")
    } else {
        format!("https://{input}")
    }
}

fn bare_input_is_loopback(input: &str) -> bool {
    Url::parse(&format!("http://{input}"))
        .ok()
        .and_then(|url| {
            url.host().map(|host| match host {
                Host::Domain(domain) => domain.eq_ignore_ascii_case("localhost"),
                Host::Ipv4(address) => address.is_loopback(),
                Host::Ipv6(address) => address.is_loopback(),
            })
        })
        .unwrap_or(false)
}

fn urlencoding_lite(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn console_origin_is_exact_and_drops_path() {
        assert_eq!(
            trusted_origin("https://v2.theoremharness.com/workspace?x=1").unwrap(),
            "https://v2.theoremharness.com"
        );
        assert!(trusted_origin("http://example.com/").is_err());
        assert_eq!(
            trusted_origin("http://127.0.0.1:3010/workspace?x=1").unwrap(),
            "http://127.0.0.1:3010"
        );
        assert!(trusted_origin("file:///tmp/console/index.html").is_err());
    }

    #[test]
    fn production_console_default_is_the_canonical_commonplace_origin() {
        assert_eq!(DEFAULT_CONSOLE_URL, "https://v2.theoremharness.com/");
    }

    #[test]
    fn go_url_canonicalizes_bare_hosts() {
        assert_eq!(canonicalize_go_url("example.com"), "https://example.com");
        assert_eq!(
            canonicalize_go_url("localhost:3010/workspace"),
            "http://localhost:3010/workspace"
        );
        assert_eq!(
            canonicalize_go_url("127.0.0.1:3010/workspace"),
            "http://127.0.0.1:3010/workspace"
        );
        assert_eq!(
            canonicalize_go_url("[::1]:3010/workspace"),
            "http://[::1]:3010/workspace"
        );
        assert_eq!(
            canonicalize_go_url("localhost.com"),
            "https://localhost.com"
        );
        assert_eq!(
            canonicalize_go_url("127.0.0.1.example"),
            "https://127.0.0.1.example"
        );
        assert_eq!(
            canonicalize_go_url("http://127.0.0.1:3010/"),
            "http://127.0.0.1:3010/"
        );
    }
}
