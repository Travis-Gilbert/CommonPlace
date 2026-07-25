// SOURCING: zod. The narrow mutation vocabulary the Index surface can send.
// A parsed action carries only what the surface can legitimately ask for:
// never a tenant, never an actor, never a raw patch. Attribution is derived
// server-side from the admitted principal, which is what keeps a browser from
// filing something as somebody else.

import { z } from 'zod';

/**
 * There is no "approve" action here, and there never will be for an item.
 * Corrections need no approval, so the vocabulary is move and reverse. Consent
 * exists only for a standing rule, because a rule keeps acting after the moment
 * it was made.
 */
export const filingActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('correct'),
    item: z.string().min(1),
    to: z.string().min(1),
  }),
  z.object({
    kind: z.literal('undo'),
    item: z.string().min(1),
  }),
]);

export type FilingAction = z.infer<typeof filingActionSchema>;

const predicateSchema = z.object({
  kind: z.enum([
    'sender-entity',
    'source',
    'path-prefix',
    'mime-class',
    'subject-contains',
  ]),
  value: z.string().min(1),
});

export const ruleActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('put'),
    id: z.string().min(1).optional(),
    // A rule with no predicates would match every arrival, so the floor is one.
    predicates: z.array(predicateSchema).min(1),
    destination: z.string().min(1),
    urgent: z.boolean().default(false),
  }),
  z.object({ kind: z.literal('delete'), id: z.string().min(1) }),
  z.object({ kind: z.literal('consent'), id: z.string().min(1) }),
  z.object({ kind: z.literal('deny'), id: z.string().min(1) }),
]);

export type RuleAction = z.infer<typeof ruleActionSchema>;
