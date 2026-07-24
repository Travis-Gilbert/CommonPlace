// SOURCING: vitest — adapter conformance suite for SPEC B1.

import { describe, expect, it } from "vitest";
import { createLoopbackStore } from "../loopback.js";
import { WebHostAdapter } from "../adapters/web.js";
import { TauriHostAdapter } from "../adapters/tauri.js";
import { GpuiHostAdapter } from "../adapters/gpui.js";
import { runAdapterConformance } from "../conformance.js";

function seededStore() {
  const store = createLoopbackStore();
  store.objects.set("obj_1", {
    id: "obj_1",
    kind: "note",
    title: "Fixture note",
    body: "hello",
  });
  store.contributions = [
    { id: "pane.browser", paneKind: "browser", label: "Browser" },
  ];
  return store;
}

describe("adapter conformance", () => {
  it("passes for GpuiHostAdapter (loopback harness)", async () => {
    const host = new GpuiHostAdapter(seededStore());
    const result = await runAdapterConformance("gpui", host);
    expect(result.failed).toEqual([]);
    expect(result.passed.length).toBeGreaterThanOrEqual(5);
  });

  it("passes for WebHostAdapter with injected transport", async () => {
    const store = seededStore();
    const host = new WebHostAdapter(
      {
        queryObjects: async (q) => {
          const objects = [...store.objects.values()].filter((o) =>
            q.kinds ? q.kinds.includes(o.kind) : true,
          );
          return { objects, total: objects.length };
        },
      },
      store,
    );
    const result = await runAdapterConformance("web", host);
    expect(result.failed).toEqual([]);
  });

  it("passes for TauriHostAdapter without runtime (loopback fallback)", async () => {
    const host = new TauriHostAdapter(null, seededStore());
    const result = await runAdapterConformance("tauri", host);
    expect(result.failed).toEqual([]);
  });

  it("Gpui placeBlock + reload-shaped re-subscribe restores blocks", async () => {
    const store = seededStore();
    const host = new GpuiHostAdapter(store);
    await host.placeBlock({
      workspaceId: "ws_reload",
      kind: "note",
      id: "block_canonical",
      grants: ["edit"],
    });
    const replayed: string[] = [];
    // Simulate surface reload: new subscription against same substrate.
    const unsub = host.subscribeWorkspace("ws_reload", (e) => {
      if (e.type === "block_placed") replayed.push(e.block.id);
    });
    unsub();
    expect(replayed).toContain("block_canonical");
    expect(store.blocks.get("block_canonical")?.id).toBe("block_canonical");
  });
});
