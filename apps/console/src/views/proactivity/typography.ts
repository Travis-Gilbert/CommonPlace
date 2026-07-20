// SOURCING: none - pure logic, no upstream component applies. The typography
// law is a mapping, not a widget; it resolves a face from a role and an author
// and is consumed by both the surface and the gate that polices it.

/**
 * The typography law (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE named choice 4).
 *
 * Every face on this surface carries meaning. A title says who wrote the thing
 * it titles; body prose says who is speaking; machinery is always machinery.
 * Variation by authorship IS the system. Variation by accident is a defect, and
 * `e2e/type-audit.ts` is the assertion that fails the build on one.
 *
 *   role      human author            agent author (and derived)
 *   -------   ---------------------   -------------------------
 *   title     Vollkorn                IBM Plex Sans
 *   body      Manrope                 IBM Plex Sans
 *   machine   JetBrains Mono          JetBrains Mono
 *
 * Machinery is author-invariant on purpose: a short id, a spend count, a date,
 * and a source name are the machine's readings of the world, not anybody's
 * voice, so giving them a speaker would be the lie the law exists to prevent.
 *
 * This module is the ONE place the mapping is written. The gate reads the same
 * table, so a face can never be changed in the render without the gate noticing
 * or in the gate without the render following.
 */

/** Which job a run of text is doing. Mirrored by `data-type-role` in the DOM so
 *  the gate can find every governed element without guessing from tag names. */
export type TypeRole = 'title' | 'body' | 'machine';

/** Who is speaking. `derived` output has no human author and speaks in the
 *  agent's face; it is distinguished by lane color, never by face. */
export type TypeSpeaker = 'human' | 'agent';

/** The Tailwind face utility for each cell of the law. Every value is a
 *  register-emitted font utility (register-bridge.css); no raw family names. */
const LAW: Record<TypeRole, Record<TypeSpeaker, string>> = {
  title: { human: 'font-cp-title', agent: 'font-cp-agent' },
  body: { human: 'font-cp-human', agent: 'font-cp-agent' },
  machine: { human: 'font-ij-mono', agent: 'font-ij-mono' },
};

/** The face utilities the law can ever emit, for the gate's closed-set check:
 *  a governed element wearing a face outside this set is drift by definition. */
export const LAW_FACES: readonly string[] = ['font-cp-title', 'font-cp-agent', 'font-cp-human', 'font-ij-mono'];

/** Normalize any node's author field to a speaker. A node with no author (a
 *  source, an assumption) is machinery of the system, so it speaks as the
 *  agent. */
export function speakerOf(node: { readonly author?: string } | null | undefined): TypeSpeaker {
  return node && node.author === 'human' ? 'human' : 'agent';
}

/** The face utility for a role and a speaker. The single lookup both the
 *  surface and the gate use. */
export function faceClass(role: TypeRole, speaker: TypeSpeaker): string {
  return LAW[role][speaker];
}

/** The face and the DOM marker together, so a call site cannot apply one and
 *  forget the other: an unmarked element is invisible to the gate, which is the
 *  same failure as a wrong face. */
export function typeFace(role: TypeRole, speaker: TypeSpeaker): {
  readonly className: string;
  readonly 'data-type-role': TypeRole;
  readonly 'data-type-speaker': TypeSpeaker;
} {
  return { className: faceClass(role, speaker), 'data-type-role': role, 'data-type-speaker': speaker };
}

/** The law, exported flat for the gate to iterate. */
export const TYPE_LAW: readonly { role: TypeRole; speaker: TypeSpeaker; face: string }[] = (
  ['title', 'body', 'machine'] as const
).flatMap((role) => (['human', 'agent'] as const).map((speaker) => ({ role, speaker, face: LAW[role][speaker] })));
