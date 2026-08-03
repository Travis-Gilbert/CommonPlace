// SOURCING: none. The web platform's own ReadableStream is the primitive, and
// nothing in the dependency graph wraps it for this.
//
// `fetch` has no size ceiling in any runtime this server targets: node-fetch's
// `size` option did not survive into undici, and neither Bun's nor Node's
// global fetch exposes one. The npm packages that name the problem
// (byte-limit-stream, maxstream and friends) are Node-stream shims that would
// need a Web-to-Node stream conversion on both sides to reach a `Response`,
// which is more moving parts than the twenty lines below.
//
// The point of every function here is that the limit is enforced *while*
// reading. `await response.text()` followed by a length check has already
// buffered the whole payload by the time the check runs, which is precisely
// the failure being prevented, and a Content-Length header is a claim from the
// other end rather than a constraint on it.

/** Raised when a body, or a budget spanning several bodies, exceeds its limit. */
export class PayloadTooLargeError extends Error {
  constructor(
    readonly subject: string,
    readonly limit: number,
  ) {
    super(`${subject} exceeds the ${limit} byte limit`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * A byte allowance shared across several reads.
 *
 * One file being small is not the same as a thousand small files being small.
 * A per-read limit bounds the worst single response; this bounds the sum, so a
 * repository of ten thousand tiny markdown files cannot pass a per-file check
 * ten thousand times and still exhaust the host.
 *
 * Spending is synchronous and per-chunk, so concurrent reads share one counter
 * exactly. A budget checked once before a read would let every in-flight read
 * see the same remaining figure and collectively overshoot it.
 */
export class ByteBudget {
  private remaining: number;

  constructor(
    private readonly total: number,
    private readonly subject = "This download",
  ) {
    this.remaining = total;
  }

  spend(bytes: number): void {
    // Checked before the subtraction, so a refused chunk is never charged.
    // Debiting first and testing for a negative balance made `spent` climb
    // past `total` by whatever the rejected chunk happened to be, which turned
    // the one number an operator would read to size these limits into a
    // figure that overstated real consumption.
    if (bytes > this.remaining) {
      throw new PayloadTooLargeError(this.subject, this.total);
    }
    this.remaining -= bytes;
  }

  get spent(): number {
    return this.total - this.remaining;
  }
}

/** Anything with a readable body: `Request` and `Response` both qualify. */
type BodyBearing = { readonly body: ReadableStream<Uint8Array> | null };

/**
 * Read a body as text, giving up once it passes `limit` bytes.
 *
 * When a `budget` is supplied, every chunk is charged to it as well, so a
 * caller reading many bodies is bounded by both the per-body ceiling and the
 * shared total. The reader is always cancelled, which is what tells the far
 * end to stop sending: returning early without cancelling leaves the response
 * streaming into a socket nobody is draining.
 */
export async function readBoundedText(
  source: BodyBearing,
  limit: number,
  subject = "The body",
  budget?: ByteBudget,
): Promise<string> {
  const body = source.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new PayloadTooLargeError(subject, limit);
      budget?.spend(value.byteLength);
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return text + decoder.decode();
}
