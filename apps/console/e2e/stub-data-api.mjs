// SOURCING: node:http. TEST INFRASTRUCTURE ONLY (R2.1: the record fixture
// lives in tests): a stub object-seam upstream serving the Rust
// commonplace-api wire contract (POST /objects/query, POST /objects/action,
// GET /objects/views) over deterministic record and typed-Hunk fixtures, so e2e
// exercises the real browser -> console proxy -> upstream path hermetically.
// The record generator mirrors src/lib/workspace-seed.ts (djb2 + LCG, the
// repo's deterministic PRNG convention) so captures stay stable.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.STUB_DATA_API_PORT ?? 50591);
const WEB_SEARCH_ENABLED = process.env.STUB_WEB_SEARCH_ENABLED !== 'false';
const MCP_PROTOCOL_VERSION = '2025-06-18';
const MCP_SESSION_ID = 'console-e2e-session';

function loadConsoleFixture() {
  const bytes = readFileSync(
    new URL('../public/wasm/commonplace_console_core.wasm', import.meta.url),
  );
  const wasmModule = new WebAssembly.Module(bytes);
  const imports = {};
  for (const entry of WebAssembly.Module.imports(wasmModule)) {
    if (entry.kind !== 'function') throw new Error(`unsupported wasm import: ${entry.kind}`);
    imports[entry.module] ??= {};
    imports[entry.module][entry.name] = () => 0;
  }
  const instance = new WebAssembly.Instance(wasmModule, imports);
  const length = instance.exports.commonplace_console_fixture_json_prepare();
  const offset = instance.exports.commonplace_console_fixture_json_ptr();
  const json = new TextDecoder().decode(
    new Uint8Array(instance.exports.memory.buffer, offset, length),
  );
  return JSON.parse(json);
}

const CONSOLE_FIXTURE = loadConsoleFixture();
const CONSOLE_PLUGIN_STATES = new Map();

function pluginState(tenant) {
  return CONSOLE_PLUGIN_STATES.get(tenant) ?? 'available';
}

function pluginContribution() {
  return {
    point: 'pane.kind',
    block: 'commonplace.console',
    kind: 'view',
    value: 'commonplace.console',
  };
}

function installedPlugin() {
  return {
    appId: 'commonplace.console',
    version: '1.0.0',
    state: 'installed',
    grants: ['corpus:read'],
    contributions: [pluginContribution()],
  };
}

function consoleGraphqlProjection(variables = {}) {
  const receiptLimit = Number.isSafeInteger(variables.receiptLimit)
    ? Math.max(1, Math.min(250, variables.receiptLimit))
    : 250;
  const receiptOffset = typeof variables.receiptCursor === 'string'
    ? Number.parseInt(variables.receiptCursor, 10) || 0
    : 0;
  const receiptEnd = Math.min(receiptOffset + receiptLimit, CONSOLE_FIXTURE.receipts.length);
  return {
    consoleOverview: {
      countsByType: CONSOLE_FIXTURE.overview.counts_by_type.map(([nodeType, count]) => ({
        nodeType,
        count,
      })),
      generation: CONSOLE_FIXTURE.overview.generation,
      readiness: CONSOLE_FIXTURE.overview.readiness,
    },
    consoleEntities: CONSOLE_FIXTURE.entities,
    consoleReceipts: {
      receipts: CONSOLE_FIXTURE.receipts.slice(receiptOffset, receiptEnd),
      nextCursor: receiptEnd < CONSOLE_FIXTURE.receipts.length ? String(receiptEnd) : null,
      total: CONSOLE_FIXTURE.receipts.length,
    },
    consoleNeighborhood: CONSOLE_FIXTURE.graph,
    standingQueries: CONSOLE_FIXTURE.standing_queries,
    standingFirings: CONSOLE_FIXTURE.firings,
  };
}

