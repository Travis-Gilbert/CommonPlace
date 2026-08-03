// SOURCING: vitest. This is V8's automated comparison; it is the gate that
// fails on drift, so it deliberately does not share conversion code between the
// two fronts.
/**
 * V8. One store, two fronts.
 *
 * The console renders through CodeMirror 6, which addresses a document by
 * absolute offset. The pack renders through VS Code, which addresses it by line
 * and character and then delta-encodes semantic tokens. Both read the same
 * `FileIntelligence` at the same generation, so any divergence is a bug in one
 * of the two conversions.
 *
 * The comparison decodes each front's *output* back to plain line/character
 * findings using arithmetic local to this file. Sharing the adapters' helpers
 * would make the test agree with itself: an off-by-one present in both the
 * conversion and its inverse would cancel out and pass.
 */

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  FIXTURE_GENERATION,
  FIXTURE_INTELLIGENCE,
  FIXTURE_SOURCE,
  FIXTURE_URI,
} from '@commonplace/block-view-contracts/editor-intelligence-fixture';
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

/** Offset back to line/character, computed here and nowhere else. */
function toLineCharacter(offset: number, text: string): { line: number; character: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length - 1;
  const lastBreak = before.lastIndexOf('\n');
  return { line, character: offset - (lastBreak + 1) };
}

function consoleFindings(text: string): Finding[] {
  return toCm6Diagnostics(FIXTURE_INTELLIGENCE, text).map((diagnostic) => {
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

function packFindings(): Finding[] {
  return (recordedDiagnostics.get(FIXTURE_URI) ?? []).map((diagnostic) => ({
    startLine: diagnostic.range.start.line,
    startCharacter: diagnostic.range.start.character,
    endLine: diagnostic.range.end.line,
    endCharacter: diagnostic.range.end.character,
    message: diagnostic.message,
    source: diagnostic.source ?? '',
  }));
}

function consoleTokens(text: string): Token[] {
  return toCm6Tokens(FIXTURE_INTELLIGENCE.tokens, text).map((range) => {
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

/** Undo VS Code's delta packing: five numbers per token, deltas from the last. */
function packTokens(): Token[] {
  const { data } = buildTokens(FIXTURE_INTELLIGENCE.tokens);
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
        json: async () => ({ data: { fileIntelligence: FIXTURE_INTELLIGENCE } }),
      }) as unknown as Response) as unknown as typeof fetch,
  });
  return { client, surface: new IntelligenceSurface(client) };
}

describe('V8 parity fixture', () => {
  it('renders the same findings in both fronts at the same generation', async () => {
    recordedDiagnostics.clear();
    const { client, surface } = packSurface();
    surface.watch(vscode.Uri.parse(FIXTURE_URI));
    await vi.waitFor(() => expect(recordedDiagnostics.get(FIXTURE_URI)).toBeDefined());

    expect(surface.snapshot(vscode.Uri.parse(FIXTURE_URI))?.intelligence?.generation).toBe(
      FIXTURE_GENERATION,
    );

    const divergences: string[] = [];
    const fromConsole = consoleFindings(FIXTURE_SOURCE);
    const fromPack = packFindings();

    if (fromConsole.length !== fromPack.length) {
      divergences.push(`finding count: console ${fromConsole.length}, pack ${fromPack.length}`);
    }
    for (let index = 0; index < Math.max(fromConsole.length, fromPack.length); index += 1) {
      const left = fromConsole[index];
      const right = fromPack[index];
      if (JSON.stringify(left) !== JSON.stringify(right)) {
        divergences.push(`finding ${index}: console ${JSON.stringify(left)} vs pack ${JSON.stringify(right)}`);
      }
    }

    expect(divergences).toEqual([]);

    surface.dispose();
    client.dispose();
  });

  it('renders the same semantic tokens in both fronts', () => {
    const divergences: string[] = [];
    const fromConsole = consoleTokens(FIXTURE_SOURCE);
    const fromPack = packTokens();

    for (let index = 0; index < Math.max(fromConsole.length, fromPack.length); index += 1) {
      const left = fromConsole[index];
      const right = fromPack[index];
      if (JSON.stringify(left) !== JSON.stringify(right)) {
        divergences.push(`token ${index}: console ${JSON.stringify(left)} vs pack ${JSON.stringify(right)}`);
      }
    }

    expect(divergences).toEqual([]);
  });

  it('catches drift: one front reading a shifted document diverges', () => {
    // The gate has to fail on drift, so prove that it does rather than assume
    // it. A prepended line moves every line start, which is exactly the class
    // of bug the offset conversion can introduce: the pack still reports line
    // and character, the console now resolves those to different text.
    const shifted = `// header\n${FIXTURE_SOURCE}`;
    const divergences = consoleTokens(shifted)
      .map((token, index) => [token, packTokens()[index]] as const)
      .filter(([left, right]) => JSON.stringify(left) !== JSON.stringify(right));

    expect(divergences.length).toBeGreaterThan(0);
  });
});
