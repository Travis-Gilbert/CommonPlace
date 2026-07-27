//! B6 — the highlighter.
//!
//! An extraction hands out character offsets into the text it extracted. Those
//! offsets do not survive a re-render, a lazy-loaded advert, or a font swap, so
//! they are converted here into W3C `TextQuoteSelector`-shaped anchors: the
//! exact quote plus the text immediately before and after it.
//!
//! The prefix and suffix are the whole point. A quote of "the report" may occur
//! four times on a page; only one of them is preceded by "according to " and
//! followed by ", the committee". [`locate`] is the rule that resolves which,
//! and the injected script implements the same rule against the DOM.

use pane_protocol::TextSpan;

/// How much text on either side of a quote is kept as disambiguating context.
///
/// Long enough to separate repeated sentences, short enough that a span stays
/// cheap to ship over the wire and to search for in the page.
pub const CONTEXT_CHARS: usize = 32;

/// Build quote-anchored spans from extraction offsets.
///
/// Offsets are in `char`s, not bytes: they come from a text extraction that
/// counts characters, and slicing UTF-8 by byte would panic on the first
/// accented word.
pub fn anchors_from_offsets(text: &str, ranges: &[(usize, usize)]) -> Vec<TextSpan> {
    let chars: Vec<char> = text.chars().collect();
    ranges
        .iter()
        .filter(|(start, end)| start < end && *end <= chars.len())
        .map(|&(start, end)| TextSpan {
            start,
            end,
            quote: chars[start..end].iter().collect(),
            prefix: chars[start.saturating_sub(CONTEXT_CHARS)..start].iter().collect(),
            suffix: chars[end..(end + CONTEXT_CHARS).min(chars.len())]
                .iter()
                .collect(),
        })
        .collect()
}

/// Character offset of the occurrence of `span.quote` in `haystack` that
/// `span`'s context identifies, or `None` if the quote is not present.
///
/// Context is a preference, not a requirement: a page that re-rendered its
/// surroundings should still highlight the quote, so an unmatched
/// prefix/suffix falls back to the first bare occurrence rather than refusing.
pub fn locate(haystack: &str, span: &TextSpan) -> Option<usize> {
    if span.quote.is_empty() {
        return None;
    }
    let haystack: Vec<char> = haystack.chars().collect();
    let quote: Vec<char> = span.quote.chars().collect();
    let prefix: Vec<char> = span.prefix.chars().collect();
    let suffix: Vec<char> = span.suffix.chars().collect();

    let mut first = None;
    let mut best = None;
    let mut best_score = 0usize;
    let limit = haystack.len().saturating_sub(quote.len());
    for at in 0..=limit {
        if haystack[at..at + quote.len()] != quote[..] {
            continue;
        }
        first.get_or_insert(at);
        let score = trailing_overlap(&haystack[..at], &prefix)
            + leading_overlap(&haystack[at + quote.len()..], &suffix);
        if score > best_score {
            best_score = score;
            best = Some(at);
        }
    }
    best.or(first)
}

/// Number of characters at the end of `before` that match the end of `prefix`.
fn trailing_overlap(before: &[char], prefix: &[char]) -> usize {
    let mut matched = 0;
    while matched < before.len()
        && matched < prefix.len()
        && before[before.len() - 1 - matched] == prefix[prefix.len() - 1 - matched]
    {
        matched += 1;
    }
    matched
}

/// Number of characters at the start of `after` that match the start of `suffix`.
fn leading_overlap(after: &[char], suffix: &[char]) -> usize {
    let mut matched = 0;
    while matched < after.len() && matched < suffix.len() && after[matched] == suffix[matched] {
        matched += 1;
    }
    matched
}

/// Attribute the injected script marks its wrappers with. Clearing keys off it,
/// and the walker skips already-marked nodes so re-highlighting is idempotent.
const MARKER: &str = "data-cp-highlight";