function djb2(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash;
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const KINDS = ['capture', 'source', 'note', 'run'];
const STATUS = ['open', 'processing', 'settled'];
const TAGS = ['harness', 'memory', 'graph', 'index', 'publish', 'agent', 'room'];
const HEADS = [
  'Ingest receipt', 'Recall trace', 'Graph delta', 'Publish attestation', 'Session summary',
  'Tension record', 'Capture batch', 'Provenance chain', 'Index sweep', 'Coordination intent',
];
const TAILS = [
  'for the harness console', 'from the memory substrate', 'across tenant records',
  'on the object contract', 'over the descriptor registry', 'through the block seam',
  'against the run journal', 'for the proof workspace', 'in the arrangement graph',
];

function seedRecords() {
  const rand = lcg(djb2('console-records-v1'));
  const records = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 5000; i += 1) {
    const kind = KINDS[Math.floor(rand() * KINDS.length)];
    const status = STATUS[Math.floor(rand() * STATUS.length)];
    const head = HEADS[Math.floor(rand() * HEADS.length)];
    const tail = TAILS[Math.floor(rand() * TAILS.length)];
    const tagCount = 1 + Math.floor(rand() * 2);
    const tags = [];
    for (let t = 0; t < tagCount; t += 1) {
      const tag = TAGS[Math.floor(rand() * TAGS.length)];
      if (!tags.includes(tag)) tags.push(tag);
    }
    const updated = new Date(start + Math.floor(rand() * 197) * 86400000).toISOString().slice(0, 10);
    records.push({
      id: `rec-${i + 1}`,
      type: 'record',
      properties: { title: `${head} ${i + 1} ${tail}`, kind, status, updated, tags },
      relations: {},
      axes: { embeddable: false },
    });
  }
  return records;
}

const RECORDS = seedRecords();

const MEMORIES = Array.from({ length: 5000 }, (_, index) => ({
  id: `memory-${index + 1}`,
  kind: 'memory',
  title: index < 2 ? `Ada Lovelace memory ${index + 1}` : `Harness memory ${index + 1}`,
  source: 'harness:memory',
  createdAtMs: Date.UTC(2026, 0, 1) + index,
  updatedAtMs: Date.UTC(2026, 6, 17) + index,
  extra: {
    projection_path: `Harness Memory/topic-${index % 20}/memory-${index + 1}.md`,
    markdown: `# Harness memory ${index + 1}\n\n${index < 2 ? 'Ada Lovelace is named in this memory.' : 'Projected from the tenant memory substrate.'}`,
    tags: ['harness', index % 2 === 0 ? 'memory' : 'agent'],
  },
}));

// Domain fixtures for the card engine + mentions surface (K1/K2/K6
// acceptance): a real person and task render through their templates against
// this seam, relation chips resolve to these objects, and the mention
// candidates drive the confirm/dismiss round trip. Types are the seam's
// canonical dash form.
const DOMAIN = [
  {
    id: 'org-braintrust',
    type: 'org',
    properties: { title: 'Braintrust', kind: 'org' },
    relations: {},
  },
  {
    id: 'project-porchfest',
    type: 'project',
    properties: { title: 'PorchFest 2026', kind: 'project', status: 'active' },
    relations: {},
  },
  {
    id: 'skill-rust',
    type: 'skill',
    properties: { title: 'Rust', kind: 'skill' },
    relations: {},
  },
  {
    id: 'person-ada',
    type: 'person',
    properties: {
      title: 'Ada Lovelace',
      kind: 'person',
      role: 'Analyst',
      email: 'ada@example.test',
      location: 'London',
      aliases: ['Countess of Lovelace'],
    },
    relations: {
      WORKS_AT: ['org-braintrust'],
      HAS_SKILL: ['skill-rust'],
      IN_PROJECT: ['project-porchfest'],
    },
  },
  {
    id: 'task-report',
    type: 'task',
    properties: {
      title: 'Send the compliance report',
      kind: 'task',
      status: 'open',
      priority: 'high',
      due: '2026-07-21',
      progress: 40,
    },
    relations: { IN_PROJECT: ['project-porchfest'] },
  },
];

