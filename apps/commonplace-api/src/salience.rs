//! Salience: which passages of a page connect back to the tenant's knowledge
//! (HANDOFF-MARGIN-RECALL D2). The margin-recall product surface.
//!
//! Where [`discover`](crate::discover) finds latent item<->item links *inside*
//! the store, salience runs over an *external* page's visible text and asks the
//! inverse question: which spans of what the user is reading connect to what
//! they already saved? Each answer is a [`SalienceCandidate`] whose anchor is a
//! W3C text-quote + position over the *page* text, reusing the exact
//! [`commonplace::annotation`] wire types the D3 store persists, so a highlight
//! the pipeline proposes and a highlight the store keeps are the same shape.
//!
//! Two tiers, both honest about their floor (spec: "anchoring/precision degrades
//! honestly"):
//! - **Semantic** rides the existing embedding index (the same
//!   [`IngestPipeline::search`] cosine seam `discover` uses): a passage whose
//!   embedding is near a stored item's is a connection.
//! - **Exact** is the local verbatim floor: a passage that *names* a stored
//!   item (its title appears word-bounded in the span) is a high-confidence
//!   connection needing no similarity model. The richer DATAWAVE field-fact
//!   source the spec names would *extend* this tier; it is absent in this
//!   checkout (VF5), so exact is the local title match alone, and that absence
//!   is named rather than faked.
//!
//! Thresholds and budget are [`SalienceConfig`] args, not constants, so the D7
//! dial can hand `quiet()` (exact only, higher bar) or `active()` (both tiers)
//! without the pipeline hard-coding a policy. Results cache by page content hash
//! (D2-3) and the compute path is timed (D2-4); the *measured cold number on a
//! real node* stays a named gap (VF8), the instrumentation does not.

use std::collections::{HashMap, HashSet};
use std::time::Instant;

use commonplace::annotation::{TextPositionSelector, TextQuoteSelector};
use commonplace::{BlobStore, Commonplace, EmbeddingGraphStore, IngestPipeline, Item, ItemBody};
use rustyred_thg_core::GraphStoreResult;
use serde::{Deserialize, Serialize};

/// Which retrieval tier surfaced a candidate. Wire value is snake_case, parity
/// with the TS `SalienceTier` union.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SalienceTier {
    /// The passage verbatim names a stored item (or, when wired, a DATAWAVE
    /// field-fact). Ranks ahead of semantic.
    Exact,
    /// The passage embeds near a stored item under the ingest index.
    Semantic,
}

/// A page span plus the context that disambiguates repeats: a W3C text quote and
/// the character range it was resolved at. The quote is authoritative; the
/// position is the re-anchor hint the overlay prefers on an unchanged revisit
/// (same contract as [`commonplace::annotation::Anchor::TextQuote`]).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SalienceAnchor {
    pub quote: TextQuoteSelector,
    pub position: TextPositionSelector,
}

/// One proposed margin-recall highlight: where on the page, which tier found it,
/// the connection explanation shown in the margin, its score, and the stored
/// records it connects to (the openable provenance chain, D6-2).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SalienceCandidate {
    pub anchor: SalienceAnchor,
    pub tier: SalienceTier,
    pub explanation: String,
    pub score: f64,
    /// Ids of the stored items this passage connects to, strongest first. Each
    /// is an openable record in the provenance chain.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub refs: Vec<String>,
}

