#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const seed = args.has("--seed");
const verify = args.has("--verify");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mountsFromLiveSurfaces(surfaces) {
  const records = surfaces.find(
    (surface) => surface.renderer?.body_kind === "record_table",
  );
  const chat = surfaces.find(
    (surface) => surface.renderer?.body_kind === "agent_thread",
  );
  invariant(records, "live registry has no record_table surface");
  invariant(chat, "live registry has no agent_thread surface");
  return {
    record: {
      surface: records,
      binding: {
        kind: "record",
        object_type: "company",
        record_id: "acme",
      },
    },
    question: { surface: chat, binding: { kind: "workspace" } },
  };
}

function exerciseHistory(mounts) {
  const entries = [];
  let cursor = -1;
  const push = (mount) => {
    entries.splice(cursor + 1);
    entries.push(structuredClone(mount));
    cursor = entries.length - 1;
  };
  push(mounts.record);
  push(mounts.question);
  cursor -= 1;
  const back = structuredClone(entries[cursor]);
  cursor += 1;
  const forward = structuredClone(entries[cursor]);
  invariant(
    back.surface.surface_id === mounts.record.surface.surface_id &&
      back.binding.record_id === "acme",
    "back did not restore the complete record surface and binding",
  );
  invariant(
    forward.surface.surface_id === mounts.question.surface.surface_id &&
      forward.binding.kind === "workspace",
    "forward did not restore the complete chat surface and binding",
  );
  return { back, forward };
}

function field(key, label, kind) {
  return {
    key,
    label,
    field_type: { kind },
    required: false,
    system: false,
  };
}

