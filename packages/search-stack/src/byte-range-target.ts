// SOURCING: extracted pure anchoring conversion from apps/web.

import type { ByteRange, FindHit } from './contracts';

export interface TextTarget {
  readonly quote: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly positionHint?: number;
}

export interface ByteRangeTargetOptions {
  readonly documentText?: string;
  readonly query?: string;
}

export interface SnippetEmphasis {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

const CONTEXT_CHARS = 32;

export function byteOffsetToCharOffset(text: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0;
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    if (bytes >= byteOffset) return index;
    const codePoint = text.codePointAt(index) as number;
    bytes += utf8Width(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }
  return text.length;
}

export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index) as number;
    bytes += utf8Width(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes;
}

export function sliceByteRange(text: string, range: ByteRange): string {
  const start = byteOffsetToCharOffset(text, range.start);
  const end = byteOffsetToCharOffset(text, range.end);
  return text.slice(start, Math.max(start, end));
}

export function byteRangeToTextTarget(
  hit: Pick<FindHit, 'byteRange' | 'snippet'>,
  options: ByteRangeTargetOptions | string = {},
): TextTarget | null {
  const { documentText, query } =
    typeof options === 'string'
      ? { documentText: options, query: undefined }
      : options;

  if (documentText != null) {
    const quote = sliceByteRange(documentText, hit.byteRange);
    if (!quote) return null;
    const start = byteOffsetToCharOffset(documentText, hit.byteRange.start);
    return withContext(quote, documentText, start, start + quote.length, start);
  }

  if (!hit.snippet) return null;
  const located = query ? locateInSnippet(hit.snippet, query) : null;
  if (located) {
    return withContext(
      hit.snippet.slice(located.start, located.end),
      hit.snippet,
      located.start,
      located.end,
      hit.byteRange.start,
    );
  }

  const passage = hit.snippet.trim();
  return passage ? { quote: passage, positionHint: hit.byteRange.start } : null;
}

export function emphasizeSnippet(
  hit: Pick<FindHit, 'byteRange' | 'snippet'>,
  options: ByteRangeTargetOptions | string = {},
): SnippetEmphasis | null {
  const { documentText, query } =
    typeof options === 'string'
      ? { documentText: options, query: undefined }
      : options;
  if (!hit.snippet) return null;

  const exact =
    documentText == null ? '' : sliceByteRange(documentText, hit.byteRange).trim();
  const needle = exact || query?.trim() || '';
  if (!needle) return null;
  const located = locateInSnippet(hit.snippet, needle);
  if (!located) return null;
  return {
    before: hit.snippet.slice(0, located.start),
    match: hit.snippet.slice(located.start, located.end),
    after: hit.snippet.slice(located.end),
  };
}

function utf8Width(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

function locateInSnippet(
  snippet: string,
  query: string,
): { readonly start: number; readonly end: number } | null {
  const trimmed = query.trim();
  const candidates = [
    trimmed,
    ...trimmed.split(/\s+/).sort((left, right) => right.length - left.length),
  ];
  const haystack = snippet.toLowerCase();
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = haystack.indexOf(candidate.toLowerCase());
    if (start >= 0) return { start, end: start + candidate.length };
  }
  return null;
}

function withContext(
  quote: string,
  source: string,
  start: number,
  end: number,
  positionHint: number,
): TextTarget {
  const prefix = source.slice(Math.max(0, start - CONTEXT_CHARS), start);
  const suffix = source.slice(end, end + CONTEXT_CHARS);
  return {
    quote,
    positionHint,
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
  };
}
