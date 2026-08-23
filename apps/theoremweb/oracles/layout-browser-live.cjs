#!/usr/bin/env node
"use strict";

// V03: prove layouts are graph-backed product surfaces, not fixture pages.
//
//   node oracles/layout-browser-live.cjs                  offline contract check
//   node oracles/layout-browser-live.cjs --live --seed    write the probe layout
//   node oracles/layout-browser-live.cjs --live --verify  read it back
//
// The offline mode checks what a fixture can honestly prove: that the pinned
// layout only names canonical bodies, that its unknown body is deliberate, and
// that no aggregate receipt is page-scoped. It cannot discharge V03. Per plan
// decision D04, fixture evidence may not stand in for a live oracle, so the
// offline run reports `not_run` for every live clause rather than a pass.
//
// Live mode needs THEOREMWEB_MCP_URL and THEOREMWEB_AUTH_TOKEN_FILE.

const fs = require("node:fs");
const path = require("node:path");
const { connect, invariant } = require("./mcp-client.cjs");

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const seed = args.has("--seed");
const verify = args.has("--verify");

const HERE = __dirname;
const PINNED_LAYOUTS = path.join(HERE, "fixtures", "layout-set-records.json");
const PINNED_AGGREGATES = path.join(HERE, "fixtures", "aggregates-records.json");
const CONTRACT = path.join(HERE, "fixtures", "registry-contract-expected.json");

// Written to the graph during --seed and expected back during --verify, with a
// geometry no fixture carries. A host that reads the checked-in fixture cannot
// report it, and a host that never persisted the drag cannot report the moved
// rectangle.
const GRAPH_ONLY_LAYOUT = "v03-graph-only-layout";
const PROBE_GEOMETRY = { x: 5, y: 3, w: 4, h: 2 };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function offline() {
  const canonical = new Set(readJson(CONTRACT).bodies.map((body) => body.kind));
  const layouts = readJson(PINNED_LAYOUTS).layouts;
  invariant(layouts.length > 0, "the pinned layout set is empty");

  const unknown = [];
  for (const layout of layouts) {
    invariant(layout.layout_id, "a pinned layout has no layout_id");
    invariant(layout.tabs.length > 0, `${layout.layout_id} has no tabs`);
    const tabIds = new Set();
    for (const tab of layout.tabs) {
      invariant(!tabIds.has(tab.tab_id), `${layout.layout_id} repeats tab ${tab.tab_id}`);
      tabIds.add(tab.tab_id);
      for (const widget of tab.widgets) {
        const { x, w } = widget.grid;
        invariant(
          x >= 0 && w >= 1 && x + w <= 12,
          `${layout.layout_id}/${widget.widget_id} does not fit the 12-column grid`,
        );
        if (!canonical.has(widget.body_kind)) {
          unknown.push(`${layout.layout_id}/${widget.widget_id}:${widget.body_kind}`);
        }
      }
    }
  }
  // LY2 wants an unregistered body rendered as a labeled placeholder. A
  // fixture with no unknown body cannot exercise that path at all, so its
  // absence is a gap in the fixture, not a clean result.
  invariant(
    unknown.length > 0,
    "the pinned layout names no unregistered body, so nothing exercises the labeled-placeholder path",
  );

  for (const receipt of readJson(PINNED_AGGREGATES)) {
    invariant(
      receipt.completeness === "full_filtered_set",
      `aggregate receipt for ${receipt.widget_id} is ${receipt.completeness}; LY5 refuses page-scoped values`,
    );
  }

  return {
    mode: "offline",
    evidence_class: "fixture",
    layouts: layouts.map((layout) => layout.layout_id),
    unknown_bodies: unknown,
    live_clauses: "not_run",
    note: "D04: fixture evidence does not discharge V03",
  };
}

async function liveSeed() {
  const client = await connect("theoremweb-layout-oracle");
  const tools = new Set((await client.listTools()).map((tool) => tool.name));
  for (const required of ["layout_write", "layout_get"]) {
    invariant(
      tools.has(required),
      `the graph exposes no ${required} tool, so V03 cannot be seeded; this is the backend half of W03`,
    );
  }
  await client.call("layout_write", {
    layout: {
      layout_id: GRAPH_ONLY_LAYOUT,
      scope: { kind: "workspace" },
      applies_to: { kind: "workspace" },
      tabs: [
        {
          tab_id: "probe",
          title: "Probe",
          widgets: [
            {
              widget_id: "moved",
              body_kind: "record_table",
              body_params: {},
              grid: PROBE_GEOMETRY,
            },
          ],
        },
      ],
    },
  });
  return { mode: "live-seed", wrote: GRAPH_ONLY_LAYOUT, geometry: PROBE_GEOMETRY };
}

async function liveVerify() {
  const client = await connect("theoremweb-layout-oracle");
  const stored = await client.call("layout_get", { layout_id: GRAPH_ONLY_LAYOUT });
  const layout = stored.layout ?? stored;
  invariant(
    layout.layout_id === GRAPH_ONLY_LAYOUT,
    `layout_get returned ${layout.layout_id}, not the probe; registry truth came from a fixture`,
  );
  const widget = layout.tabs
    .flatMap((tab) => tab.widgets)
    .find((candidate) => candidate.widget_id === "moved");
  invariant(widget, "the probe layout lost its widget across the round trip");
  // LY1: a layout survives reload. The geometry is the discriminating part --
  // a host that echoed the write without persisting it would still return the
  // id, but a re-read from the graph returns the rectangle.
  for (const axis of ["x", "y", "w", "h"]) {
    invariant(
      widget.grid[axis] === PROBE_GEOMETRY[axis],
      `probe geometry ${axis} came back ${widget.grid[axis]}, expected ${PROBE_GEOMETRY[axis]}`,
    );
  }
  return { mode: "live-verify", layout_id: GRAPH_ONLY_LAYOUT, geometry: widget.grid };
}

async function main() {
  if (!live) {
    return offline();
  }
  invariant(seed !== verify, "--live requires exactly one of --seed or --verify");
  // The offline contract still has to hold in live mode; a live run that
  // skipped it could pass against a graph whose layouts name bodies the
  // registry never declared.
  offline();
  return seed ? liveSeed() : liveVerify();
}

main()
  .then((receipt) => {
    console.log(JSON.stringify(receipt, null, 2));
  })
  .catch((error) => {
    console.error(`layout-browser-live: ${error.message}`);
    process.exitCode = 1;
  });
