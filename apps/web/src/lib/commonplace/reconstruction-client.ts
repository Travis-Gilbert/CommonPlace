/**
 * Reconstruction data client — React hook for consuming reconstructed facts
 * through the CommonPlace GraphQL API.
 *
 * Threads onto the existing `useApiData()` fetcher pattern used by SidebarTree,
 * GridView, FilesView, and AutoOrganizeView.
 */

import { useMemo } from "react";
import { useApiData, type UseApiDataResult } from "@/lib/commonplace-api";
import { gqlReconstructedFacts, gqlReconstructedFactsByModality, type ItemGql } from "@/lib/commonplace-graphql";
import {
  parseReconstructedExtra,
  RECONSTRUCTED_TAG,
  type ReconstructedExtra,
  type Modality,
} from "@/lib/commonplace/reconstruction-types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ReconstructedItem {
  /** The raw GraphQL item (tags, collections, status, etc.) */
  item: ItemGql;
  /** Parsed reconstruction metadata — always Some when tag gate passes */
  reconstruction: ReconstructedExtra;
}

// ── Hook: useReconstructedFacts ───────────────────────────────────────────────

/**
 * Fetch all Scene-kind items tagged "reconstructed", parse their `extra`
 * field, and return the list sorted by recency (newest first).
 *
 * Uses the same `useApiData` fetcher pattern as the rest of CommonPlace.
 */
export function useReconstructedFacts(limit: number = 50): UseApiDataResult<ReconstructedItem[]> {
  const result = useApiData(() => gqlReconstructedFacts(limit), [limit]);

  const items = useMemo(() => reconstructItems(result.data), [result.data]);

  return {
    ...result,
    data: items,
  };
}

/**
 * Fetch reconstructed facts for a specific modality (binary, data, design, procedural).
 */
export function useReconstructedFactsByModality(
  modality: Modality,
  limit: number = 50,
): UseApiDataResult<ReconstructedItem[]> {
  const result = useApiData(
    () => gqlReconstructedFactsByModality(modality, limit),
    [modality, limit],
  );

  const items = useMemo(() => reconstructItems(result.data), [result.data]);

  return {
    ...result,
    data: items,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reconstructItems(raw: ItemGql[] | null): ReconstructedItem[] | null {
  if (!raw) return null;
  return raw
    .filter((item) => item.tags.includes(RECONSTRUCTED_TAG))
    .map((item) => {
      const reconstruction = parseReconstructedExtra(item.extra);
      // parseReconstructedExtra returns null when modality is missing —
      // but the tag gate guarantees we passed the reconstructor filter.
      // Fall back to a minimal extra so the consumer always gets a shape.
      return {
        item,
        reconstruction: reconstruction ?? fallbackExtra(item),
      };
    })
    .sort((a, b) => b.item.updatedAtMs - a.item.updatedAtMs);
}

function fallbackExtra(item: ItemGql): ReconstructedExtra {
  return {
    modality: undefined,
    confidence_mean: typeof item.extra?.confidence_mean === "number"
      ? (item.extra.confidence_mean as number)
      : undefined,
  };
}