/// Tuning for salience. Thresholds and budget are args (D2 acceptance: "threshold
/// + budget are config args, not constants") so the D7 dial supplies the policy.
#[derive(Clone, Debug)]
pub struct SalienceConfig {
    /// Minimum cosine similarity for a semantic connection.
    pub min_similarity: f64,
    /// Max candidates returned (the D4 overlay budget cap).
    pub max_candidates: usize,
    /// Stored neighbors examined per passage in the semantic tier.
    pub per_passage_neighbors: usize,
    /// Passages shorter than this (chars) are never anchored.
    pub min_passage_chars: usize,
    /// Information gate: a passage needs at least this many content tokens
    /// (length > 3, non-stopword) to be considered. An in-repo term-frequency
    /// proxy standing in for a real corpus-IDF gate (absent without Valkey).
    pub min_content_tokens: usize,
    /// Chars of prefix/suffix captured around a span for quote disambiguation.
    pub context_chars: usize,
    /// Run the exact (verbatim-title) tier.
    pub exact_tier_enabled: bool,
    /// Run the semantic (embedding) tier.
    pub semantic_tier_enabled: bool,
    /// Shortest stored title eligible for exact matching (guards against noisy
    /// short titles matching common words).
    pub min_exact_title_chars: usize,
}

impl Default for SalienceConfig {
    fn default() -> Self {
        Self {
            min_similarity: 0.55,
            max_candidates: 5,
            per_passage_neighbors: 6,
            min_passage_chars: 24,
            min_content_tokens: 3,
            context_chars: 32,
            exact_tier_enabled: true,
            semantic_tier_enabled: true,
            min_exact_title_chars: 6,
        }
    }
}

impl SalienceConfig {
    /// D7 **Active**: both tiers at the standard threshold.
    pub fn active() -> Self {
        Self::default()
    }

    /// D7 **Quiet**: exact tier only, higher threshold. Honors non-goal 4 (no
    /// proactive semantic surfacing in Quiet) and D2-5 (not auto-surfaced unless
    /// Active) at the config layer: with the semantic tier off, a page that only
    /// embeds-near a note yields nothing.
    pub fn quiet() -> Self {
        Self {
            semantic_tier_enabled: false,
            min_similarity: 0.72,
            ..Self::default()
        }
    }
}

/// Whether a cached page hash produced this result or it was recomputed.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CacheStatus {
    Miss,
    Hit,
}

/// A salience run plus its cache disposition and compute latency (D2-4).
#[derive(Clone, Debug)]
pub struct SalienceResult {
    pub candidates: Vec<SalienceCandidate>,
    pub cache: CacheStatus,
    /// Wall-clock of the compute path in ms; 0 on a cache hit. The measured
    /// cold number on a real node is a named gap (VF8); this is the seam.
    pub elapsed_ms: u64,
}

/// Result cache keyed by page content hash (`blake3:<hex>`, D2-3). A repeat
/// visit to an unchanged page returns the prior candidates without recomputing.
#[derive(Clone, Debug, Default)]
pub struct SalienceCache {
    entries: HashMap<String, Vec<SalienceCandidate>>,
}

impl SalienceCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, content_hash: &str) -> Option<&Vec<SalienceCandidate>> {
        self.entries.get(content_hash)
    }

    pub fn insert(&mut self, content_hash: impl Into<String>, candidates: Vec<SalienceCandidate>) {
        self.entries.insert(content_hash.into(), candidates);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Run salience over `page_text` against the tenant store. Returns ranked
/// candidates (exact tier first, then score), deduplicated by span and capped to
/// the config budget. A page with no connections returns an empty vec (zero UI).
pub fn salience<S, B>(
    cp: &Commonplace<S, B>,
    page_text: &str,
    config: &SalienceConfig,
) -> GraphStoreResult<Vec<SalienceCandidate>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let chars: Vec<char> = page_text.chars().collect();
    let passages = segment_passages(&chars, config.min_passage_chars);
    if passages.is_empty() {
        return Ok(Vec::new());
    }

    // Exact-tier corpus: stored titles. DATAWAVE field-facts would extend this
    // (VF5, named gap); absent here, the exact tier is the verbatim-title floor.
    let items = if config.exact_tier_enabled {
        cp.all_items()?
    } else {
        Vec::new()
    };
    let pipeline = IngestPipeline::default();

    let mut candidates: Vec<SalienceCandidate> = Vec::new();
    for passage in &passages {
        if !passes_information_gate(&passage.text, config.min_content_tokens) {
            continue;
        }

        // Exact tier wins a passage outright: a page that literally names a
        // saved item is a stronger signal than an embedding neighbor, and one
        // span should not carry two overlapping highlights.
        let mut claimed = false;
        if config.exact_tier_enabled {
            if let Some(candidate) = exact_candidate(&chars, passage, &items, config) {
                candidates.push(candidate);
                claimed = true;
            }
        }
        if config.semantic_tier_enabled && !claimed {
            if let Some(candidate) =
                semantic_candidate(cp, &pipeline, &chars, passage, config)?
            {
                candidates.push(candidate);
            }
        }
    }

    rank_and_cap(&mut candidates, config.max_candidates);
    Ok(candidates)
}

