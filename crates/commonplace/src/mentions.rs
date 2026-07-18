//! Unlinked-mention detection (HANDOFF-CARDS-ACTIONS-MENTIONS K5/K6).
//!
//! Unlinked mentions are identity-edge candidates, and the reconstruction
//! guardrail is the spine: detection proposes, a person confirms, and the
//! confirmed edge records its basis (matched alias, atom, span). Nothing
//! auto-links.
//!
//! The pass matches object titles and aliases against atom text on two tiers,
//! exact and normalized-exact (the semantic tier is explicitly out of this
//! round). It runs incrementally on new or edited atoms (mirroring the
//! `resolve_entities` seam in ingest), never as a full rescan. Candidates are
//! plain items of kind `mention-candidate`, so they ride the object seam like
//! anything else; their deterministic id keys (object, atom, alias), which is
//! also the suppression record: a dismissed candidate never reappears on
//! re-evaluation because the id already exists.
//!
//! Normalization for the second tier: casefold plus punctuation stripped to
//! spaces, whitespace collapsed. The recorded span always slices the ORIGINAL
//! atom text back to the matched alias.

use serde_json::{json, Map, Value};

use rustyred_thg_core::{EdgeRecord, GraphStore, GraphStoreError, GraphStoreResult};

use crate::blob::BlobStore;
use crate::item::{Item, ItemBody, ItemKind};
use crate::renderable::item_object_type_slug;
use crate::store::Commonplace;

/// The candidate kind on the object seam.
pub const MENTION_CANDIDATE_KIND: &str = "mention-candidate";
/// The identity edge a confirmation writes: object MENTIONED_IN atom.
pub const MENTIONED_IN_EDGE: &str = "MENTIONED_IN";

/// Kinds that never act as mention targets or atoms: seam metadata.
const META_KINDS: [&str; 2] = [MENTION_CANDIDATE_KIND, "card-template"];
/// Aliases shorter than this are noise, not identity.
const MIN_ALIAS_LEN: usize = 3;
/// Snippet window on each side of the match, in characters.
const SNIPPET_CONTEXT: usize = 60;

#[derive(Clone, Debug, PartialEq)]
pub struct MentionMatch {
    pub object_id: String,
    pub atom_id: String,
    pub matched_alias: String,
    /// "exact" or "normalized".
    pub tier: &'static str,
    /// Char offsets into the atom's original text.
    pub span_start: usize,
    pub span_end: usize,
    pub snippet: String,
    /// Char offsets of the match within `snippet`.
    pub snippet_start: usize,
    pub snippet_end: usize,
}

/// The deterministic candidate id: also the dedup and suppression key.
pub fn mention_candidate_id(object_id: &str, atom_id: &str, alias: &str) -> String {
    format!("mention:{object_id}:{atom_id}:{}", alias_slug(alias))
}

