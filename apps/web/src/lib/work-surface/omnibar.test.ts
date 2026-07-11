import { describe, expect, it } from 'vitest';
import {
  isSlashQuery,
  matchStageCommands,
  matchToolCommands,
  parseOmnibarSubmit,
  STAGE_COMMANDS,
  TOOL_COMMANDS,
} from './omnibar';

describe('parseOmnibarSubmit', () => {
  it('parses an exact stage command as a stage intent', () => {
    expect(parseOmnibarSubmit('/board')).toEqual({ type: 'stage', stage: 'board' });
    expect(parseOmnibarSubmit('/doc')).toEqual({ type: 'stage', stage: 'doc' });
    expect(parseOmnibarSubmit('/code')).toEqual({ type: 'stage', stage: 'code' });
  });

  it('is case-insensitive and tolerant of outer whitespace', () => {
    expect(parseOmnibarSubmit('  /BOARD  ')).toEqual({ type: 'stage', stage: 'board' });
  });

  it('parses a stage command with a trailing argument as a stage intent', () => {
    expect(parseOmnibarSubmit('/code src/index.ts')).toEqual({ type: 'stage', stage: 'code' });
  });

  it('does not treat a slash command as a stage prefix of another word', () => {
    // "/coder" is not "/code " or "/code"; a real product would need a
    // dedicated command for it, so it falls through to a chat message.
    expect(parseOmnibarSubmit('/coder review this')).toEqual({
      type: 'message',
      text: '/coder review this',
    });
  });

  it('treats anything else as a trimmed chat message', () => {
    expect(parseOmnibarSubmit('  what changed in the last commit?  ')).toEqual({
      type: 'message',
      text: 'what changed in the last commit?',
    });
  });

  it('treats an empty or whitespace-only string as an empty message', () => {
    expect(parseOmnibarSubmit('   ')).toEqual({ type: 'message', text: '' });
  });

  it('parses /recall with a question as a memory_recall tool intent', () => {
    expect(parseOmnibarSubmit('/recall what did we decide about auth?')).toEqual({
      type: 'tool',
      tool: 'memory_recall',
      arg: 'what did we decide about auth?',
    });
  });

  it('parses /recall with no argument as an empty-arg tool intent', () => {
    expect(parseOmnibarSubmit('/recall')).toEqual({ type: 'tool', tool: 'memory_recall', arg: '' });
    expect(parseOmnibarSubmit('/recall   ')).toEqual({ type: 'tool', tool: 'memory_recall', arg: '' });
  });

  it('parses /ping as a coordination_ping tool intent, ignoring trailing text', () => {
    expect(parseOmnibarSubmit('/ping')).toEqual({ type: 'tool', tool: 'coordination_ping', arg: '' });
    expect(parseOmnibarSubmit('/ping room:ungrouped')).toEqual({
      type: 'tool',
      tool: 'coordination_ping',
      arg: 'room:ungrouped',
    });
  });

  it('is case-insensitive for tool commands', () => {
    expect(parseOmnibarSubmit('/RECALL something')).toEqual({
      type: 'tool',
      tool: 'memory_recall',
      arg: 'something',
    });
  });

  it('does not treat a tool command as a prefix of another word', () => {
    expect(parseOmnibarSubmit('/pingback')).toEqual({ type: 'message', text: '/pingback' });
  });
});

describe('isSlashQuery', () => {
  it('is true only when the raw text starts with a slash', () => {
    expect(isSlashQuery('/board')).toBe(true);
    expect(isSlashQuery('board')).toBe(false);
    expect(isSlashQuery('')).toBe(false);
  });
});

describe('matchStageCommands', () => {
  it('returns all stage commands for a bare slash', () => {
    expect(matchStageCommands('/')).toEqual(STAGE_COMMANDS);
  });

  it('prefix-filters as the user keeps typing', () => {
    expect(matchStageCommands('/co')).toEqual([STAGE_COMMANDS[2]]);
    expect(matchStageCommands('/b')).toEqual([STAGE_COMMANDS[0]]);
  });

  it('returns nothing for a non-slash query', () => {
    expect(matchStageCommands('board')).toEqual([]);
  });

  it('returns nothing when no command matches the typed prefix', () => {
    expect(matchStageCommands('/zzz')).toEqual([]);
  });
});

describe('matchToolCommands', () => {
  it('returns all tool commands for a bare slash', () => {
    expect(matchToolCommands('/')).toEqual(TOOL_COMMANDS);
  });

  it('prefix-filters as the user keeps typing', () => {
    expect(matchToolCommands('/rec')).toEqual([TOOL_COMMANDS[0]]);
    expect(matchToolCommands('/pi')).toEqual([TOOL_COMMANDS[1]]);
  });

  it('returns nothing for a non-slash query', () => {
    expect(matchToolCommands('recall')).toEqual([]);
  });

  it('returns nothing when no tool command matches the typed prefix', () => {
    expect(matchToolCommands('/board')).toEqual([]);
  });
});
