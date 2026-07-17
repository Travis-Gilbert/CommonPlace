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
/// `extra` key holding the [`BodyKind`] (D3): the typed body of the annotation.
pub const BODY_KIND_KEY: &str = "body_kind";
/// `extra` key holding the W3C motivation (D3), e.g. `"commenting"` | `"describing"`.
pub const MOTIVATION_KEY: &str = "motivation";
/// `extra` key: `true` when the annotation re-anchored below confidence (D3 orphan).
/// Orphans are listed in the session drawer but never highlighted on the page.
pub const ORPHAN_KEY: &str = "orphan";

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

/// The typed body of an annotation (D3, HANDOFF-MARGIN-RECALL): a named connection
/// explanation (D2 salience), a set of memory references, or a model's note. Wire value
/// is snake_case, parity with the TS body union.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BodyKind {
    ConnectionExplanation,
    MemoryRefs,
    ModelNote,
}

impl BodyKind {
    pub fn as_str(self) -> &'static str {
        match self {
            BodyKind::ConnectionExplanation => "connection_explanation",
            BodyKind::MemoryRefs => "memory_refs",
            BodyKind::ModelNote => "model_note",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "connection_explanation" => Some(BodyKind::ConnectionExplanation),
            "memory_refs" => Some(BodyKind::MemoryRefs),
            "model_note" => Some(BodyKind::ModelNote),
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

/// W3C TextQuoteSelector: the exact quote plus optional context that disambiguates
/// repeated occurrences (D3, HANDOFF-MARGIN-RECALL). Wire-parity with the TS
/// `TextQuoteSelector` in `packages/coannotate`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextQuoteSelector {
    pub exact: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
}

/// W3C TextPositionSelector: a character range in the page text. Doubles as the
/// last-resolved position the overlay prefers when re-anchoring.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextPositionSelector {
    pub start: u32,
    pub end: u32,
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
    /// A W3C-style text quote (D3, HANDOFF-MARGIN-RECALL): the source page, a quote
    /// selector, the last-resolved position (the re-anchor hint), and the BLAKE3
    /// page content hash captured with it. A margin-recall highlight persists as
    /// this and re-anchors by quote on revisit.
    TextQuote {
        source: String,
        quote: TextQuoteSelector,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        position: Option<TextPositionSelector>,
        content_hash: String,
    },
}

/// A resolved annotation's receipt (D6): who/what resolved it, and how (a commit
/// hash, a run receipt id, or an in-thread note).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Resolution {
    pub by: String,
    #[serde(default)]
    pub receipt: Option<String>,
}

/// A recorded annotation lifecycle transition (D3-5, HANDOFF-MARGIN-RECALL). The
/// annotation item upserts by id, so its own row keeps only the latest state; the
/// history lives on append-only, timestamped event edges, and replaying them
/// reconstructs the annotation's state at any point. Wire value snake_case.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnnotationEventKind {
    /// The annotation was created.
    Created,
    /// A reply was appended to its thread.
    Replied,
    /// It was resolved with a receipt (D6).
    Resolved,
    /// Its text-quote re-anchored below confidence (D3): listed, not painted.
    Orphaned,
    /// It re-anchored back above confidence and is painted again.
    Unorphaned,
}

impl AnnotationEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AnnotationEventKind::Created => "created",
            AnnotationEventKind::Replied => "replied",
            AnnotationEventKind::Resolved => "resolved",
            AnnotationEventKind::Orphaned => "orphaned",
            AnnotationEventKind::Unorphaned => "unorphaned",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "created" => Some(AnnotationEventKind::Created),
            "replied" => Some(AnnotationEventKind::Replied),
            "resolved" => Some(AnnotationEventKind::Resolved),
            "orphaned" => Some(AnnotationEventKind::Orphaned),
            "unorphaned" => Some(AnnotationEventKind::Unorphaned),
            _ => None,
        }
    }
}

/// One entry in an annotation's history (D3-5): a monotonic transaction-time
/// sequence, the transition kind, who did it, the wall-clock ms it happened, and
/// optional detail (e.g. the resolve receipt). Read from the append-only
/// `ANNOTATION_EVENT` edges, ordered by `seq`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AnnotationEvent {
    pub seq: u64,
    pub kind: AnnotationEventKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
    pub at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// The reconstructed state of an annotation as of a transaction-time cut (D3-5),
/// folded from its event history: whether it is resolved / orphaned, how many
/// replies it had by then, who resolved it, and the last transition applied.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct AnnotationReplay {
    pub resolved: bool,
    pub orphan: bool,
    pub reply_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolution_receipt: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_event: Option<AnnotationEventKind>,
}

