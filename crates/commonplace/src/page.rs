//! Page identity for margin recall (HANDOFF-MARGIN-RECALL D1/D2/D3).
//!
//! A page's content hash is the stable key three surfaces share: D1 `pageIdentity`
//! reports it, D2 caches salience by it, and a D3 [`Anchor::TextQuote`](crate::annotation::Anchor)
//! stores it so an unchanged revisit re-anchors without a scan. It is BLAKE3 over the
//! page's extracted text, addressed `blake3:<hex>` to match the crate's `sha256:<hex>`
//! blob convention ([`blob::content_hash`](crate::blob::content_hash)). VF7: the
//! `blake3` dependency was declared here but used only by `stamp`; this is its first
//! page-hash use.

/// The content address of a page's text: `blake3:<lowercase-hex>`. Stable across an
/// unchanged revisit (the same text yields the same hash) and cheap to compare, so a
/// revisit whose hash matches the stored anchor reuses the stored position with no scan.
pub fn page_content_hash(text: &str) -> String {
    format!("blake3:{}", blake3::hash(text.as_bytes()).to_hex())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_content_hash_is_stable_prefixed_and_sensitive() {
        let a = page_content_hash("the sculptor of Athens");
        // Stable: same text, same hash (D1 identity across an unchanged revisit).
        assert_eq!(a, page_content_hash("the sculptor of Athens"));
        // Addressed like the blob convention: `blake3:` + 64 hex chars.
        assert!(a.starts_with("blake3:"));
        assert_eq!(a.len(), "blake3:".len() + 64);
        // Sensitive: any change flips the hash, so a changed page re-resolves by quote.
        assert_ne!(a, page_content_hash("the sculptor of Athenz"));
        // Empty text still hashes (honest degenerate case).
        assert!(page_content_hash("").starts_with("blake3:"));
    }
}
