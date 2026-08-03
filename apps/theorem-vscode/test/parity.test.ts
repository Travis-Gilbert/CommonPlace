// SOURCING: vitest. This is V8's automated comparison; it is the gate that
// fails on drift.
/**
 * V8. One store, two fronts.
 *
 * The console renders through CodeMirror 6, which addresses a document by
 * absolute offset in UTF-16 code units. The pack renders through VS Code, which
 * addresses it by line and character and then delta-encodes semantic tokens.
 * Both read the same payloads at the same generation, so any divergence is a bug
 * in one of the two conversions.
 *
 * **The design changed and the test had to change with it.** Both fronts now
 * convert through the same `editor-offsets` module, because the byte to UTF-16
 * conversion is the same problem twice and having two implementations of it was
 * two places to be wrong. That makes a front-versus-front comparison weaker: a
 * bug present in the shared module cancels out and both fronts agree on the
 * wrong answer.
 *
 * So the comparison runs against an independent oracle. The oracle converts a
 * byte span to a UTF-16 offset by actually encoding the text and decoding the
 * prefix, which shares no code with the module under test and is obviously
 * correct at the cost of being far too slow to ship. Each front is compared to
 * it, and to the other.
 */

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_DIAGNOSTICS,
  FIXTURE_FILE,
  FIXTURE_GENERATION,
  FIXTURE_INLAY_HINTS,
  FIXTURE_SOURCE,
  FIXTURE_TOKENS,
  FIXTURE_URI,
} from '@commonplace/block-view-contracts/editor-intelligence-fixture';
import { buildOffsetTable } from '@commonplace/block-view-contracts/editor-offsets';
import { toCm6Diagnostics, toCm6Tokens } from '@commonplace/console-editor/cm6-adapter';
import { SubstrateClient } from '../src/substrate/client';
import { IntelligenceSurface, TOKEN_MODIFIERS, TOKEN_TYPES, buildTokens } from '../src/intelligence/surface';

const { recordedDiagnostics } = vscode as unknown as {
  recordedDiagnostics: Map<string, { range: vscode.Range; message: string; source?: string }[]>;
};

interface Finding {
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
  readonly message: string;
  readonly source: string;
}

interface Token {
  readonly line: number;
  readonly character: number;
  readonly length: number;
  readonly type: string;
  readonly modifiers: string[];
}

// ---------------------------------------------------------------------------
// The oracle. Deliberately naive: encode, slice, decode, count.
// ---------------------------------------------------------------------------

const ENCODED = new TextEncoder().encode(FIXTURE_SOURCE);

/** UTF-8 byte offset to UTF-16 index, the slow obvious way. */
function oracleUtf16(byte: number): number {
  return new TextDecoder().decode(ENCODED.slice(0, byte)).length;
}

function oracleLineCharacter(byte: number): { line: number; character: number } {
  const before = FIXTURE_SOURCE.slice(0, oracleUtf16(byte));
  const line = before.split('\n').length - 1;
  return { line, character: before.length - (before.lastIndexOf('\n') + 1) };
}

function oracleFindings(): Finding[] {
  return FIXTURE_DIAGNOSTICS.diagnostics.map((finding) => {
    const start = oracleLineCharacter(finding.startByte);
    const end = oracleLineCharacter(finding.endByte);
    return {
      startLine: start.line,
      startCharacter: start.character,
      endLine: end.line,
      endCharacter: end.character,
      message: finding.message,
      source: finding.detector,
    };
  });
}

function oracleTokens(): Token[] {
  return FIXTURE_TOKENS.tokens.map((span) => {
    const start = oracleLineCharacter(span.startByte);
    return {
      line: start.line,
      character: start.character,
      length: oracleUtf16(span.endByte) - oracleUtf16(span.startByte),
      type: span.tokenType,
      modifiers: [...span.modifiers],
    };
  });
}

// ---------------------------------------------------------------------------
// The two fronts.
// ---------------------------------------------------------------------------