const MENTION_CANDIDATES_SEED = [
  {
    id: 'mention:person-ada:rec-1:ada-lovelace',
    type: 'mention-candidate',
    properties: {
      title: 'Ada Lovelace in rec-1',
      object_id: 'person-ada',
      atom_id: 'rec-1',
      matched_alias: 'Ada Lovelace',
      tier: 'exact',
      status: 'unlinked',
      snippet: 'Filed after the sync: Ada Lovelace flagged the setback distance.',
      snippet_start: 22,
      snippet_end: 34,
    },
    relations: {},
  },
  {
    id: 'mention:person-ada:rec-2:countess-of-lovelace',
    type: 'mention-candidate',
    properties: {
      title: 'Countess of Lovelace in rec-2',
      object_id: 'person-ada',
      atom_id: 'rec-2',
      matched_alias: 'Countess of Lovelace',
      tier: 'normalized',
      status: 'unlinked',
      snippet: 'The countess of lovelace annotated the memoir margins.',
      snippet_start: 4,
      snippet_end: 24,
    },
    relations: {},
  },
];

function cloneMentionCandidates() {
  return MENTION_CANDIDATES_SEED.map((entry) => ({
    ...entry,
    properties: { ...entry.properties },
    relations: { ...entry.relations },
  }));
}

const DOCS = [
  {
    id: 'doc-console-brief',
    type: 'doc',
    properties: {
      slug: 'console-brief',
      title: 'The harness console',
      markdown:
        '# The harness console\n\nImagine Cursor had forked IntelliJ instead of VS Code, with sidebars that show code and markdown as easily as they show data models.\n\n## The mechanism\n\nThe chrome outside is Int UI: tool window stripes down the edges, a sunken editor well, a main toolbar with a run widget, a status bar.\n',
    },
    relations: {},
  },
  {
    id: 'doc-console-punch-list',
    type: 'doc',
    properties: {
      slug: 'console-punch-list',
      title: 'Console punch list',
      markdown:
        '# Console punch list\n\nWorking notes for the console itself. Each todo carries the action affordance.\n\n## Open items\n\n- [ ] Wire the destination rail to live connector counts\n- [ ] Capture a fresh visual baseline after the card engine lands\n- [x] Point the record table at the deployed object seam\n',
    },
    relations: {},
  },
];

const CODE_FILES = [
  {
    id: 'code-surface-tree',
    type: 'code-file',
    properties: {
      path: 'packages/block-view/src/surface-tree.ts',
      language: 'typescript',
      content: "export const CONTAINS_EDGE = 'CONTAINS';\n",
    },
    relations: {},
  },
];

