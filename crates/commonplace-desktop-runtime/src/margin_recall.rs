//! Margin-recall geometry (HANDOFF-MARGIN-RECALL D1). External co-browse pages are
//! separate native `WebviewWindow`s with no shared render tree, so in-page eval is the
//! only geometry source (VF4). `window.eval` is fire-and-forget, so resolving a quote to
//! rects is eval-then-event: inject a self-contained resolver that finds the quote in the
//! page DOM and posts its `Range.getClientRects()` back on the margin-recall channel,
//! tagged with the request id.
//!
//! This module is the pure, testable core of that contract: the wire types, the page
//! identity hash (MR-D1-4), the injected-resolver builder (MR-D1-1), the scroll-into-view
//! builder (MR-D1-3), and the postback parser. The eval dispatch plus webview round-trip
//! is a named gap (no live webview to run it here); the JS-builder and parser are proven.

use serde::{Deserialize, Serialize};

/// A viewport rect (CSS px), wire-parity with the TS `Rect` in commands.ts.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// One resolved target: the viewport rects a quote occupies (one per visual line) plus
/// the re-anchor confidence (1 = exact). Wire-parity with the TS `RectSet`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RectSet {
    pub rects: Vec<Rect>,
    pub confidence: f64,
}

/// A quote to resolve, wire-parity with the TS `TextTarget` (camelCase `positionHint`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextTarget {
    pub quote: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_hint: Option<u32>,
}

/// A page's identity, wire-parity with the TS `PageIdentity`. `content_hash` is the
/// BLAKE3 page hash, the shared key for the D2 result cache and the D3 anchor.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageIdentity {
    pub url: String,
    pub title: String,
    pub content_hash: String,
}

/// The payload the injected resolver posts back: the request id it was called with and
/// the resolved targets.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetsPayload {
    pub request_id: String,
    pub targets: Vec<RectSet>,
}

/// The shell event the resolved rects are delivered on, paired with the D1 contract's
/// `marginrecall://viewport` and `marginrecall://scroll` events.
pub const TARGETS_EVENT: &str = "marginrecall://targets";

/// Build a page identity for an already-extracted page (MR-D1-4). The content hash is
/// BLAKE3 over the visible text, so an unchanged revisit yields a stable identity.
pub fn page_identity(
    url: impl Into<String>,
    title: impl Into<String>,
    text: &str,
) -> PageIdentity {
    PageIdentity {
        url: url.into(),
        title: title.into(),
        content_hash: commonplace::page::page_content_hash(text),
    }
}

/// JSON-encode a string for safe embedding in the injected script (the same technique
/// `tab_highlight` uses). Never panics for a `str`.
fn js(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn js_opt(value: &Option<String>) -> String {
    match value {
        Some(value) => js(value),
        None => "null".to_string(),
    }
}

/// Build the self-contained resolver for `resolve_text_targets` (MR-D1-1). It flattens the
/// page's text nodes, finds `target.quote` (disambiguated by prefix/suffix context and the
/// position hint), maps the match back to a `Range`, collects its client rects, and posts
/// `{ requestId, targets }` back through the Tauri IPC. Fire-and-forget: the rects arrive on
/// [`TARGETS_EVENT`], not this call's return value.
pub fn resolve_script(request_id: &str, target: &TextTarget) -> String {
    let hint = target
        .position_hint
        .map(|value| value.to_string())
        .unwrap_or_else(|| "null".to_string());
    format!(
        r#"(function() {{
  var reqId = {req};
  var quote = {quote};
  var pre = {pre};
  var suf = {suf};
  var hint = {hint};
  function post(targets) {{
    try {{
      window.__TAURI_INTERNALS__.invoke('margin_recall_targets', {{
        payload: JSON.stringify({{ requestId: reqId, targets: targets }})
      }});
    }} catch (e) {{}}
  }}
  if (!quote) {{ post([]); return; }}
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var nodes = [], flat = '', node;
  while ((node = walker.nextNode())) {{
    var start = flat.length;
    flat += (node.nodeValue || '');
    nodes.push({{ node: node, start: start, end: flat.length }});
  }}
  // Try full-context match first (confidence 1.0); fall back to quote-only (confidence 0.8)
  // so that highlights survive minor page edits that shift prefix/suffix context.
  var needle = (pre || '') + quote + (suf || '');
  var qOffset = pre ? pre.length : 0;
  var best = -1, bestConf = 0.0, from = 0, idx;
  while ((idx = flat.indexOf(needle, from)) !== -1) {{
    if (best === -1 || (hint !== null && Math.abs(idx + qOffset - hint) < Math.abs(best - hint))) {{
      best = idx + qOffset;
      bestConf = 1.0;
    }}
    from = idx + 1;
  }}
  if (best === -1) {{
    from = 0;
    while ((idx = flat.indexOf(quote, from)) !== -1) {{
      if (best === -1 || (hint !== null && Math.abs(idx - hint) < Math.abs(best - hint))) {{
        best = idx;
        bestConf = 0.8;
      }}
      from = idx + 1;
    }}
  }}
  if (best === -1) {{ post([]); return; }}
  var qStart = best;
  var qEnd = qStart + quote.length;
  function locate(offset) {{
    for (var i = 0; i < nodes.length; i++) {{
      if (offset >= nodes[i].start && offset <= nodes[i].end) {{
        return {{ node: nodes[i].node, offset: offset - nodes[i].start }};
      }}
    }}
    return null;
  }}
  var a = locate(qStart), b = locate(qEnd);
  if (!a || !b) {{ post([]); return; }}
  var range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  var rects = [];
  var list = range.getClientRects();
  for (var j = 0; j < list.length; j++) {{
    var r = list[j];
    rects.push({{ x: r.left, y: r.top, width: r.width, height: r.height }});
  }}
  post([{{ rects: rects, confidence: bestConf }}]);
}})();"#,
        req = js(request_id),
        quote = js(&target.quote),
        pre = js_opt(&target.prefix),
        suf = js_opt(&target.suffix),
        hint = hint,
    )
}