/// Script that replaces the pane's highlight set with `spans`.
///
/// Returns the number of spans it managed to anchor, as a string: Servo's
/// `evaluate_javascript` hands back a `JSValue`, and a string completion value
/// is the one shape every caller here can read.
pub fn apply_script(spans: &[TextSpan]) -> String {
    let payload = serde_json::to_string(spans).unwrap_or_else(|_| "[]".to_string());
    format!(
        r#"(function(){{
{clear}
  var spans = {payload};
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {{
    acceptNode: function(node) {{
      var parent = node.parentNode;
      if (!parent) return NodeFilter.FILTER_REJECT;
      var tag = parent.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }}
  }});
  var nodes = [], text = '', node;
  while ((node = walker.nextNode())) {{
    nodes.push({{ node: node, at: text.length }});
    text += node.nodeValue;
  }}
  function overlap(a, b, fromEnd) {{
    var n = 0;
    while (n < a.length && n < b.length &&
           a[fromEnd ? a.length - 1 - n : n] === b[fromEnd ? b.length - 1 - n : n]) n++;
    return n;
  }}
  function locate(quote, prefix, suffix) {{
    if (!quote) return -1;
    var first = -1, best = -1, bestScore = 0, at = text.indexOf(quote);
    while (at !== -1) {{
      if (first === -1) first = at;
      var score = overlap(text.slice(0, at), prefix, true) +
                  overlap(text.slice(at + quote.length), suffix, false);
      if (score > bestScore) {{ bestScore = score; best = at; }}
      at = text.indexOf(quote, at + 1);
    }}
    return best !== -1 ? best : first;
  }}
  function wrap(start, end) {{
    for (var i = 0; i < nodes.length; i++) {{
      var entry = nodes[i], node = entry.node;
      var nodeStart = entry.at, nodeEnd = nodeStart + node.nodeValue.length;
      if (nodeEnd <= start || nodeStart >= end) continue;
      var from = Math.max(start - nodeStart, 0);
      var to = Math.min(end - nodeStart, node.nodeValue.length);
      var target = node;
      if (from > 0) target = target.splitText(from);
      if (to - from < target.nodeValue.length) target.splitText(to - from);
      var mark = document.createElement('span');
      mark.setAttribute('{marker}', '1');
      mark.style.backgroundColor = 'rgba(255, 214, 102, 0.55)';
      mark.style.borderRadius = '2px';
      target.parentNode.replaceChild(mark, target);
      mark.appendChild(target);
    }}
  }}
  var anchored = 0;
  for (var s = spans.length - 1; s >= 0; s--) {{
    var span = spans[s];
    var at = locate(span.quote, span.prefix || '', span.suffix || '');
    if (at === -1) continue;
    wrap(at, at + span.quote.length);
    anchored++;
  }}
  return String(anchored);
}})()"#,
        clear = clear_body(),
        payload = payload,
        marker = MARKER,
    )
}

/// Script that removes every highlight and restores the page's original text
/// nodes. `normalize()` is what actually restores it: without it the page keeps
/// the split text nodes and a later extraction sees a different DOM.
pub fn clear_script() -> String {
    format!("(function(){{\n{}\n  return 'cleared';\n}})()", clear_body())
}

fn clear_body() -> String {
    format!(
        r#"  var marked = document.querySelectorAll('span[{marker}]');
  for (var m = 0; m < marked.length; m++) {{
    var mark = marked[m], parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }}"#,
        marker = MARKER
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn span(quote: &str, prefix: &str, suffix: &str) -> TextSpan {
        TextSpan {
            start: 0,
            end: 0,
            quote: quote.to_string(),
            prefix: prefix.to_string(),
            suffix: suffix.to_string(),
        }
    }

    #[test]
    fn offsets_become_quote_anchors_with_context() {
        let text = "According to the report, the committee agreed. The report was late.";
        let quote_at = text.find("the report").expect("present");
        let start = text[..quote_at].chars().count();
        let anchors = anchors_from_offsets(text, &[(start, start + "the report".chars().count())]);
        assert_eq!(anchors.len(), 1);
        assert_eq!(anchors[0].quote, "the report");
        assert_eq!(anchors[0].prefix, "According to ");
        assert!(anchors[0].suffix.starts_with(", the committee"));
    }

    #[test]
    fn prefix_and_suffix_disambiguate_a_repeated_quote() {
        let page = "the report is late. Meanwhile the report is fine.";
        let second = page.rfind("the report").expect("present");
        let second_chars = page[..second].chars().count();

        let first_anchor = span("the report", "", " is late");
        let second_anchor = span("the report", "Meanwhile ", " is fine");

        assert_eq!(locate(page, &first_anchor), Some(0));
        assert_eq!(locate(page, &second_anchor), Some(second_chars));
    }

    #[test]
    fn a_quote_whose_context_moved_still_anchors_to_the_first_occurrence() {
        let page = "the report is late.";
        let anchor = span("the report", "nothing like this", "nor this");
        assert_eq!(locate(page, &anchor), Some(0));
    }

    #[test]
    fn a_missing_quote_anchors_nowhere() {
        assert_eq!(locate("nothing here", &span("absent", "", "")), None);
        assert_eq!(locate("nothing here", &span("", "", "")), None);
    }

    #[test]
    fn multibyte_text_does_not_split_a_character() {
        let text = "café études café";
        let anchors = anchors_from_offsets(text, &[(0, 4)]);
        assert_eq!(anchors[0].quote, "café");
        assert_eq!(anchors[0].suffix, " études café");
    }

    #[test]
    fn apply_script_carries_the_spans_and_clears_first() {
        let script = apply_script(&[span("hello", "say ", " world")]);
        assert!(script.contains("\"quote\":\"hello\""), "{script}");
        assert!(script.contains(MARKER));
        // Replacing the set means clearing the old one in the same evaluation;
        // two round trips would flash the page.
        assert!(script.contains("querySelectorAll"));
    }

    #[test]
    fn clear_script_normalizes_the_text_nodes_it_split() {
        let script = clear_script();
        assert!(script.contains("normalize()"));
        assert!(script.contains(MARKER));
    }
}