/// Salience with the D2-3 result cache and D2-4 latency seam. On a cache hit the
/// prior candidates are returned as-is with `elapsed_ms == 0`; on a miss the
/// compute path is timed and the result stored under `content_hash`.
pub fn salience_cached<S, B>(
    cp: &Commonplace<S, B>,
    page_text: &str,
    content_hash: &str,
    config: &SalienceConfig,
    cache: &mut SalienceCache,
) -> GraphStoreResult<SalienceResult>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    if let Some(cached) = cache.get(content_hash) {
        return Ok(SalienceResult {
            candidates: cached.clone(),
            cache: CacheStatus::Hit,
            elapsed_ms: 0,
        });
    }
    let started = Instant::now();
    let candidates = salience(cp, page_text, config)?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    cache.insert(content_hash.to_string(), candidates.clone());
    Ok(SalienceResult {
        candidates,
        cache: CacheStatus::Miss,
        elapsed_ms,
    })
}

/// A trimmed page span with its char offsets into the page text.
struct Passage {
    text: String,
    start: u32,
    end: u32,
}

/// Split page text into sentence-ish passages, tracking char offsets. A boundary
/// is `.`/`!`/`?`/newline followed by whitespace or end-of-text. Offsets are
/// character indices (the position is a hint; the quote is authoritative, so
/// exact code-unit parity with the JS side is not required, per D3-3).
fn segment_passages(chars: &[char], min_chars: usize) -> Vec<Passage> {
    let mut passages = Vec::new();
    let mut start = 0usize;
    let mut index = 0usize;
    while index < chars.len() {
        let ch = chars[index];
        let boundary = matches!(ch, '.' | '!' | '?' | '\n')
            && chars
                .get(index + 1)
                .map(|next| next.is_whitespace())
                .unwrap_or(true);
        if boundary {
            push_passage(chars, start, index + 1, min_chars, &mut passages);
            let mut next = index + 1;
            while next < chars.len() && chars[next].is_whitespace() {
                next += 1;
            }
            start = next;
            index = next;
            continue;
        }
        index += 1;
    }
    if start < chars.len() {
        push_passage(chars, start, chars.len(), min_chars, &mut passages);
    }
    passages
}

fn push_passage(chars: &[char], start: usize, end: usize, min_chars: usize, out: &mut Vec<Passage>) {
    let mut begin = start;
    let mut finish = end;
    while begin < finish && chars[begin].is_whitespace() {
        begin += 1;
    }
    while finish > begin && chars[finish - 1].is_whitespace() {
        finish -= 1;
    }
    if finish <= begin {
        return;
    }
    let text: String = chars[begin..finish].iter().collect();
    if text.chars().count() < min_chars {
        return;
    }
    out.push(Passage {
        text,
        start: begin as u32,
        end: finish as u32,
    });
}

