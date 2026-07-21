// SOURCING: none. Pure projection from harness StatusReport into run and
// dispatch ObjectRefs for the automation-history block (B9).

import type { ObjectRef, ObjectShape } from '@commonplace/block-view/types';

export type AutomationHistoryStatus = {
  readonly runs: ReadonlyArray<{
    readonly id: string;
    readonly planRef: string | null;
    readonly fraction: { readonly done: number; readonly total: number };
    readonly lastEvent: string | null;
    readonly headPresence: string | null;
  }>;
  readonly waitingOnYou: ReadonlyArray<{
    readonly kind: string;
    readonly id: string;
    readonly summary: string;
  }>;
  readonly coordination: {
    readonly intents: readonly unknown[];
    readonly unreadStreamDeltas: number;
  };
  readonly generation: number;
};

export const AUTOMATION_HISTORY_TYPES = ['run', 'dispatch'] as const;

export function projectAutomationHistory(report: AutomationHistoryStatus): ObjectRef[] {
  const runs: ObjectRef[] = report.runs.map((run, index) => ({
    id: run.id,
    type: 'run',
    properties: {
      title: run.planRef ? `Run ${run.planRef}` : `Run ${run.id}`,
      hash: run.id,
      message: run.lastEvent ?? `progress ${run.fraction.done}/${run.fraction.total}`,
      author: run.headPresence ?? 'harness',
      date: `gen-${report.generation}`,
      refs: run.planRef ? [run.planRef] : [],
      fraction_done: run.fraction.done,
      fraction_total: run.fraction.total,
      order: index,
    },
  }));

  const waiting: ObjectRef[] = report.waitingOnYou.map((item, index) => ({
    id: `dispatch:${item.kind}:${item.id}`,
    type: 'dispatch',
    properties: {
      title: item.summary,
      hash: item.id,
      message: item.summary,
      author: item.kind,
      date: `gen-${report.generation}`,
      refs: [item.kind],
      order: runs.length + index,
    },
  }));

  const intentDispatches: ObjectRef[] = report.coordination.intents.map((intent, index) => {
    const record = intent && typeof intent === 'object' ? (intent as Record<string, unknown>) : null;
    const id = String(record?.id ?? `intent-${index}`);
    const summary = String(record?.summary ?? record?.kind ?? 'coordination intent');
    return {
      id: `dispatch:intent:${id}`,
      type: 'dispatch',
      properties: {
        title: summary,
        hash: id,
        message: summary,
        author: 'coordination',
        date: `gen-${report.generation}`,
        refs: ['intent'],
        order: runs.length + waiting.length + index,
      },
    };
  });

  return [...runs, ...waiting, ...intentDispatches];
}

export function automationHistoryShape(objects: readonly ObjectRef[]): ObjectShape {
  return {
    types: [...AUTOMATION_HISTORY_TYPES],
    fields: [
      'title',
      'hash',
      'message',
      'author',
      'date',
      'refs',
      'fraction_done',
      'fraction_total',
      'order',
    ],
    relations: [],
    axes: {},
    cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
  };
}
