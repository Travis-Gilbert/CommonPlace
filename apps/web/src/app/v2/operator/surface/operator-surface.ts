/* SPEC-OBJECT-CONTRACT-V2 OC5 — the Operator surface expressed as objects.
 *
 * The attention strip, bays, and queue are view-instances; the arrangement is a
 * region tree. Both layouts reuse the SAME three instances (op-attention,
 * op-bays, op-queue) — only the region tree and the bays' descriptor differ. A
 * diff of the two surfaces is a diff of these objects, nothing else. This is the
 * proof: rearranging the Operator is editing data, not code. */

import type { JsonValue, ObjectRef } from '@/lib/block-view/types';

const CONTAINS = 'CONTAINS';

export type OperatorLayout = 'default' | 'alt';

function viewInstance(id: string, descriptorId: string, title: string, types: string[]): ObjectRef {
  return {
    id,
    type: 'view-instance',
    properties: {
      descriptor_id: descriptorId,
      title,
      query: { types, live: true } as unknown as JsonValue,
    },
  };
}

function region(
  id: string,
  layout: string,
  children: string[],
  extra: Record<string, JsonValue> = {},
): ObjectRef {
  return {
    id,
    type: 'region',
    properties: { layout, ...extra },
    relations: { [CONTAINS]: children },
  };
}

function surface(id: string, children: string[]): ObjectRef {
  return {
    id,
    type: 'surface',
    properties: { name: 'Operator', kind: 'page' },
    relations: { [CONTAINS]: children },
  };
}

export function operatorSurfaceId(layout: OperatorLayout): string {
  return layout === 'alt' ? 'operator-alt' : 'operator';
}

export function buildOperatorSurface(layout: OperatorLayout): ObjectRef[] {
  const attention = viewInstance('op-attention', 'operator-attention', 'Attention', ['operator-attention']);
  const queue = viewInstance('op-queue', 'operator-queue', 'Queue', ['operator-queue']);
  const bays = viewInstance(
    'op-bays',
    // The only descriptor that differs between the two surfaces: cards vs table.
    layout === 'alt' ? 'operator-bay-table' : 'operator-bays',
    'Bays',
    ['operator-bay'],
  );

  if (layout === 'alt') {
    // Swap: queue on the left, bays (as a table) on the right.
    const left = region('op-left', 'stack', ['op-attention', 'op-queue']);
    const right = region('op-right', 'stack', ['op-bays']);
    const split = region('op-split', 'split-h', ['op-left', 'op-right'], {
      ratios: [1.35, 1] as unknown as JsonValue,
    });
    return [surface('operator-alt', ['op-split']), split, left, right, attention, queue, bays];
  }

  // Default: one stack — attention, bays (as cards), then the queue.
  const main = region('op-main', 'stack', ['op-attention', 'op-bays', 'op-queue']);
  return [surface('operator', ['op-main']), main, attention, bays, queue];
}