/** Offset back to line/character, computed here and nowhere else. */
function toLineCharacter(offset: number, text: string): { line: number; character: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length - 1;
  return { line, character: offset - (before.lastIndexOf('\n') + 1) };
}

function consoleFindings(text: string): Finding[] {
  return toCm6Diagnostics(FIXTURE_DIAGNOSTICS, text).map((diagnostic) => {
    const start = toLineCharacter(diagnostic.from, text);
    const end = toLineCharacter(diagnostic.to, text);
    return {
      startLine: start.line,
      startCharacter: start.character,
      endLine: end.line,
      endCharacter: end.character,
      message: diagnostic.message,
      source: diagnostic.source,
    };
  });
}

function consoleTokens(text: string): Token[] {
  const table = buildOffsetTable(text, FIXTURE_CONTENT_HASH);
  return toCm6Tokens(FIXTURE_TOKENS.tokens, table).map((range) => {
    const start = toLineCharacter(range.from, text);
    const classes = range.className.split(' ');
    return {
      line: start.line,
      character: start.character,
      length: range.to - range.from,
      type: (classes[0] ?? '').replace('cm-t-', ''),
      modifiers: classes.slice(1).map((entry) => entry.replace('cm-tm-', '')),
    };
  });
}

/**
 * Attribution sits in a different slot on each front, by each host's own
 * convention, and parity is about what the reader sees rather than about field
 * names matching.
 *
 * VS Code renders `source(code)`, so the pack puts the producing system in
 * `source` and the detector id in `code`. CodeMirror's Diagnostic has only
 * `source`, so the console puts the detector there. A reader sees the detector
 * either way. The constant half is asserted separately below so a swap between
 * the two pack slots still fails.
 */
function packFindings(): Finding[] {
  return (recordedDiagnostics.get(FIXTURE_URI) ?? []).map(
    (diagnostic: { range: vscode.Range; message: string; source?: string; code?: string }) => ({
      startLine: diagnostic.range.start.line,
      startCharacter: diagnostic.range.start.character,
      endLine: diagnostic.range.end.line,
      endCharacter: diagnostic.range.end.character,
      message: diagnostic.message,
      source: diagnostic.code ?? '',
    }),
  );
}

/** Undo VS Code's delta packing: five numbers per token, deltas from the last. */
function packTokens(text = FIXTURE_SOURCE): Token[] {
  const { data } = buildTokens(buildOffsetTable(text, FIXTURE_CONTENT_HASH), FIXTURE_TOKENS.tokens);
  const tokens: Token[] = [];
  let line = 0;
  let character = 0;
  for (let index = 0; index < data.length; index += 5) {
    const deltaLine = data[index] ?? 0;
    const deltaStart = data[index + 1] ?? 0;
    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;
    const modifierBits = data[index + 4] ?? 0;
    tokens.push({
      line,
      character,
      length: data[index + 2] ?? 0,
      type: TOKEN_TYPES[data[index + 3] ?? 0] ?? '',
      modifiers: TOKEN_MODIFIERS.filter((_, bit) => (modifierBits & (1 << bit)) !== 0),
    });
  }
  return tokens;
}

function packSurface() {
  const client = new SubstrateClient({
    endpoint: { graphqlUrl: 'http://store.test/graphql' },
    fetchImpl: (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            semanticTokens: FIXTURE_TOKENS,
            diagnostics: FIXTURE_DIAGNOSTICS,
            inlayHints: FIXTURE_INLAY_HINTS,
          },
        }),
      }) as unknown as Response) as unknown as typeof fetch,
  });
  return { client, surface: new IntelligenceSurface(client) };
}