const HUNKS = [
  {
    id: 'hunk-agent-run',
    type: 'hunk',
    properties: {
      hunk_id: 'agent-run:proposal', source: 'agent_run', state: { kind: 'proposed', actions: [] },
      target_block: 'block:proposal', before_ref: 'value:proposal:before', after_ref: 'value:proposal:after',
      before_text: 'status: draft\nowner: theorem', after_text: 'status: reviewed\nowner: theorem',
      derivation_refs: ['derivation:run:1'], discharge: { kind: 'deterministic' }, group_id: 'run:current',
      title: 'Promote proposal status', capability_class: 'proposal.write',
      semiring: { supported: true, independent_lines: 1, weakest_link: '0.93', confidence: 0.93 },
    },
  },
  {
    id: 'hunk-briefing',
    type: 'hunk',
    properties: {
      hunk_id: 'briefing:today', source: 'briefing', state: { kind: 'proposed', actions: [] },
      target_block: 'briefing:today', before_ref: 'value:briefing:empty', after_ref: 'value:briefing:item',
      before_text: '# Today\n', after_text: '# Today\n\n- Review the object-seam receipts.',
      derivation_refs: ['derivation:briefing:1', 'derivation:briefing:2'], discharge: { kind: 'deterministic' }, group_id: 'briefing:today',
      title: 'Add the morning review item', capability_class: 'briefing.publish',
      semiring: { supported: true, independent_lines: 2, weakest_link: '0.88', confidence: 0.91 },
    },
  },
  {
    id: 'hunk-recalc',
    type: 'hunk',
    properties: {
      hunk_id: 'recalc:standing', source: 'recalc', state: { kind: 'proposed', actions: [] }, model_authored: true,
      target_block: 'belief:standing', before_ref: 'value:belief:before', after_ref: 'value:belief:after',
      before_text: 'standing: probable', after_text: 'standing: accepted',
      derivation_refs: ['derivation:recalc:1', 'why:standing'], discharge: { kind: 'undischarged' }, group_id: 'recalc:belief:standing',
      title: 'Re-derived standing', capability_class: 'belief.revise',
      semiring: { supported: true, independent_lines: 2, weakest_link: 'unverified model edge', confidence: 0.67 },
    },
  },
  {
    id: 'hunk-install',
    type: 'hunk',
    properties: {
      hunk_id: 'install:grant', source: 'app_install', state: { kind: 'proposed', actions: [] },
      target_block: 'grant:objects.write', after_ref: 'value:grant:preview',
      derivation_refs: [], discharge: { kind: 'deterministic' }, group_id: 'install:grants',
      title: 'Capability grant · objects.write', capability_class: 'app.install',
      semiring: { supported: false, independent_lines: 0 },
    },
  },
  {
    id: 'hunk-schema',
    type: 'hunk',
    properties: {
      hunk_id: 'schema:claim', source: 'schema_draft', state: { kind: 'proposed', actions: [] },
      target_block: 'shape:claim', before_ref: 'value:shape:before', after_ref: 'value:shape:after',
      before_text: 'fields: [title]', after_text: 'fields: [title, provenance]',
      derivation_refs: ['derivation:schema:1'], discharge: { kind: 'discharged', verify_ref: 'verification:42' }, group_id: 'schema:draft',
      title: 'Add provenance to Claim', capability_class: 'schema.publish',
      semiring: { supported: true, independent_lines: 1, weakest_link: 'verification:42', confidence: 1 },
    },
  },
];

const CANVAS_GRAPH_FIXTURE = {
  id: 'canvas.default',
  title: 'Evidence synthesis',
  tenant: 'Travis-Gilbert',
  placements: [
    {
      canvasId: 'canvas.default',
      objectId: 'canvas.card-observe',
      x: 80,
      y: 80,
      width: 240,
      height: 120,
    },
    {
      canvasId: 'canvas.default',
      objectId: 'canvas.card-connect',
      x: 420,
      y: 250,
      width: 240,
      height: 120,
    },
    {
      canvasId: 'canvas.default',
      objectId: 'canvas.card-verify',
      x: 760,
      y: 80,
      width: 240,
      height: 120,
    },
  ],
  groups: [],
  objects: [
    {
      id: 'canvas.card-observe',
      type: 'note',
      title: 'Observe the source',
      text: 'Read the repository state and preserve the evidence boundary.',
    },
    {
      id: 'canvas.card-connect',
      type: 'url',
      title: 'Connect the claim',
      text: 'Relate the grounded source to the working conclusion.',
    },
    {
      id: 'canvas.card-verify',
      type: 'file',
      title: 'Verify the result',
      text: 'Hold the final statement against deterministic proof.',
    },
  ],
  connections: [
    {
      id: 'canvas.connection-observe-connect',
      canvasId: 'canvas.default',
      fromObjectId: 'canvas.card-observe',
      toObjectId: 'canvas.card-connect',
      label: 'grounds',
    },
    {
      id: 'canvas.connection-connect-verify',
      canvasId: 'canvas.default',
      fromObjectId: 'canvas.card-connect',
      toObjectId: 'canvas.card-verify',
      label: 'supports',
    },
  ],
};

