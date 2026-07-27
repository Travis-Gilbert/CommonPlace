//! B7 — navigation safety.
//!
//! Every URL that reaches the engine passes through [`resolve`] first. Two
//! rules, in this order:
//!
//! 1. The scheme must be in `pane_protocol::CONTENT_SCHEME_ALLOWLIST`.
//! 2. http(s) URLs are canonicalized by `rustyred_web::canonicalize_url`.
//!
//! The order is load-bearing. `canonicalize_url` refuses anything that is not
//! http(s), so running it first would report `file:///etc/passwd` as an
//! *invalid* URL. It is not invalid; it is refused, and the person who typed it
//! deserves to be told which.

use pane_protocol::{scheme_is_allowed, ErrorKind, PaneError};
use url::Url;

/// Canonicalize and check a navigation target.
///
/// On success the returned string is the URL that should actually be loaded and
/// reported back to the omnibox — post-canonicalization, so the address bar
/// settles on the real destination rather than on what was typed.
pub fn resolve(raw: &str) -> Result<String, PaneError> {
    let parsed = Url::parse(raw.trim()).map_err(|error| {
        PaneError::new(
            ErrorKind::InvalidUrl,
            format!("{raw} is not a URL that can be opened ({error})"),
        )
    })?;

    if !scheme_is_allowed(parsed.scheme()) {
        return Err(PaneError::new(
            ErrorKind::SchemeRefused,
            format!(
                "{}: pages cannot open in a content pane; only {} can",
                parsed.scheme(),
                pane_protocol::CONTENT_SCHEME_ALLOWLIST.join(", ")
            ),
        ));
    }

    // `about:` is allowlisted but is not an http(s) URL, so RustyWeb's
    // canonicalizer would reject it. There is nothing to canonicalize either:
    // no fragment, no userinfo, no host. Pass the parsed form through.
    if parsed.scheme().eq_ignore_ascii_case("about") {
        return Ok(parsed.to_string());
    }

    rustyred_web::canonicalize_url(parsed.as_str()).map_err(|error| {
        PaneError::new(
            ErrorKind::InvalidUrl,
            format!("{raw} could not be canonicalized ({error})"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_urls_are_refused_with_the_typed_kind() {
        let error = resolve("file:///etc/passwd").expect_err("file:// must be refused");
        assert_eq!(error.kind, ErrorKind::SchemeRefused);
        assert!(error.message.contains("file"), "{}", error.message);
    }

    #[test]
    fn javascript_and_data_urls_are_refused_too() {
        for raw in ["javascript:alert(1)", "data:text/html,<b>x</b>"] {
            let error = resolve(raw).expect_err("must be refused");
            assert_eq!(error.kind, ErrorKind::SchemeRefused, "{raw}");
        }
    }

    #[test]
    fn allowlisted_schemes_resolve() {
        assert_eq!(
            resolve("https://example.com/a").expect("https resolves"),
            "https://example.com/a"
        );
        assert_eq!(
            resolve("http://example.com/a").expect("http resolves"),
            "http://example.com/a"
        );
        assert_eq!(resolve("about:blank").expect("about resolves"), "about:blank");
    }

    #[test]
    fn canonicalization_strips_the_fragment_and_userinfo() {
        assert_eq!(
            resolve("https://user:secret@example.com/doc#section-3").expect("resolves"),
            "https://example.com/doc"
        );
    }

    #[test]
    fn unparseable_input_is_invalid_not_refused() {
        let error = resolve("not a url at all").expect_err("must fail");
        assert_eq!(error.kind, ErrorKind::InvalidUrl);
    }
}
