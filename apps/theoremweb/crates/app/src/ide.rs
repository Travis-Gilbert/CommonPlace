//! IDE surface-row and degradation contracts.
//!
//! Code-server is mounted like any other surface. The primary and fallback
//! renderers travel on one graph row; capability failure flips that row rather
//! than introducing a route or platform branch in the shell.

use dioxus::prelude::*;

use crate::{McpCall, Renderer, ScopeBinding, SurfaceSpec};

pub const CODE_SERVER_SURFACE_ID: &str = "ide";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ServoIdePreferences {
    pub dom_serviceworker_enabled: bool,
    pub dom_indexeddb_enabled: bool,
    pub dom_intersection_observer_enabled: bool,
}

impl ServoIdePreferences {
    #[must_use]
    pub const fn enabled() -> Self {
        Self {
            dom_serviceworker_enabled: true,
            dom_indexeddb_enabled: true,
            dom_intersection_observer_enabled: true,
        }
    }

    #[must_use]
    pub const fn all_enabled(self) -> bool {
        self.dom_serviceworker_enabled
            && self.dom_indexeddb_enabled
            && self.dom_intersection_observer_enabled
    }
}

#[must_use]
pub fn code_server_surface(url: impl Into<String>) -> SurfaceSpec {
    let url = url.into();
    SurfaceSpec {
        surface_id: CODE_SERVER_SURFACE_ID.into(),
        title: "IDE".into(),
        icon: "code".into(),
        default_scope: ScopeBinding::Workspace,
        renderer: Renderer::Servo(url.clone()),
        fallback_renderer: Some(Renderer::SystemWebview(url)),
        layout_ref: None,
        capabilities: vec![
            "agentfs.read".into(),
            "agentfs.write".into(),
            "ide.extension_webview".into(),
        ],
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IdeError {
    EmptyCapability,
    MissingFallback,
}

impl std::fmt::Display for IdeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyCapability => formatter.write_str("IDE degradation must name a capability"),
            Self::MissingFallback => formatter.write_str("IDE surface has no declared fallback"),
        }
    }
}

impl std::error::Error for IdeError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdeDegradation {
    pub failing_capability: String,
    pub label: String,
    pub replacement: SurfaceSpec,
    pub write_call: McpCall,
}

/// Produce the single graph-row edit that activates the declared fallback.
///
/// # Errors
///
/// Refuses an empty capability label or a row without a fallback renderer.
pub fn degrade_to_fallback(
    surface: &SurfaceSpec,
    failing_capability: &str,
) -> Result<IdeDegradation, IdeError> {
    let failing_capability = failing_capability.trim();
    if failing_capability.is_empty() {
        return Err(IdeError::EmptyCapability);
    }
    let fallback = surface
        .fallback_renderer
        .clone()
        .ok_or(IdeError::MissingFallback)?;
    let mut replacement = surface.clone();
    replacement.fallback_renderer = Some(replacement.renderer);
    replacement.renderer = fallback;
    let label =
        format!("IDE degraded to system webview: unavailable capability {failing_capability}");
    Ok(IdeDegradation {
        failing_capability: failing_capability.into(),
        label,
        write_call: McpCall::surface_write(&replacement),
        replacement,
    })
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IdeSurfaceState {
    Booting { url: String },
    Ready { url: String },
    Degraded { url: String, label: String },
}

#[component]
pub fn IdeSurface(state: IdeSurfaceState) -> Element {
    let (url, state_name, label) = match state {
        IdeSurfaceState::Booting { url } => (
            url,
            "booting",
            "Starting the code-server workbench".to_owned(),
        ),
        IdeSurfaceState::Ready { url } => (url, "ready", "IDE workbench ready".to_owned()),
        IdeSurfaceState::Degraded { url, label } => (url, "degraded", label),
    };
    rsx! {
        section {
            class: "theoremweb-ide-surface",
            "data-ide-state": state_name,
            "data-ide-url": url,
            h2 { "IDE" }
            p { role: "status", "{label}" }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ide_row_declares_servo_and_system_webview_on_one_record() {
        let row = code_server_surface("http://127.0.0.1:3000/?folder=/workspace");
        assert!(matches!(row.renderer, Renderer::Servo(_)));
        assert!(matches!(
            row.fallback_renderer,
            Some(Renderer::SystemWebview(_))
        ));
        assert!(ServoIdePreferences::enabled().all_enabled());
    }

    #[test]
    fn fallback_is_one_labeled_surface_write_and_is_reversible() {
        let primary = code_server_surface("https://ide.example/?folder=/workspace");
        let degraded = degrade_to_fallback(
            &primary,
            "extension_webview_service_worker_fetch_interception",
        )
        .unwrap();
        assert_eq!(degraded.write_call.name, "surface_write");
        assert_eq!(
            degraded.write_call.arguments["surface"]["renderer"]["kind"],
            "system_webview"
        );
        assert_eq!(
            degraded.write_call.arguments["surface"]["fallback_renderer"]["kind"],
            "servo"
        );
        assert!(degraded
            .label
            .contains("extension_webview_service_worker_fetch_interception"));
        assert!(matches!(
            degraded.replacement.renderer,
            Renderer::SystemWebview(_)
        ));
        assert!(matches!(
            degraded.replacement.fallback_renderer,
            Some(Renderer::Servo(_))
        ));

        let restored = degrade_to_fallback(&degraded.replacement, "capability_restored").unwrap();
        assert_eq!(restored.replacement, primary);
    }

    #[test]
    fn degraded_surface_names_the_failed_capability_instead_of_rendering_blank() {
        let html = dioxus_ssr::render_element(rsx! {
            IdeSurface {
                state: IdeSurfaceState::Degraded {
                    url: "https://ide.example".into(),
                    label: "IDE degraded: service_worker_fetch_interception unavailable".into(),
                }
            }
        });
        assert!(html.contains("data-ide-state=\"degraded\""));
        assert!(html.contains("service_worker_fetch_interception unavailable"));
    }
}
