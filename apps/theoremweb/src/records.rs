//! The records data seam.
//!
//! W02 requires records to be server-driven: sorts, filters, and aggregates
//! ride the generated tool surface, and no client-computed total is presented
//! as complete. This module is the client half of that contract and computes
//! none of those things. It fetches a page and hands it to the table.
//!
//! The same authenticated endpoint accepts domain actions and returns the next
//! graph-backed page. The browser never names a generated tool or supplies a
//! tenant: those are resolved by the server from the surface and identity.

use theoremweb_record_table::{RecordPage, RecordTableAction};

use crate::registry::RegistryError;

/// Decode a record page.
///
/// # Errors
///
/// Returns [`RegistryError::Decode`] when the payload does not match the
/// declared `RecordPage` shape. A malformed page is refused rather than
/// partially rendered, because a half-decoded row reads as missing data.
pub fn parse_page(bytes: &[u8]) -> Result<RecordPage, RegistryError> {
    serde_json::from_slice(bytes).map_err(|error| RegistryError::Decode(error.to_string()))
}

/// Apply the visible half of an edit before the authenticated request returns.
///
/// The caller retains the prior [`RecordPage`] as its rollback value. Only an
/// edit mutates the page; focus, view, and aggregate actions wait for their
/// authoritative replacement page.
pub fn apply_optimistic_edit(page: &mut RecordPage, action: &RecordTableAction) -> bool {
    let RecordTableAction::Edit {
        record_id,
        field_key,
        value,
    } = action
    else {
        return false;
    };
    let Some(row) = page.rows.iter_mut().find(|row| row.record_id == *record_id) else {
        return false;
    };
    let Some(cell) = row.values.get_mut(field_key) else {
        return false;
    };
    *cell = value.clone();
    page.notice = None;
    true
}

/// Fetch the record page a surface renders.
///
/// Keyed by surface id, not object type: the server resolves which object type
/// and view a surface shows, so the client never has to hold that mapping.
/// That is the same server-driven rule the spec applies to sorts, filters, and
/// aggregates.
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] when the request or body read fails,
/// and [`RegistryError::Decode`] for a malformed payload.
#[cfg(target_arch = "wasm32")]
pub async fn fetch(base_url: &str, surface_id: &str) -> Result<RecordPage, RegistryError> {
    let response = gloo_net::http::Request::get(&format!("{base_url}/records/{surface_id}"))
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    let bytes = response
        .binary()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    parse_page(&bytes)
}

/// Apply one table gesture and decode the authoritative replacement page.
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] with the server refusal when the
/// generated write or coordination event is refused, and
/// [`RegistryError::Decode`] when an accepted response has the wrong shape.
#[cfg(target_arch = "wasm32")]
pub async fn dispatch(
    base_url: &str,
    surface_id: &str,
    action: &RecordTableAction,
) -> Result<RecordPage, RegistryError> {
    let response = gloo_net::http::Request::post(&format!("{base_url}/records/{surface_id}"))
        .json(action)
        .map_err(|error| RegistryError::Transport(error.to_string()))?
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    let status = response.status();
    let bytes = response
        .binary()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    if !(200..300).contains(&status) {
        let detail = serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|value| {
                value
                    .get("detail")
                    .or_else(|| value.get("error"))
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| format!("record action refused with status {status}"));
        return Err(RegistryError::Transport(detail));
    }
    parse_page(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = r#"{
        "object_type": {
            "object_type_id": "company",
            "tenant_id": "Travis-Gilbert",
            "name_singular": "company",
            "name_plural": "companies",
            "label_singular": "Company",
            "label_plural": "Companies",
            "node_label": "Company",
            "label_identifier_field": "name",
            "fields": [
                {"key": "name", "label": "Name",
                 "field_type": {"kind": "text", "raw": {}},
                 "required": true, "system": false}
            ],
            "enforcement": "reject",
            "system": false,
            "content_anchor": "",
            "retired": false,
            "schema_version": "v1"
        },
        "rows": [{"record_id": "acme", "values": {"name": "Acme"}}],
        "total": 1
    }"#;

    #[test]
    fn a_declared_page_decodes_with_its_server_total() {
        let page = parse_page(PAGE.as_bytes()).expect("page decodes");
        assert_eq!(page.rows.len(), 1);
        assert_eq!(page.total, Some(1));
        assert_eq!(page.object_type.label_plural, "Companies");
    }

    #[test]
    fn a_malformed_page_is_refused_rather_than_partially_rendered() {
        let error = parse_page(br#"{"object_type": {"object_type_id": "company"}}"#).unwrap_err();
        assert!(matches!(error, RegistryError::Decode(_)));
    }

    #[test]
    fn an_edit_updates_the_visible_cell_before_the_server_reply() {
        let mut page = parse_page(PAGE.as_bytes()).expect("page decodes");
        assert!(apply_optimistic_edit(
            &mut page,
            &RecordTableAction::Edit {
                record_id: "acme".into(),
                field_key: "name".into(),
                value: serde_json::json!("Acme edited"),
            },
        ));
        assert_eq!(page.rows[0].values["name"], "Acme edited");
    }
}