const INSPECTOR_CANVAS_GRAPH_FIXTURE = {
  id: 'canvas.inspector.rail',
  title: 'Inspector canvas',
  tenant: 'Travis-Gilbert',
  placements: [],
  groups: [],
  objects: [],
  connections: [],
};

const CANVAS_FIXTURE = [
  {
    id: 'canvas.default',
    type: 'canvas',
    properties: {
      title: CANVAS_GRAPH_FIXTURE.title,
      tenant: CANVAS_GRAPH_FIXTURE.tenant,
      persistence_kind: 'canvas-work-v1',
      graph: CANVAS_GRAPH_FIXTURE,
    },
    relations: {},
  },
  {
    id: 'canvas.inspector.rail',
    type: 'canvas',
    properties: {
      title: INSPECTOR_CANVAS_GRAPH_FIXTURE.title,
      tenant: INSPECTOR_CANVAS_GRAPH_FIXTURE.tenant,
      persistence_kind: 'canvas-work-v1',
      graph: INSPECTOR_CANVAS_GRAPH_FIXTURE,
    },
    relations: {},
  },
];
const LAYOUT_TYPES = new Set(['surface', 'region', 'view-instance']);
const RESETTABLE_STATE_TYPES = new Set([...LAYOUT_TYPES, 'proactivity-structure']);
const POOLS = new Map([
  ['record', RECORDS],
  ['person', DOMAIN.filter((o) => o.type === 'person')],
  ['task', DOMAIN.filter((o) => o.type === 'task')],
  ['org', DOMAIN.filter((o) => o.type === 'org')],
  ['project', DOMAIN.filter((o) => o.type === 'project')],
  ['skill', DOMAIN.filter((o) => o.type === 'skill')],
  ['mention-candidate', cloneMentionCandidates()],
  ['doc', DOCS],
  ['code-file', CODE_FILES],
  ['hunk', HUNKS],
  ['canvas', CANVAS_FIXTURE],
  ['chat-project', []],
  ['chat-catalog', []],
  ['chat-thread', []],
  ['search-session-origin', []],
  ['proactivity-structure', []],
  // B6 / sidebar acceptance: layout write-through and cleared-cache restore.
  ['surface', []],
  ['region', []],
  ['view-instance', []],
]);

/** Every stored object across pools, for id-keyed update. */
function allStored() {
  return [...POOLS.values()].flat();
}

function resetLayoutPools() {
  for (const type of RESETTABLE_STATE_TYPES) {
    const pool = POOLS.get(type);
    if (pool) pool.length = 0;
  }
}

/** Restore mutable domain fixtures (mention confirm/dismiss) to seed status. */
function resetDomainPools() {
  POOLS.set('mention-candidate', cloneMentionCandidates());
}
function upsertLayoutObject(type, id, properties) {
  const pool = POOLS.get(type);
  if (!pool) return null;
  const index = pool.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    pool[index] = {
      ...pool[index],
      properties: { ...properties },
      relations: pool[index].relations ?? { CONTAINS: [] },
    };
    return pool[index];
  }
  const created = { id, type, properties: { ...properties }, relations: { CONTAINS: [] } };
  pool.push(created);
  return created;
}

function applyMove(action) {
  const target = allStored().find((entry) => entry.id === action.id);
  const parent = allStored().find((entry) => entry.id === action.new_parent);
  if (!target || !parent) return false;
  for (const entry of allStored()) {
    if (!Array.isArray(entry.relations?.CONTAINS)) continue;
    entry.relations.CONTAINS = entry.relations.CONTAINS.filter((childId) => childId !== action.id);
  }
  if (!parent.relations) parent.relations = { CONTAINS: [] };
  if (!Array.isArray(parent.relations.CONTAINS)) parent.relations.CONTAINS = [];
  // Server CONTAINS order is 1-based fractional rank; convert to splice index.
  const order = Math.max(0, Math.min((Number(action.order) || 1) - 1, parent.relations.CONTAINS.length));
  parent.relations.CONTAINS.splice(order, 0, action.id);
  return true;
}

