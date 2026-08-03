import { describe, expect, it } from "bun:test";

import { ByteBudget, PayloadTooLargeError, readBoundedText } from "./bounded-body.js";

function bodyOf(chunks: readonly string[]): { body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder();
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
}

describe("readBoundedText", () => {
  it("returns a body that fits", async () => {
    expect(await readBoundedText(bodyOf(["hello ", "world"]), 100)).toBe("hello world");
  });

  it("refuses at the byte limit rather than after buffering", async () => {
    // The chunk that crosses the line is the one that raises. A limit checked
    // after `await response.text()` would have already held the whole payload,
    // which is the failure this exists to prevent.
    let delivered = 0;
    const encoder = new TextEncoder();
    const source = {
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          delivered += 1;
          controller.enqueue(encoder.encode("x".repeat(16)));
        },
      }),
    };
    await expect(readBoundedText(source, 64, "The body")).rejects.toBeInstanceOf(PayloadTooLargeError);
    // Five 16-byte chunks is the first size past 64; an unbounded reader would
    // have gone on pulling forever, because this stream never closes.
    expect(delivered).toBe(5);
  });

  it("counts bytes, not characters", async () => {
    // Four bytes in UTF-8, one string length. A `.length` check would pass this.
    await expect(readBoundedText(bodyOf(["\u{1F600}"]), 3)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(await readBoundedText(bodyOf(["\u{1F600}"]), 4)).toBe("\u{1F600}");
  });

  it("decodes a multi-byte character split across chunks", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode("é");
    const source = {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 1));
          controller.enqueue(bytes.slice(1));
          controller.close();
        },
      }),
    };
    expect(await readBoundedText(source, 100)).toBe("é");
  });

  it("treats an absent body as empty", async () => {
    expect(await readBoundedText({ body: null }, 100)).toBe("");
  });
});

describe("ByteBudget", () => {
  it("permits spending up to the total", () => {
    const budget = new ByteBudget(100);
    budget.spend(60);
    budget.spend(40);
    expect(budget.spent).toBe(100);
  });

  it("refuses the byte that passes the total", () => {
    const budget = new ByteBudget(100);
    budget.spend(100);
    expect(() => budget.spend(1)).toThrow(PayloadTooLargeError);
  });

  it("bounds the sum of many bodies that each fit on their own", async () => {
    // The case a per-read limit cannot see: ten small files are individually
    // fine and collectively over budget.
    const budget = new ByteBudget(50, "This download");
    const readTen = async () => {
      for (let index = 0; index < 10; index += 1) {
        await readBoundedText(bodyOf(["x".repeat(10)]), 1000, "file", budget);
      }
    };
    await expect(readTen()).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(budget.spent).toBeLessThanOrEqual(50);
  });

  it("shares one counter across concurrent reads", async () => {
    // Six in-flight reads must not each see the same remaining figure and
    // collectively overshoot it. Spending is per-chunk and synchronous, so
    // exactly one of these crosses the line.
    const budget = new ByteBudget(25, "This download");
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        readBoundedText(bodyOf(["x".repeat(10)]), 1000, "file", budget)),
    );
    expect(results.filter((result) => result.status === "rejected").length).toBeGreaterThan(0);
    expect(budget.spent).toBeLessThanOrEqual(25);
  });
});
