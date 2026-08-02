/** @jsxImportSource react */
// SOURCING: none. Replaces a PaperGrainGradient usage with a compositor-only
// equivalent; no upstream component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3, shader law: one shader mount per
// window. That mount is PageBackground's dither.
//
// The small activity orbs (a streaming-message indicator, a session-surface
// badge, the voice orb) each rendered their own <PaperGrainGradient>, and
// every one of those is a ShaderMount with its own WebGL context. The message
// list mounts one per in-flight message, so the count was unbounded and the
// browser's per-document context limit (about 16, oldest silently killed) was
// reachable in one busy session.
//
// A 34px orb does not need a fragment shader. This paints the same reading,
// soft coloured lobes and slow drift, with a conic gradient and a transform
// animation, which stays on the compositor and costs no context. Colours come
// from the register, so the orb tracks the scheme instead of freezing one.

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useRegisterTokens } from "./register-token";

/**
 * The working orb: the agent is doing something. Upstream picked four Tailwind
 * hues (indigo, rose, amber, emerald) with no register behind them; these are
 * the console's four harness domain accents, which carry the same spread of
 * hue and already mean "agent", "memory", "rooms", "graph".
 */
export const WORKING_ORB_TOKENS = [
  "--ij-agent",
  "--ij-room",
  "--ij-memory",
  "--ij-graph",
] as const;

/** Voice orb palettes, by state. Muted drops to the achromatic ramp. */
export const VOICE_ORB_TOKENS = {
  speaking: ["--ij-agent", "--ij-room", "--ij-memory", "--ij-ink"],
  muted: ["--ij-gray-8", "--ij-gray-5", "--ij-gray-9", "--ij-gray-3"],
  idle: ["--ij-graph", "--ij-ok", "--ij-memory", "--ij-teal-2"],
} as const;

export type GrainOrbProps = {
  /** Register token names, in lobe order. Two or more reads best. */
  tokens: readonly string[];
  /** Drift period in seconds. Larger is calmer. */
  period?: number;
  className?: string;
};

export function GrainOrb({ tokens, period = 18, className }: GrainOrbProps) {
  const colors = useRegisterTokens(tokens, "transparent");
  const background = useMemo(() => {
    if (colors.length === 0) return undefined;
    // Repeat the first colour at 360deg so the conic sweep closes seamlessly.
    const step = 360 / colors.length;
    const stops = colors
      .map((color, index) => `${color} ${Math.round(index * step)}deg`)
      .concat(`${colors[0]} 360deg`)
      .join(", ");
    return `conic-gradient(from 0deg, ${stops})`;
  }, [colors]);

  return (
    <span
      aria-hidden="true"
      className={cn("ow-grain-orb block size-full rounded-full", className)}
      style={{ background, animationDuration: `${period}s` }}
    />
  );
}