function poolFor(types) {
  const requested = Array.isArray(types) && types.length > 0 ? types : ['record'];
  const objects = [];
  const seen = new Set();
  for (const type of requested) {
    for (const object of POOLS.get(type) ?? []) {
      if (!seen.has(object.id)) {
        seen.add(object.id);
        objects.push(object);
      }
    }
  }
  return objects;
}
function matches(object, predicate) {
  if (!predicate) return true;
  switch (predicate.kind) {
    case 'eq':
      if (predicate.field === 'id') {
        return object.id === predicate.value || object.properties.id === predicate.value;
      }
      return object.properties[predicate.field] === predicate.value;
    case 'contains': {
      const value = object.properties[predicate.field];
      return typeof value === 'string' && typeof predicate.value === 'string'
        ? value.toLowerCase().includes(predicate.value.toLowerCase())
        : Array.isArray(value) && value.includes(predicate.value);
    }
    case 'and':
      return predicate.all.every((inner) => matches(object, inner));
    case 'or':
      return predicate.any.some((inner) => matches(object, inner));
    default:
      return true;
  }
}

function runQuery(query) {
  let objects = poolFor(query.types).filter((object) => matches(object, query.where));
  const ranker = query.rank?.[0];
  if (ranker?.kind === 'field') {
    const direction = ranker.direction === 'desc' ? -1 : 1;
    objects = [...objects].sort((a, b) =>
      direction * String(a.properties[ranker.field] ?? '').localeCompare(String(b.properties[ranker.field] ?? '')),
    );
  }
  let nextCursor;
  if (query.page) {
    const offset = query.page.cursor ? Number.parseInt(query.page.cursor, 10) || 0 : 0;
    const end = offset + query.page.limit;
    if (end < objects.length) nextCursor = String(end);
    objects = objects.slice(offset, end);
  }
  const isLayout = (query.types ?? []).some((type) => LAYOUT_TYPES.has(type));
  return {
    objects,
    shape: {
      types: query.types?.includes('hunk') ? ['hunk'] : isLayout ? [...(query.types ?? [])] : ['record'],
      fields: query.types?.includes('hunk')
        ? ['hunk_id', 'source', 'state', 'target_block', 'after_ref', 'derivation_refs', 'discharge', 'group_id']
        : isLayout
          ? ['title', 'name', 'kind', 'descriptor_id', 'collapsed', 'active', 'stripe_order']
          : ['title', 'kind', 'status', 'updated', 'tags'],
      relations: isLayout ? ['CONTAINS'] : [],
      axes: {},
      cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
    },
    next_cursor: nextCursor,
    note: 'stub data api (e2e fixture)',
  };
}

