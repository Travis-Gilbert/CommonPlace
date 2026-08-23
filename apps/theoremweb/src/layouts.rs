//! The layout data seam.
//!
//! LY1 asks that a layout survive reload. That is not a client property: the
//! browser owns an editable draft and nothing else, so surviving reload means
//! a completed interaction reached `layout_write` on the server and the next
//! load read it back. This module is both halves of that round trip and holds
//! no layout state of its own.
//!
//! Like `records`, it is keyed by surface id. The server resolves which scope
//! a surface binds and which layouts apply, so the client never carries that
//! mapping and cannot disagree with the server about it.

use theoremweb_layout::{LayoutSet, ServerAggregateReceipt};
// Only the write half needs the call type, and that half is wasm-only.
#[cfg(target_arch = "wasm32")]
use theoremweb_layout::LayoutMcpCall;

use crate::registry::RegistryError;

/// Decode the layouts that apply to a surface.
///
/// # Errors
///
/// Returns [`RegistryError::Decode`] when the payload does not match the
/// declared `LayoutSet` shape. A malformed set is refused rather than
/// partially applied: half a layout renders as a page that quietly lost
/// widgets, which is worse than an empty state that says so.
pub fn parse_set(bytes: &[u8]) -> Result<LayoutSet, RegistryError> {
    serde_json::from_slice(bytes).map_err(|error| RegistryError::Decode(error.to_string()))
}

/// Fetch the layouts a surface may mount.
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] when the request or body read fails,
/// and [`RegistryError::Decode`] for a malformed payload.
#[cfg(target_arch = "wasm32")]
pub async fn fetch(base_url: &str, surface_id: &str) -> Result<LayoutSet, RegistryError> {
    let response = gloo_net::http::Request::get(&format!("{base_url}/layouts/{surface_id}"))
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    let bytes = response
        .binary()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    parse_set(&bytes)
}

/// Send one completed layout interaction to the graph.
///
/// The call is the `layout_write` the editor produced; this does not compose
/// it, because the shape of the persisted object is the layout crate's
/// contract and restating it here would be a second authority on it.
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] when the request fails or the server
/// refuses the write, so a caller can surface an unpersisted edit rather than
/// leave the reader believing a drop was saved.
#[cfg(target_arch = "wasm32")]
pub async fn persist(base_url: &str, call: &LayoutMcpCall) -> Result<(), RegistryError> {
    let response = gloo_net::http::Request::post(&format!("{base_url}/layouts/write"))
        .json(call)
        .map_err(|error| RegistryError::Transport(error.to_string()))?
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    if response.ok() {
        Ok(())
    } else {
        Err(RegistryError::Transport(format!(
            "layout_write refused with status {}",
            response.status()
        )))
    }
}

/// Decode the aggregate receipts a dashboard's widgets were computed from.
///
/// The receipts carry their own completeness, and
/// `theoremweb_layout::project_server_aggregates` refuses any that covers only
/// the loaded page. Keeping the refusal on the receipt rather than on the
/// number is what makes LY5's "no dashboard value is computed over a loaded
/// page" checkable instead of a convention.
///
/// # Errors
///
/// Returns [`RegistryError::Decode`] for a malformed payload.
pub fn parse_aggregates(bytes: &[u8]) -> Result<Vec<ServerAggregateReceipt>, RegistryError> {
    serde_json::from_slice(bytes).map_err(|error| RegistryError::Decode(error.to_string()))
}