/// A typed projection over a Comment item: the anchor, author + author kind,
/// body, and resolve state. Replies project too (with `anchor: None`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Annotation {
    pub id: String,
    pub target_id: Option<String>,
    pub author: Option<String>,
    pub author_kind: Option<AuthorKind>,
    pub body_kind: Option<BodyKind>,
    pub motivation: Option<String>,
    /// True when this target re-anchored below confidence (D3): listed, never painted.
    pub orphan: bool,
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
    let body_kind = extra
        .get(BODY_KIND_KEY)
        .and_then(|value| value.as_str())
        .and_then(BodyKind::parse);
    let motivation = extra
        .get(MOTIVATION_KEY)
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let orphan = extra
        .get(ORPHAN_KEY)
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
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
        body_kind,
        motivation,
        orphan,
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
        let file = cp
            .put_item(Item::new(ItemKind::File, "src/App.tsx"))
            .unwrap();

        // A head annotates a source line.
        let anchor = Anchor::FileLine {
            path: "src/App.tsx".to_string(),
            line: 42,
            column: Some(9),
        };
        let ann = cp
            .create_annotation(
                &file.id,
                Some("head:claude"),
                AuthorKind::Head,
                "this padding wraps the header",
                &anchor,
            )
            .unwrap();

        // It is discoverable from the file's drawer, with full provenance + anchor.
        let list = cp.annotations_for(&file.id).unwrap();
        assert_eq!(
            list.len(),
            1,
            "the annotation is found from the file object"
        );
        let got = &list[0];
        assert_eq!(got.id, ann.id);
        assert_eq!(got.author.as_deref(), Some("head:claude"));
        assert_eq!(got.author_kind, Some(AuthorKind::Head));
        assert_eq!(got.target_id.as_deref(), Some(file.id.as_str()));
        assert_eq!(got.body, "this padding wraps the header");
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
        let page = cp
            .put_item(Item::new(ItemKind::Link, "competitor pricing"))
            .unwrap();

        // General-page anchoring: selector + rect fallback.
        let selector = Anchor::Selector {
            selector: "main > .pricing .tier:nth-child(2)".to_string(),
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

    #[test]
    fn text_quote_anchor_round_trips_and_matches_ts_wire() {
        let anchor = Anchor::TextQuote {
            source: "https://ex.com/essay".to_string(),
            quote: TextQuoteSelector {
                exact: "the sculptor of Athens".to_string(),
                prefix: Some("was ".to_string()),
                suffix: None,
            },
            position: Some(TextPositionSelector { start: 40, end: 62 }),
            content_hash: "blake3:deadbeef".to_string(),
        };

        // The JSON matches the shape the TS coannotate side produces (snake_case
        // tag + fields, omitted None context), so a highlight stored from either
        // side deserializes on the other.
        let json = serde_json::to_value(&anchor).unwrap();
        assert_eq!(json["kind"], "text_quote");
        assert_eq!(json["source"], "https://ex.com/essay");
        assert_eq!(json["quote"]["exact"], "the sculptor of Athens");
        assert_eq!(json["quote"]["prefix"], "was ");
        assert!(json["quote"].get("suffix").is_none(), "absent context is omitted");
        assert_eq!(json["content_hash"], "blake3:deadbeef");
        let back: Anchor = serde_json::from_value(json).unwrap();
        assert_eq!(back, anchor, "the text_quote anchor round-trips");

        // And it persists through the store like any other anchor.
        let mut cp = store();
        let page = cp.put_item(Item::new(ItemKind::Link, "essay")).unwrap();
        cp.create_annotation(&page.id, None, AuthorKind::User, "keep this line", &anchor)
            .unwrap();
        let stored = cp.annotations_for(&page.id).unwrap();
        assert_eq!(stored[0].anchor.as_ref(), Some(&anchor));
    }

    #[test]
    fn typed_body_kind_and_motivation_round_trip() {
        let mut cp = store();
        let page = cp.put_item(Item::new(ItemKind::Link, "essay")).unwrap();
        let anchor = Anchor::TextQuote {
            source: "https://ex.com/essay".to_string(),
            quote: TextQuoteSelector { exact: "a line".to_string(), prefix: None, suffix: None },
            position: None,
            content_hash: "blake3:abc".to_string(),
        };
        // D2 salience creates a connection explanation through the typed path.
        cp.create_typed_annotation(
            &page.id,
            Some("head:claude"),
            AuthorKind::Head,
            "connects to your note on Athens",
            &anchor,
            Some(BodyKind::ConnectionExplanation),
            Some("describing"),
        )
        .unwrap();
        let got = &cp.annotations_for(&page.id).unwrap()[0];
        assert_eq!(got.body_kind, Some(BodyKind::ConnectionExplanation));
        assert_eq!(got.motivation.as_deref(), Some("describing"));

        // A plain create_annotation carries neither (defaults None), so old callers
        // are unchanged.
        let file = cp.put_item(Item::new(ItemKind::File, "x.tsx")).unwrap();
        cp.create_annotation(&file.id, None, AuthorKind::User, "note", &Anchor::Page { url: "u".to_string() })
            .unwrap();
        let plain = &cp.annotations_for(&file.id).unwrap()[0];
        assert_eq!(plain.body_kind, None);
        assert_eq!(plain.motivation, None);
    }

    #[test]
    fn orphan_marker_round_trips() {
        let mut cp = store();
        let page = cp.put_item(Item::new(ItemKind::Link, "essay")).unwrap();
        let ann = cp
            .create_annotation(
                &page.id,
                None,
                AuthorKind::User,
                "note",
                &Anchor::Page { url: "u".to_string() },
            )
            .unwrap();
        // A fresh annotation is not an orphan.
        assert!(!cp.annotations_for(&page.id).unwrap()[0].orphan);
        // Re-anchoring below confidence marks it: still stored + listed, never painted.
        cp.mark_orphan(&ann.id, true).unwrap().expect("the annotation exists");
        assert!(cp.annotations_for(&page.id).unwrap()[0].orphan, "the orphan marker persists");
    }

    #[test]
    fn annotation_history_replays_lifecycle_from_edges() {
        let mut cp = store();
        let page = cp.put_item(Item::new(ItemKind::Link, "essay")).unwrap();
        let anchor = Anchor::Page {
            url: "https://ex.com/essay".to_string(),
        };
        let ann = cp
            .create_annotation(&page.id, Some("head:claude"), AuthorKind::Head, "note", &anchor)
            .unwrap();

        // Four transitions: create -> reply -> resolve -> orphan.
        cp.reply_to_annotation(&ann.id, Some("user:travis"), AuthorKind::User, "agreed")
            .unwrap();
        cp.resolve_annotation(&ann.id, "head:claude", Some("commit:abc123"))
            .unwrap()
            .expect("the annotation exists");
        cp.mark_orphan(&ann.id, true)
            .unwrap()
            .expect("the annotation exists");

        // The history is the ordered, provenance-carrying event log, read from the
        // append-only edges (the comment item only keeps its latest state).
        let history = cp.annotation_history(&ann.id).unwrap();
        let kinds: Vec<AnnotationEventKind> = history.iter().map(|event| event.kind).collect();
        assert_eq!(
            kinds,
            vec![
                AnnotationEventKind::Created,
                AnnotationEventKind::Replied,
                AnnotationEventKind::Resolved,
                AnnotationEventKind::Orphaned,
            ]
        );
        assert_eq!(history[0].actor.as_deref(), Some("head:claude"));
        assert_eq!(history[1].actor.as_deref(), Some("user:travis"));
        assert_eq!(history[2].actor.as_deref(), Some("head:claude"));
        assert_eq!(history[2].detail.as_deref(), Some("commit:abc123"));
        // Transaction-time is strictly increasing, so a cut isolates a prefix.
        assert!(history.windows(2).all(|pair| pair[1].at_ms > pair[0].at_ms));

        // Replaying to each cut reconstructs the state at that point.
        let after_create = cp.replay_annotation(&ann.id, history[0].at_ms).unwrap().unwrap();
        assert!(!after_create.resolved && !after_create.orphan);
        assert_eq!(after_create.reply_count, 0);
        assert_eq!(after_create.last_event, Some(AnnotationEventKind::Created));

        let after_reply = cp.replay_annotation(&ann.id, history[1].at_ms).unwrap().unwrap();
        assert_eq!(after_reply.reply_count, 1);
        assert!(!after_reply.resolved);

        let after_resolve = cp.replay_annotation(&ann.id, history[2].at_ms).unwrap().unwrap();
        assert!(after_resolve.resolved && !after_resolve.orphan);
        assert_eq!(after_resolve.resolved_by.as_deref(), Some("head:claude"));
        assert_eq!(after_resolve.resolution_receipt.as_deref(), Some("commit:abc123"));

        let latest = cp.replay_annotation(&ann.id, i64::MAX).unwrap().unwrap();
        assert!(latest.resolved && latest.orphan);
        assert_eq!(latest.reply_count, 1);
        assert_eq!(latest.last_event, Some(AnnotationEventKind::Orphaned));

        // A cut before anything happened has no state to replay.
        assert!(cp.replay_annotation(&ann.id, 0).unwrap().is_none());
        // An unknown annotation has an empty history.
        assert!(cp.annotation_history("missing").unwrap().is_empty());
    }
}