function graphqlFixture(query, variables, tenant) {
  if (query.includes('ConsoleObservedAndDeclaredModel')) {
    return {
      data: {
        observedModel: {
          eventCount: 0,
          types: [],
          sources: [],
        },
        declaredModel: {
          objectTypes: [],
          views: [],
          versions: [],
          divergences: [],
        },
      },
    };
  }
  if (query.includes('CommonPlaceConsolePluginState')) {
    const installed = pluginState(tenant) === 'installed' ? [installedPlugin()] : [];
    return { data: { installedApps: installed, pendingApps: [] } };
  }
  if (query.includes('ConsentCommonPlaceConsole')) {
    CONSOLE_PLUGIN_STATES.set(tenant, 'installed');
    return {
      data: {
        consentApp: {
          appId: 'commonplace.console',
          toolsAdded: [],
          seedsCreated: [],
          contributions: [pluginContribution()],
          grants: ['corpus:read'],
        },
      },
    };
  }
  if (query.includes('DenyCommonPlaceConsole')) {
    CONSOLE_PLUGIN_STATES.set(tenant, 'denied');
    return {
      data: {
        denyApp: {
          appId: 'commonplace.console',
          draftNodeId: 'fixture:commonplace.console',
          draftRemoved: true,
          contributionsRemoved: 1,
          grantsDeclined: ['corpus:read'],
        },
      },
    };
  }
  if (query.includes('UninstallCommonPlaceConsole')) {
    CONSOLE_PLUGIN_STATES.set(tenant, 'available');
    return {
      data: {
        uninstallApp: {
          appId: 'commonplace.console',
          toolsRemoved: [],
          seedsTombstoned: [],
          contributionsRemoved: 1,
        },
      },
    };
  }
  if (query.includes('CommonPlaceConsoleSnapshot')) {
    return pluginState(tenant) === 'installed'
      ? { data: consoleGraphqlProjection(variables) }
      : { errors: [{ message: 'corpus_read_grant_required' }] };
  }
  if (query.includes('itemsByKind')) {
    return { data: { itemsByKind: MEMORIES } };
  }
  return { errors: [{ message: 'unsupported query' }] };
}

