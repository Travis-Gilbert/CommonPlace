// SOURCING: none — pure logic, no upstream component applies.
// Validator for Obsidian JSON Canvas 1.0 (obsidianmd/jsoncanvas).

/**
 * Defensive JSON Canvas 1.0 parser. Rejects malformed input with a named path;
 * never applies a silent partial.
 */

import type {
  CanvasColor,
  CanvasEdge,
  CanvasNode,
  EdgeEnd,
  GroupBackgroundStyle,
  JSONCanvas,
  NodeSide,
} from './types';

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
    throw new CanvasParseError(
      `${path}.${key}`,
      `must be one of ${allowed.join('|')} (got ${JSON.stringify(value)})`,
    );
  }
  return value as T;
}

function optionalColor(record: Record<string, unknown>, key: string, path: string): CanvasColor | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) {
    throw new CanvasParseError(
      `${path}.${key}`,
      `must be a preset "1"-"6" or a hex color (got ${JSON.stringify(value)})`,
    );
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
  const graphId = optionalString(raw, 'graphId', path);
  const provenance = optionalString(raw, 'provenance', path);
  const generic = { id, x, y, width, height, color, graphId, provenance };

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
      throw new CanvasParseError(
        `${path}.type`,
        `must be one of text|file|link|group (got ${JSON.stringify(type)})`,
      );
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
    graphId: optionalString(raw, 'graphId', path),
    provenance: optionalString(raw, 'provenance', path),
  };
}

/** Parses an already-JSON.parsed value into a validated JSONCanvas. */
export function parseCanvasValue(value: unknown): JSONCanvas {
  if (!isRecord(value)) {
    throw new CanvasParseError('$', 'must be an object with optional nodes/edges arrays');
  }

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

/** Parses raw `.canvas` file text. Throws SyntaxError or CanvasParseError. */
export function parseCanvasText(raw: string): JSONCanvas {
  return parseCanvasValue(JSON.parse(raw) as unknown);
}

/** Alias matching the spec deliverable name. */
export const validateJsonCanvas = parseCanvasValue;
