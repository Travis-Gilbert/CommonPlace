//! Z-order law: native overlays must never intersect the webview content hole
//! (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 design law + B6 acceptance).

/// Axis-aligned rect in logical shell coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct ContentRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl ContentRect {
    pub fn right(self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(self) -> f32 {
        self.y + self.height
    }
}

/// A native chrome overlay (permission strip, popover, takeover).
#[derive(Debug, Clone, PartialEq)]
pub struct NativeOverlay {
    pub id: String,
    pub bounds: ContentRect,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ZOrderViolation {
    pub overlay_id: String,
    pub webview: ContentRect,
    pub overlay: ContentRect,
}

pub fn rects_intersect(a: ContentRect, b: ContentRect) -> bool {
    a.x < b.right() && a.right() > b.x && a.y < b.bottom() && a.bottom() > b.y
}

/// Returns violations where a native overlay intersects the webview hole.
pub fn zorder_violations(
    webview: ContentRect,
    overlays: &[NativeOverlay],
) -> Vec<ZOrderViolation> {
    overlays
        .iter()
        .filter(|o| rects_intersect(webview, o.bounds))
        .map(|o| ZOrderViolation {
            overlay_id: o.id.clone(),
            webview,
            overlay: o.bounds,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chrome::{content_top_inset, RAIL_WIDTH_COLLAPSED};

    #[test]
    fn scripted_native_popover_has_zero_intersection_with_webview() {
        let webview = ContentRect {
            x: RAIL_WIDTH_COLLAPSED,
            y: content_top_inset(false),
            width: 1200.0,
            height: 700.0,
        };
        // Permission strip is above the content hole (layout reserve), not over it.
        let permission = NativeOverlay {
            id: "permission".into(),
            bounds: ContentRect {
                x: RAIL_WIDTH_COLLAPSED,
                y: content_top_inset(false) - 40.0,
                width: 400.0,
                height: 40.0,
            },
        };
        assert!(zorder_violations(webview, &[permission]).is_empty());
    }

    #[test]
    fn intersecting_popover_is_reported() {
        let webview = ContentRect {
            x: 56.0,
            y: 86.0,
            width: 800.0,
            height: 600.0,
        };
        let bad = NativeOverlay {
            id: "popover".into(),
            bounds: ContentRect {
                x: 100.0,
                y: 100.0,
                width: 200.0,
                height: 80.0,
            },
        };
        let v = zorder_violations(webview, &[bad]);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].overlay_id, "popover");
    }
}
