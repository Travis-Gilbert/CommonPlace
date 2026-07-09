/**
 * JSON Canvas 1.0 types + a defensive parser/serializer.
 *
 * Spec: https://jsoncanvas.org/spec/1.0/ (Obsidian's open `.canvas` format,
 * also the format `/v2/canvas`'s placeholder copy already promises: "nodes:
 * text/file/link/group; edges with sides + labels"). This module is the real
 * implementation behind that promise — no invented fields, no fields dropped.
 *
 * `parseCanvas` never fabricates or silently drops data: a malformed node or
 * edge throws a `CanvasParseError` naming the exact offending path, instead
 * of coercing it into something that renders wrong. `serializeCanvas` writes
 * keys in the same order the spec documents them in, so re-serializing a
 * canvas we just parsed is byte-stable (see json-canvas.test.ts).
 */

export type CanvasColorPreset = '1' | '2' | '3' | '4' | '5' | '6';
export type CanvasColor = string;

export type NodeSide = 'top' | 'right' | 'bottom' | 'left';
export type EdgeEnd = 'none' | 'arrow';
export type GroupBackgroundStyle = 'cover' | 'ratio' | 'repeat';

interface GenericNodeFields {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color?: CanvasColor;
}

export interface TextCanvasNode extends GenericNodeFields {
  readonly type: 'text';
  readonly text: string;
}

export interface FileCanvasNode extends GenericNodeFields {
  readonly type: 'file';
  readonly file: string;
  readonly subpath?: string;
}

export interface LinkCanvasNode extends GenericNodeFields {
  readonly type: 'link';
  readonly url: string;
}

export interface GroupCanvasNode extends GenericNodeFields {
  readonly type: 'group';
  readonly label?: string;
  readonly background?: string;
  readonly backgroundStyle?: GroupBackgroundStyle;
}

export type CanvasNode = TextCanvasNode | FileCanvasNode | LinkCanvasNode | GroupCanvasNode;

export interface CanvasEdge {
  readonly id: string;
  readonly fromNode: string;
  readonly fromSide?: NodeSide;
  readonly fromEnd?: EdgeEnd;
  readonly toNode: string;
  readonly toSide?: NodeSide;
  readonly toEnd?: EdgeEnd;
  readonly color?: CanvasColor;
  readonly label?: string;
}

export interface JSONCanvas {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export const EMPTY_CANVAS: JSONCanvas = { nodes: [], edges: [] };

export class CanvasParseError extends Error {
  constructor(path: string, reason: string) {
    super(`JSON Canvas: ${path} ${reason}`);
    this.name = 'CanvasParseError';
  }
}

const NODE_SIDES: readonly NodeSide[] = ['top', 'right', 'bottom', 'left'];
const EDGE_ENDS: readonly EdgeEnd[] = ['none', 'arrow'];
const GROUP_BACKGROUND_STYLES: readonly GroupBackgroundStyle[] = ['cover', 'ratio', 'repeat'];
const COLOR_PATTERN = /^([1-6]|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new CanvasParseError(`${path}.${key}`, `must be a string (got ${typeof value})`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, path: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new CanvasParseError(`${path}.${key}`, `must be a string when present (got ${typeof value})`);
  }
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new CanvasParseError(`${path}.${key}`, `must be an integer (got ${typeof value})`);
  }
  return value;
}

function optionalEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
): T | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new CanvasParseError(`${path}.${key}`, `must be one of ${allowed.join('|')} (got ${JSON.stringify(value)})`);
  }
  return value as T;
}

function optionalColor(record: Record<string, unknown>, key: string, path: string): CanvasColor | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) {
    throw new CanvasParseError(`${path}.${key}`, `must be a preset "1"-"6" or a hex color (got ${JSON.stringify(value)})`);
  }
  return value;
}

