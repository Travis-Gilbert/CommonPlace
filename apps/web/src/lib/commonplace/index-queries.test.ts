import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commonplace-graphql", () => ({
  gqlAddToCollection: vi.fn(),
  gqlBriefing: vi.fn(),
  gqlCollections: vi.fn(),
  gqlCreateCollection: vi.fn(),
  gqlMoveToCollection: vi.fn(),
}));

import {
  gqlAddToCollection,
  gqlCollections,
  gqlMoveToCollection,
  type CollectionGql,
} from "@/lib/commonplace-graphql";
import { indexRowKey, submitRefile, type IndexRow } from "./index-queries";

class TestCustomEvent<T = unknown> extends Event {
  readonly detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type);
    this.detail = init?.detail as T;
  }
}

function collectionFixture(id: string, name: string): CollectionGql {
  return {
    id,
    name,
    kind: "collection",
    identifier: null,
    description: null,
    startAtMs: null,
    endAtMs: null,
    color: null,
    sortOrder: null,
    featureFlags: {},
    createdAtMs: 0,
  };
}

describe("index queries", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", TestCustomEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses a band-aware row key so duplicate item ids select distinct rows", () => {
    const base = {
      id: "item:shared",
      kind: "task",
      title: "Shared task",
      destination: null,
      tags: [],
    } satisfies Omit<IndexRow, "band">;

    expect(indexRowKey({ ...base, band: "today" })).toBe("today:item:shared");
    expect(indexRowKey({ ...base, band: "open" })).toBe("open:item:shared");
  });

  it("moves from the replacement collection back on undo instead of adding a duplicate", async () => {
    vi.mocked(gqlCollections).mockResolvedValue([
      collectionFixture("collection-a", "Original"),
      collectionFixture("collection-b", "Replacement"),
    ]);

    await submitRefile("item-1", "Original", "Filed item", undefined, "Replacement");

    expect(gqlMoveToCollection).toHaveBeenCalledWith("item-1", "collection-b", "collection-a");
    expect(gqlAddToCollection).not.toHaveBeenCalled();
  });
});
