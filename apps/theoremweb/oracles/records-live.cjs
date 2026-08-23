#!/usr/bin/env node
"use strict";

// W02 / AC2: graph-backed Record Table live oracle.
//
//   node oracles/records-live.cjs                  fixture/source contract only
//   node oracles/records-live.cjs --live --seed    mutate the live tenant once
//   node oracles/records-live.cjs --live           read-only live verification
//
// Live mode requires THEOREMWEB_MCP_URL, THEOREMWEB_AUTH_TOKEN_FILE, and
// THEOREMWEB_SECOND_AUTH_TOKEN_FILE. Bare --live never declares, writes,
// publishes, or advances a stream cursor.

const fs = require("node:fs");
const path = require("node:path");
const { connect, invariant } = require("./mcp-client.cjs");

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const seed = args.has("--seed");

const OBJECT = "theoremweb_company";
const PLURAL = "theoremweb_companies";
const OBJECT_ID = "schema:object-type:Travis-Gilbert:theoremweb_company";
const VIEW = "view:theoremweb:w02-qualified";
const SECOND_VIEW = "view:theoremweb:w02-all";
const LAYOUT = "layout:workspace:records";
const SURFACE = "records";
const STREAM = `view:${VIEW}`;
const RECORDS = [
  { id: "theoremweb-company:w02-acme", name: "Acme persisted", revenue: 30, status: "qualified" },
  { id: "theoremweb-company:w02-globex", name: "Globex", revenue: 20, status: "qualified" },
  { id: "theoremweb-company:w02-low", name: "Low Co", revenue: 5, status: "lead" },
];

function healthy(value, tool) {
  invariant(value && typeof value === "object", `${tool} returned no structured result`);
  invariant(value.status !== "degraded", `${tool} degraded: ${JSON.stringify(value.degradation)}`);
  invariant(!value.error, `${tool} refused: ${value.error}: ${value.message ?? ""}`);
  return value;
}

async function call(client, tool, argumentsValue = {}) {
  return healthy(await client.call(tool, argumentsValue), tool);
}

function declaration() {
  return {
    name_singular: OBJECT,
    name_plural: PLURAL,
    label_singular: "TheoremWeb Company",
    label_plural: "TheoremWeb Companies",
    node_label: "TheoremWebCompany",
    label_identifier_field: "name",
    fields: [
      {
        key: "name",
        label: "Name",
        field_type: { kind: "text" },
        required: true,
        system: false,
      },
      {
        key: "revenue",
        label: "Revenue",
        field_type: { kind: "number" },
        required: true,
        system: false,
      },
      {
        key: "status",
        label: "Status",
        field_type: { kind: "text" },
        required: true,
        system: false,
      },
    ],
    enforcement: "reject",
    system: false,
    extensions: {},
  };
}

function view(viewId, name, filters) {
  return {
    view_id: viewId,
    tenant_id: "forged-tenant-is-overwritten",
    object_type_id: OBJECT_ID,
    name,
    schema_version: "w02-live",
    filters,
    sorts: [{ field_key: "revenue", direction: "desc" }],
    group_by: null,
    columns: [
      { field_key: "name", order: 0, width: 240, visible: true, pinned: true },
      { field_key: "revenue", order: 1, width: 140, visible: true, pinned: false },
      { field_key: "status", order: 2, width: 140, visible: true, pinned: false },
    ],
  };
}

function surface() {
  return {
    surface_id: SURFACE,
    title: "Records",
    icon: "table",
    default_scope: { kind: "workspace" },
    renderer: { kind: "dioxus", body_kind: "record_table" },
    layout_ref: LAYOUT,
    capabilities: ["records.read", "records.write"],
  };
}

function layout() {
  return {
    layout_id: LAYOUT,
    scope: { kind: "workspace" },
    applies_to: { kind: "workspace" },
    tabs: [{
      tab_id: "records",
      title: "Records",
      widgets: [{
        widget_id: "theoremweb-companies",
        body_kind: "record_table",
        body_params: { name_singular: OBJECT, view_id: VIEW },
        grid: { x: 0, y: 0, w: 12, h: 8 },
      }],
    }],
  };
}

function offline() {
  const root = path.join(__dirname, "..");
  const table = fs.readFileSync(path.join(root, "crates/record-table/src/table.rs"), "utf8");
  const route = fs.readFileSync(
    path.join(root, "../console/src/lib/server/theoremweb-records.ts"),
    "utf8",
  );
  for (const contract of [
    "RecordTableAction",
    "presence_events",
    "operations_for",
    "find_many_",
    "aggregate_",
    "view_upsert",
    "stream_publish",
  ]) {
    invariant(table.includes(contract) || route.includes(contract), `source omits ${contract}`);
  }
  invariant(!route.includes("rows.length"), "server route fabricates a total from loaded rows");
  return {
    mode: "offline",
    evidence_class: "source_and_unit_contract",
    live_clauses: "not_run",
    substitution_allowed: false,
  };
}

