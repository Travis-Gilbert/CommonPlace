/**
 * WS2/WS3 omnibar: command parsing is pure so it's covered by vitest without
 * mounting cmdk/React. The omnibar is a single input that is simultaneously
 * a chat composer, a stage switcher (/board /doc /code), a tool dispatcher
 * (/recall /ping, WS3), and (via object-client's fulltextQuery) an object
 * search box.
 */

export type WorkStageKind = 'board' | 'doc' | 'code';

export interface WorkStage {
  readonly kind: WorkStageKind;
  /** Backing Item id once WS6 mints one for network co-presence. */
  readonly itemId?: string;
}

export interface StageCommand {
  readonly command: string; // e.g. "/board"
  readonly stage: WorkStageKind;
  readonly label: string;
  readonly hint: string;
}

export const STAGE_COMMANDS: readonly StageCommand[] = [
  { command: '/board', stage: 'board', label: 'Board', hint: 'Open the JSON Canvas board stage' },
  { command: '/doc', stage: 'doc', label: 'Doc', hint: 'Open the collaborative document stage' },
  { command: '/code', stage: 'code', label: 'Code', hint: 'Open the code editor stage' },
];

/**
 * The only two bespoke tool-call names WS3 wires up. Both run through real
 * backends (gqlAsk's GraphQL `ask` query for recall; the Tauri
 * room_context command for ping — see use-work-thread.ts), never invented
 * data. There is no dispatch for anything else (e.g. okf_import): no
 * backend/shape exists for it anywhere in this codebase.
 */
export type WorkToolCommandName = 'memory_recall' | 'coordination_ping';

export interface ToolCommand {
  readonly command: string; // e.g. "/recall"
  readonly tool: WorkToolCommandName;
  readonly label: string;
  readonly hint: string;
  readonly requiresArg: boolean;
}

export const TOOL_COMMANDS: readonly ToolCommand[] = [
  {
    command: '/recall',
    tool: 'memory_recall',
    label: 'Recall',
    hint: 'Ask memory recall a question (real GraphQL ask + provenance)',
    requiresArg: true,
  },
  {
    command: '/ping',
    tool: 'coordination_ping',
    label: 'Ping',
    hint: 'Check the coordination room (desktop app only)',
    requiresArg: false,
  },
];

export type OmnibarIntent =
  | { readonly type: 'stage'; readonly stage: WorkStageKind }
  | { readonly type: 'tool'; readonly tool: WorkToolCommandName; readonly arg: string }
  | { readonly type: 'message'; readonly text: string };

/**
 * Commits the omnibar's current text on Enter. A leading exact stage command
 * (optionally followed by trailing whitespace) switches the active stage; a
 * leading exact tool command dispatches that tool with the remaining text as
 * its argument; anything else is a chat message, verbatim (only outer
 * whitespace trimmed).
 */
export function parseOmnibarSubmit(raw: string): OmnibarIntent {
  const trimmed = raw.trim();

  const stageCommand = STAGE_COMMANDS.find(
    (c) => trimmed.toLowerCase() === c.command || trimmed.toLowerCase().startsWith(`${c.command} `),
  );
  if (stageCommand) return { type: 'stage', stage: stageCommand.stage };

  const toolCommand = TOOL_COMMANDS.find(
    (c) => trimmed.toLowerCase() === c.command || trimmed.toLowerCase().startsWith(`${c.command} `),
  );
  if (toolCommand) {
    return { type: 'tool', tool: toolCommand.tool, arg: trimmed.slice(toolCommand.command.length).trim() };
  }

  return { type: 'message', text: trimmed };
}

/** True while the omnibar should show the slash-command dropdown, not object search. */
export function isSlashQuery(raw: string): boolean {
  return raw.startsWith('/');
}

/** Prefix-filters STAGE_COMMANDS for the inline dropdown while typing "/...". */
export function matchStageCommands(raw: string): readonly StageCommand[] {
  const q = raw.trim().toLowerCase();
  if (!q.startsWith('/')) return [];
  return STAGE_COMMANDS.filter((c) => c.command.startsWith(q));
}

/** Prefix-filters TOOL_COMMANDS for the inline dropdown while typing "/...". */
export function matchToolCommands(raw: string): readonly ToolCommand[] {
  const q = raw.trim().toLowerCase();
  if (!q.startsWith('/')) return [];
  return TOOL_COMMANDS.filter((c) => c.command.startsWith(q));
}
