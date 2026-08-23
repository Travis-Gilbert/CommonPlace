#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const seed = args.has("--seed");
const verify = args.has("--verify");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fixtureLayout() {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../crates/layout/fixtures/company-layout.json"),
      "utf8",
    ),
  );
}

function recordOverride() {
  const layout = structuredClone(fixtureLayout());
  layout.layout_id = "layout:acme-override";
  layout.applies_to = {
    kind: "record",
    object_type: "company",
    record_id: "acme",
  };
  layout.tabs[0].widgets[0].grid = { x: 2, y: 1, w: 8, h: 5 };
  return layout;
}

function workspaceDashboard() {
  return {
    layout_id: "layout:workspace-dashboard",
    scope: { kind: "workspace" },
    applies_to: { kind: "workspace" },
    tabs: [
      {
        tab_id: "overview",
        title: "Overview",
        widgets: [
          {
            widget_id: "revenue",
            body_kind: "chart",
            body_params: {
              object_type: "companies",
              field: "revenue",
              operation: "sum",
              query: {
                filters: [
                  { field_key: "revenue", operator: "greater_than", value: 10 },
                ],
              },
            },
            grid: { x: 0, y: 0, w: 6, h: 4 },
          },
          {
            widget_id: "companies",
            body_kind: "record_table",
            body_params: { object_type: "companies" },
            grid: { x: 6, y: 0, w: 6, h: 6 },
          },
        ],
      },
    ],
  };
}

function canvasLayout() {
  return {
    layout_id: "layout:command-canvas",
    scope: { kind: "canvas", canvas_id: "commands" },
    applies_to: { kind: "canvas", canvas_id: "commands" },
    tabs: [
      {
        tab_id: "canvas",
        title: "Canvas",
        widgets: [
          {
            widget_id: "log",
            body_kind: "log",
            body_params: {},
            grid: { x: 0, y: 0, w: 12, h: 4 },
          },
        ],
      },
    ],
  };
}

function offlineOracle() {
  const layout = fixtureLayout();
  invariant(layout.tabs.length === 2, "layout fixture lost its tabs");
  invariant(
    layout.tabs[1].widgets[0].body_kind === "future_body",
    "unknown body fixture disappeared",
  );
  const dashboard = workspaceDashboard();
  const chart = dashboard.tabs[0].widgets[0];
  const query = structuredClone(chart.body_params.query);
  delete query.offset;
  delete query.limit;
  query.field = chart.body_params.field;
  query.op = chart.body_params.operation;
  invariant(query.offset === undefined && query.limit === undefined, "page bounds leaked");
  return {
    oracle_class: "layout_fixture_contract",
    layouts: [layout.layout_id, recordOverride().layout_id, dashboard.layout_id],
    body_kinds: layout.tabs.flatMap((tab) =>
      tab.widgets.map((widget) => widget.body_kind),
    ),
    aggregate_call: { tool: "aggregate_companies", arguments: query },
    page_aggregate_substitution_allowed: false,
  };
}

function parseMcpBody(text, contentType) {
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text);
  }
  const events = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map(JSON.parse);
  invariant(events.length > 0, "MCP returned an empty event stream");
  return events.at(-1);
}

function structuredResult(response) {
  if (response.error) {
    throw new Error(`MCP ${response.error.code}: ${response.error.message}`);
  }
  const result = response.result ?? {};
  if (result.isError) {
    const text = result.content?.find((part) => part.type === "text")?.text;
    throw new Error(`MCP tool error: ${text ?? JSON.stringify(result)}`);
  }
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const text = result.content?.find((part) => part.type === "text")?.text;
  invariant(text, "MCP tool response has no structured content");
  return JSON.parse(text);
}

async function liveClient() {
  const endpoint = process.env.THEOREMWEB_MCP_URL;
  const tokenFile = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  invariant(endpoint, "THEOREMWEB_MCP_URL is required for --live");
  invariant(tokenFile, "THEOREMWEB_AUTH_TOKEN_FILE is required for --live");
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  invariant(token, "authentication token file is empty");
  let id = 0;
  return async (name, argumentsValue = {}) => {
    id += 1;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: argumentsValue },
      }),
    });
    const text = await response.text();
    invariant(response.ok, `${name} returned HTTP ${response.status}: ${text}`);
    return structuredResult(
      parseMcpBody(text, response.headers.get("content-type") ?? ""),
    );
  };
}

