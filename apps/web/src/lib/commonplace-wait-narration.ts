/**
 * WL-2 narration inventory (HANDOFF-WAIT-LADDER D2). The T2 tier (2s to 10s, see
 * commonplace-wait-tier.ts) shows the WeaveSpinner plus one line of narrated
 * intent. This module is the single source of that line: every T2 narration
 * string a surface can show lives here, keyed by operation kind and ordered
 * step, so no component hardcodes narration text of its own.
 *
 * Callers own the step index (they know when their real step advances) and
 * pull the string with narrationFor(kind, stepIndex). The rotation described
 * by the wait-ladder spec advances only when the underlying step actually
 * changes, never on a timer: this module has no timers or React imports, it is
 * pure data plus pure functions, so the caller's own step-change logic is what
 * decides when to move forward.
 *
 * Voice: present tense, concrete, one line, no exclamation points, no filler.
 * "Searching the web", not "We're currently searching the web!"
 *
 * Mobile mirrors this module at apps/mobile/src/lib/waitNarration.ts (see the
 * comment there). Keep the two files' string content identical; the parity
 * test at commonplace-wait-narration-parity.test.ts fails the build if they
 * drift.
 */

/**
 * Operation kinds this inventory covers. `thinking` is the model-call state
 * (LLM generation / compose-engine reasoning); `agentRun` is a multi-step
 * agent task (harness-style run, see WL-3); `coBrowseAction` is a single step
 * of the human+agent co-browser (SPEC-9 D5, apps/web/src/lib/desktop.ts).
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

/**
 * Ordered step strings per operation kind. Order matters: index 0 is what a
 * caller shows the moment T2 is reached, later entries are what a real step
 * change reveals as the operation continues. Each entry passes lintNarration
 * below (enforced by assertInventoryClean and its test).
 */
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
 * available step. A long-running operation that outlives its known steps
 * holds on the final honest line rather than looping back to the start or
 * rendering nothing.
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
 * provided this session (see Decision 5 in
 * docs/plans/ux-physics-accent/implementation-plan.md). When that handoff
 * lands, its full rule set should replace or extend the checks below; until
 * then this interface documents the categories a T2 narration line must not
 * fall into, and lintNarration implements only the subset this module can
 * check with confidence.
 *
 * Also noted per that decision: co-browse T2 narration (coBrowseAction above)
 * should eventually reuse the same proposed_action intent strings as the
 * co-browse telegraph (HANDOFF-COBROWSE-PRESENCE D3, also not provided this
 * session), rather than maintaining a second copy here. The placeholder
 * strings above stand in until that handoff lands.
 */
export interface NarrationAntipatterns {
  /** A trailing exclamation point reads as false enthusiasm for a wait state. */
  readonly exclamationPoint: boolean;
  /** A trailing ellipsis simulates activity instead of naming the real step. */
  readonly trailingEllipsis: boolean;
  /** Filler openers ("Just", "Please wait") pad the line without adding intent. */
  readonly fillerOpener: boolean;
  /** Lines longer than the T2 slot's readable width stop being one honest line. */
  readonly overLength: boolean;
}

/** Filler openers this module is confident are always wrong; not exhaustive. */
const FILLER_OPENERS = ['just', 'please wait'];

/** Conservative length ceiling for a single T2 narration line. */
const MAX_NARRATION_LENGTH = 48;

/**
 * Conservative anti-pattern checks (see NARRATION_ANTIPATTERNS's doc comment
 * for what this stands in for). Returns a human-readable violation per
 * problem found, or an empty array when the text is clean.
 */
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

/**
 * Self-check: run lintNarration over every string in the inventory. A test
 * asserts this returns an empty array, so a bad string added later fails CI
 * instead of shipping.
 */
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
