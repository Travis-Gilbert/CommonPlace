import { describe, expect, it } from 'vitest';
import { readAskResult, readErrorResult, readRoomContext, objectLabel } from './tool-result-readers';
import type { ObjectRef } from '@/lib/block-view/types';

describe('readAskResult', () => {
  it('returns null for a missing result', () => {
    expect(readAskResult(undefined)).toBeNull();
  });

  it('returns null for a non-object result', () => {
    expect(readAskResult('nope')).toBeNull();
    expect(readAskResult(42)).toBeNull();
    expect(readAskResult(null)).toBeNull();
  });

  it('returns null for an array result', () => {
    expect(readAskResult([1, 2, 3])).toBeNull();
  });

  it('returns null when answer or answerKind is missing or the wrong type', () => {
    expect(readAskResult({ answerKind: 'SYNTHESIZED' })).toBeNull();
    expect(readAskResult({ answer: 'hi' })).toBeNull();
    expect(readAskResult({ answer: 1, answerKind: 'SYNTHESIZED' })).toBeNull();
  });

  it('reads a well-formed result with no provenance', () => {
    const result = readAskResult({ answer: 'The sky is blue.', answerKind: 'SYNTHESIZED' });
    expect(result).toEqual({ answer: 'The sky is blue.', answerKind: 'SYNTHESIZED', provenance: [] });
  });

  it('treats a non-array provenance field as empty', () => {
    const result = readAskResult({ answer: 'x', answerKind: 'SYNTHESIZED', provenance: 'not-an-array' });
    expect(result?.provenance).toEqual([]);
  });

  it('reads well-formed provenance entries, defaulting score to 0 when absent', () => {
    const result = readAskResult({
      answer: 'x',
      answerKind: 'SYNTHESIZED',
      provenance: [
        { item: { id: 'item:1', title: 'First' }, score: 0.92 },
        { item: { id: 'item:2' }, score: 0.5 },
        { item: { id: 'item:3', title: 'Third' } },
      ],
    });
    expect(result?.provenance).toEqual([
      { itemId: 'item:1', title: 'First', score: 0.92 },
      { itemId: 'item:2', title: 'item:2', score: 0.5 },
      { itemId: 'item:3', title: 'Third', score: 0 },
    ]);
  });

  it('drops malformed provenance entries without an item id, keeping well-formed siblings', () => {
    const result = readAskResult({
      answer: 'x',
      answerKind: 'SYNTHESIZED',
      provenance: [null, 'garbage', { score: 0.1 }, { item: { id: 5 } }, { item: { id: 'item:9' }, score: 0.7 }],
    });
    expect(result?.provenance).toEqual([{ itemId: 'item:9', title: 'item:9', score: 0.7 }]);
  });

  it('reports the EMPTY answerKind as-is (rendering decides messaging)', () => {
    const result = readAskResult({ answer: '', answerKind: 'EMPTY' });
    expect(result?.answerKind).toBe('EMPTY');
  });
});

describe('readRoomContext', () => {
  it('returns null for a missing or non-object result', () => {
    expect(readRoomContext(undefined)).toBeNull();
    expect(readRoomContext('nope')).toBeNull();
    expect(readRoomContext([1])).toBeNull();
  });

  it('returns null when feed, participants, or intents are missing or not arrays', () => {
    expect(readRoomContext({ participants: [], intents: [] })).toBeNull();
    expect(readRoomContext({ feed: [], intents: [] })).toBeNull();
    expect(readRoomContext({ feed: [], participants: [] })).toBeNull();
    expect(readRoomContext({ feed: 'x', participants: [], intents: [] })).toBeNull();
  });

  it('reads counts and participant actors from a well-formed room context', () => {
    const result = readRoomContext({
      feed: [{ id: 'f1' }, { id: 'f2' }],
      participants: [{ actor: 'alice' }, { actor: 'bob' }],
      intents: [{ id: 'i1' }],
    });
    expect(result).toEqual({ feedCount: 2, participants: ['alice', 'bob'], intentCount: 1 });
  });

  it('drops malformed participant entries without an actor string', () => {
    const result = readRoomContext({
      feed: [],
      participants: [{ actor: 'alice' }, {}, { actor: 42 }, null],
      intents: [],
    });
    expect(result?.participants).toEqual(['alice']);
  });

  it('reports empty room state honestly', () => {
    const result = readRoomContext({ feed: [], participants: [], intents: [] });
    expect(result).toEqual({ feedCount: 0, participants: [], intentCount: 0 });
  });
});

describe('readErrorResult', () => {
  it('returns null for a missing, non-object, or array result', () => {
    expect(readErrorResult(undefined)).toBeNull();
    expect(readErrorResult('nope')).toBeNull();
    expect(readErrorResult([1])).toBeNull();
  });

  it('returns null when the error field is missing or not a string', () => {
    expect(readErrorResult({})).toBeNull();
    expect(readErrorResult({ error: 42 })).toBeNull();
  });

  it('reads a well-formed error string', () => {
    expect(readErrorResult({ error: 'coordination ping is unavailable outside the desktop app' })).toBe(
      'coordination ping is unavailable outside the desktop app',
    );
  });
});

describe('objectLabel', () => {
  function objectRef(properties: Record<string, unknown>): ObjectRef {
    return { id: 'obj:1', type: 'note', properties } as ObjectRef;
  }

  it('prefers title', () => {
    expect(objectLabel(objectRef({ title: 'Hello', name: 'ignored' }))).toBe('Hello');
  });

  it('falls back to name when title is absent', () => {
    expect(objectLabel(objectRef({ name: 'Fallback name' }))).toBe('Fallback name');
  });

  it('falls back to display_title when title and name are absent', () => {
    expect(objectLabel(objectRef({ display_title: 'Display title' }))).toBe('Display title');
  });

  it('falls back to the object id when no label field is present', () => {
    expect(objectLabel(objectRef({}))).toBe('obj:1');
  });

  it('falls back to the object id when the title is blank', () => {
    expect(objectLabel(objectRef({ title: '   ' }))).toBe('obj:1');
  });
});