/// Fetch the aggregate receipts backing a dashboard surface.
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] when the request or body read fails,
/// and [`RegistryError::Decode`] for a malformed payload.
#[cfg(target_arch = "wasm32")]
pub async fn fetch_aggregates(
    base_url: &str,
    surface_id: &str,
) -> Result<Vec<ServerAggregateReceipt>, RegistryError> {
    let response = gloo_net::http::Request::get(&format!("{base_url}/aggregates/{surface_id}"))
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    let bytes = response
        .binary()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    parse_aggregates(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use theoremweb_layout::{GridRect, LayoutEditor, ScopeBinding};

    const SET: &str = r#"{
        "layouts": [
            {
                "layout_id": "layout:companies",
                "scope": {"kind": "workspace"},
                "applies_to": {"kind": "object_type", "object_type": "company"},
                "tabs": [{
                    "tab_id": "main", "title": "Main",
                    "widgets": [{
                        "widget_id": "fields", "body_kind": "fields",
                        "body_params": {}, "grid": {"x": 0, "y": 0, "w": 6, "h": 4}
                    }]
                }]
            }
        ]
    }"#;

    #[test]
    fn a_declared_layout_set_decodes_and_resolves_by_binding() {
        let set = parse_set(SET.as_bytes()).expect("set decodes");
        let resolved = set
            .resolve(&ScopeBinding::Record {
                object_type: "company".into(),
                record_id: "globex".into(),
            })
            .expect("the object-type default covers this record");
        assert_eq!(resolved.layout_id, "layout:companies");
    }

    #[test]
    fn a_malformed_set_is_refused_rather_than_partially_applied() {
        let error = parse_set(br#"{"layouts": [{"layout_id": "x"}]}"#).unwrap_err();
        assert!(matches!(error, RegistryError::Decode(_)));
    }

    #[test]
    fn a_committed_drag_survives_the_write_and_read_round_trip() {
        // LY1's reload clause at the seam it actually crosses. The live
        // half is V03's; this proves the payload the editor emits is the
        // payload this module can read back, so a geometry change cannot be
        // lost in serialization.
        let set = parse_set(SET.as_bytes()).expect("set decodes");
        let mut editor = LayoutEditor::new(set.layouts[0].clone());
        editor.enter_edit_mode();
        let commit = editor
            .commit_widget_drop(
                "main",
                "fields",
                GridRect {
                    x: 3,
                    y: 2,
                    w: 4,
                    h: 5,
                },
            )
            .expect("the drop commits");

        let written = serde_json::to_vec(&serde_json::json!({
            "layouts": [commit.persistence.arguments["layout"]]
        }))
        .expect("the write call serializes");
        let reloaded = parse_set(&written).expect("the server's echo decodes");
        assert_eq!(
            reloaded.layouts[0].tabs[0].widgets[0].grid,
            GridRect {
                x: 3,
                y: 2,
                w: 4,
                h: 5,
            }
        );
        // And the reloaded layout is still the same object, not a copy under
        // a fresh id, so a per-record override does not multiply on save.
        assert_eq!(reloaded.layouts[0].layout_id, "layout:companies");
    }

    #[test]
    fn one_page_scoped_receipt_refuses_the_whole_dashboard() {
        // LY5's second clause at the host seam. The refusal is deliberately
        // all-or-nothing: rendering the full-set widgets and quietly dropping
        // the page-scoped one would leave a dashboard that looks complete and
        // is missing a number.
        let receipts = parse_aggregates(
            br#"[
                {"widget_id": "revenue", "tool": "aggregate_companies", "arguments": {},
                 "value": 50, "completeness": "full_filtered_set"},
                {"widget_id": "headcount", "tool": "aggregate_companies", "arguments": {},
                 "value": 20, "completeness": "page"}
            ]"#,
        )
        .expect("receipts decode");
        let error = theoremweb_layout::project_server_aggregates(receipts).unwrap_err();
        assert_eq!(
            error.to_string(),
            "dashboard refused page-scoped aggregate for widget headcount"
        );
    }

    #[test]
    fn full_set_receipts_project_onto_their_widget_ids() {
        let receipts = parse_aggregates(
            br#"[{"widget_id": "revenue", "tool": "aggregate_companies", "arguments": {},
                  "value": 50, "completeness": "full_filtered_set"}]"#,
        )
        .expect("receipts decode");
        let projected =
            theoremweb_layout::project_server_aggregates(receipts).expect("full-set projects");
        assert_eq!(projected["revenue"], 50);
    }

}
