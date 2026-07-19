// SOURCING: zod. The explicit Console mutation vocabulary: typed action
// inputs only. Tenant, grants, effect contracts, and generic patches are not
// representable in this union.

import { z } from 'zod';

const nodeId = z.string().min(1).max(320);

export const proactivityActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('set-node-enabled'), nodeId, enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal('set-judgment-class'), nodeId, class: z.string().min(1).max(160) }).strict(),
  z.object({
    kind: z.literal('set-judgment-thresholds'),
    nodeId,
    thresholds: z.record(z.string().min(1).max(80), z.number().finite()).refine(
      (thresholds) => Object.keys(thresholds).length <= 20,
      'At most twenty thresholds are allowed.',
    ),
  }).strict(),
  z.object({ kind: z.literal('set-watch-sources'), nodeId, sourceIds: z.array(nodeId).max(100) }).strict(),
  z.object({ kind: z.literal('set-watch-condition'), nodeId, condition: z.string().min(1).max(2000) }).strict(),
  z.object({ kind: z.literal('set-response-action-class'), nodeId, actionClass: z.string().min(1).max(160) }).strict(),
  z.object({ kind: z.literal('prune-assumption'), stakeId: nodeId, assumptionId: nodeId }).strict(),
]);

export type ProactivityAction = z.infer<typeof proactivityActionSchema>;
