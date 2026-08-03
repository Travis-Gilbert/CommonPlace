import { describe, expect, it } from "bun:test";

import { FileSessionCapacityError, FileSessionStore } from "./file-sessions.js";

const LONG_TTL = 24 * 60 * 60 * 1000;
const SHORT_TTL = 15 * 60 * 1000;

function makeSession(store: FileSessionStore, actorTokenHash: string, ttlMs: number) {
  return store.create({
    workspaceId: "ws_1",
    workspaceRoot: "/tmp/ws",
    actorTokenHash,
    actorScope: "viewer",
    canWrite: false,
    ttlMs,
  });
}

describe("file session capacity is per actor", () => {
  // The escalation: a viewer may create sessions and may ask for the maximum
  // TTL. Global soonest-expiry eviction meant that viewer's long-lived
  // sessions outlived, and pushed out, a collaborator's live default-TTL
  // session — whose renew and file calls then began returning 404.
  it("does not evict another actor's live session under pressure", () => {
    const store = new FileSessionStore({ maxSessions: 4, maxSessionsPerActor: 4 });

    const collaborator = makeSession(store, "collaborator-hash", SHORT_TTL);
    for (let index = 0; index < 3; index += 1) {
      makeSession(store, "viewer-hash", LONG_TTL);
    }

    // Store is full. The next viewer session must not take the collaborator's
    // slot, even though the collaborator's expires first.
    makeSession(store, "viewer-hash", LONG_TTL);

    expect(store.get(collaborator.id)).not.toBeNull();
  });

  it("recycles the caller's own oldest session once they hit their quota", () => {
    const store = new FileSessionStore({ maxSessions: 100, maxSessionsPerActor: 2 });

    const first = makeSession(store, "viewer-hash", SHORT_TTL);
    const second = makeSession(store, "viewer-hash", LONG_TTL);
    const third = makeSession(store, "viewer-hash", LONG_TTL);

    expect(store.get(first.id)).toBeNull();
    expect(store.get(second.id)).not.toBeNull();
    expect(store.get(third.id)).not.toBeNull();
  });

  it("reports capacity rather than evicting when the store is all other actors", () => {
    const store = new FileSessionStore({ maxSessions: 2, maxSessionsPerActor: 8 });
    makeSession(store, "actor-a", LONG_TTL);
    makeSession(store, "actor-b", LONG_TTL);

    expect(() => makeSession(store, "actor-c", LONG_TTL)).toThrow(FileSessionCapacityError);
  });

  it("still admits a new actor once an expired session is pruned", () => {
    const store = new FileSessionStore({ maxSessions: 2, maxSessionsPerActor: 8 });
    makeSession(store, "actor-a", 1);
    makeSession(store, "actor-b", LONG_TTL);

    // The 1ms session is expired by the time the next create prunes.
    const start = Date.now();
    while (Date.now() === start) {
      // Spin briefly so the clock advances past the 1ms TTL.
    }

    expect(() => makeSession(store, "actor-c", LONG_TTL)).not.toThrow();
  });
});