describe('V8 parity fixture', () => {
  it('the fixture is not ASCII, or none of this proves anything', () => {
    expect(ENCODED.length).toBeGreaterThan(FIXTURE_SOURCE.length);
  });

  it('renders the same findings in both fronts, and both match the oracle', async () => {
    recordedDiagnostics.clear();
    const { client, surface } = packSurface();
    surface.watch(vscode.Uri.parse(FIXTURE_URI));
    await vi.waitFor(() => expect(recordedDiagnostics.get(FIXTURE_URI)).toBeDefined());

    expect(surface.snapshot(vscode.Uri.parse(FIXTURE_URI))?.generation).toBe(FIXTURE_GENERATION);

    const expected = oracleFindings();
    expect(consoleFindings(FIXTURE_SOURCE)).toEqual(expected);
    expect(packFindings()).toEqual(expected);

    // The pack's other attribution slot is the producing system, constant.
    const raw = recordedDiagnostics.get(FIXTURE_URI) as { source?: string }[];
    expect(raw.map((entry) => entry.source)).toEqual(['theorem', 'theorem']);

    surface.dispose();
    client.dispose();
  });

  it('renders the same semantic tokens in both fronts, and both match the oracle', () => {
    const expected = oracleTokens();
    expect(consoleTokens(FIXTURE_SOURCE)).toEqual(expected);
    expect(packTokens()).toEqual(expected);
  });

  it('catches drift: a shifted document diverges from the oracle in both fronts', () => {
    // The gate has to fail on drift, so prove that it does rather than assume
    // it. A prepended line moves every byte offset, which is exactly the class
    // of bug the conversion can introduce. Both fronts are fed the shifted text
    // directly here, bypassing the content-identity gate, because the point is
    // to show the arithmetic itself diverges and not merely that the gate fires.
    const shifted = `// header\n${FIXTURE_SOURCE}`;
    const expected = oracleTokens();
    expect(consoleTokens(shifted)).not.toEqual(expected);
    expect(packTokens(shifted)).not.toEqual(expected);
  });

  it('the content-identity gate catches the same drift before anything renders', () => {
    // The gate is the shipping defence: a payload whose indexed bytes are not
    // the buffer's produces nothing rather than misplaced findings.
    const shifted = `// header\n${FIXTURE_SOURCE}`;
    expect(toCm6Diagnostics(FIXTURE_DIAGNOSTICS, shifted)).toEqual([]);
    expect(toCm6Diagnostics(FIXTURE_DIAGNOSTICS, FIXTURE_SOURCE).length).toBeGreaterThan(0);
  });

  it('converts against the indexed bytes when no document is open, which is not drift', async () => {
    // With nothing open there is no buffer to have moved on. The server's own
    // indexed text is definitionally the bytes the offsets were measured
    // against, so this path resolves rather than degrading.
    recordedDiagnostics.clear();
    const { client, surface } = packSurface();
    const target = vscode.Uri.parse(FIXTURE_URI);
    surface.watch(target);
    await vi.waitFor(() => expect(surface.snapshot(target)?.table).toBeDefined());
    expect(surface.snapshot(target)?.drift).toBeUndefined();
    surface.dispose();
    client.dispose();
  });

  it('the surface holds no findings for an open document whose bytes moved', async () => {
    recordedDiagnostics.clear();
    // An open buffer holding the fixture, against a store that indexed a
    // shifted copy. Every byte offset in the answer is measured against text
    // this reader does not have.
    const openDocuments = (vscode as unknown as { workspace: { textDocuments: unknown[] } }).workspace
      .textDocuments;
    openDocuments.push({
      uri: vscode.Uri.parse(FIXTURE_URI),
      getText: () => FIXTURE_SOURCE,
    });
    const drifted = { ...FIXTURE_TOKENS, content: `// header\n${FIXTURE_SOURCE}` };
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              semanticTokens: drifted,
              diagnostics: FIXTURE_DIAGNOSTICS,
              inlayHints: FIXTURE_INLAY_HINTS,
            },
          }),
        }) as unknown as Response) as unknown as typeof fetch,
    });
    const surface = new IntelligenceSurface(client);
    const uri = vscode.Uri.parse(FIXTURE_URI);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.drift).toBeDefined());

    expect(surface.snapshot(uri)?.drift?.kind).toBe('buffer_diverged');
    expect(recordedDiagnostics.get(FIXTURE_URI) ?? []).toEqual([]);

    surface.dispose();
    client.dispose();
  });
});
