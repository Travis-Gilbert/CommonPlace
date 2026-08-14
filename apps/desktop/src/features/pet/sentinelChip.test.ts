import { describe, expect, it } from "vitest";

import {
  chipsWithoutId,
  FIXTURE_SENTINEL_CHIP,
  fixtureChipFromSearch,
} from "./sentinelChip";

describe("PET sentinel chip fixture", () => {
  it("injects a chip from the interaction oracle query", () => {
    const chip = fixtureChipFromSearch("?sentinelChip=1");
    expect(chip).toEqual(FIXTURE_SENTINEL_CHIP);
    expect(chip?.receiptLink).toContain("theorem://receipt/");
  });

  it("injects a digest chip when asked", () => {
    const chip = fixtureChipFromSearch("sentinelChip=1&digest=1");
    expect(chip?.digest).toBe(true);
    expect(chip?.diffSummary).toBe("3 monitor alerts batched");
  });

  it("does not invent a chip without the fixture flag", () => {
    expect(fixtureChipFromSearch("")).toBeNull();
  });

  it("dismiss removes that chip id", () => {
    expect(
      chipsWithoutId([FIXTURE_SENTINEL_CHIP], FIXTURE_SENTINEL_CHIP.id),
    ).toEqual([]);
  });
});
