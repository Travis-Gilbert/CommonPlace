import { describe, expect, it } from 'vitest';
import {
  automationHistoryShape,
  projectAutomationHistory,
} from './automation-history-projection';

describe('projectAutomationHistory', () => {
  it('projects runs and waiting items into run and dispatch objects', () => {
    const objects = projectAutomationHistory({
      generation: 4,
      runs: [
        {
          id: 'run:1',
          planRef: 'plan:alpha',
          fraction: { done: 2, total: 5 },
          lastEvent: 'step compiled',
          headPresence: 'head-a',
        },
      ],
      waitingOnYou: [{ kind: 'judgment', id: 'j1', summary: 'Approve the patch' }],
      coordination: { intents: [{ id: 'i1', summary: 'sync room' }], unreadStreamDeltas: 0 },
    });

    expect(objects.map((object) => object.type)).toEqual(['run', 'dispatch', 'dispatch']);
    expect(objects[0]?.properties.hash).toBe('run:1');
    expect(objects[0]?.properties.refs).toEqual(['plan:alpha']);
    expect(objects[1]?.id).toBe('dispatch:judgment:j1');
    expect(automationHistoryShape(objects).cardinality).toBe('many');
  });

  it('returns an empty projection when status has no activity', () => {
    const objects = projectAutomationHistory({
      generation: 1,
      runs: [],
      waitingOnYou: [],
      coordination: { intents: [], unreadStreamDeltas: 0 },
    });
    expect(objects).toEqual([]);
    expect(automationHistoryShape(objects).cardinality).toBe('empty');
  });
});
