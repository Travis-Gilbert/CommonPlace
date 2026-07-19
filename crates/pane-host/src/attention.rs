//! B5 — viewport attention.
//!
//! Off by default, per pane. While it is on, the host samples the text actually
//! visible in the viewport whenever scrolling has settled, and emits the result
//! as quote-anchored spans.
//!
//! The important guarantee is the negative one. `SetAttention(false)` does not
//! sample-and-discard; it stops sampling. [`Attention::sample_script`] returns
//! `None` while off, so no `evaluate_js` call is ever made, and
//! [`Attention::samples`] counts the calls that were made so a test can prove
//! it rather than take it on trust.

use pane_protocol::TextSpan;

use crate::highlight::anchors_from_offsets;

/// How long the page must be still before a sample counts as settled. Measured
/// in the page, because only the page sees the scroll events.
const SETTLE_MS: u64 = 350;

/// Per-pane attention state.
#[derive(Debug, Default)]
pub struct Attention {
    on: bool,
    sequence: u64,
    samples: u64,
    last_text: String,
}

/// What a settled sample produced.
pub struct Observation {
    pub spans: Vec<TextSpan>,
    pub sequence: u64,
}

impl Attention {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_on(&self) -> bool {
        self.on
    }

    /// How many sample scripts have been handed out. The B5 acceptance check:
    /// this must not move while attention is off.
    pub fn samples(&self) -> u64 {
        self.samples
    }

    /// Turn attention on or off. Returns whether the state actually changed, so
    /// the caller can emit `AttentionChanged` once rather than on every request.
    pub fn set(&mut self, on: bool) -> bool {
        if self.on == on {
            return false;
        }
        self.on = on;
        // Forget the last sample: switching back on should re-observe what is
        // on screen now, not stay silent because the viewport never moved.
        self.last_text.clear();
        true
    }

    /// The script to evaluate for the next sample, or `None` when attention is
    /// off. Taking the script is what counts as a sample.
    pub fn sample_script(&mut self) -> Option<String> {
        if !self.on {
            return None;
        }
        self.samples += 1;
        Some(visible_text_script())
    }

    /// Interpret a sample. `None` when the page has not settled, or when the
    /// visible text is unchanged since the last observation — a consumer that
    /// re-received identical spans could not tell a genuine re-read from a
    /// duplicate.
    pub fn observe(&mut self, raw: &str) -> Option<Observation> {
        let sample: Sample = serde_json::from_str(raw).ok()?;
        if !sample.settled {
            return None;
        }
        let text = sample.text.trim();
        if text.is_empty() || text == self.last_text {
            return None;
        }
        self.last_text = text.to_string();
        self.sequence += 1;
        Some(Observation {
            spans: spans_for(text),
            sequence: self.sequence,
        })
    }
}

#[derive(serde::Deserialize)]
struct Sample {
    settled: bool,
    #[serde(default)]
    text: String,
}

/// Split visible text into one anchored span per block.
///
/// Blocks, not the whole viewport as a single quote: a consumer matching these
/// against an extraction needs pieces small enough to line up with paragraphs,
/// and a single multi-thousand-character quote would match nothing.
fn spans_for(text: &str) -> Vec<TextSpan> {
    let mut ranges = Vec::new();
    let mut at = 0usize;
    for line in text.split('\n') {
        let length = line.chars().count();
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let lead = line.chars().take_while(|c| c.is_whitespace()).count();
            ranges.push((at + lead, at + lead + trimmed.chars().count()));
        }
        at += length + 1;
    }
    anchors_from_offsets(text, &ranges)
}

