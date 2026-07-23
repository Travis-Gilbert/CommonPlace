//! Documented pin constants for GPUI edition deps (SPEC B4).
//! Keep in sync with `../PINS.md`.

/// longbridge/gpui-component @ 2eed542ccd9e1e9700f366b5991b6fce1ef90e45
pub const GPUI_COMPONENT_SHA: &str = "2eed542ccd9e1e9700f366b5991b6fce1ef90e45";

/// zed-industries/zed gpui crate SHA taken from gpui-component Cargo.lock
pub const GPUI_SHA: &str = "1a246efd7e1b83ab568ec5e3e6c1a43a42e1abba";

/// gpui-wry = longbridge gpui-component crates/webview (same tree SHA).
pub const GPUI_WRY_SHA: &str = GPUI_COMPONENT_SHA;

/// Upstream URLs for the optional `gpui` feature (not linked under `mock`).
pub const GPUI_COMPONENT_GIT: &str = "https://github.com/longbridge/gpui-component";
pub const GPUI_GIT: &str = "https://github.com/zed-industries/zed";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pins_match_documented_shas() {
        assert_eq!(
            GPUI_COMPONENT_SHA,
            "2eed542ccd9e1e9700f366b5991b6fce1ef90e45"
        );
        assert_eq!(GPUI_SHA, "1a246efd7e1b83ab568ec5e3e6c1a43a42e1abba");
        assert_eq!(GPUI_WRY_SHA, GPUI_COMPONENT_SHA);
    }
}
