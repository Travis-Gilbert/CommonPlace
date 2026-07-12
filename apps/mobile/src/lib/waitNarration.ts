/**
 * Mirrors apps/web/src/lib/commonplace-wait-narration.ts (WL-2 narration
 * inventory, HANDOFF-WAIT-LADDER D2). apps/mobile cannot import across the
 * package boundary from apps/web, so this is a documented mirror rather than
 * a shared import, the same pattern apps/mobile/src/theme/tokens.ts uses for
 * the motion scale (see its "Motion scale (HANDOFF-MOTION-TOKENS)" comment,
 * checked for parity by apps/web/src/lib/motion-tokens-parity.test.ts).
 *
 * Keep every exported name and every string in WAIT_NARRATION_INVENTORY
 * identical to the web copy. The web-side parity test at
 * apps/web/src/lib/commonplace-wait-narration-parity.test.ts reads both files
 * and fails the build if they drift; update both files in the same change.
 *
 * No React Native imports: pure data plus pure functions, same as the web
 * copy, so this file works identically for Expo and any future codegen pass.
 */

export type WaitNarrationOpKind =
  | 'searching'
  | 'reading'
  | 'comparing'
  | 'capturing'
  | 'syncing'
  | 'publishing'
  | 'thinking'
  | 'agentRun'
  | 'coBrowseAction';

export type WaitNarrationInventory = Readonly<Record<WaitNarrationOpKind, readonly string[]>>;

export const WAIT_NARRATION_INVENTORY: WaitNarrationInventory = {
  searching: ['Searching your library', 'Searching the web', 'Ranking results by relevance'],
  reading: ['Opening the page', 'Extracting the visible text', 'Checking for related sources'],
  comparing: ['Comparing against the last version', 'Checking for conflicts'],
  capturing: ['Parsing the capture', 'Filing it in your library', 'Linking it to related objects'],
  syncing: ['Syncing local changes', 'Resolving conflicts', 'Confirming with the server'],
  publishing: ['Committing the draft', 'Pushing to the site repository', 'Waiting on the build'],
  thinking: ['Reading the evidence', 'Weighing the sources', 'Composing the answer'],
  agentRun: ['Starting the run', 'Working through the steps', 'Checking the results'],
  coBrowseAction: ['Opening the tab', 'Reading the page', 'Sending the next action'],
} as const;

/**
 * Return the narration line for a kind at a step index, clamping to the last
 * available step so a long-running operation holds on the final honest line
 * instead of looping back to the start or rendering nothing.
 */
export function narrationFor(kind: WaitNarrationOpKind, stepIndex: number): string {
  const steps = WAIT_NARRATION_INVENTORY[kind];
  const lastIndex = steps.length - 1;
  const safeIndex = Number.isFinite(stepIndex) ? stepIndex : 0;
  const clampedIndex = Math.min(Math.max(safeIndex, 0), lastIndex);
  return steps[clampedIndex];
}

/**
 * Seam for the real anti-pattern voice linter from HANDOFF-AGENT-VOICE, not
 * provided this session. Mirrors the interface in the web copy; see that
 * file's doc comment for the full explanation, including the note that
 * coBrowseAction should eventually reuse HANDOFF-COBROWSE-PRESENCE D3's
 * proposed_action intent strings instead of this placeholder set.
 */
export interface NarrationAntipatterns {
  readonly exclamationPoint: boolean;
  readonly trailingEllipsis: boolean;
  readonly fillerOpener: boolean;
  readonly overLength: boolean;
}

const FILLER_OPENERS = ['just', 'please wait'];
const MAX_NARRATION_LENGTH = 48;

/** Conservative anti-pattern checks; mirrors the web copy's implementation. */
export function lintNarration(text: string): string[] {
  const violations: string[] = [];
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.includes('!')) {
    violations.push('exclamation point reads as false enthusiasm for a wait state');
  }
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
    violations.push('trailing ellipsis simulates activity instead of naming the step');
  }
  if (FILLER_OPENERS.some((opener) => lower.startsWith(opener))) {
    violations.push('filler opener adds no concrete intent');
  }
  if (trimmed.length > MAX_NARRATION_LENGTH) {
    violations.push(`line exceeds ${MAX_NARRATION_LENGTH} characters (${trimmed.length})`);
  }

  return violations;
}

/** Self-check: run lintNarration over every string in the inventory. */
export function assertInventoryClean(): string[] {
  const violations: string[] = [];

  for (const kind of Object.keys(WAIT_NARRATION_INVENTORY) as WaitNarrationOpKind[]) {
    WAIT_NARRATION_INVENTORY[kind].forEach((step, index) => {
      for (const violation of lintNarration(step)) {
        violations.push(`${kind}[${index}] "${step}": ${violation}`);
      }
    });
  }

  return violations;
}