/// The in-page sampler.
///
/// It installs one scroll listener on first use and keeps the timestamp of the
/// last scroll on `window`, so settle detection lives where the scroll events
/// are. The host cannot observe scrolling from outside the engine at all.
fn visible_text_script() -> String {
    format!(
        r#"(function(){{
  var w = window;
  if (!w.__cpAttention) {{
    w.__cpAttention = {{ at: 0 }};
    w.addEventListener('scroll', function() {{ w.__cpAttention.at = Date.now(); }}, true);
  }}
  if (Date.now() - w.__cpAttention.at < {settle}) {{
    return JSON.stringify({{ settled: false, text: '' }});
  }}
  var height = w.innerHeight || document.documentElement.clientHeight;
  var width = w.innerWidth || document.documentElement.clientWidth;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {{
    acceptNode: function(node) {{
      var parent = node.parentNode;
      if (!parent) return NodeFilter.FILTER_REJECT;
      var tag = parent.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }}
  }});
  var lines = [], node;
  while ((node = walker.nextNode())) {{
    var range = document.createRange();
    range.selectNodeContents(node);
    var box = range.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= height || box.right <= 0 || box.left >= width) continue;
    lines.push(node.nodeValue.trim());
  }}
  return JSON.stringify({{ settled: true, text: lines.join('\n') }});
}})()"#,
        settle = SETTLE_MS
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settled(text: &str) -> String {
        serde_json::json!({ "settled": true, "text": text }).to_string()
    }

    #[test]
    fn attention_is_off_by_default_and_samples_nothing() {
        let mut attention = Attention::new();
        assert!(!attention.is_on());
        assert!(attention.sample_script().is_none());
        assert!(attention.sample_script().is_none());
        assert_eq!(attention.samples(), 0);
    }

    #[test]
    fn turning_attention_off_stops_sampling_entirely() {
        let mut attention = Attention::new();
        assert!(attention.set(true));
        assert!(attention.sample_script().is_some());
        assert!(attention.sample_script().is_some());
        assert_eq!(attention.samples(), 2);

        assert!(attention.set(false));
        assert!(attention.sample_script().is_none());
        assert!(attention.sample_script().is_none());
        assert_eq!(attention.samples(), 2, "no sampling while attention is off");
    }

    #[test]
    fn setting_the_state_it_already_has_is_not_a_change() {
        let mut attention = Attention::new();
        assert!(!attention.set(false));
        assert!(attention.set(true));
        assert!(!attention.set(true));
    }

    #[test]
    fn an_unsettled_sample_produces_nothing() {
        let mut attention = Attention::new();
        attention.set(true);
        let raw = serde_json::json!({ "settled": false, "text": "" }).to_string();
        assert!(attention.observe(&raw).is_none());
    }

    #[test]
    fn a_settled_sample_produces_anchored_spans_and_a_rising_sequence() {
        let mut attention = Attention::new();
        attention.set(true);

        let first = attention
            .observe(&settled("First block.\nSecond block."))
            .expect("settled text observes");
        assert_eq!(first.sequence, 1);
        assert_eq!(
            first.spans.iter().map(|s| s.quote.as_str()).collect::<Vec<_>>(),
            vec!["First block.", "Second block."]
        );
        assert_eq!(first.spans[1].prefix, "First block.\n");

        let second = attention
            .observe(&settled("Third block."))
            .expect("new text observes");
        assert_eq!(second.sequence, 2);
    }

    #[test]
    fn an_unchanged_viewport_is_not_re_announced() {
        let mut attention = Attention::new();
        attention.set(true);
        assert!(attention.observe(&settled("Same text.")).is_some());
        assert!(attention.observe(&settled("Same text.")).is_none());
    }

    #[test]
    fn re_enabling_attention_re_observes_the_same_viewport() {
        let mut attention = Attention::new();
        attention.set(true);
        assert!(attention.observe(&settled("Same text.")).is_some());
        attention.set(false);
        attention.set(true);
        assert!(
            attention.observe(&settled("Same text.")).is_some(),
            "turning attention back on must report what is on screen"
        );
    }

    #[test]
    fn the_sampler_measures_settling_in_the_page() {
        let mut attention = Attention::new();
        attention.set(true);
        let script = attention.sample_script().expect("on");
        assert!(script.contains("addEventListener('scroll'"));
        assert!(script.contains(&SETTLE_MS.to_string()));
        assert!(script.contains("getBoundingClientRect"));
    }
}