async function seedLayouts(call) {
  const layouts = [
    fixtureLayout(),
    recordOverride(),
    workspaceDashboard(),
    canvasLayout(),
  ];
  for (const layout of layouts) {
    await call("layout_write", { layout });
  }
  const record = await call("layout_resolve", {
    binding: { kind: "record", object_type: "company", record_id: "acme" },
  });
  invariant(
    record.layout.layout_id === "layout:acme-override",
    "record override did not beat the object-type default",
  );
  return {
    phase: "seed",
    layouts_written: layouts.map((layout) => layout.layout_id),
    record_override: record.layout.layout_id,
    persisted_grid: record.layout.tabs[0].widgets[0].grid,
  };
}

async function verifyLayouts(call) {
  const listed = await call("layout_list");
  invariant(listed.layouts.length === 4, "layout rows did not survive restart");
  const record = await call("layout_resolve", {
    binding: { kind: "record", object_type: "company", record_id: "acme" },
  });
  const objectDefault = await call("layout_resolve", {
    binding: { kind: "record", object_type: "company", record_id: "globex" },
  });
  const canvas = await call("layout_resolve", {
    binding: { kind: "canvas", canvas_id: "commands" },
  });
  const dashboard = await call("layout_resolve", { binding: { kind: "workspace" } });
  invariant(record.layout.layout_id === "layout:acme-override", "override was lost");
  invariant(
    objectDefault.layout.layout_id === "layout:companies",
    "object default was not applied",
  );
  invariant(canvas.layout.layout_id === "layout:command-canvas", "canvas was lost");
  invariant(
    dashboard.layout.layout_id === "layout:workspace-dashboard",
    "workspace dashboard was lost",
  );

  const filters = [
    { field_key: "revenue", operator: "greater_than", value: 10 },
  ];
  const page = await call("invoke", {
    name: "find_many_companies",
    arguments: { filters, limit: 1 },
  });
  const aggregate = await call("invoke", {
    name: "aggregate_companies",
    arguments: {
      filters,
      field: "revenue",
      op: "sum",
    },
  });
  invariant(page.records.length === 1, "page oracle did not load one row");
  invariant(page.count === 2, "filtered full-set count drifted");
  invariant(aggregate.available, "revenue aggregate was unavailable");
  invariant(aggregate.value === 50, "server aggregate did not equal 50");
  const loadedPageValue = Number(page.records[0].properties?.revenue);
  invariant(
    Number.isFinite(loadedPageValue),
    "loaded page record did not contain a numeric revenue",
  );
  invariant(
    loadedPageValue !== aggregate.value,
    "aggregate accidentally matched the loaded page value",
  );

  return {
    phase: "verify_after_restart",
    authenticated_tenant: listed.identity_receipt?.tenant,
    layout_ids: listed.layouts.map((layout) => layout.layout_id),
    record_override: record.layout.layout_id,
    object_default: objectDefault.layout.layout_id,
    canvas_layout: canvas.layout.layout_id,
    dashboard_layout: dashboard.layout.layout_id,
    unknown_body_label: "Unavailable body: future_body",
    aggregate: {
      loaded_page_length: page.records.length,
      full_filtered_count: page.count,
      loaded_page_value: loadedPageValue,
      full_filtered_revenue_sum: aggregate.value,
      source: "aggregate_companies",
    },
  };
}

async function main() {
  if (!live) {
    console.log(JSON.stringify(offlineOracle(), null, 2));
    return;
  }
  invariant(seed !== verify, "choose exactly one of --seed or --verify with --live");
  const call = await liveClient();
  console.log(
    JSON.stringify(seed ? await seedLayouts(call) : await verifyLayouts(call), null, 2),
  );
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
});