function objectDeclaration(name) {
  const title = `${name[0].toUpperCase()}${name.slice(1)}`;
  return {
    name_singular: name,
    name_plural: `${name}s`,
    label_singular: title,
    label_plural: `${title}s`,
    node_label: title,
    label_identifier_field: "name",
    fields: [field("name", "Name", "text"), field("status", "Status", "text")],
    enforcement: "reject",
    system: false,
    extensions: {},
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

async function seedLiveGraph(call) {
  const surfaces = [
    {
      surface_id: "tenant-records",
      title: "Records",
      icon: "table",
      default_scope: { kind: "workspace" },
      renderer: { kind: "dioxus", body_kind: "record_table" },
      capabilities: ["records.read"],
    },
    {
      surface_id: "tenant-chat",
      title: "Ask",
      icon: "message",
      default_scope: { kind: "workspace" },
      renderer: { kind: "dioxus", body_kind: "agent_thread" },
      capabilities: ["threads.read"],
    },
    {
      surface_id: "future-canvas",
      title: "Future Canvas",
      icon: "sparkle",
      default_scope: { kind: "workspace" },
      renderer: { kind: "future_gpu", quality: "high" },
      capabilities: [],
    },
  ];
  for (const surface of surfaces) {
    await call("surface_write", { surface });
  }
  await call("scope_write", {
    context: {
      binding: { kind: "record", object_type: "company", record_id: "acme" },
      records: [{ object_type: "company", record_id: "acme" }],
      documents: [],
      thread_id: "thread:acme",
      capability_grants: ["records.read"],
    },
  });
  await call("scope_write", {
    context: {
      binding: { kind: "workspace" },
      records: [],
      documents: [],
      thread_id: "thread:workspace",
      capability_grants: ["threads.read"],
    },
  });

  const company = await call("schema_declare", objectDeclaration("company"));
  const task = await call("schema_declare", objectDeclaration("task"));
  const companyId = company.object_type.object_type_id;
  const taskId = task.object_type.object_type_id;
  await call("view_upsert", {
    view: {
      view_id: "view:qualified",
      tenant_id: "forged-tenant",
      object_type_id: companyId,
      name: "Qualified companies",
      schema_version: company.object_type.content_anchor,
      filters: [{ field_key: "status", operator: "eq", value: "qualified" }],
      sorts: [{ field_key: "name", direction: "asc" }],
      group_by: null,
      columns: [
        { field_key: "name", order: 0, width: 240, visible: true, pinned: true },
        { field_key: "status", order: 1, width: 140, visible: false, pinned: false },
      ],
    },
  });

  const probe = await call("surface_list");
  const principalId = probe.identity_receipt?.principal;
  invariant(principalId, "authenticated response omitted principal identity receipt");
  const folder = (
    await call("navigation_create", {
      scope: "workspace",
      kind: { kind: "folder", name: "Work" },
      position: 0,
    })
  ).item;
  const companyNav = (
    await call("navigation_create", {
      scope: "workspace",
      kind: { kind: "object", object_type_id: companyId, name: "Companies" },
      position: 1,
      parent_id: folder.nav_item_id,
    })
  ).item;
  const taskNav = (
    await call("navigation_create", {
      scope: "workspace",
      kind: { kind: "object", object_type_id: taskId, name: "Tasks" },
      position: 2,
      parent_id: folder.nav_item_id,
    })
  ).item;
  const link = (
    await call("navigation_create", {
      scope: "workspace",
      kind: { kind: "link", name: "Handbook", url: "https://example.invalid/handbook" },
      position: 3,
    })
  ).item;
  const favorite = (
    await call("navigation_create", {
      scope: { user: principalId },
      kind: { kind: "view", view_id: "view:qualified", name: "Qualified" },
      position: 4,
    })
  ).item;
  const beforeHide = (await call("navigation_list")).items;
  const folderChildren = beforeHide.filter(
    (item) => item.parent_id === folder.nav_item_id,
  );
  invariant(folderChildren.length === 2, "folder did not group two object types");
  await call("navigation_reorder", {
    ordered_ids: [
      folder.nav_item_id,
      companyNav.nav_item_id,
      taskNav.nav_item_id,
      link.nav_item_id,
      favorite.nav_item_id,
    ],
  });
  await call("navigation_delete", { nav_item_id: taskNav.nav_item_id });
  const taskAfterHide = await call("schema_get", { name_singular: "task" });
  invariant(taskAfterHide && !taskAfterHide.retired, "hiding Task retired its declaration");

  return {
    phase: "seed",
    principal: principalId,
    surfaces_written: surfaces.length,
    folder_children_before_hide: folderChildren.map(
      (item) => item.kind.object_type_id,
    ),
    hidden_nav_item: taskNav.nav_item_id,
    hidden_object_still_declared: true,
    expected_restart_order: [
      folder.nav_item_id,
      companyNav.nav_item_id,
      link.nav_item_id,
      favorite.nav_item_id,
    ],
  };
}

async function verifyLiveGraph(call) {
  const surfacePayload = await call("surface_list");
  const surfaces = surfacePayload.surfaces;
  invariant(surfaces.length === 3, "surface rows did not survive restart");
  const future = surfaces.find((surface) => surface.surface_id === "future-canvas");
  invariant(
    future?.renderer?.kind === "future_gpu",
    "unknown renderer row did not survive restart",
  );
  const mounts = mountsFromLiveSurfaces(surfaces);
  const history = exerciseHistory(mounts);
  const recordScope = (
    await call("scope_resolve", {
      binding: { kind: "record", object_type: "company", record_id: "acme" },
    })
  ).context;
  invariant(recordScope.thread_id === "thread:acme", "record scope did not survive restart");

  const navigation = (await call("navigation_list")).items;
  const positions = [...navigation]
    .sort((left, right) => left.position - right.position)
    .map((item) => item.nav_item_id);
  const folder = navigation.find((item) => item.kind.kind === "folder");
  const company = navigation.find(
    (item) => item.kind.kind === "object" && item.kind.name === "Companies",
  );
  const task = navigation.find(
    (item) => item.kind.kind === "object" && item.kind.name === "Tasks",
  );
  const link = navigation.find((item) => item.kind.kind === "link");
  const favorite = navigation.find((item) => item.kind.kind === "view");
  invariant(folder && company && link && favorite, "persisted navigation is incomplete");
  invariant(company.parent_id === folder.nav_item_id, "folder membership did not persist");
  invariant(!task, "hidden Task navigation item returned after restart");
  const savedView = await call("view_get", { view_id: favorite.kind.view_id });
  invariant(
    savedView.view.filters[0].value === "qualified" &&
      savedView.view.columns[1].visible === false,
    "favorite did not open the persisted saved filters and columns",
  );
  const taskDeclaration = await call("schema_get", { name_singular: "task" });
  invariant(
    taskDeclaration && !taskDeclaration.retired,
    "hidden object declaration was retired",
  );

  return {
    phase: "verify_after_restart",
    authenticated_tenant: surfacePayload.identity_receipt?.tenant,
    surfaces: surfaces.map((surface) => surface.surface_id),
    future_renderer_label: `Unavailable renderer: ${future.renderer.kind}`,
    record_intent: {
      surface_id: mounts.record.surface.surface_id,
      binding: mounts.record.binding,
      resolved_thread_id: recordScope.thread_id,
    },
    question_intent: {
      surface_id: mounts.question.surface.surface_id,
      binding: mounts.question.binding,
    },
    history,
    navigation: {
      ordered_ids: positions,
      folder_id: folder.nav_item_id,
      company_parent_id: company.parent_id,
      hidden_task_absent: true,
      hidden_task_declaration_retained: true,
      custom_link: link.kind.url,
      favorite_view_id: favorite.kind.view_id,
    },
    saved_view: {
      filters: savedView.view.filters,
      sorts: savedView.view.sorts,
      columns: savedView.view.columns,
    },
  };
}

async function main() {
  if (!live) {
    const surfaces = [
      { surface_id: "records", renderer: { kind: "dioxus", body_kind: "record_table" } },
      { surface_id: "chat", renderer: { kind: "dioxus", body_kind: "agent_thread" } },
    ];
    const history = exerciseHistory(mountsFromLiveSurfaces(surfaces));
    process.stdout.write(`${JSON.stringify({ oracle: "offline-contract", history }, null, 2)}\n`);
    return;
  }
  invariant(seed !== verify, "--live requires exactly one of --seed or --verify");
  const call = await liveClient();
  const receipt = seed ? await seedLiveGraph(call) : await verifyLiveGraph(call);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});

