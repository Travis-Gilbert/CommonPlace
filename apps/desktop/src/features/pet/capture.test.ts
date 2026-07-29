import { describe, expect, it } from "vitest";

import { nextPetCaptureAttemptAt } from "./capture";

describe("PET capture retry scheduling", () => {
  it("schedules from the oldest nonterminal FIFO entry", () => {
    expect(
      nextPetCaptureAttemptAt([
        { state: "kept", nextAttemptAt: 5_000 },
        { state: "kept", nextAttemptAt: 100 },
      ]),
    ).toBe(5_000);
  });

  it("skips completed entries before selecting the FIFO head", () => {
    expect(
      nextPetCaptureAttemptAt([
        { state: "sent", nextAttemptAt: 0 },
        { state: "error", nextAttemptAt: 50 },
        { state: "kept", nextAttemptAt: 1_000 },
      ]),
    ).toBe(1_000);
  });
});
