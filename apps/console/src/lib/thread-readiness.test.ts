import { describe, expect, it } from 'vitest';
import { askDegradation } from '@/lib/thread-store';

describe('Composer ask readiness', () => {
  it('labels only ask results whose required indexes are building', () => {
    expect(askDegradation({
      generation: 4,
      capabilities: [
        { capability: 'find', state: 'Building', missing: ['trigram'] },
        { capability: 'ask', state: 'Building', missing: ['trigram', 'vector'] },
      ],
    })).toEqual({ degraded: true, missingIndexes: ['trigram', 'vector'] });
    expect(askDegradation({
      generation: 4,
      capabilities: [{ capability: 'ask', state: 'Ready', missing: [] }],
    })).toBeUndefined();
  });
});