fn alias_slug(alias: &str) -> String {
    let mut out = String::with_capacity(alias.len());
    for ch in alias.chars() {
        if ch.is_alphanumeric() {
            out.extend(ch.to_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').to_string()
}

/// The text a detection pass scans: the atom's inline body. Blob and empty
/// bodies carry no scannable text in this round.
fn atom_text(item: &Item) -> Option<&str> {
    match &item.body {
        ItemBody::Inline { text } if !text.trim().is_empty() => Some(text),
        _ => None,
    }
}

/// The aliases an object is known by: its title plus any `aliases` string
/// list in `extra`. (No kind carries a dedicated alias field today; the
/// `aliases` property is the convention this pass reads.)
fn aliases_of(item: &Item) -> Vec<String> {
    let mut aliases = Vec::new();
    let title = item.title.trim();
    if title.chars().count() >= MIN_ALIAS_LEN {
        aliases.push(title.to_string());
    }
    if let Some(Value::Array(values)) = item.extra.get("aliases") {
        for value in values {
            if let Some(text) = value.as_str() {
                let text = text.trim();
                if text.chars().count() >= MIN_ALIAS_LEN && !aliases.iter().any(|a| a == text) {
                    aliases.push(text.to_string());
                }
            }
        }
    }
    aliases
}

fn is_word_char(ch: char) -> bool {
    ch.is_alphanumeric()
}

/// Exact-tier find: the alias as a substring on word boundaries. Returns char
/// offsets into `text`.
fn find_exact(text: &str, alias: &str) -> Option<(usize, usize)> {
    let text_chars: Vec<char> = text.chars().collect();
    let alias_chars: Vec<char> = alias.chars().collect();
    if alias_chars.is_empty() || alias_chars.len() > text_chars.len() {
        return None;
    }
    for start in 0..=(text_chars.len() - alias_chars.len()) {
        if text_chars[start..start + alias_chars.len()] != alias_chars[..] {
            continue;
        }
        let boundary_before = start == 0 || !is_word_char(text_chars[start - 1]);
        let end = start + alias_chars.len();
        let boundary_after = end == text_chars.len() || !is_word_char(text_chars[end]);
        if boundary_before && boundary_after {
            return Some((start, end));
        }
    }
    None
}

/// Normalized view of a string: casefolded, punctuation as spaces, whitespace
/// collapsed. Each normalized char carries the char offset of its source in
/// the original, so a normalized match maps back to an original span.
fn normalized_view(text: &str) -> (Vec<char>, Vec<usize>) {
    let mut chars = Vec::new();
    let mut map = Vec::new();
    let mut last_space = true;
    for (index, ch) in text.chars().enumerate() {
        if ch.is_alphanumeric() {
            for lowered in ch.to_lowercase() {
                chars.push(lowered);
                map.push(index);
            }
            last_space = false;
        } else if !last_space {
            chars.push(' ');
            map.push(index);
            last_space = true;
        }
    }
    (chars, map)
}

/// Normalized-tier find: match in normalized space, span in original chars.
fn find_normalized(text: &str, alias: &str) -> Option<(usize, usize)> {
    let (text_norm, map) = normalized_view(text);
    let (alias_norm, _) = normalized_view(alias);
    let alias_norm: Vec<char> = alias_norm
        .iter()
        .copied()
        .skip_while(|c| *c == ' ')
        .collect();
    let alias_trimmed: Vec<char> = alias_norm
        .iter()
        .rev()
        .copied()
        .skip_while(|c| *c == ' ')
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if alias_trimmed.is_empty() || alias_trimmed.len() > text_norm.len() {
        return None;
    }
    for start in 0..=(text_norm.len() - alias_trimmed.len()) {
        if text_norm[start..start + alias_trimmed.len()] != alias_trimmed[..] {
            continue;
        }
        let boundary_before = start == 0 || text_norm[start - 1] == ' ';
        let end = start + alias_trimmed.len();
        let boundary_after = end == text_norm.len() || text_norm[end] == ' ';
        if boundary_before && boundary_after {
            let orig_start = map[start];
            let orig_end = map[end - 1] + 1;
            return Some((orig_start, orig_end));
        }
    }
    None
}

fn snippet_around(text: &str, span_start: usize, span_end: usize) -> (String, usize, usize) {
    let chars: Vec<char> = text.chars().collect();
    let start = span_start.saturating_sub(SNIPPET_CONTEXT);
    let end = (span_end + SNIPPET_CONTEXT).min(chars.len());
    let snippet: String = chars[start..end].iter().collect();
    (snippet, span_start - start, span_end - start)
}

/// Match one target's aliases against one atom's text. Exact tier wins per
/// alias; the normalized tier fires only when exact found nothing.
pub fn match_aliases(object_id: &str, atom_id: &str, text: &str, aliases: &[String]) -> Vec<MentionMatch> {
    let mut matches = Vec::new();
    for alias in aliases {
        let found = find_exact(text, alias)
            .map(|span| (span, "exact"))
            .or_else(|| find_normalized(text, alias).map(|span| (span, "normalized")));
        if let Some(((span_start, span_end), tier)) = found {
            let (snippet, snippet_start, snippet_end) = snippet_around(text, span_start, span_end);
            matches.push(MentionMatch {
                object_id: object_id.to_string(),
                atom_id: atom_id.to_string(),
                matched_alias: alias.clone(),
                tier,
                span_start,
                span_end,
                snippet,
                snippet_start,
                snippet_end,
            });
        }
    }
    matches
}

fn candidate_item(m: &MentionMatch) -> Item {
    let mut extra = Map::new();
    extra.insert("object_id".into(), Value::String(m.object_id.clone()));
    extra.insert("atom_id".into(), Value::String(m.atom_id.clone()));
    extra.insert("matched_alias".into(), Value::String(m.matched_alias.clone()));
    extra.insert("tier".into(), Value::String(m.tier.to_string()));
    extra.insert("span_start".into(), json!(m.span_start));
    extra.insert("span_end".into(), json!(m.span_end));
    extra.insert("snippet".into(), Value::String(m.snippet.clone()));
    extra.insert("snippet_start".into(), json!(m.snippet_start));
    extra.insert("snippet_end".into(), json!(m.snippet_end));
    let mut item = Item::new(
        ItemKind::Other(MENTION_CANDIDATE_KIND.to_string()),
        format!("{} in {}", m.matched_alias, m.atom_id),
    );
    item.id = mention_candidate_id(&m.object_id, &m.atom_id, &m.matched_alias);
    // Status rides the item's indexed scalar (the same slot tasks use), so a
    // wire patch of `status` lands where filters and the projection read it.
    item.status = Some("unlinked".to_string());
    item.extra = extra;
    item
}

impl<S, B> Commonplace<S, B>
where
    S: GraphStore,
    B: BlobStore,
{
    /// Incremental detection for one atom (a new or edited text-bearing
    /// item): every other object's title and aliases are matched against the
    /// atom's text, and fresh candidates are filed. Existing candidate ids
    /// (unlinked, confirmed, or dismissed) are left untouched, which is what
    /// keeps dismissals suppressed across re-evaluation.
    pub fn evaluate_mentions_for_atom(&mut self, atom_id: &str) -> GraphStoreResult<Vec<Item>> {
        let Some(atom) = self.get_item(atom_id)? else {
            return Ok(Vec::new());
        };
        if META_KINDS.contains(&item_object_type_slug(&atom).as_str()) {
            return Ok(Vec::new());
        }
        let Some(text) = atom_text(&atom).map(str::to_string) else {
            return Ok(Vec::new());
        };
        let targets: Vec<(String, Vec<String>)> = self
            .all_items()?
            .into_iter()
            .filter(|item| item.id != atom_id)
            .filter(|item| !META_KINDS.contains(&item_object_type_slug(item).as_str()))
            .map(|item| {
                let aliases = aliases_of(&item);
                (item.id, aliases)
            })
            .filter(|(_, aliases)| !aliases.is_empty())
            .collect();

        let mut created = Vec::new();
        for (object_id, aliases) in targets {
            for m in match_aliases(&object_id, atom_id, &text, &aliases) {
                let id = mention_candidate_id(&m.object_id, &m.atom_id, &m.matched_alias);
                if self.get_item(&id)?.is_some() {
                    continue;
                }
                let stored = self.put_item(candidate_item(&m))?;
                created.push(stored);
            }
        }
        Ok(created)
    }

    /// The confirm hook (K6): when a `mention_candidate` is patched to
    /// `status: confirmed`, write the identity edge with the basis recorded
    /// on the edge itself (matched alias, atom, span, snippet). Dismissal
    /// needs no extra write: the candidate item is the negative signal.
    pub fn apply_mention_confirmation(&mut self, candidate: &Item) -> GraphStoreResult<()> {
        let get = |key: &str| -> GraphStoreResult<String> {
            candidate
                .extra
                .get(key)
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| {
                    GraphStoreError::new(
                        "mention_candidate_incomplete",
                        format!("candidate {} is missing {key}", candidate.id),
                    )
                })
        };
        let object_id = get("object_id")?;
        let atom_id = get("atom_id")?;
        let basis = json!({
            "basis": {
                "matched_alias": candidate.extra.get("matched_alias").cloned().unwrap_or(Value::Null),
                "atom_id": atom_id,
                "span_start": candidate.extra.get("span_start").cloned().unwrap_or(Value::Null),
                "span_end": candidate.extra.get("span_end").cloned().unwrap_or(Value::Null),
                "snippet": candidate.extra.get("snippet").cloned().unwrap_or(Value::Null),
                "tier": candidate.extra.get("tier").cloned().unwrap_or(Value::Null),
                "candidate_id": candidate.id,
            }
        });
        let edge = EdgeRecord::new(
            format!("mentioned-in:{object_id}:{atom_id}"),
            object_id.as_str(),
            MENTIONED_IN_EDGE,
            atom_id.as_str(),
            basis,
        )
        .with_confidence(1.0);
        self.store_mut().upsert_edge(edge)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_match_respects_word_boundaries() {
        assert_eq!(find_exact("met Ada Lovelace today", "Ada Lovelace"), Some((4, 16)));
        assert_eq!(find_exact("metAda Lovelace today", "Ada"), None);
        assert_eq!(find_exact("Ada.", "Ada"), Some((0, 3)));
    }

    #[test]
    fn normalized_match_maps_back_to_the_original_span() {
        let text = "Talked to A. Lovelace about the engine.";
        let span = find_normalized(text, "a lovelace").expect("normalized hit");
        let original: String = text.chars().skip(span.0).take(span.1 - span.0).collect();
        assert_eq!(original, "A. Lovelace");
    }

    #[test]
    fn snippet_slices_back_to_the_alias() {
        let text = "x".repeat(100) + " Ada Lovelace " + &"y".repeat(100);
        let matches = match_aliases("person:ada", "note:1", &text, &[String::from("Ada Lovelace")]);
        assert_eq!(matches.len(), 1);
        let m = &matches[0];
        let sliced: String = m
            .snippet
            .chars()
            .skip(m.snippet_start)
            .take(m.snippet_end - m.snippet_start)
            .collect();
        assert_eq!(sliced, "Ada Lovelace");
        let original: String = text.chars().skip(m.span_start).take(m.span_end - m.span_start).collect();
        assert_eq!(original, "Ada Lovelace");
    }

    #[test]
    fn exact_tier_wins_over_normalized() {
        let matches = match_aliases("p", "a", "Ada Lovelace wrote notes", &[String::from("Ada Lovelace")]);
        assert_eq!(matches[0].tier, "exact");
    }

    use crate::block_view::{ObjectAction, ObjectQuery};
    use crate::InMemoryBlobStore;
    use rustyred_thg_core::InMemoryGraphStore;

    fn fresh() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
    }

    fn create(
        cp: &mut Commonplace<InMemoryGraphStore, InMemoryBlobStore>,
        type_ref: &str,
        props: Value,
    ) -> String {
        let props = match props {
            Value::Object(map) => map,
            _ => panic!("props must be an object"),
        };
        let receipt = cp
            .emit_object_action(
                ObjectAction::Create {
                    type_ref: type_ref.to_string(),
                    props,
                },
                None,
            )
            .expect("create applies");
        receipt.target_ids[0].clone()
    }

    fn candidates_for(
        cp: &Commonplace<InMemoryGraphStore, InMemoryBlobStore>,
        object_id: &str,
    ) -> Vec<Item> {
        let set = cp
            .query_object_set(ObjectQuery::new([MENTION_CANDIDATE_KIND]))
            .expect("candidate query");
        set.objects
            .into_iter()
            .filter(|obj| {
                obj.properties.get("object_id").and_then(Value::as_str) == Some(object_id)
            })
            .filter_map(|obj| cp.get_item(&obj.id).ok().flatten())
            .collect()
    }

    /// The K5/K6 round trip: seeded aliases yield candidates whose spans
    /// slice the atom text back to the alias; a new matching atom produces
    /// its candidate within one evaluation cycle; nothing auto-creates an
    /// edge; confirmation writes the identity edge with an inspectable
    /// basis; dismissal suppresses the pair across re-evaluation.
    #[test]
    fn candidate_to_confirmed_edge_round_trip() {
        let mut cp = fresh();
        let person_id = create(
            &mut cp,
            "person",
            json!({ "title": "Ada Lovelace", "aliases": ["Countess of Lovelace"] }),
        );

        let atom_1 = create(
            &mut cp,
            "note",
            json!({ "title": "n1", "body": "Met Ada Lovelace at the engine works." }),
        );
        create(
            &mut cp,
            "note",
            json!({ "title": "n2", "body": "The Countess of Lovelace annotated the memoir." }),
        );
        create(
            &mut cp,
            "note",
            json!({ "title": "n3", "body": "ada lovelace, again, in lowercase." }),
        );

        let found = candidates_for(&cp, &person_id);
        assert_eq!(found.len(), 3, "three atoms, one candidate each");
        for candidate in &found {
            let snippet = candidate.extra["snippet"].as_str().unwrap();
            let start = candidate.extra["snippet_start"].as_u64().unwrap() as usize;
            let end = candidate.extra["snippet_end"].as_u64().unwrap() as usize;
            let sliced: String = snippet.chars().skip(start).take(end - start).collect();
            let alias = candidate.extra["matched_alias"].as_str().unwrap();
            assert!(
                sliced.eq_ignore_ascii_case(alias) || sliced.contains(alias),
                "span slices back to the alias: {sliced:?} vs {alias:?}"
            );
            assert_eq!(candidate.status.as_deref(), Some("unlinked"));
        }

        // No candidate auto-creates an edge.
        let edge_id = format!("mentioned-in:{person_id}:{atom_1}");
        assert!(cp.store().get_edge(&edge_id).is_none());

        // A new matching atom produces its candidate within one cycle.
        create(&mut cp, "note", json!({ "title": "n4", "body": "Ada Lovelace, once more." }));
        assert_eq!(candidates_for(&cp, &person_id).len(), 4);

        // Confirm the first candidate: the edge exists and its basis is
        // inspectable from the edge itself.
        let first = found
            .iter()
            .find(|c| c.extra["atom_id"] == json!(atom_1.clone()))
            .expect("candidate for atom 1");
        cp.emit_object_action(
            ObjectAction::Update {
                id: first.id.clone(),
                patch: Map::from_iter([("status".to_string(), json!("confirmed"))]),
            },
            None,
        )
        .expect("confirm applies");
        let edge = cp.store().get_edge(&edge_id).expect("identity edge written");
        assert_eq!(edge.properties["basis"]["matched_alias"], json!("Ada Lovelace"));
        assert_eq!(edge.properties["basis"]["atom_id"], json!(atom_1));
        assert!(edge.properties["basis"]["span_start"].is_number());

        // Dismiss another candidate, then edit its atom: the pair does not
        // reappear and the dismissal is preserved.
        let dismissed = candidates_for(&cp, &person_id)
            .into_iter()
            .find(|c| c.status.as_deref() == Some("unlinked"))
            .expect("an unlinked candidate remains");
        let dismissed_atom = dismissed.extra["atom_id"].as_str().unwrap().to_string();
        cp.emit_object_action(
            ObjectAction::Update {
                id: dismissed.id.clone(),
                patch: Map::from_iter([("status".to_string(), json!("dismissed"))]),
            },
            None,
        )
        .expect("dismiss applies");
        cp.emit_object_action(
            ObjectAction::Update {
                id: dismissed_atom.clone(),
                patch: Map::from_iter([("title".to_string(), json!("edited title"))]),
            },
            None,
        )
        .expect("atom edit applies");
        let after = cp.get_item(&dismissed.id).expect("read").expect("exists");
        assert_eq!(after.status.as_deref(), Some("dismissed"), "dismissal survives re-evaluation");
        assert_eq!(
            candidates_for(&cp, &person_id).len(),
            4,
            "re-evaluation creates no duplicate for the dismissed pair"
        );
    }
}
