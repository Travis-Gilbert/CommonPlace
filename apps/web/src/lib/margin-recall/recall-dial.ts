// SOURCING: none; the D7 recall-dial policy (HANDOFF-MARGIN-RECALL). A pure mapping from
// the three dial positions to salience request behavior, mirroring the Rust
// SalienceConfig::quiet()/active() presets and the desktop site_policy resolve_effective
// (a per-origin override wins over the global dial). No upstream library models "a
// three-position privacy dial with a per-origin override that gates a recall pipeline"; it
// is product policy, hand-written and node-tested. Carries no DOM and no network.

/** The three dial positions, wire-parity with the Rust `RecallPolicy` (`off`/`quiet`/`active`). */
export type RecallPolicy = 'off' | 'quiet' | 'active';

/** The dial's default position (D7-1): Quiet, so recall stays calm until asked louder. */
export const DEFAULT_RECALL_DIAL: RecallPolicy = 'quiet';

/** The positions in dial order (Off ... Active). */
export const RECALL_POLICIES: readonly RecallPolicy[] = ['off', 'quiet', 'active'];

/**
 * Resolve the effective policy for an origin: a per-site override always wins over the
 * global dial (mirrors the Rust `resolve_effective`), so a site pinned Off stays suppressed
 * no matter how loud the dial. A `null` site means no override, so the dial applies.
 */
export function resolveEffectivePolicy(
  site: RecallPolicy | null,
  dial: RecallPolicy,
): RecallPolicy {
  return site ?? dial;
}

/** Whether the pipeline is suppressed for this policy (the Off position). */
export function isRecallSuppressed(policy: RecallPolicy): boolean {
  return policy === 'off';
}

/**
 * What a resolved policy means for a salience request (D7-2). `run` false means do not call
 * the node at all (Off, or the AR0 gate). `mode` is the salience preset name passed to the
 * node. `exactOnly` mirrors Quiet's exact-tier-only behavior (semantic tier suppressed).
 * `proactive` is Active's single unsolicited margin note (non-goal 4: only in Active, once
 * per page).
 */
export interface RecallBehavior {
  run: boolean;
  mode: 'quiet' | 'active';
  exactOnly: boolean;
  proactive: boolean;
}

export function recallBehavior(policy: RecallPolicy): RecallBehavior {
  switch (policy) {
    case 'off':
      return { run: false, mode: 'quiet', exactOnly: true, proactive: false };
    case 'quiet':
      return { run: true, mode: 'quiet', exactOnly: true, proactive: false };
    case 'active':
      return { run: true, mode: 'active', exactOnly: false, proactive: true };
  }
}

/** The human label for a dial position. */
export function recallPolicyLabel(policy: RecallPolicy): string {
  switch (policy) {
    case 'off':
      return 'Off';
    case 'quiet':
      return 'Quiet';
    case 'active':
      return 'Active';
  }
}

/** One-line description of what a position does, for the dial's helper text. */
export function recallPolicyHint(policy: RecallPolicy): string {
  switch (policy) {
    case 'off':
      return 'No recall on this page.';
    case 'quiet':
      return 'Only exact connections, shown quietly.';
    case 'active':
      return 'Exact and related connections, with one proactive note.';
  }
}
