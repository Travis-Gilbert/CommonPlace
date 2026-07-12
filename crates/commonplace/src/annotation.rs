//! The annotation model over the Comment item (SPEC-PREVIEW-COANNOTATION D4).
//!
//! An annotation is durable graph state, not a Code-surface widget: it is a
//! [`ItemKind::Comment`](crate::item::ItemKind::Comment) item carrying an
//! [`Anchor`] payload and author provenance, linked `COMMENT_ON` a target (a
//! file item in dev mode, a page item in general). Thread replies are further
//! Comments `COMMENT_ON` the annotation. The Comment kind, the `COMMENT_ON`
//! edge, and the `create_comment`/`comments_for` primitives already existed; this
//! module adds the anchor + author-kind + resolve state on top of them, and a
//! projection from a raw item to a typed [`Annotation`].

use serde::{Deserialize, Serialize};

use crate::item::{Item, ItemBody, ItemKind};

/// `extra` key holding the serialized [`Anchor`].
pub const ANCHOR_KEY: &str = "anchor";
/// `extra` key holding the [`AuthorKind`] (`"user"` | `"head"`).
pub const AUTHOR_KIND_KEY: &str = "author_kind";
/// `extra` key: `true` once the annotation is resolved.
pub const RESOLVED_KEY: &str = "resolved";
/// `extra` key holding the [`Resolution`] receipt.
pub const RESOLUTION_KEY: &str = "resolution";
/// `extra` key holding the author id. Shared with `create_comment`.
pub const AUTHOR_ID_KEY: &str = "author_id";
/// `extra` key holding the target id. Shared with `create_comment`.
pub const TARGET_ID_KEY: &str = "target_id";

/// Who authored an annotation: a human user, or an agent head.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthorKind {
    User,
    Head,
}

impl AuthorKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AuthorKind::User => "user",
            AuthorKind::Head => "head",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "user" => Some(AuthorKind::User),
            "head" => Some(AuthorKind::Head),
            _ => None,
        }
    }
}

/// A bounding rect (CSS px, viewport-relative) for a selector/region anchor.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Where an annotation is anchored. Precision degrades honestly (the spec's
/// "anchoring degrades honestly"): file-and-line when we own the build (dev
/// preview, source-attribute injected), a robust selector plus a bounding-rect
/// fallback when we do not, or a whole-page url for the general mount's Keep.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Anchor {
    /// Dev-mode: the source location under the pointer, from the injected
    /// `data-cp-loc="file:line:column"` attribute.
    FileLine {
        path: String,
        line: u32,
        #[serde(default)]
        column: Option<u32>,
    },
    /// General page: a robust selector, plus an optional bounding rect the
    /// overlay re-anchors on mutation.
    Selector {
        selector: String,
        #[serde(default)]
        rect: Option<Rect>,
    },
    /// A whole page (the general browser mount's Keep target).
    Page { url: String },
}

/// A resolved annotation's receipt (D6): who/what resolved it, and how (a commit
/// hash, a run receipt id, or an in-thread note).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Resolution {
    pub by: String,
    #[serde(default)]
    pub receipt: Option<String>,
}

/// A typed projection over a Comment item: the anchor, author + author kind,
/// body, and resolve state. Replies project too (with `anchor: None`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Annotation {
    pub id: String,
    pub target_id: Option<String>,
    pub author: Option<String>,
    pub author_kind: Option<AuthorKind>,
    pub anchor: Option<Anchor>,
    pub body: String,
    pub resolved: bool,
    pub resolution: Option<Resolution>,
    pub created_at_ms: i64,
}

