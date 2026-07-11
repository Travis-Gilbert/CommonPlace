import { describe, expect, it } from 'vitest';
import { parseGrowthResponse } from './growth';

const stats = {
  form: 'Lantern Stag',
  evolutionStage: 2,
  contextLevels: [{ leaf: 'rust/refactor', level: 7 }],
  natureBucket: 'Deliberate',
  skills: [],
  calibrationGrade: 'A-',
  lineageDepth: 18,
  episodeCount: 142,
  badges: [],
};

function response(source: 'live' | 'fixture') {
  return {
    growthSnapshot: {
      available: true,
      message: null,
      snapshot: {
        schemaVersion: 1,
        generatedAtMs: 1,
        source,
        tenantSlug: 'Travis-Gilbert',
        xp: { total: 100, sessionDelta: 4, byContext: [{ leaf: 'rust/refactor', xp: 100 }] },
        readiness: [],
        card: {
          stats,
          bundle: {
            faceSvg: '<svg></svg>',
            manifest: {
              ownerPublicFingerprint: 'key:123',
              genesisDigest: 'genesis',
              epochNumber: 2,
              epochDate: '2026-07-01',
              initialCommit: 'initial',
              initialMessage: 'Born curious.',
              lineageHead: 'head',
              displayedStats: stats,
            },
          },
        },
        timeline: [],
        graphNodes: [],
        graphEdges: [],
        stamps: [],
        listings: [],
      },
    },
  };
}

describe('Growth GraphQL contract', () => {
  it('accepts the live projection', () => {
    const state = parseGrowthResponse(response('live'));
    expect(state.status).toBe('ready');
  });

  it('rejects fixture data on the shipped product edge', () => {
    const state = parseGrowthResponse(response('fixture'));
    expect(state.status).toBe('error');
  });

  it('preserves the explicit unavailable state', () => {
    const state = parseGrowthResponse({
      growthSnapshot: { available: false, message: 'No live snapshot configured.', snapshot: null },
    });
    expect(state).toEqual({ status: 'unavailable', message: 'No live snapshot configured.' });
  });
});
