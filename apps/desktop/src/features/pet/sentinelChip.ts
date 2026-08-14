// SOURCING: none — sentinel chip contract (title, one-line diff, receipt link)
// matching theorem-pet SentinelChip / programmable-graph NotificationChip.

export type SentinelChipView = {
  id: string;
  programTitle: string;
  diffSummary: string;
  receiptLink: string;
  sentinelNodeId: string;
  programId: string;
  observedAtMs: number;
  digest: boolean;
  coalescedCount: number;
};

export const FIXTURE_SENTINEL_CHIP: SentinelChipView = {
  id: "chip:program:price:sentinel-0",
  programTitle: "Price watch",
  diffSummary: "price 10.00 → 11.00",
  receiptLink: "theorem://receipt/sentinel-receipt:program:price:5000",
  sentinelNodeId: "sentinel-0",
  programId: "program:price",
  observedAtMs: 5_000,
  digest: false,
  coalescedCount: 1,
};

export function fixtureChipFromSearch(search: string): SentinelChipView | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  if (params.get("sentinelChip") !== "1") return null;
  if (params.get("digest") === "1") {
    return {
      ...FIXTURE_SENTINEL_CHIP,
      id: "digest:program:price:20",
      diffSummary: "3 monitor alerts batched",
      digest: true,
      coalescedCount: 3,
      sentinelNodeId: "digest",
    };
  }
  return { ...FIXTURE_SENTINEL_CHIP };
}

export function chipsWithoutId(
  chips: readonly SentinelChipView[],
  id: string,
): SentinelChipView[] {
  return chips.filter((chip) => chip.id !== id);
}
