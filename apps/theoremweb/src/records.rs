//! The records data seam.
//!
//! W02 requires records to be server-driven: sorts, filters, and aggregates
//! ride the generated tool surface, and no client-computed total is presented
//! as complete. This module is the client half of that contract and computes
//! none of those things. It fetches a page and hands it to the table.
//!
//! The live record stream is W02's backend half and does not exist yet. The
//! interface here is the real one either way: the host fetches over HTTP and
//! renders whatever arrives. Until the endpoint is live, a typed fixture is
//! served at the same path by `scripts/build-web.sh --with-local-registry`,
//! which is a local stand-in and never an authority.

use theoremweb_record_table::RecordPage;

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
}