function parseNode(raw: unknown, path: string): CanvasNode {
  if (!isRecord(raw)) throw new CanvasParseError(path, 'must be an object');
  const id = requireString(raw, 'id', path);
  const type = requireString(raw, 'type', path);
  const x = requireInteger(raw, 'x', path);
  const y = requireInteger(raw, 'y', path);
  const width = requireInteger(raw, 'width', path);
  const height = requireInteger(raw, 'height', path);
  const color = optionalColor(raw, 'color', path);
  const generic = { id, x, y, width, height, color };

  switch (type) {
    case 'text':
      return { ...generic, type, text: requireString(raw, 'text', path) };
    case 'file':
      return {
        ...generic,
        type,
        file: requireString(raw, 'file', path),
        subpath: optionalString(raw, 'subpath', path),
      };
    case 'link':
      return { ...generic, type, url: requireString(raw, 'url', path) };
    case 'group':
      return {
        ...generic,
        type,
        label: optionalString(raw, 'label', path),
        background: optionalString(raw, 'background', path),
        backgroundStyle: optionalEnum(raw, 'backgroundStyle', GROUP_BACKGROUND_STYLES, path),
      };
    default:
      throw new CanvasParseError(`${path}.type`, `must be one of text|file|link|group (got ${JSON.stringify(type)})`);
  }
}

function parseEdge(raw: unknown, path: string): CanvasEdge {
  if (!isRecord(raw)) throw new CanvasParseError(path, 'must be an object');
  return {
    id: requireString(raw, 'id', path),
    fromNode: requireString(raw, 'fromNode', path),
    fromSide: optionalEnum(raw, 'fromSide', NODE_SIDES, path),
    fromEnd: optionalEnum(raw, 'fromEnd', EDGE_ENDS, path),
    toNode: requireString(raw, 'toNode', path),
    toSide: optionalEnum(raw, 'toSide', NODE_SIDES, path),
    toEnd: optionalEnum(raw, 'toEnd', EDGE_ENDS, path),
    color: optionalColor(raw, 'color', path),
    label: optionalString(raw, 'label', path),
  };
}

/** Parses an already-`JSON.parse`d value into a validated JSONCanvas. Throws CanvasParseError on any malformed field. */
export function parseCanvasValue(value: unknown): JSONCanvas {
  if (!isRecord(value)) throw new CanvasParseError('$', 'must be an object with optional nodes/edges arrays');

  const rawNodes = value.nodes;
  if (rawNodes !== undefined && !Array.isArray(rawNodes)) {
    throw new CanvasParseError('$.nodes', 'must be an array when present');
  }
  const nodes = (rawNodes ?? []).map((n, i) => parseNode(n, `$.nodes[${i}]`));

  const rawEdges = value.edges;
  if (rawEdges !== undefined && !Array.isArray(rawEdges)) {
    throw new CanvasParseError('$.edges', 'must be an array when present');
  }
  const edges = (rawEdges ?? []).map((e, i) => parseEdge(e, `$.edges[${i}]`));

  return { nodes, edges };
}

/** Parses raw `.canvas` file text (JSON). Throws SyntaxError on invalid JSON, CanvasParseError on invalid shape. */
export function parseCanvasText(raw: string): JSONCanvas {
  return parseCanvasValue(JSON.parse(raw));
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function serializeNode(node: CanvasNode): Record<string, unknown> {
  const generic = { id: node.id, type: node.type, x: node.x, y: node.y, width: node.width, height: node.height, color: node.color };
  switch (node.type) {
    case 'text':
      return omitUndefined({ ...generic, text: node.text });
    case 'file':
      return omitUndefined({ ...generic, file: node.file, subpath: node.subpath });
    case 'link':
      return omitUndefined({ ...generic, url: node.url });
    case 'group':
      return omitUndefined({
        ...generic,
        label: node.label,
        background: node.background,
        backgroundStyle: node.backgroundStyle,
      });
  }
}

function serializeEdge(edge: CanvasEdge): Record<string, unknown> {
  return omitUndefined({
    id: edge.id,
    fromNode: edge.fromNode,
    fromSide: edge.fromSide,
    fromEnd: edge.fromEnd,
    toNode: edge.toNode,
    toSide: edge.toSide,
    toEnd: edge.toEnd,
    color: edge.color,
    label: edge.label,
  });
}

/**
 * Serializes a JSONCanvas back to `.canvas` file text. Key order matches the
 * spec's own attribute documentation order, and `undefined` optional fields
 * are omitted entirely (never written as `null`), so
 * `serializeCanvas(parseCanvasText(x)) === x` for any canvas text this
 * module itself produced (byte-stable round trip; see the fixture test).
 */
export function serializeCanvas(canvas: JSONCanvas): string {
  return JSON.stringify(
    { nodes: canvas.nodes.map(serializeNode), edges: canvas.edges.map(serializeEdge) },
    null,
    2,
  );
}
