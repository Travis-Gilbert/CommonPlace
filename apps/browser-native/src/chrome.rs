//! Chrome design tokens from `docs/plans/native-shell/chrome-design-brief.md`.
//! CSS-facing strings for the mock shell and future GPUI theme bridge.

/// Porcelain register ground.
pub const CHROME_GROUND: &str = "oklch(91.5% 0.005 72)";
/// Raised chrome surface (omnibox row, rail).
pub const CHROME_SURFACE: &str = "oklch(96.7% 0.005 72)";
/// Title bar / bottom dock.
pub const CHROME_TOP: &str = "oklch(98.9% 0.005 72)";
pub const CHROME_INK: &str = "oklch(34% 0.012 72)";
pub const CHROME_INK_2: &str = "oklch(45% 0.012 72)";
pub const CHROME_INK_3: &str = "oklch(56% 0.012 72)";
pub const CHROME_HAIRLINE: &str = "rgba(20, 20, 19, 0.10)";
pub const CHROME_SIGNAL: &str = "oklch(54.25% 0.12 24)";
pub const CHROME_LINK: &str = "oklch(52.25% 0.06 218)";

/// Title bar height in logical pixels (traffic lights + brand).
pub const TITLE_BAR_HEIGHT: f32 = 36.0;
/// Omnibox row height.
pub const OMNIBOX_ROW_HEIGHT: f32 = 50.0;
/// Native permission strip under omnibox (never overlaps content hole).
pub const PERMISSION_STRIP_HEIGHT: f32 = 40.0;
/// Collapsed capability rail width.
pub const RAIL_WIDTH_COLLAPSED: f32 = 56.0;
/// Bottom dock height.
pub const BOTTOM_DOCK_HEIGHT: f32 = 36.0;

/// Content hole top inset: title + omnibox (+ optional permission strip).
pub fn content_top_inset(permission_open: bool) -> f32 {
    TITLE_BAR_HEIGHT
        + OMNIBOX_ROW_HEIGHT
        + if permission_open {
            PERMISSION_STRIP_HEIGHT
        } else {
            0.0
        }
}

/// Content hole bottom inset.
pub fn content_bottom_inset() -> f32 {
    BOTTOM_DOCK_HEIGHT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_strip_reserves_layout_not_overlay() {
        let closed = content_top_inset(false);
        let open = content_top_inset(true);
        assert!(open > closed);
        assert_eq!(open - closed, PERMISSION_STRIP_HEIGHT);
        // Content never starts at 0 when chrome is present.
        assert!(closed >= TITLE_BAR_HEIGHT + OMNIBOX_ROW_HEIGHT);
    }
}
