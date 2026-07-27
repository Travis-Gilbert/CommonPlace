'use client';

import type { TextTarget } from '@commonplace/search-stack';

interface TextSpan {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
}

/**
 * Highlight an exact text target inside the active console page. The console
 * edition owns DOM pages, so the native Selection API is the honest equivalent
 * of the desktop edition's injected webview highlighter.
 */
export function highlightPageTarget(
  root: HTMLElement,
  target: TextTarget,
): boolean {
  const spans = textSpans(root);
  const text = spans.map((span) => span.node.data).join('');
  const match = findTargetOffset(text, target);
  if (!match) return false;

  const start = pointAt(spans, match.start);
  const end = pointAt(spans, match.end);
  if (!start || !end) return false;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);

  const element = start.node.parentElement;
  element?.scrollIntoView({ block: 'center', inline: 'nearest' });
  root.dataset.searchPageHit = target.quote;
  return true;
}

export function findTargetOffset(
  text: string,
  target: TextTarget,
): { readonly start: number; readonly end: number } | null {
  if (!target.quote) return null;
  const prefix = target.prefix ?? '';
  const suffix = target.suffix ?? '';
  const direct = text.indexOf(target.quote);
  if (direct < 0) return null;

  let offset = direct;
  while (offset >= 0) {
    const before = text.slice(Math.max(0, offset - prefix.length), offset);
    const after = text.slice(
      offset + target.quote.length,
      offset + target.quote.length + suffix.length,
    );
    if (
      (!prefix || before.endsWith(prefix))
      && (!suffix || after.startsWith(suffix))
    ) {
      return { start: offset, end: offset + target.quote.length };
    }
    offset = text.indexOf(target.quote, offset + 1);
  }
  return { start: direct, end: direct + target.quote.length };
}

function textSpans(root: HTMLElement): TextSpan[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const spans: TextSpan[] = [];
  let cursor = 0;
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const start = cursor;
    cursor += text.data.length;
    spans.push({ node: text, start, end: cursor });
    node = walker.nextNode();
  }
  return spans;
}

function pointAt(
  spans: readonly TextSpan[],
  position: number,
): { readonly node: Text; readonly offset: number } | null {
  const span = spans.find((candidate) =>
    position >= candidate.start && position <= candidate.end
  );
  if (!span) return null;
  return { node: span.node, offset: position - span.start };
}