/// Build the scroll-into-view script for `scroll_to_target` (MR-D1-3): resolve the quote the
/// same way, then `scrollIntoView` centered. Fire-and-forget (no postback needed).
pub fn scroll_script(target: &TextTarget) -> String {
    format!(
        r#"(function() {{
  var quote = {quote};
  var pre = {pre};
  if (!quote) return;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var flat = '', starts = [], nodes = [], node;
  while ((node = walker.nextNode())) {{
    starts.push(flat.length);
    nodes.push(node);
    flat += (node.nodeValue || '');
  }}
  // Try prefix + quote first; fall back to quote-only so scroll works after minor page edits.
  var needle = (pre || '') + quote;
  var idx = flat.indexOf(needle);
  var qStart;
  if (idx === -1) {{
    idx = flat.indexOf(quote);
    qStart = idx;
  }} else {{
    qStart = idx + (pre ? pre.length : 0);
  }}
  if (qStart === -1) return;
  for (var i = 0; i < nodes.length; i++) {{
    if (qStart >= starts[i] && qStart <= starts[i] + (nodes[i].nodeValue || '').length) {{
      var range = document.createRange();
      range.setStart(nodes[i], qStart - starts[i]);
      range.setEnd(nodes[i], qStart - starts[i]);
      var rect = range.getBoundingClientRect();
      window.scrollTo({{ top: window.scrollY + rect.top - window.innerHeight / 2, behavior: 'smooth' }});
      return;
    }}
  }}
}})();"#,
        quote = js(&target.quote),
        pre = js_opt(&target.prefix),
    )
}

/// Parse the `{ requestId, targets }` payload the resolver posts back (MR-D1-1).
pub fn parse_targets_payload(payload: &str) -> Result<TargetsPayload, String> {
    serde_json::from_str(payload).map_err(|error| error.to_string())
}

/// The faint additive-ink color for a tier, matching the reader-side `--cp-tint-*` gold and
/// terracotta. Exact connections read terracotta; everything else the margin-recall gold.
fn tier_color(tier: &str) -> &'static str {
    match tier {
        "exact" => "#B45A2D",
        _ => "#C49A4A",
    }
}

/// Build the external-page tint script (MR-D4-5): paint a faint, click-through highlight over
/// each rect from the D1 geometry (a text-range tint, not an element bbox), tier-colored, in a
/// single fixed container each call replaces. Extends the `tab_highlight` eval pattern; purely
/// additive (mix-blend multiply darkens toward the ink, never lowering contrast) and
/// fire-and-forget. External co-browse pages get this where CommonPlace's own reader gets the
/// React overlay, both from the same geometry contract.
pub fn tint_script(targets: &[RectSet], tier: &str) -> String {
    let rects: Vec<Rect> = targets
        .iter()
        .flat_map(|target| target.rects.iter().copied())
        .collect();
    let rects_json = serde_json::to_string(&rects).unwrap_or_else(|_| "[]".to_string());
    format!(
        r#"(function() {{
  var id = '__cp_margin_tint';
  var box = document.getElementById(id);
  if (!box) {{
    box = document.createElement('div');
    box.id = id;
    box.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483645;';
    document.documentElement.appendChild(box);
  }}
  box.style.display = 'block';
  box.innerHTML = '';
  var color = {color};
  var rects = {rects};
  for (var i = 0; i < rects.length; i++) {{
    var r = rects[i];
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;pointer-events:none;mix-blend-mode:multiply;opacity:0.28;border-radius:2px;background:' + color + ';';
    m.style.left = r.x + 'px';
    m.style.top = r.y + 'px';
    m.style.width = r.width + 'px';
    m.style.height = r.height + 'px';
    box.appendChild(m);
  }}
}})();"#,
        color = js(tier_color(tier)),
        rects = rects_json,
    )
}

