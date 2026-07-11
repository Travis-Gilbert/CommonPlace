'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { gql } from '@/lib/commonplace-graphql';

const contextLevelSchema = z.object({ leaf: z.string(), level: z.number().int().nonnegative() });
const statsSchema = z.object({
  form: z.string(),
  evolutionStage: z.number().int().nonnegative(),
  contextLevels: z.array(contextLevelSchema),
  natureBucket: z.string(),
  skills: z.array(z.object({ name: z.string(), unlockedAt: z.string() })),
  calibrationGrade: z.string(),
  lineageDepth: z.number().int().nonnegative(),
  episodeCount: z.number().int().nonnegative(),
  badges: z.array(z.object({ name: z.string(), awardedAt: z.string() })),
});

const cardBundleSchema = z.object({
  manifest: z.object({
    ownerPublicFingerprint: z.string(),
    genesisDigest: z.string(),
    epochNumber: z.number().int().nonnegative(),
    epochDate: z.string(),
    initialCommit: z.string(),
    initialMessage: z.string(),
    lineageHead: z.string(),
    displayedStats: statsSchema,
  }),
  faceSvg: z.string().startsWith('<svg'),
});

const timelinePointSchema = z.object({
  commitHash: z.string(),
  parentCommits: z.array(z.string()),
  observedAtMs: z.number(),
  xp: z.number().int().nonnegative(),
  contextLevels: z.array(contextLevelSchema),
  stats: statsSchema,
  formSvg: z.string(),
  beats: z.array(z.string()),
});

const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAtMs: z.number(),
  source: z.literal('live'),
  tenantSlug: z.string().min(1),
  xp: z.object({
    total: z.number().int().nonnegative(),
    byContext: z.array(z.object({ leaf: z.string(), xp: z.number().int().nonnegative() })),
    sessionDelta: z.number().int().nonnegative(),
  }),
  readiness: z.array(z.object({
    leaf: z.string(),
    levelCurrent: z.number().int().nonnegative(),
    ready: z.boolean(),
    ciWidth: z.number().nonnegative(),
    shrinkageSinceLevel: z.number().nonnegative(),
    evidenceN: z.number().int().nonnegative(),
    failingPredicates: z.array(z.string()),
  })),
  card: z.object({ bundle: cardBundleSchema, stats: statsSchema }),
  timeline: z.array(timelinePointSchema),
  graphNodes: z.array(z.object({
    id: z.string(),
    leaf: z.string(),
    label: z.string(),
    posteriorMass: z.number().nonnegative(),
    uncertaintyWidth: z.number().nonnegative(),
    level: z.number().int().nonnegative(),
    ready: z.boolean(),
  })),
  graphEdges: z.array(z.object({ source: z.string(), target: z.string() })),
  stamps: z.array(z.object({
    noteId: z.string(),
    savedAtMs: z.number(),
    snapshotDigest: z.string(),
    emptyMark: z.boolean(),
    edges: z.array(z.object({
      edgeId: z.string(),
      fromId: z.string(),
      toId: z.string(),
      edgeType: z.string(),
      class: z.enum(['epistemic', 'reference']),
      callout: z.string(),
    })),
  })),
  listings: z.array(z.object({
    listingId: z.string(),
    card: cardBundleSchema,
    lineage: z.object({
      domainFamilies: z.array(z.string()).nullable(),
      mostExercisedSkills: z.array(z.string()).nullable(),
      dominantLanguages: z.array(z.string()).nullable(),
      worldFamilies: z.array(z.string()).nullable(),
    }),
    publicTimeline: z.array(timelinePointSchema),
    publishedAtMs: z.number(),
  })),
});

const growthResultSchema = z.object({
  growthSnapshot: z.object({
    available: z.boolean(),
    message: z.string().nullable(),
    snapshot: snapshotSchema.nullable(),
  }),
});

export type GrowthSnapshot = z.infer<typeof snapshotSchema>;
export type GrowthStats = z.infer<typeof statsSchema>;
export type GrowthTimelinePoint = z.infer<typeof timelinePointSchema>;
export type GrowthStamp = GrowthSnapshot['stamps'][number];
export type GrowthListing = GrowthSnapshot['listings'][number];

export type GrowthState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: GrowthSnapshot; stale: boolean; message?: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const GROWTH_QUERY = `
  query CommonPlaceGrowthSnapshot {
    growthSnapshot {
      available
      message
      snapshot {
        schemaVersion generatedAtMs source tenantSlug
        xp { total sessionDelta byContext { leaf xp } }
        readiness { leaf levelCurrent ready ciWidth shrinkageSinceLevel evidenceN failingPredicates }
        card {
          stats { ...GrowthStats }
          bundle {
            faceSvg
            manifest {
              ownerPublicFingerprint genesisDigest epochNumber epochDate initialCommit initialMessage lineageHead
              displayedStats { ...GrowthStats }
            }
          }
        }
        timeline {
          commitHash parentCommits observedAtMs xp formSvg beats
          contextLevels { leaf level }
          stats { ...GrowthStats }
        }
        graphNodes { id leaf label posteriorMass uncertaintyWidth level ready }
        graphEdges { source target }
        stamps {
          noteId savedAtMs snapshotDigest emptyMark
          edges { edgeId fromId toId edgeType class callout }
        }
        listings {
          listingId publishedAtMs
          card {
            faceSvg
            manifest {
              ownerPublicFingerprint genesisDigest epochNumber epochDate initialCommit initialMessage lineageHead
              displayedStats { ...GrowthStats }
            }
          }
          lineage { domainFamilies mostExercisedSkills dominantLanguages worldFamilies }
          publicTimeline {
            commitHash parentCommits observedAtMs xp formSvg beats
            contextLevels { leaf level }
            stats { ...GrowthStats }
          }
        }
      }
    }
  }
  fragment GrowthStats on GrowthDisplayedStatsGql {
    form evolutionStage natureBucket calibrationGrade lineageDepth episodeCount
    contextLevels { leaf level }
    skills { name unlockedAt }
    badges { name awardedAt }
  }
`;

async function fetchGrowthSnapshot(signal: AbortSignal): Promise<GrowthState> {
  try {
    const raw = await gql<unknown>(GROWTH_QUERY, {}, { signal });
    return parseGrowthResponse(raw);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export function parseGrowthResponse(raw: unknown): GrowthState {
  const parsed = growthResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', message: 'The Growth GraphQL response did not match the signed snapshot contract.' };
  }
  const result = parsed.data.growthSnapshot;
  if (!result.available || !result.snapshot) {
    return { status: 'unavailable', message: result.message ?? 'Live Growth data is unavailable.' };
  }
  return { status: 'ready', snapshot: result.snapshot, stale: false };
}

export function useGrowthSnapshot(): GrowthState {
  const [state, setState] = useState<GrowthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async (): Promise<void> => {
      const next = await fetchGrowthSnapshot(controller.signal);
      setState((current) => {
        if (next.status === 'error' && current.status === 'ready') {
          return { ...current, stale: true, message: next.message };
        }
        return next;
      });
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 3_000);
    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, []);

  return state;
}
