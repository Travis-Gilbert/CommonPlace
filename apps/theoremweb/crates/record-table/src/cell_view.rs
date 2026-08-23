//! Render a [`CellPresentation`] into DOM.
//!
//! `cells::render_cell` decides what a value *is* and stays pure and testable.
//! This module decides what that looks like, and is the only place that knows
//! about elements. Splitting them is what lets the RC3 FieldType map be tested
//! without a renderer.
//!
//! Every variant renders something. An unrecognised field variant arrives here
//! as `RawLabeled` and is shown with its variant name rather than dropped,
//! because a blank cell and an unsupported cell must not look the same.

use dioxus::prelude::*;

use crate::cells::{CellPresentation, RecordChip, TagPresentation};

/// How many relation chips render before the rest collapse into a count.
const RELATION_CHIP_LIMIT: usize = 3;

#[component]
pub fn CellView(presentation: CellPresentation) -> Element {
    match presentation {
        CellPresentation::Empty => rsx! {
            span { class: "theorem-cell-empty", "aria-label": "Empty", "" }
        },
        CellPresentation::Text(value) | CellPresentation::Uuid(value) => rsx! {
            span { class: "theorem-cell-text", "{value}" }
        },
        CellPresentation::LongText(value) => rsx! {
            span { class: "theorem-cell-text theorem-cell-longtext", title: "{value}", "{value}" }
        },
        CellPresentation::Number(value) => rsx! {
            span { class: "theorem-cell-number", "{value}" }
        },
        CellPresentation::Boolean(value) => rsx! {
            span {
                class: "theorem-cell-boolean",
                role: "img",
                "aria-label": if value { "True" } else { "False" },
                if value { "Yes" } else { "No" }
            }
        },
        CellPresentation::Temporal { value, includes_time } => rsx! {
            time {
                class: "theorem-cell-temporal",
                "data-includes-time": "{includes_time}",
                "{value}"
            }
        },
        CellPresentation::UrlPill { label, href } => rsx! {
            a {
                class: "theorem-cell-url",
                href: "{href}",
                rel: "noreferrer noopener",
                target: "_blank",
                "{label}"
            }
        },
        CellPresentation::Tag(tag) => rsx! { TagChip { tag } },
        CellPresentation::Tags(tags) => rsx! {
            span { class: "theorem-cell-tags",
                for tag in tags {
                    TagChip { key: "{tag.label}", tag }
                }
            }
        },
        CellPresentation::Relation { chips, overflow } => {
            let shown: Vec<RecordChip> = chips.into_iter().take(RELATION_CHIP_LIMIT).collect();
            let hidden = overflow;
            rsx! {
                span { class: "theorem-cell-relation",
                    for chip in shown {
                        span {
                            key: "{chip.record_id}",
                            class: "theorem-cell-chip",
                            "data-record-id": "{chip.record_id}",
                            span { class: "theorem-cell-chip-icon", "aria-hidden": "true", "{chip.object_icon}" }
                            "{chip.label}"
                        }
                    }
                    if hidden > 0 {
                        span { class: "theorem-cell-overflow", "+{hidden}" }
                    }
                }
            }
        }
        CellPresentation::JsonInspect { summary, .. } => rsx! {
            span { class: "theorem-cell-inspect", "data-inspect": "json", "{summary}" }
        },
        CellPresentation::GeometryInspect { summary, .. } => rsx! {
            span { class: "theorem-cell-inspect", "data-inspect": "geometry", "{summary}" }
        },
        CellPresentation::Vector { dimensions } => rsx! {
            span { class: "theorem-cell-inspect", "data-inspect": "vector", "{dimensions}d vector" }
        },
        CellPresentation::RawLabeled { variant, .. } => rsx! {
            span {
                class: "theorem-cell-raw",
                "data-unsupported-variant": "{variant}",
                title: "No renderer for field variant {variant}",
                "Unsupported: {variant}"
            }
        },
    }
}

#[component]
fn TagChip(tag: TagPresentation) -> Element {
    rsx! {
        span {
            class: "theorem-cell-tag",
            "data-hue": "{tag.hue_name}",
            style: "color: {tag.text}; background: {tag.background};",
            "{tag.label}"
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn an_unsupported_variant_names_itself_instead_of_rendering_blank() {
        let html = dioxus_ssr::render_element(rsx! {
            CellView {
                presentation: CellPresentation::RawLabeled {
                    variant: "future_kind".into(),
                    raw: json!({"any": "shape"}),
                }
            }
        });
        assert!(html.contains("future_kind"));
        assert!(html.contains("data-unsupported-variant"));
    }

    #[test]
    fn empty_and_unsupported_do_not_look_the_same() {
        let empty = dioxus_ssr::render_element(rsx! {
            CellView { presentation: CellPresentation::Empty }
        });
        let unsupported = dioxus_ssr::render_element(rsx! {
            CellView {
                presentation: CellPresentation::RawLabeled {
                    variant: "future_kind".into(),
                    raw: json!(null),
                }
            }
        });
        assert_ne!(empty, unsupported);
        assert!(empty.contains("theorem-cell-empty"));
    }

    #[test]
    fn a_url_cell_is_a_real_anchor_with_a_safe_rel() {
        let html = dioxus_ssr::render_element(rsx! {
            CellView {
                presentation: CellPresentation::UrlPill {
                    label: "example.com".into(),
                    href: "https://example.com".into(),
                }
            }
        });
        assert!(html.contains("href=\"https://example.com\""));
        assert!(html.contains("noreferrer"));
    }

    #[test]
    fn relation_chips_collapse_past_the_limit() {
        let chips: Vec<RecordChip> = (0..5)
            .map(|index| RecordChip {
                record_id: format!("record-{index}"),
                label: format!("Record {index}"),
                object_icon: "dot".into(),
            })
            .collect();
        let html = dioxus_ssr::render_element(rsx! {
            CellView { presentation: CellPresentation::Relation { chips, overflow: 2 } }
        });
        assert!(html.contains("record-0"));
        assert!(html.contains("record-2"));
        assert!(!html.contains("record-3"));
        assert!(html.contains("+2"));
    }
}
