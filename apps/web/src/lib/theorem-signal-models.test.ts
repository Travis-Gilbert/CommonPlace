import { describe, expect, it } from 'vitest';
import { harnessSignalModels } from './theorem-signal-models';

describe('Harness signal models client', () => {
  it('projects active artifact metrics from an MCP GraphQL envelope', () => {
    const payload = {
      result: {
        structuredContent: {
          data: {
            harnessModelCatalog: {
              models: [{
                id: 'signal_model:abc',
                consumer: 'topic_relevance:rust',
                version: 'scheduled-123',
                signal_count: 42,
                trained_through_ms: 100,
                created_at_ms: 120,
                evaluation: {
                  candidate: {
                    weighted_precision: 0.88,
                    calibration_error: 0.04,
                  },
                  reason: 'strict win',
                },
              }],
            },
          },
        },
      },
    };
    expect(harnessSignalModels(payload)).toEqual([expect.objectContaining({
      consumer: 'topic_relevance:rust',
      version: 'scheduled-123',
      signalCount: 42,
      weightedPrecision: 0.88,
      calibrationError: 0.04,
      reason: 'strict win',
    })]);
  });
});
