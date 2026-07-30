import { describe, expect, it } from "vitest";
import {
  ALL_HIDDEN,
  hiddenCount,
  isAllHidden,
  isNothingHidden,
  NOTHING_HIDDEN,
  OBJ_LABEL_PARTS,
  togglePart,
} from "./objLabels";

describe("object label projection", () => {
  it("toggles one part without touching the others", () => {
    const once = togglePart(NOTHING_HIDDEN, "status");
    expect(once).toEqual({ source: false, fields: false, status: true });
    expect(togglePart(once, "fields")).toEqual({
      source: false,
      fields: true,
      status: true,
    });
  });

  it("counts hidden parts and recognizes the two extremes", () => {
    expect(hiddenCount(NOTHING_HIDDEN)).toBe(0);
    expect(hiddenCount(ALL_HIDDEN)).toBe(OBJ_LABEL_PARTS.length);
    expect(isNothingHidden(NOTHING_HIDDEN)).toBe(true);
    expect(isAllHidden(ALL_HIDDEN)).toBe(true);
  });
});