async function secondClient() {
  const original = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  const second = process.env.THEOREMWEB_SECOND_AUTH_TOKEN_FILE;
  invariant(second, "THEOREMWEB_SECOND_AUTH_TOKEN_FILE is required for two-principal proof");
  process.env.THEOREMWEB_AUTH_TOKEN_FILE = second;
  try {
    return await connect("theoremweb-records-claude-principal");
  } finally {
    process.env.THEOREMWEB_AUTH_TOKEN_FILE = original;
  }
}

async function seedLive() {
  let human = await connect("theoremweb-records-human-principal");
  let head = await secondClient();
  const declared = await call(human, "schema_declare", declaration());
  invariant(
    declared.object_type?.object_type_id === OBJECT_ID,
    `schema_declare returned ${declared.object_type?.object_type_id}, expected ${OBJECT_ID}`,
  );
  // Generated affordances are bound to the session catalog. Reconnect after
  // declaration so both principals receive the new tool family.
  human = await connect("theoremweb-records-human-generated-tools");
  head = await secondClient();

  await call(human, "invoke", {
    name: `upsert_many_${PLURAL}`,
    arguments: { records: RECORDS },
  });
  await call(human, "view_upsert", {
    view: view(VIEW, "Qualified", [
      { field_key: "revenue", operator: "greater_than", value: 10 },
    ]),
  });
  await call(human, "view_upsert", { view: view(SECOND_VIEW, "All", []) });
  await call(human, "surface_write", { surface: surface() });
  await call(human, "layout_write", { layout: layout() });

  await call(human, "stream_publish", {
    stream: STREAM,
    actor: "human:codex",
    kind: "view.presence",
    payload: {
      viewId: VIEW,
      objectTypeId: OBJECT_ID,
      actorKind: "human",
      displayName: "Codex",
    },
  });
  await call(human, "stream_publish", {
    stream: STREAM,
    actor: "human:codex",
    kind: "view.focus",
    payload: {
      viewId: VIEW,
      objectTypeId: OBJECT_ID,
      recordId: RECORDS[0].id,
      actorKind: "human",
      displayName: "Codex",
    },
  });
  await call(head, "stream_publish", {
    stream: STREAM,
    actor: "head:claude-code",
    kind: "view.presence",
    payload: {
      viewId: VIEW,
      objectTypeId: OBJECT_ID,
      actorKind: "head",
      displayName: "Claude Code",
    },
  });
  await call(head, "invoke", {
    name: `update_one_${OBJECT}`,
    arguments: { id: RECORDS[1].id, status: "qualified by Claude Code" },
  });
  await call(head, "stream_publish", {
    stream: STREAM,
    actor: "head:claude-code",
    kind: "view.write",
    payload: {
      viewId: VIEW,
      objectTypeId: OBJECT_ID,
      recordId: RECORDS[1].id,
      actorKind: "head",
      displayName: "Claude Code",
    },
  });

  let rejectedEdit;
  try {
    const rejected = await human.call("invoke", {
      name: `update_one_${OBJECT}`,
      arguments: { id: RECORDS[2].id, revenue: "not-a-number" },
    });
    rejectedEdit = [rejected.error, rejected.message].filter(Boolean).join(": ");
  } catch (error) {
    rejectedEdit = error instanceof Error ? error.message : String(error);
  }
  invariant(
    rejectedEdit.includes("schema conformance rejected on `revenue`"),
    `Reject enforcement returned an unexpected result: ${rejectedEdit || "accepted"}`,
  );
  return {
    mode: "live-seed",
    object_type_id: OBJECT_ID,
    view_ids: [VIEW, SECOND_VIEW],
    record_ids: RECORDS.map(({ id }) => id),
    rejected_edit: rejectedEdit,
    principals: [
      declared.identity_receipt?.principal,
      (await call(head, "view_list", { object_type_id: OBJECT_ID })).identity_receipt?.principal,
    ],
  };
}

async function readPresence(client, actor) {
  return call(client, "stream_read", {
    stream: STREAM,
    actor,
    advance: false,
    ack_policy: "on_read",
  });
}