/// Project a Comment [`Item`] into an [`Annotation`], reading the anchor / author
/// / resolve markers from `extra`. Returns `None` for a non-Comment item.
pub fn annotation_from_item(item: &Item) -> Option<Annotation> {
    if !matches!(item.kind, ItemKind::Comment) {
        return None;
    }
    let extra = &item.extra;
    let anchor = extra
        .get(ANCHOR_KEY)
        .and_then(|value| serde_json::from_value(value.clone()).ok());
    let author = extra
        .get(AUTHOR_ID_KEY)
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let author_kind = extra
        .get(AUTHOR_KIND_KEY)
        .and_then(|value| value.as_str())
        .and_then(AuthorKind::parse);
    let target_id = extra
        .get(TARGET_ID_KEY)
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let resolved = extra
        .get(RESOLVED_KEY)
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let resolution = extra
        .get(RESOLUTION_KEY)
        .and_then(|value| serde_json::from_value(value.clone()).ok());
    let body = match &item.body {
        ItemBody::Inline { text } => text.clone(),
        _ => String::new(),
    };
    Some(Annotation {
        id: item.id.clone(),
        target_id,
        author,
        author_kind,
        anchor,
        body,
        resolved,
        resolution,
        created_at_ms: item.created_at_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::blob::InMemoryBlobStore;
    use crate::store::Commonplace;
    use rustyred_thg_core::InMemoryGraphStore;

    fn store() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
    }

    #[test]
    fn annotation_carries_anchor_provenance_and_threads_then_resolves() {
        let mut cp = store();
        // The target: a file object (dev-mode anchoring).
<<<<<<< HEAD
        let file = cp
            .put_item(Item::new(ItemKind::File, "src/App.tsx"))
            .unwrap();
=======
        let file = cp.put_item(Item::new(ItemKind::File, "src/App.tsx")).unwrap();
>>>>>>> origin/main

        // A head annotates a source line.
        let anchor = Anchor::FileLine {
            path: "src/App.tsx".to_string(),
            line: 42,
            column: Some(9),
        };
        let ann = cp
<<<<<<< HEAD
            .create_annotation(
                &file.id,
                Some("head:claude"),
                AuthorKind::Head,
                "this padding wraps the header",
                &anchor,
            )
=======
            .create_annotation(&file.id, Some("head:claude"), AuthorKind::Head, "this padding wraps the header", &anchor)
>>>>>>> origin/main
            .unwrap();

        // It is discoverable from the file's drawer, with full provenance + anchor.
        let list = cp.annotations_for(&file.id).unwrap();
<<<<<<< HEAD
        assert_eq!(
            list.len(),
            1,
            "the annotation is found from the file object"
        );
=======
        assert_eq!(list.len(), 1, "the annotation is found from the file object");
>>>>>>> origin/main
        let got = &list[0];
        assert_eq!(got.id, ann.id);
        assert_eq!(got.author.as_deref(), Some("head:claude"));
        assert_eq!(got.author_kind, Some(AuthorKind::Head));
        assert_eq!(got.target_id.as_deref(), Some(file.id.as_str()));
        assert_eq!(got.body, "this padding wraps the header");
<<<<<<< HEAD
        assert_eq!(
            got.anchor,
            Some(anchor),
            "the file:line:col anchor round-trips"
        );
        assert!(!got.resolved);

        // A human replies in-thread; the thread reads under the annotation.
        cp.reply_to_annotation(
            &ann.id,
            Some("user:travis"),
            AuthorKind::User,
            "agreed, drop it to 8px",
        )
        .unwrap();
        let thread = cp.thread_for(&ann.id).unwrap();
        assert_eq!(thread.len(), 1, "the reply is in the annotation's thread");
        assert_eq!(thread[0].author_kind, Some(AuthorKind::User));
        assert_eq!(
            thread[0].anchor, None,
            "a reply carries no anchor of its own"
        );
=======
        assert_eq!(got.anchor, Some(anchor), "the file:line:col anchor round-trips");
        assert!(!got.resolved);

        // A human replies in-thread; the thread reads under the annotation.
        cp.reply_to_annotation(&ann.id, Some("user:travis"), AuthorKind::User, "agreed, drop it to 8px")
            .unwrap();
        let thread = cp.thread_for(&ann.id).unwrap();
        assert_eq!(thread.len(), 1, "the reply is in the annotation's thread");
        assert_eq!(thread[0].author_kind, Some(AuthorKind::User));
        assert_eq!(thread[0].anchor, None, "a reply carries no anchor of its own");
>>>>>>> origin/main

        // Resolving folds the pin with a receipt (D6).
        let resolved = cp
            .resolve_annotation(&ann.id, "head:claude", Some("commit:abc123"))
            .unwrap()
            .expect("the annotation exists");
        let view = annotation_from_item(&resolved).unwrap();
        assert!(view.resolved);
        assert_eq!(
            view.resolution,
            Some(Resolution {
                by: "head:claude".to_string(),
                receipt: Some("commit:abc123".to_string()),
            })
        );
        // The resolve did not spawn a new item (upsert by id).
        assert_eq!(view.id, ann.id);
        assert_eq!(cp.annotations_for(&file.id).unwrap().len(), 1);
    }

    #[test]
    fn selector_and_page_anchors_round_trip() {
        let mut cp = store();
<<<<<<< HEAD
        let page = cp
            .put_item(Item::new(ItemKind::Link, "competitor pricing"))
            .unwrap();
=======
        let page = cp.put_item(Item::new(ItemKind::Link, "competitor pricing")).unwrap();
>>>>>>> origin/main

        // General-page anchoring: selector + rect fallback.
        let selector = Anchor::Selector {
            selector: "main > .pricing .tier:nth-child(2)".to_string(),
<<<<<<< HEAD
            rect: Some(Rect {
                x: 12.0,
                y: 340.0,
                width: 220.0,
                height: 96.0,
            }),
        };
        cp.create_annotation(
            &page.id,
            None,
            AuthorKind::User,
            "this tier is buried",
            &selector,
        )
        .unwrap();
        // Whole-page anchor (a Keep).
        cp.create_annotation(
            &page.id,
            None,
            AuthorKind::User,
            "keep this page",
            &Anchor::Page {
                url: "https://ex.com/pricing".to_string(),
            },
        )
        .unwrap();
=======
            rect: Some(Rect { x: 12.0, y: 340.0, width: 220.0, height: 96.0 }),
        };
        cp.create_annotation(&page.id, None, AuthorKind::User, "this tier is buried", &selector)
            .unwrap();
        // Whole-page anchor (a Keep).
        cp.create_annotation(&page.id, None, AuthorKind::User, "keep this page", &Anchor::Page { url: "https://ex.com/pricing".to_string() })
            .unwrap();
>>>>>>> origin/main

        let anchors: Vec<_> = cp
            .annotations_for(&page.id)
            .unwrap()
            .into_iter()
            .filter_map(|a| a.anchor)
            .collect();
        assert!(anchors.contains(&selector));
        assert!(anchors
            .iter()
            .any(|a| matches!(a, Anchor::Page { url } if url == "https://ex.com/pricing")));
    }

    #[test]
    fn non_comment_item_is_not_an_annotation() {
        let file = Item::new(ItemKind::File, "x");
        assert!(annotation_from_item(&file).is_none());
    }
}
