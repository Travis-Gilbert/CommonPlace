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
  let objects = RECORDS.filter((object) => matches(object, query.where));
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