async function verifyLive() {
  const human = await connect("theoremweb-records-human-verify");
  const head = await secondClient();
  const declared = await call(human, "schema_get", { name_singular: OBJECT });
  invariant(declared.object_type_id === OBJECT_ID, "declared object type was not persisted");

  const storedSurface = (await call(human, "surface_get", { surface_id: SURFACE })).surface;
  invariant(storedSurface?.layout_ref === LAYOUT, "Records surface lost its graph layout_ref");
  const storedLayout = (await call(human, "layout_get", { layout_id: LAYOUT })).layout;
  const widget = storedLayout?.tabs
    .flatMap((tab) => tab.widgets)
    .find((candidate) => candidate.body_kind === "record_table");
  invariant(widget?.body_params?.name_singular === OBJECT, "layout lost its object contract");
  invariant(widget?.body_params?.view_id === VIEW, "layout lost its active view contract");

  const storedView = (await call(human, "view_get", { view_id: VIEW })).view;
  const listedViews = await call(human, "view_list", { object_type_id: OBJECT_ID });
  invariant(listedViews.count === 2, `view_list returned ${listedViews.count}, expected 2`);
  invariant(storedView.filters[0].field_key === "revenue", "saved filter did not persist");
  invariant(storedView.sorts[0].direction === "desc", "saved sort did not persist");
  invariant(storedView.columns[0].pinned === true, "saved column pin did not persist");

  const query = { filters: storedView.filters, sorts: storedView.sorts };
  const page = await call(human, "invoke", {
    name: `find_many_${PLURAL}`,
    arguments: { ...query, offset: 0, limit: 1 },
  });
  invariant(page.records.length === 1, "the live page did not honor limit=1");
  invariant(page.count === 2, `the full filtered count is ${page.count}, expected 2`);
  invariant(page.records[0].properties.name === "Acme persisted", "accepted edit did not survive reload");

  const aggregate = await call(human, "invoke", {
    name: `aggregate_${PLURAL}`,
    arguments: { ...query, field: "revenue", op: "sum" },
  });
  invariant(aggregate.available === true, "numeric aggregate was unavailable");
  invariant(aggregate.value === 50, `full-set revenue sum is ${aggregate.value}, expected 50`);
  invariant(
    aggregate.value !== page.records[0].properties.revenue,
    "aggregate accidentally equals the one loaded page value",
  );
  const unavailable = await call(human, "invoke", {
    name: `aggregate_${PLURAL}`,
    arguments: { ...query, field: "name", op: "sum" },
  });
  invariant(unavailable.available === false, "non-numeric sum pretended to be available");

  const rejectedRow = await call(human, "invoke", {
    name: `find_one_${OBJECT}`,
    arguments: { id: RECORDS[2].id },
  });
  invariant(
    rejectedRow.record.properties.revenue === 5,
    "Reject-enforced invalid edit changed the persisted cell",
  );

  const [humanStream, headStream] = await Promise.all([
    readPresence(human, "human:codex"),
    readPresence(head, "head:claude-code"),
  ]);
  const allEvents = [...(humanStream.events ?? []), ...(headStream.events ?? [])];
  const humanFocus = allEvents.find(
    (event) => event.kind === "view.focus" && event.payload?.displayName === "Codex",
  );
  const headWrite = allEvents.find(
    (event) => event.kind === "view.write" && event.payload?.displayName === "Claude Code",
  );
  invariant(humanFocus, "the second session saw no named human focus event");
  invariant(headWrite, "the first session saw no named head write event");

  const principals = [
    listedViews.identity_receipt?.principal,
    headStream.identity_receipt?.principal,
  ];
  invariant(principals.every(Boolean), "live responses omitted principal receipts");
  invariant(principals[0] !== principals[1], "two sessions resolved to the same principal");
  return {
    mode: "live-verify",
    evidence_class: "authenticated_live",
    tenant: listedViews.identity_receipt?.tenant,
    principals,
    object_type_id: OBJECT_ID,
    view_ids: listedViews.views.map(({ view_id }) => view_id).sort(),
    page: { loaded: page.records.length, full_filtered_count: page.count },
    aggregate: {
      field: aggregate.field,
      op: aggregate.op,
      full_filtered_value: aggregate.value,
      loaded_page_value: page.records[0].properties.revenue,
    },
    rejected_edit_rolled_back_to: rejectedRow.record.properties.revenue,
    presence: {
      human_focus: humanFocus.payload.displayName,
      head_write: headWrite.payload.displayName,
    },
    read_only_verify: true,
  };
}

async function main() {
  invariant(!seed || live, "--seed requires --live");
  offline();
  if (!live) return offline();
  return seed ? seedLive() : verifyLive();
}

main()
  .then((receipt) => {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`, () => process.exit(0));
  })
  .catch((error) => {
    console.error(`records-live: ${error.message}`);
    process.exit(1);
  });
