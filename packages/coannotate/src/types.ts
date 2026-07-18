// The co-annotation overlay's shared types (SPEC-PREVIEW-COANNOTATION D3/D4/D5).
//
// One overlay, three mounts: these types are framework-agnostic so the same
// package backs the dev-preview mount, the general browser mount, and
// browse_with_me. The `Anchor` shape is a WIRE-PARITY CONTRACT with the Rust
// `commonplace::annotation::Anchor` (serde `tag = "kind"`, snake_case): the JSON
// this produces must deserialize into that Rust enum, since an annotation's
// anchor is stored in the Rust `Item.extra["anchor"]`.

import type { TextPositionSelector, TextQuoteSelector } from './text-quote.ts';

/** A bounding rect in CSS px, viewport-relative. Mirrors Rust `Rect`. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A viewport point in CSS px. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Where an annotation is anchored. Precision degrades honestly: file+line when
 * we own the build (dev preview, source-attribute injected), a robust selector
 * plus a bounding-rect fallback when we do not, or a whole-page url. The `kind`
 * tags and field names match Rust `Anchor` exactly, so `JSON.stringify(anchor)`
 * is the wire form the Rust store reads.
 */
export type Anchor =
  | { kind: 'file_line'; path: string; line: number; column?: number }
  | { kind: 'selector'; selector: string; rect?: Rect }
  | { kind: 'page'; url: string }
  | {
      // W3C-style text anchor (D3, HANDOFF-MARGIN-RECALL). Wire-parity with Rust
      // `Anchor::TextQuote`: snake_case `content_hash`, quote + position selectors.
      // A margin-recall highlight persists as this.
      kind: 'text_quote';
      source: string;
      quote: TextQuoteSelector;
      position?: TextPositionSelector;
      content_hash: string;
    };

/** Who authored an annotation. Mirrors Rust `AuthorKind` (snake_case). */
export type AuthorKind = 'user' | 'head';

/** A resolved annotation's receipt (D6). Mirrors Rust `Resolution`. */
export interface Resolution {
  by: string;
  receipt?: string;
}

/** A durable annotation, as projected from the graph (D4). */
export interface Annotation {
  id: string;
  targetId?: string;
  author?: string;
  authorKind?: AuthorKind;
  anchor?: Anchor;
  body: string;
  resolved: boolean;
  resolution?: Resolution;
  createdAtMs: number;
}

// --- Agent cursor + gestures (D5) ---
// Forward-parity with the planned Rust `theorem-copresence` gesture extension
// (Presence gains `color` + `CursorGesture{Point,Mark,Pin}`): the overlay renders
// these; the substrate transports them.

export type MarkKind = 'circle' | 'underline';

/**
 * An agent cursor gesture. `point` moves + pulses (no approval needed); `mark` is
 * an ephemeral stroke with a TTL; `pin` drops a D4 annotation. Actuation (real
 * clicks) is a SEPARATE, approval-gated path — a gesture never actuates.
 *
 * WIRE-PARITY with the Rust `theorem_copresence::CursorGesture` (serde
 * `tag = "type"`, snake_case): a gesture emitted on the copresence channel by the
 * Rust substrate deserializes here field-for-field, so the fields are snake_case
 * on purpose.
 */
export type CursorGesture =
  | { type: 'point'; at: Point; duration_ms?: number }
  | { type: 'mark'; mark_kind: MarkKind; bounds: Rect; ttl_ms: number }
  | { type: 'pin'; annotation_id: string; bounds: Rect };

/** A rendered cursor (human or agent). */
export interface Cursor {
  actor: string;
  kind: 'human' | 'agent';
  color?: string;
  pos: Point;
  gesture?: CursorGesture;
}

/** Validate an arbitrary JSON value as an [`Anchor`], or return `null`. Used when
 * reading an anchor back from the graph (defensive against a malformed extra). */
export function parseAnchor(value: unknown): Anchor | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'file_line':
      return typeof v.path === 'string' && typeof v.line === 'number'
        ? {
            kind: 'file_line',
            path: v.path,
            line: v.line,
            ...(typeof v.column === 'number' ? { column: v.column } : {}),
          }
        : null;
    case 'selector':
      return typeof v.selector === 'string'
        ? {
            kind: 'selector',
            selector: v.selector,
            ...(isRect(v.rect) ? { rect: v.rect } : {}),
          }
        : null;
    case 'page':
      return typeof v.url === 'string' ? { kind: 'page', url: v.url } : null;
    case 'text_quote': {
      if (typeof v.source !== 'string' || typeof v.content_hash !== 'string') return null;
      const quote = v.quote;
      if (typeof quote !== 'object' || quote === null) return null;
      const q = quote as Record<string, unknown>;
      if (typeof q.exact !== 'string') return null;
      return {
        kind: 'text_quote',
        source: v.source,
        quote: {
          exact: q.exact,
          ...(typeof q.prefix === 'string' ? { prefix: q.prefix } : {}),
          ...(typeof q.suffix === 'string' ? { suffix: q.suffix } : {}),
        },
        content_hash: v.content_hash,
        ...(isPosition(v.position) ? { position: v.position } : {}),
      };
    }
    default:
      return null;
  }
}

function isRect(value: unknown): value is Rect {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
  );
}

function isPosition(value: unknown): value is TextPositionSelector {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.start === 'number' && typeof p.end === 'number';
}

/** A short human label for an anchor (the component chip / margin note). */
export function anchorLabel(anchor: Anchor): string {
  switch (anchor.kind) {
    case 'file_line':
      return anchor.column != null
        ? `${anchor.path}:${anchor.line}:${anchor.column}`
        : `${anchor.path}:${anchor.line}`;
    case 'selector':
      return anchor.selector;
    case 'page':
      return anchor.url;
    case 'text_quote':
      return anchor.quote.exact;
  }
}
