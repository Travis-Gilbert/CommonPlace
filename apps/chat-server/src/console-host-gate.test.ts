import { describe, expect, it } from "bun:test";

import { consoleActorSatisfiesHost } from "./server.js";
import type { Actor } from "./types.js";

// Regression test for an escalation that survived its own fix.
//
// consoleSessionActor was changed from owner to collaborator to stop every
// console member holding admin rights. But requireHost returned the console
// actor without checking scope, so host-only routes (token minting, workspace
// deletion, runtime upgrades) kept accepting it and nothing changed.
//
// Every test at the time asserted the shape of the actor. None asserted what
// the authorization path did with it, which is why the hole was invisible.
// This tests the decision.
function consoleActor(scope: Actor["scope"]): Actor {
  return {
    type: "console",
    scope,
    subject: "user:travis",
    tenant: "Travis-Gilbert",
    workspaceId: "ws_01",
    workspaceSlug: "commonplace",
    tokenHash: "hash",
  };
}

describe("console sessions on host-only routes", () => {
  it("refuses a collaborator, which is what console sessions are today", () => {
    expect(consoleActorSatisfiesHost(consoleActor("collaborator"))).toBe(false);
  });

  it("refuses a viewer", () => {
    expect(consoleActorSatisfiesHost(consoleActor("viewer"))).toBe(false);
  });

  it("refuses an absent session rather than throwing", () => {
    expect(consoleActorSatisfiesHost(null)).toBe(false);
  });

  it("admits owner, so a console that later signs a role needs no code change", () => {
    expect(consoleActorSatisfiesHost(consoleActor("owner"))).toBe(true);
  });

  it("keys off scope alone, not the presence of console identity fields", () => {
    // A future actor type carrying owner must pass, and a console actor
    // decorated with more identity must still fail without owner.
    const decorated = { ...consoleActor("collaborator"), workspaceSlug: "anything" };
    expect(consoleActorSatisfiesHost(decorated)).toBe(false);
  });
});