/// Build the script that clears the external-page tint (paired with [`tint_script`]).
pub fn clear_tint_script() -> String {
    r#"(function() {
  var box = document.getElementById('__cp_margin_tint');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }
})();"#
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_identity_is_stable_blake3_over_text() {
        let a = page_identity("https://ex.com/essay", "Essay", "the sculptor of Athens");
        let b = page_identity("https://ex.com/essay", "Essay", "the sculptor of Athens");
        assert_eq!(a, b, "same text yields the same identity");
        assert!(a.content_hash.starts_with("blake3:"), "BLAKE3-prefixed");
        assert_eq!(a.url, "https://ex.com/essay");
        assert_eq!(a.title, "Essay");
        // Changed content changes the hash (a revisit to an edited page re-anchors).
        let c = page_identity("https://ex.com/essay", "Essay", "the sculptor of Sparta");
        assert_ne!(a.content_hash, c.content_hash);
    }

    #[test]
    fn resolve_script_embeds_escaped_inputs_and_postback() {
        let target = TextTarget {
            quote: "the \"sculptor\" of Athens".to_string(),
            prefix: Some("was ".to_string()),
            suffix: None,
            position_hint: Some(40),
        };
        let script = resolve_script("req-1", &target);
        // The quote is embedded JSON-escaped (the inner quotes did not break the script).
        assert!(script.contains(r#"var quote = "the \"sculptor\" of Athens";"#));
        assert!(script.contains(r#"var pre = "was ";"#));
        assert!(script.contains("var suf = null;"));
        assert!(script.contains("var hint = 40;"));
        assert!(script.contains("var reqId = \"req-1\";"));
        // It reads geometry and posts back through the Tauri IPC on the resolve command.
        assert!(script.contains("getClientRects()"));
        assert!(script.contains("margin_recall_targets"));
        assert!(script.trim_start().starts_with("(function()"));
    }

    #[test]
    fn resolve_script_defaults_hint_to_null_when_absent() {
        let target = TextTarget {
            quote: "a line".to_string(),
            prefix: None,
            suffix: None,
            position_hint: None,
        };
        let script = resolve_script("r", &target);
        assert!(script.contains("var hint = null;"));
        assert!(script.contains("var pre = null;"));
    }

    #[test]
    fn scroll_script_embeds_the_quote() {
        let target = TextTarget {
            quote: "jump here".to_string(),
            prefix: Some("please ".to_string()),
            suffix: None,
            position_hint: None,
        };
        let script = scroll_script(&target);
        assert!(script.contains(r#"var quote = "jump here";"#));
        assert!(script.contains("scrollTo"));
    }

    #[test]
    fn targets_payload_round_trips_and_rejects_garbage() {
        let payload = TargetsPayload {
            request_id: "req-1".to_string(),
            targets: vec![RectSet {
                rects: vec![Rect {
                    x: 10.0,
                    y: 20.0,
                    width: 100.0,
                    height: 18.0,
                }],
                confidence: 1.0,
            }],
        };
        let json = serde_json::to_string(&payload).unwrap();
        // camelCase on the wire, matching the TS side.
        assert!(json.contains("\"requestId\""));
        let back = parse_targets_payload(&json).unwrap();
        assert_eq!(back, payload);
        assert!(parse_targets_payload("not json").is_err());
    }

    #[test]
    fn tint_script_paints_the_d1_rects_click_through_and_tier_colored() {
        let targets = vec![RectSet {
            rects: vec![Rect {
                x: 10.0,
                y: 20.0,
                width: 100.0,
                height: 18.0,
            }],
            confidence: 1.0,
        }];
        let exact = tint_script(&targets, "exact");
        assert!(exact.contains("#B45A2D"), "exact tier reads terracotta");
        assert!(exact.contains("mix-blend-mode:multiply"), "additive ink, never lowers contrast");
        assert!(exact.contains("pointer-events:none"), "click-through");
        assert!(exact.contains("__cp_margin_tint"));
        assert!(exact.contains("\"x\":10"), "the D1 rect coords are painted, not an element bbox");
        assert!(exact.trim_start().starts_with("(function()"));
        let semantic = tint_script(&targets, "semantic");
        assert!(semantic.contains("#C49A4A"), "other tiers read the margin-recall gold");
    }

    #[test]
    fn clear_tint_script_hides_the_container() {
        let script = clear_tint_script();
        assert!(script.contains("__cp_margin_tint"));
        assert!(script.contains("display = 'none'"));
    }
}