/// In-repo term-frequency information gate: a passage needs at least
/// `min_content_tokens` content tokens (length > 3, non-stopword). This is the
/// honest degrade of a corpus-IDF gate (real document frequencies live in
/// Valkey, absent here); it keeps low-information spans (nav chrome, stopword
/// runs) from ever anchoring.
fn passes_information_gate(text: &str, min_content_tokens: usize) -> bool {
    let content = text
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|token| token.len() > 3 && !is_stopword(&token.to_ascii_lowercase()))
        .count();
    content >= min_content_tokens
}

fn is_stopword(lower: &str) -> bool {
    matches!(
        lower,
        "the" | "and"
            | "for"
            | "that"
            | "this"
            | "with"
            | "from"
            | "have"
            | "were"
            | "was"
            | "are"
            | "but"
            | "not"
            | "you"
            | "your"
            | "its"
            | "into"
            | "than"
            | "then"
            | "they"
            | "them"
            | "our"
            | "their"
            | "which"
            | "would"
            | "could"
    )
}

/// Build the anchor for a passage: the exact quote plus prefix/suffix context
/// windows and the resolved char range.
fn anchor_for(chars: &[char], passage: &Passage, context_chars: usize) -> SalienceAnchor {
    let start = passage.start as usize;
    let end = passage.end as usize;
    let prefix_start = start.saturating_sub(context_chars);
    let prefix: String = chars[prefix_start..start].iter().collect();
    let suffix_end = (end + context_chars).min(chars.len());
    let suffix: String = chars[end..suffix_end].iter().collect();
    SalienceAnchor {
        quote: TextQuoteSelector {
            exact: passage.text.clone(),
            prefix: (!prefix.trim().is_empty()).then_some(prefix),
            suffix: (!suffix.trim().is_empty()).then_some(suffix),
        },
        position: TextPositionSelector {
            start: passage.start,
            end: passage.end,
        },
    }
}

/// Exact tier: the first stored item whose title appears word-bounded in the
/// passage. Score 1.0; the connection is that the page names a saved record.
fn exact_candidate(
    chars: &[char],
    passage: &Passage,
    items: &[Item],
    config: &SalienceConfig,
) -> Option<SalienceCandidate> {
    let haystack = passage.text.to_ascii_lowercase();
    for item in items {
        let title = item.title.trim();
        if title.chars().count() < config.min_exact_title_chars {
            continue;
        }
        let needle = title.to_ascii_lowercase();
        if contains_word_bounded(&haystack, &needle) {
            return Some(SalienceCandidate {
                anchor: anchor_for(chars, passage, config.context_chars),
                tier: SalienceTier::Exact,
                explanation: format!(
                    "This passage names \"{title}\", which is already in your library."
                ),
                score: 1.0,
                refs: vec![item.id.clone()],
            });
        }
    }
    None
}

/// Semantic tier: the strongest stored neighbor of the passage above threshold
/// that also shares content vocabulary with it.
///
/// The lexical floor is a precision guard, not the ranking signal: an embedding
/// neighbor that shares no content token with the passage is a false positive
/// (a real error class for any embedder, and acute under the low-dimensional
/// offline embedder, whose hash buckets collide). Cosine still ranks; the floor
/// only vetoes. Genuine connections share vocabulary, so it never suppresses a
/// real match.
fn semantic_candidate<S, B>(
    cp: &Commonplace<S, B>,
    pipeline: &IngestPipeline,
    chars: &[char],
    passage: &Passage,
    config: &SalienceConfig,
) -> GraphStoreResult<Option<SalienceCandidate>>
where
    S: EmbeddingGraphStore,
    B: BlobStore,
{
    let hits = pipeline.search(cp, &passage.text, config.per_passage_neighbors)?;
    let mut scored: Vec<(String, f64)> = hits
        .into_iter()
        .map(|(id, distance)| (id, 1.0 - distance as f64))
        .filter(|(_, similarity)| *similarity >= config.min_similarity)
        .collect();
    if scored.is_empty() {
        return Ok(None);
    }
    scored.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });

    let passage_tokens = content_tokens(&passage.text);
    let mut connected: Vec<(String, f64, String)> = Vec::new();
    for (id, similarity) in scored {
        let Some(item) = cp.get_item(&id)? else {
            continue;
        };
        if shares_content_token(&passage_tokens, &item) {
            connected.push((id, similarity, item.title));
        }
    }
    let Some((_, best_score, title)) = connected.first().cloned() else {
        return Ok(None);
    };
    Ok(Some(SalienceCandidate {
        anchor: anchor_for(chars, passage, config.context_chars),
        tier: SalienceTier::Semantic,
        explanation: format!("Related to your note \"{title}\" (similarity {best_score:.2})."),
        score: best_score,
        refs: connected.into_iter().map(|(id, _, _)| id).collect(),
    }))
}