const server = createServer((request, response) => {
  const key = request.headers['x-api-key'];
  const authorization = request.headers.authorization;
  const fixtureCredential = process.env.STUB_DATA_API_KEY ?? 'dev-key';
  if (key !== fixtureCredential && authorization !== `Bearer ${fixtureCredential}`) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'forbidden' }));
    return;
  }
  if (request.method === 'GET' && request.url === '/capabilities') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ web_search: WEB_SEARCH_ENABLED }));
    return;
  }
  if (request.method === 'GET' && request.url === '/objects/views') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('[]');
    return;
  }
  if (request.method === 'POST' && request.url === '/objects/test/reset-layout') {
    resetLayoutPools();
    resetDomainPools();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, note: 'layout pools cleared' }));
    return;
  }
  if (request.method === 'POST' && request.url === '/objects/test/reset-domain') {
    resetDomainPools();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, note: 'domain fixtures restored' }));
    return;
  }
  if (request.method === 'POST' && request.url === '/objects/test/reset-console-plugin') {
    CONSOLE_PLUGIN_STATES.clear();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, note: 'console plugin state cleared' }));
    return;
  }
  if (request.url === '/mcp') {
    if (!request.headers['x-theorem-tenant']) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'missing_mcp_tenant' }));
      return;
    }
    if (request.method === 'DELETE') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST, DELETE' });
      response.end();
      return;
    }
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        const rpc = JSON.parse(body);
        if (rpc.method === 'initialize') {
          const requestedVersion = rpc.params?.protocolVersion;
          response.writeHead(200, {
            'Content-Type': 'application/json',
            'MCP-Session-Id': MCP_SESSION_ID,
          });
          response.end(JSON.stringify({
            jsonrpc: '2.0',
            id: rpc.id ?? null,
            result: {
              protocolVersion: typeof requestedVersion === 'string'
                ? requestedVersion
                : MCP_PROTOCOL_VERSION,
              capabilities: {},
              serverInfo: { name: 'commonplace-e2e-harness', version: '1' },
            },
          }));
          return;
        }
        if (rpc.method === 'notifications/initialized') {
          if (request.headers['mcp-session-id'] !== MCP_SESSION_ID) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'unknown_mcp_session' }));
            return;
          }
          response.writeHead(202);
          response.end();
          return;
        }
        const name = rpc.params?.name;
        const query = rpc.params?.arguments?.query;
        if (
          rpc.method !== 'tools/call'
          || request.headers['mcp-session-id'] !== MCP_SESSION_ID
          || (name !== 'graphql_query' && name !== 'graphql_mutate')
          || typeof query !== 'string'
        ) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({
            jsonrpc: '2.0',
            id: rpc.id ?? null,
            error: { code: -32602, message: 'unsupported fixture tool call' },
          }));
          return;
        }
        const tenant = String(request.headers['x-theorem-tenant']);
        const variables = rpc.params?.arguments?.variables ?? {};
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          jsonrpc: '2.0',
          id: rpc.id ?? null,
          result: {
            structuredContent: graphqlFixture(query, variables, tenant),
          },
        }));
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
      }
    });
    return;
  }
  if (request.method === 'POST' && request.url === '/graphql') {
    if (!request.headers['x-theorem-tenant']) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'missing_mcp_tenant' }));
      return;
    }
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const tenant = String(request.headers['x-theorem-tenant']);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(
          graphqlFixture(String(payload.query ?? ''), payload.variables ?? {}, tenant),
        ));
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
      }
    });
    return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/v1/items/stream?tenant=')) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(': tenant-filtered changefeed connected\n\n');
    request.on('close', () => response.end());
    return;
  }
  if (request.method === 'POST' && (request.url === '/objects/query' || request.url === '/objects/action')) {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        if (request.url === '/objects/action') {
          const action = JSON.parse(body);
          // Update applies in place across every pool (mention confirm/dismiss
          // K6, and persisted document/code edits): the surface's refetch sees
          // the transition.
          if (action.kind === 'update') {
            const target = allStored().find((entry) => entry.id === action.id);
            if (target) {
              target.properties = { ...target.properties, ...action.patch };
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(
                JSON.stringify({ action_kind: 'update', status: 'applied', target_ids: [action.id] }),
              );
              return;
            }
            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({ action_kind: 'update', status: 'rejected', error: 'target_not_found' }),
            );
            return;
          }
          // Create appends to the type's pool (the seed-content path); ids are
          // deterministic for stable captures. Layout creates may carry an
          // explicit props.id so B6 pushLayoutToServer round-trips.
          if (action.kind === 'create') {
            if (POOLS.has(action.type)) {
              const pool = POOLS.get(action.type);
              const id = typeof action.props?.id === 'string'
                ? action.props.id
                : `${action.type}-${pool.length + 1}`;
              const { id: _ignored, ...properties } = action.props ?? {};
              if (LAYOUT_TYPES.has(action.type)) {
                upsertLayoutObject(action.type, id, properties);
              } else {
                pool.push({ id, type: action.type, properties: { ...properties }, relations: {} });
              }
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(
                JSON.stringify({ action_kind: 'create', status: 'applied', target_ids: [id] }),
              );
              return;
            }
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({ action_kind: 'create', status: 'rejected', error: 'unsupported_type' }),
            );
            return;
          }
          if (action.kind === 'move') {
            const applied = applyMove(action);
            response.writeHead(applied ? 200 : 404, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({
                action_kind: 'move',
                status: applied ? 'applied' : 'rejected',
                target_ids: applied ? [action.id] : [],
                error: applied ? undefined : 'move_target_missing',
              }),
            );
            return;
          }
          if (action.kind === 'delete') {
            const target = allStored().find((entry) => entry.id === action.id);
            if (target && POOLS.has(target.type)) {
              const pool = POOLS.get(target.type);
              const index = pool.findIndex((entry) => entry.id === action.id);
              if (index >= 0) pool.splice(index, 1);
              for (const entry of allStored()) {
                if (!Array.isArray(entry.relations?.CONTAINS)) continue;
                entry.relations.CONTAINS = entry.relations.CONTAINS.filter((childId) => childId !== action.id);
              }
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(
                JSON.stringify({ action_kind: 'delete', status: 'applied', target_ids: [action.id] }),
              );
              return;
            }
            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({ action_kind: 'delete', status: 'rejected', error: 'target_not_found' }),
            );
            return;
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ action_kind: action.kind, status: 'accepted' }));
          return;
        }
        const result = runQuery(JSON.parse(body));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(result));
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
      }
    });
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`stub data api listening on ${PORT}`);
});
