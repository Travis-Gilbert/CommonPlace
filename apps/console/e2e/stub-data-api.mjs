// SOURCING: node:http. TEST INFRASTRUCTURE ONLY (R2.1: the record fixture
// lives in tests): a stub object-seam upstream serving the Rust
// commonplace-api wire contract (POST /objects/query, POST /objects/action,
// GET /objects/views) over the deterministic 5000-record fixture, so e2e
// exercises the real browser -> console proxy -> upstream path hermetically.
// The record generator mirrors src/lib/workspace-seed.ts (djb2 + LCG, the
// repo's deterministic PRNG convention) so captures stay stable.

import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_DATA_API_PORT ?? 50591);

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

const MENTION_CANDIDATES = [
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

// Documents and code files ride the live wire now (the file-editing fix), so
// the stub serves them and applies edits in place, exercising the real
// browser -> proxy -> upstream path for persisted document editing.
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

const POOLS = new Map([
  ['record', RECORDS],
  ['person', DOMAIN.filter((o) => o.type === 'person')],
  ['task', DOMAIN.filter((o) => o.type === 'task')],
  ['org', DOMAIN.filter((o) => o.type === 'org')],
  ['project', DOMAIN.filter((o) => o.type === 'project')],
  ['skill', DOMAIN.filter((o) => o.type === 'skill')],
  ['mention-candidate', MENTION_CANDIDATES],
  ['doc', DOCS],
  ['code-file', CODE_FILES],
]);

/** Every stored object across pools, for id-keyed update. */
function allStored() {
  return [...POOLS.values()].flat();
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
  return {
    objects,
    shape: {
      types: ['record'],
      fields: ['title', 'kind', 'status', 'updated', 'tags'],
      relations: [],
      axes: {},
      cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
    },
    next_cursor: nextCursor,
    note: 'stub data api (e2e fixture)',
  };
}

const server = createServer((request, response) => {
  const key = request.headers['x-api-key'];
  if (key !== (process.env.STUB_DATA_API_KEY ?? 'dev-key')) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'forbidden' }));
    return;
  }
  if (request.method === 'GET' && request.url === '/objects/views') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('[]');
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
          }
          // Create appends to the type's pool (the seed-content path); ids are
          // deterministic for stable captures.
          if (action.kind === 'create' && POOLS.has(action.type)) {
            const pool = POOLS.get(action.type);
            const id = `${action.type}-${pool.length + 1}`;
            pool.push({ id, type: action.type, properties: { ...action.props }, relations: {} });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({ action_kind: 'create', status: 'applied', target_ids: [id] }),
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