/// Content tokens of a text: lowercased alphanumeric runs longer than three
/// chars that are not stopwords. The same extraction the information gate uses,
/// reused as the semantic tier's lexical-overlap key.
fn content_tokens(text: &str) -> HashSet<String> {
    text.split(|ch: char| !ch.is_alphanumeric())
        .filter_map(|token| {
            let lower = token.to_ascii_lowercase();
            (lower.len() > 3 && !is_stopword(&lower)).then_some(lower)
        })
        .collect()
}

/// Whether a stored item's title-plus-body shares any content token with the
/// passage.
fn shares_content_token(passage_tokens: &HashSet<String>, item: &Item) -> bool {
    let mut text = item.title.clone();
    if let ItemBody::Inline { text: body } = &item.body {
        text.push(' ');
        text.push_str(body);
    }
    content_tokens(&text)
        .iter()
        .any(|token| passage_tokens.contains(token))
}

/// True when `needle` occurs in `haystack` with non-alphanumeric (or edge)
/// boundaries on both sides, so "war" does not match inside "warden". Both
/// arguments are already lowercased by the caller.
fn contains_word_bounded(haystack: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return false;
    }
    let mut from = 0usize;
    while let Some(offset) = haystack[from..].find(needle) {
        let at = from + offset;
        let before_ok = at == 0
            || !haystack[..at]
                .chars()
                .next_back()
                .map(|ch| ch.is_alphanumeric())
                .unwrap_or(false);
        let after = at + needle.len();
        let after_ok = after >= haystack.len()
            || !haystack[after..]
                .chars()
                .next()
                .map(|ch| ch.is_alphanumeric())
                .unwrap_or(false);
        if before_ok && after_ok {
            return true;
        }
        from = at + needle.len();
        if from > haystack.len() {
            break;
        }
    }
    false
}

