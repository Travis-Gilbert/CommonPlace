'use client';

/**
 * WS7: shared motion tokens for the Work Surface. Mirrors
 * components/commonplace/engine/engine-motion.ts's shape (spring presets +
 * a reduced-motion-aware useSpring hook) rather than inventing a new
 * tokens API -- this is the established repo convention for a
 * domain-scoped motion module, just kept local to v2/work instead of
 * cross-importing from the unrelated `engine` domain.
 *
 * Per the locked motion-vs-Anime.js decision: `motion` (imported as
 * 'motion/react') owns all Work Surface animation -- React lifecycle
 * (mount/unmount, thread/tool-card enter-exit, stage dock spring,
 * collaborator presence). Anime v4 is reserved for SVG/choreography work
 * elsewhere in the app and has no role in this surface. Do not import
 * 'framer-motion' here even though it remains installed for other,
 * pre-existing parts of the app -- it is a literal duplicate of `motion`
 * and using both in new code would reintroduce the duplication the
 * decision explicitly removes.
 */
import { useReducedMotion } from 'motion/react';

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  natural: { type: 'spring' as const, stiffness: 300, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

/** Fade-only exit: for text fragments (streaming labels, presence pills) that should never slide. */
export const FADE_EXIT = { opacity: 0 };

/** Fade + small upward settle: for list items (messages, tool cards) being removed. */
export const SETTLE_EXIT = { opacity: 0, y: -6 };

/** Hook: returns a spring transition config, or an instant `{ duration: 0 }` under prefers-reduced-motion. */
export function useSpring(preset: keyof typeof SPRING) {
  const reduced = useReducedMotion();
  if (reduced) return { duration: 0 };
  return SPRING[preset];
}