/// Rank exact-tier first, then by score descending, then by span start; drop
/// duplicate spans (an exact and semantic hit on the same passage keeps exact);
/// cap to the budget.
fn rank_and_cap(candidates: &mut Vec<SalienceCandidate>, max_candidates: usize) {
    candidates.sort_by(|left, right| {
        tier_rank(left.tier)
            .cmp(&tier_rank(right.tier))
            .then_with(|| {
                right
                    .score
                    .partial_cmp(&left.score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| left.anchor.position.start.cmp(&right.anchor.position.start))
    });
    let mut seen: HashSet<(u32, u32)> = HashSet::new();
    candidates.retain(|candidate| {
        seen.insert((candidate.anchor.position.start, candidate.anchor.position.end))
    });
    candidates.truncate(max_candidates);
}

fn tier_rank(tier: SalienceTier) -> u8 {
    match tier {
        SalienceTier::Exact => 0,
        SalienceTier::Semantic => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use commonplace::{IngestInput, InMemoryBlobStore, ItemKind};
    use rustyred_thg_core::InMemoryGraphStore;

    fn store() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
        Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
    }

    fn seed(cp: &mut Commonplace<InMemoryGraphStore, InMemoryBlobStore>, title: &str, text: &str) -> String {
        IngestPipeline::default()
            .ingest(cp, IngestInput::text(title, text, ItemKind::Doc))
            .expect("ingest seeds an embedded item")
            .item
            .id
    }

    #[test]
    fn seeded_tenant_yields_semantic_candidate_with_complete_explanation() {
        // A saved note; the page shares its distinctive tokens but never names
        // the title verbatim, so only the semantic tier can fire.
        let mut cp = store();
        let id = seed(
            &mut cp,
            "Greek Art Notes",
            "marble sculpture athens acropolis parthenon frieze carving",
        );

        let page = "Yesterday was ordinary. \
             The marble sculpture athens acropolis parthenon frieze carving still stands. \
             Nothing else happened.";
        let candidates = salience(&cp, page, &SalienceConfig::default()).unwrap();

        assert_eq!(candidates.len(), 1, "one connected passage");
        let candidate = &candidates[0];
        assert_eq!(candidate.tier, SalienceTier::Semantic);
        assert!(candidate.score >= SalienceConfig::default().min_similarity);
        assert!(
            candidate.explanation.contains("Greek Art Notes"),
            "explanation names the connected record: {}",
            candidate.explanation
        );
        assert!(candidate.refs.contains(&id), "refs carry the openable record");
        // The anchor's char range selects exactly the quoted passage.
        let chars: Vec<char> = page.chars().collect();
        let selected: String = chars
            [candidate.anchor.position.start as usize..candidate.anchor.position.end as usize]
            .iter()
            .collect();
        assert_eq!(selected, candidate.anchor.quote.exact);
        assert!(selected.contains("parthenon"));
    }

    #[test]
    fn exact_tier_matches_verbatim_title_and_ranks_first() {
        let mut cp = store();
        // Distinct titles so the page can name one exactly and embed-near another.
        let war = seed(
            &mut cp,
            "Peloponnesian War",
            "sparta athens conflict alliance siege",
        );
        seed(
            &mut cp,
            "Botany Field Guide",
            "fern spore chlorophyll photosynthesis xylem phloem",
        );

        let page = "The Peloponnesian War reshaped the ancient world forever. \
             Separately, fern spore chlorophyll photosynthesis xylem phloem define plant life.";
        let candidates = salience(&cp, page, &SalienceConfig::default()).unwrap();

        // The exact (verbatim-title) hit sorts ahead of the semantic one.
        assert!(candidates.len() >= 1);
        assert_eq!(candidates[0].tier, SalienceTier::Exact);
        assert_eq!(candidates[0].score, 1.0);
        assert!(candidates[0].refs.contains(&war));
        assert!(candidates[0].explanation.contains("Peloponnesian War"));
        // Exact-first: no semantic candidate outranks it.
        assert!(candidates
            .iter()
            .take_while(|c| c.tier == SalienceTier::Exact)
            .all(|c| c.score == 1.0));
    }

    #[test]
    fn no_connection_page_yields_zero_candidates() {
        let mut cp = store();
        seed(
            &mut cp,
            "Greek Art Notes",
            "marble sculpture athens acropolis parthenon frieze",
        );
        // A page about something entirely unrelated, with no shared tokens and
        // no verbatim title: zero candidates, so the overlay renders nothing.
        let page = "Quarterly logistics throughput improved. \
             Warehouse forklift routing shortened dwell time across every depot.";
        let candidates = salience(&cp, page, &SalienceConfig::default()).unwrap();
        assert!(candidates.is_empty(), "no connection means zero UI");
    }

    #[test]
    fn budget_caps_and_dedups() {
        let mut cp = store();
        seed(
            &mut cp,
            "Greek Art Notes",
            "marble sculpture athens acropolis parthenon frieze carving",
        );
        // Eight passages all sharing the note's tokens; budget of 3 caps them.
        let mut page = String::new();
        for _ in 0..8 {
            page.push_str(
                "The marble sculpture athens acropolis parthenon frieze carving endures here. ",
            );
        }
        let config = SalienceConfig {
            max_candidates: 3,
            ..SalienceConfig::default()
        };
        let candidates = salience(&cp, &page, &config).unwrap();
        assert_eq!(candidates.len(), 3, "capped to the budget");
        // Distinct spans (dedup by position).
        let spans: HashSet<(u32, u32)> = candidates
            .iter()
            .map(|c| (c.anchor.position.start, c.anchor.position.end))
            .collect();
        assert_eq!(spans.len(), candidates.len(), "no duplicate spans");
    }

    #[test]
    fn quiet_config_suppresses_the_semantic_tier() {
        // D2-5 / D7-2: a page that only embeds-near a note (no verbatim title)
        // yields a candidate in Active but nothing in Quiet.
        let mut cp = store();
        seed(
            &mut cp,
            "Greek Art Notes",
            "marble sculpture athens acropolis parthenon frieze carving",
        );
        let page = "The marble sculpture athens acropolis parthenon frieze carving still stands today.";

        let active = salience(&cp, page, &SalienceConfig::active()).unwrap();
        assert_eq!(active.len(), 1, "Active surfaces the semantic connection");

        let quiet = salience(&cp, page, &SalienceConfig::quiet()).unwrap();
        assert!(quiet.is_empty(), "Quiet does not surface semantic connections");
    }

    #[test]
    fn cache_hits_on_unchanged_page_and_times_the_miss() {
        let mut cp = store();
        seed(
            &mut cp,
            "Greek Art Notes",
            "marble sculpture athens acropolis parthenon frieze carving",
        );
        let page = "The marble sculpture athens acropolis parthenon frieze carving still stands today.";
        let hash = "blake3:deadbeef";
        let mut cache = SalienceCache::new();

        // First visit computes and caches (a miss).
        let first = salience_cached(&cp, page, hash, &SalienceConfig::default(), &mut cache).unwrap();
        assert_eq!(first.cache, CacheStatus::Miss);
        assert_eq!(first.candidates.len(), 1);
        assert_eq!(cache.len(), 1);

        // Revisit the same hash: served from cache, unaffected even though the
        // store changed underneath, proving it did not recompute.
        seed(&mut cp, "Distraction", "totally unrelated tokens zzz qqq");
        let second = salience_cached(&cp, page, hash, &SalienceConfig::default(), &mut cache).unwrap();
        assert_eq!(second.cache, CacheStatus::Hit);
        assert_eq!(second.elapsed_ms, 0);
        assert_eq!(second.candidates, first.candidates, "cache returned the prior result");
    }

    #[test]
    fn candidate_json_matches_the_ts_wire_shape() {
        // Wire-parity guard (D2-1): snake_case tier tag, quote/position anchor,
        // omitted-empty refs, matching what the TS SalienceCandidate expects.
        let candidate = SalienceCandidate {
            anchor: SalienceAnchor {
                quote: TextQuoteSelector {
                    exact: "the sculptor of Athens".to_string(),
                    prefix: Some("was ".to_string()),
                    suffix: None,
                },
                position: TextPositionSelector { start: 4, end: 26 },
            },
            tier: SalienceTier::Exact,
            explanation: "names a saved record".to_string(),
            score: 1.0,
            refs: vec!["item:1".to_string()],
        };
        let json = serde_json::to_value(&candidate).unwrap();
        assert_eq!(json["tier"], "exact");
        assert_eq!(json["anchor"]["quote"]["exact"], "the sculptor of Athens");
        assert_eq!(json["anchor"]["quote"]["prefix"], "was ");
        assert!(json["anchor"]["quote"].get("suffix").is_none(), "absent context omitted");
        assert_eq!(json["anchor"]["position"]["start"], 4);
        assert_eq!(json["refs"][0], "item:1");
        let back: SalienceCandidate = serde_json::from_value(json).unwrap();
        assert_eq!(back, candidate, "round-trips");
    }
}
